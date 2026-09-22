const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { uploadDir, jwtSecret } = require('../config/env');
const authenticateManager = require('../middleware/auth');
const { buildBillNumber, generatePdfFile } = require('../controllers/billingController');
const { buildShares } = require('../controllers/splitBillController');

const router = express.Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token);
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

// --------------------------------------------------------------------------
// MANAGER-ONLY ENDPOINTS (declared before /:id parameter routes)
// --------------------------------------------------------------------------

// List active and recent visits for managers with full round details
router.get('/active', authenticateManager, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT v.id, v.table_id, v.status, v.opened_at, v.bill_requested_at, v.closed_at,
              t.table_number,
              (
                SELECT json_build_object(
                  'id', vb.id,
                  'bill_number', vb.bill_number,
                  'total_amount', vb.total_amount,
                  'subtotal', vb.subtotal,
                  'tax_amount', vb.tax_amount,
                  'created_at', vb.created_at,
                  'revision', vb.revision,
                  'is_active', vb.is_active
                )
                FROM visit_bills vb
                WHERE vb.visit_id = v.id AND vb.is_active = TRUE
                LIMIT 1
              ) AS active_bill,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'id', o.id,
                      'order_number', o.order_number,
                      'customer_name', o.customer_name,
                      'status', o.status,
                      'created_at', o.created_at,
                      'subtotal', o.subtotal,
                      'total_amount', o.total_amount,
                      'items', COALESCE(
                        (
                          SELECT json_agg(
                            json_build_object(
                              'id', oi.id,
                              'name', COALESCE(oi.item_name, mi.name),
                              'variant_label', COALESCE(oi.variant_label, mv.label),
                              'quantity', oi.quantity,
                              'unit_price', oi.unit_price,
                              'line_total', oi.line_total,
                              'is_alcoholic', COALESCE(oi.is_alcoholic, mi.is_alcoholic, FALSE)
                            )
                            ORDER BY oi.created_at
                          )
                          FROM order_items oi
                          LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
                          LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
                          WHERE oi.order_id = o.id
                        ),
                        '[]'::json
                      )
                    )
                    ORDER BY o.created_at ASC
                  )
                  FROM orders o
                  WHERE o.visit_id = v.id
                ),
                '[]'::json
              ) AS orders
       FROM table_visits v
       JOIN restaurant_tables t ON t.id = v.table_id
       WHERE v.status IN ('open', 'bill_requested')
          OR (v.status = 'closed' AND v.closed_at >= NOW() - INTERVAL '24 hours')
       ORDER BY v.opened_at DESC`,
    );

    // Annotate demo visitors sharing Table 1 with an ordinal visit index
    const tableCounts = {};
    const visitsWithLabels = rows.map((v) => {
      tableCounts[v.table_number] = (tableCounts[v.table_number] || 0) + 1;
      const count = tableCounts[v.table_number];
      return {
        ...v,
        visitorLabel: `Table ${v.table_number} · Visit #${count} (${v.id.slice(0, 6)})`,
      };
    });

    res.json({ success: true, data: visitsWithLabels });
  } catch (error) {
    next(error);
  }
});

// Reopen a visit after a final bill was requested (manager only)
// Invalidates the previous bill so an outdated PDF is never served.
router.post('/:id/reopen', authenticateManager, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const visitId = req.params.id;
    if (!UUID_PATTERN.test(visitId)) {
      throw fail(400, 'Invalid visit ID.');
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, status, table_id FROM table_visits WHERE id = $1 FOR UPDATE`,
      [visitId],
    );

    const visit = rows[0];
    if (!visit) {
      throw fail(404, 'Visit not found.');
    }

    if (visit.status === 'closed') {
      throw fail(400, 'Closed visits cannot be reopened. The customer can start a fresh visit.');
    }

    // Invalidate active bill: mark superseded so outdated PDF is not presented
    await client.query(
      `UPDATE visit_bills
       SET is_active = FALSE, status = 'superseded', superseded_at = NOW()
       WHERE visit_id = $1 AND is_active = TRUE`,
      [visitId],
    );

    // Reset visit status to open
    const updated = await client.query(
      `UPDATE table_visits
       SET status = 'open', bill_requested_at = NULL
       WHERE id = $1
       RETURNING id, status, opened_at`,
      [visitId],
    );

    await client.query('COMMIT');

    const io = req.app.locals.io;
    if (io) {
      io.emit('visit_reopened', { visitId: visit.id });
    }

    res.json({ success: true, data: { visit: updated.rows[0] }, message: 'Visit reopened successfully.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    next(error);
  } finally {
    client.release();
  }
});

// Close a visit (manager only)
router.post('/:id/close', authenticateManager, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const visitId = req.params.id;
    if (!UUID_PATTERN.test(visitId)) {
      throw fail(400, 'Invalid visit ID.');
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, status FROM table_visits WHERE id = $1 FOR UPDATE`,
      [visitId],
    );

    const visit = rows[0];
    if (!visit) {
      throw fail(404, 'Visit not found.');
    }

    const updated = await client.query(
      `UPDATE table_visits
       SET status = 'closed', closed_at = NOW()
       WHERE id = $1
       RETURNING id, status, closed_at`,
      [visitId],
    );

    await client.query('COMMIT');

    const io = req.app.locals.io;
    if (io) {
      io.emit('visit_closed', { visitId: visit.id });
    }

    res.json({ success: true, data: { visit: updated.rows[0] }, message: 'Visit closed successfully.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    next(error);
  } finally {
    client.release();
  }
});

// --------------------------------------------------------------------------
// CUSTOMER VISIT ENDPOINTS
// --------------------------------------------------------------------------

// Start a visit, or resume it using the same private token.
router.post('/start', async (req, res, next) => {
  let client;
  try {
    const { tableNumber, visitToken } = req.body;

    if (!Number.isInteger(tableNumber) || tableNumber < 1) {
      throw fail(400, 'A valid table number is required.');
    }

    if (!validToken(visitToken)) {
      throw fail(400, 'A valid visit token is required.');
    }

    client = await db.getClient();
    await client.query('BEGIN');

    const tableResult = await client.query(
      `SELECT id, table_number, status
       FROM restaurant_tables
       WHERE table_number = $1
       FOR UPDATE`,
      [tableNumber]
    );

    const table = tableResult.rows[0];
    if (!table) {
      throw fail(404, 'Table not found.');
    }

    if (table.status === 'out_of_service') {
      throw fail(409, 'This table is currently unavailable.');
    }

    const tokenHash = hashToken(visitToken);

    // Look for an existing open or bill_requested visit belonging to THIS browser token
    const activeResult = await client.query(
      `SELECT id, status, opened_at, access_token_hash
       FROM table_visits
       WHERE table_id = $1
         AND access_token_hash = $2
         AND status IN ('open', 'bill_requested')`,
      [table.id, tokenHash]
    );

    let visit = activeResult.rows[0];
    let created = false;

    if (!visit) {
      // Check if this token belonged to a closed visit
      const previous = await client.query(
        `SELECT id
         FROM table_visits
         WHERE table_id = $1 AND access_token_hash = $2 AND status = 'closed'
         LIMIT 1`,
        [table.id, tokenHash]
      );

      if (previous.rows.length) {
        throw fail(409, 'This visit has ended. Please start a new table visit.');
      }

      // Start new independent visit for this browser
      const inserted = await client.query(
        `INSERT INTO table_visits (table_id, access_token_hash)
         VALUES ($1, $2)
         RETURNING id, status, opened_at`,
        [table.id, tokenHash]
      );

      visit = inserted.rows[0];
      created = true;
    }

    await client.query('COMMIT');

    res.status(created ? 201 : 200).json({
      success: true,
      data: {
        visit: {
          id: visit.id,
          tableNumber: table.table_number,
          status: visit.status,
          openedAt: visit.opened_at,
        },
      },
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => { });
    }
    next(error);
  } finally {
    if (client) client.release();
  }
});

// Retrieve the visit and all its order rounds.
router.get('/:id', async (req, res, next) => {
  try {
    const visitId = req.params.id;
    const token = req.get('X-Visit-Token');

    if (!UUID_PATTERN.test(visitId) || !validToken(token)) {
      throw fail(400, 'Valid visit details are required.');
    }

    const visitResult = await db.query(
      `SELECT v.id, v.status, v.opened_at,
              v.bill_requested_at, v.closed_at,
              t.table_number
       FROM table_visits v
       JOIN restaurant_tables t ON t.id = v.table_id
       WHERE v.id = $1 AND v.access_token_hash = $2`,
      [visitId, hashToken(token)]
    );

    const visit = visitResult.rows[0];
    if (!visit) {
      throw fail(404, 'Visit not found or access denied.');
    }

    const ordersResult = await db.query(
      `SELECT
         o.id,
         o.order_number,
         o.status,
         o.created_at,
         o.subtotal,
         o.total_amount,
         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'id', oi.id,
                 'menu_item_id', oi.menu_item_id,
                 'name', COALESCE(oi.item_name, mi.name),
                 'variant_label', COALESCE(oi.variant_label, mv.label),
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price,
                 'line_total', oi.line_total,
                 'is_alcoholic', COALESCE(oi.is_alcoholic, mi.is_alcoholic, FALSE)
               )
               ORDER BY oi.created_at, oi.id
             )
             FROM order_items oi
             LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
             LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
             WHERE oi.order_id = o.id
           ),
           '[]'::json
         ) AS items
       FROM orders o
       WHERE o.visit_id = $1
       ORDER BY o.created_at, o.id`,
      [visitId]
    );

    const activeBillResult = await db.query(
      `SELECT id, bill_number, food_subtotal, alcohol_subtotal, subtotal,
              cgst_rate, sgst_rate, vat_rate, cgst_amount, sgst_amount, vat_amount,
              tax_amount, discount_amount, total_amount, items_snapshot,
              status, is_active, revision, created_at
       FROM visit_bills
       WHERE visit_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [visitId]
    );

    const feedbackResult = await db.query(
      `SELECT id, rating, comment, recommend, created_at
       FROM visit_feedback
       WHERE visit_id = $1
       LIMIT 1`,
      [visitId]
    );

    res.json({
      success: true,
      data: {
        visit,
        orders: ordersResult.rows,
        activeBill: activeBillResult.rows[0] || null,
        feedback: feedbackResult.rows[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Finalize and combine all non-cancelled rounds into one final bill.
// Shared visit lock ensures repeated/concurrent requests return the same bill.
router.post('/:id/bill', async (req, res, next) => {
  const client = await db.getClient();
  try {
    const visitId = req.params.id;
    const token = req.get('X-Visit-Token');

    if (!UUID_PATTERN.test(visitId) || !validToken(token)) {
      throw fail(400, 'Valid visit details are required.');
    }

    await client.query('BEGIN');

    // Shared visit lock serializes order submissions, cancellations, and finalization
    const visitResult = await client.query(
      `SELECT v.id, v.status, v.opened_at, t.table_number
       FROM table_visits v
       JOIN restaurant_tables t ON t.id = v.table_id
       WHERE v.id = $1 AND v.access_token_hash = $2
       FOR UPDATE`,
      [visitId, hashToken(token)]
    );

    const visit = visitResult.rows[0];
    if (!visit) {
      throw fail(403, 'Visit not found or access denied.');
    }

    if (visit.status === 'closed') {
      throw fail(409, 'This visit has ended. Please start a new table visit.');
    }

    // Repeated/concurrent finalization requests must return the same current bill
    const existingBillResult = await client.query(
      `SELECT id, bill_number, food_subtotal, alcohol_subtotal, subtotal,
              cgst_rate, sgst_rate, vat_rate, cgst_amount, sgst_amount, vat_amount,
              tax_amount, discount_amount, total_amount, items_snapshot,
              status, is_active, revision, created_at
       FROM visit_bills
       WHERE visit_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [visitId]
    );

    if (existingBillResult.rows[0]) {
      await client.query('COMMIT');
      return res.status(200).json({
        success: true,
        data: {
          bill: existingBillResult.rows[0],
          replayed: true,
          tableNumber: visit.table_number,
        },
      });
    }

    // Combine all non-cancelled rounds from the visit
    const ordersResult = await client.query(
      `SELECT id, order_number, status, created_at
       FROM orders
       WHERE visit_id = $1 AND status != 'cancelled'
       ORDER BY created_at ASC
       FOR UPDATE`,
      [visitId]
    );

    if (!ordersResult.rows.length) {
      throw fail(400, 'There are no active orders to bill for this visit.');
    }

    // Collect all order items from non-cancelled rounds
    const itemsResult = await client.query(
      `SELECT oi.id, oi.menu_item_id, oi.variant_id, oi.quantity, oi.unit_price, oi.line_total,
              COALESCE(oi.item_name, mi.name) AS name,
              COALESCE(oi.variant_label, mv.label) AS variant_label,
              COALESCE(oi.is_alcoholic, mi.is_alcoholic, FALSE) AS is_alcoholic,
              o.order_number
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
       WHERE o.visit_id = $1 AND o.status != 'cancelled'
       ORDER BY o.created_at ASC, oi.created_at ASC`,
      [visitId]
    );

    const items = itemsResult.rows;

    // Calculate taxes on combined applicable subtotals (rather than summing rounded per-round taxes)
    const foodSubtotal = round2(
      items
        .filter((i) => !i.is_alcoholic)
        .reduce((sum, i) => sum + Number(i.line_total), 0)
    );
    const alcoholSubtotal = round2(
      items
        .filter((i) => i.is_alcoholic)
        .reduce((sum, i) => sum + Number(i.line_total), 0)
    );
    const subtotal = round2(foodSubtotal + alcoholSubtotal);

    const cgstRate = 2.5;
    const sgstRate = 2.5;
    const vatRate = 10.0;

    const cgstAmount = round2(foodSubtotal * (cgstRate / 100));
    const sgstAmount = round2(foodSubtotal * (sgstRate / 100));
    const vatAmount = round2(alcoholSubtotal * (vatRate / 100));
    const taxAmount = round2(cgstAmount + sgstAmount + vatAmount);
    const totalAmount = round2(subtotal + taxAmount);

    const itemsSnapshot = items.map((i) => ({
      id: i.id,
      menuItemId: i.menu_item_id,
      variantId: i.variant_id,
      name: i.name,
      variantLabel: i.variant_label,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      isAlcoholic: Boolean(i.is_alcoholic),
      orderNumber: i.order_number,
    }));

    // Find next revision number
    const revResult = await client.query(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS next_rev FROM visit_bills WHERE visit_id = $1`,
      [visitId]
    );
    const revision = Number(revResult.rows[0].next_rev || 1);

    const billNumber = buildBillNumber();

    const insertedBill = await client.query(
      `INSERT INTO visit_bills (
         visit_id, bill_number, food_subtotal, alcohol_subtotal, subtotal,
         cgst_rate, sgst_rate, vat_rate,
         cgst_amount, sgst_amount, vat_amount, tax_amount,
         discount_amount, total_amount, items_snapshot,
         status, is_active, revision
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, $13, $14, 'active', TRUE, $15)
       RETURNING *`,
      [
        visitId,
        billNumber,
        foodSubtotal,
        alcoholSubtotal,
        subtotal,
        cgstRate,
        sgstRate,
        vatRate,
        cgstAmount,
        sgstAmount,
        vatAmount,
        taxAmount,
        totalAmount,
        JSON.stringify(itemsSnapshot),
        revision,
      ]
    );

    // Update visit status to bill_requested
    await client.query(
      `UPDATE table_visits
       SET status = 'bill_requested', bill_requested_at = NOW()
       WHERE id = $1`,
      [visitId]
    );

    await client.query('COMMIT');

    const bill = insertedBill.rows[0];

    // Emit live update to manager
    const io = req.app.locals.io;
    if (io) {
      io.emit('bill_requested', {
        visitId,
        tableNumber: visit.table_number,
        billNumber: bill.bill_number,
        totalAmount: bill.total_amount,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        bill,
        tableNumber: visit.table_number,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    next(error);
  } finally {
    client.release();
  }
});

// Protected PDF download for visit bill
// Regenerates PDF on demand from snapshot if not cached.
router.get('/:id/bill/pdf', async (req, res, next) => {
  try {
    const visitId = req.params.id;
    if (!UUID_PATTERN.test(visitId)) {
      throw fail(400, 'Invalid visit ID.');
    }

    const visitToken = req.get('X-Visit-Token');
    const authHeader = req.get('Authorization');

    let authorized = false;

    // 1. Check customer visit token
    if (validToken(visitToken)) {
      const visitRes = await db.query(
        `SELECT id FROM table_visits WHERE id = $1 AND access_token_hash = $2`,
        [visitId, hashToken(visitToken)]
      );
      if (visitRes.rows[0]) authorized = true;
    }

    // 2. Or check manager authentication
    if (!authorized && authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, jwtSecret);
        authorized = true;
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      throw fail(403, 'Access denied. Valid visit token or manager authorization required.');
    }

    const billRes = await db.query(
      `SELECT vb.*, t.table_number
       FROM visit_bills vb
       JOIN table_visits tv ON tv.id = vb.visit_id
       JOIN restaurant_tables t ON t.id = tv.table_id
       WHERE vb.visit_id = $1 AND vb.is_active = TRUE
       LIMIT 1`,
      [visitId]
    );

    const bill = billRes.rows[0];
    if (!bill) {
      throw fail(404, 'No active bill found for this visit.');
    }

    const privateBillsDir = path.join(__dirname, '..', 'private-bills');
    fs.mkdirSync(privateBillsDir, { recursive: true });
    const billPath = path.join(privateBillsDir, `${bill.bill_number}.pdf`);

    // Regenerate from snapshot if file doesn't exist
    if (!fs.existsSync(billPath)) {
      const rawSnapshot = bill.items_snapshot;
      const items = Array.isArray(rawSnapshot) ? rawSnapshot : (JSON.parse(rawSnapshot || '[]'));

      await generatePdfFile(billPath, {
        restaurantName: 'Hotel Sea Palace',
        billNumber: bill.bill_number,
        tableNumber: bill.table_number,
        order: {
          created_at: bill.created_at,
          order_number: bill.bill_number,
          customer_name: `Table ${bill.table_number}`,
          food_subtotal: bill.food_subtotal,
          alcohol_subtotal: bill.alcohol_subtotal,
          cgst_amount: bill.cgst_amount,
          sgst_amount: bill.sgst_amount,
          vat_amount: bill.vat_amount,
          total_amount: bill.total_amount,
          payment_status: 'unpaid',
        },
        items: items.map((it) => ({
          name: it.name,
          variant_label: it.variantLabel || it.variant_label,
          quantity: it.quantity,
          unit_price: it.unitPrice || it.unit_price,
          line_total: it.lineTotal || it.line_total,
        })),
      });
    }

    res.download(billPath, `Invoice-${bill.bill_number}.pdf`);
  } catch (error) {
    next(error);
  }
});

// Visit-based feedback
router.post('/:id/feedback', async (req, res, next) => {
  try {
    const visitId = req.params.id;
    const token = req.get('X-Visit-Token');
    const { rating, comment, recommend } = req.body;

    if (!UUID_PATTERN.test(visitId) || !validToken(token)) {
      throw fail(400, 'Valid visit details are required.');
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw fail(400, 'Rating must be an integer between 1 and 5.');
    }

    const visitRes = await db.query(
      `SELECT id FROM table_visits WHERE id = $1 AND access_token_hash = $2`,
      [visitId, hashToken(token)]
    );

    if (!visitRes.rows[0]) {
      throw fail(403, 'Visit not found or access denied.');
    }

    const { rows } = await db.query(
      `INSERT INTO visit_feedback (visit_id, rating, comment, recommend)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (visit_id) DO UPDATE
         SET rating = EXCLUDED.rating,
             comment = EXCLUDED.comment,
             recommend = EXCLUDED.recommend
       RETURNING id, visit_id, rating, comment, recommend, created_at`,
      [visitId, numRating, comment ? String(comment).trim() : null, recommend !== undefined ? Boolean(recommend) : null]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

// Bill splitting for the visit's final bill
router.post('/:id/split-bill', async (req, res, next) => {
  try {
    const visitId = req.params.id;
    const token = req.get('X-Visit-Token');
    const { people, assignments } = req.body;

    if (!UUID_PATTERN.test(visitId) || !validToken(token)) {
      throw fail(400, 'Valid visit details are required.');
    }

    if (!Array.isArray(people) || people.length === 0) {
      throw fail(400, 'At least one person is required.');
    }

    const visitRes = await db.query(
      `SELECT id FROM table_visits WHERE id = $1 AND access_token_hash = $2`,
      [visitId, hashToken(token)]
    );

    if (!visitRes.rows[0]) {
      throw fail(403, 'Visit not found or access denied.');
    }

    const billRes = await db.query(
      `SELECT * FROM visit_bills WHERE visit_id = $1 AND is_active = TRUE LIMIT 1`,
      [visitId]
    );
    const bill = billRes.rows[0];

    let items;
    let subtotal;
    let taxAmount;
    let totalAmount;
    let billId = null;

    if (bill) {
      billId = bill.id;
      const rawSnapshot = bill.items_snapshot;
      items = Array.isArray(rawSnapshot) ? rawSnapshot : JSON.parse(rawSnapshot || '[]');
      subtotal = Number(bill.subtotal);
      taxAmount = Number(bill.tax_amount);
      totalAmount = Number(bill.total_amount);
    } else {
      // Preview mode: calculate across all submitted non-cancelled orders in this visit
      const itemsRes = await db.query(
        `SELECT oi.id, oi.menu_item_id, oi.variant_id,
                COALESCE(oi.item_name, mi.name) AS name,
                COALESCE(oi.variant_label, miv.label) AS variant_label,
                oi.quantity, oi.unit_price, oi.line_total,
                COALESCE(oi.is_alcoholic, mi.is_alcoholic, FALSE) AS is_alcoholic,
                o.order_number
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
         LEFT JOIN menu_item_variants miv ON miv.id = oi.variant_id
         WHERE o.visit_id = $1 AND o.status != 'cancelled'
         ORDER BY o.created_at ASC, oi.id ASC`,
        [visitId]
      );

      if (itemsRes.rows.length === 0) {
        throw fail(400, 'No submitted non-cancelled orders found to split.');
      }

      items = itemsRes.rows;
      const foodSubtotal = round2(
        items.filter((i) => !i.is_alcoholic).reduce((sum, i) => sum + Number(i.line_total), 0)
      );
      const alcoholSubtotal = round2(
        items.filter((i) => i.is_alcoholic).reduce((sum, i) => sum + Number(i.line_total), 0)
      );
      subtotal = round2(foodSubtotal + alcoholSubtotal);
      const cgstAmount = round2(foodSubtotal * 0.025);
      const sgstAmount = round2(foodSubtotal * 0.025);
      const vatAmount = round2(alcoholSubtotal * 0.10);
      taxAmount = round2(cgstAmount + sgstAmount + vatAmount);
      totalAmount = round2(subtotal + taxAmount);
    }

    const normalizedPeople = people.map((p, index) => ({
      clientId: p.clientId ?? p.id ?? index,
      name: (p.name || `Person ${index + 1}`).toString().trim().slice(0, 150) || `Person ${index + 1}`,
    }));

    const orderItems = items.map((it) => ({
      id: String(it.id || it.menuItemId || it.menu_item_id),
      line_total: it.lineTotal ?? it.line_total,
    }));

    const normalizedAssignments = {};
    if (assignments && typeof assignments === 'object') {
      for (const [key, val] of Object.entries(assignments)) {
        if (Array.isArray(val)) {
          normalizedAssignments[key] = val;
        }
      }
    }

    const toPaise = (amt) => Math.round(Number(amt) * 100);

    const shares = buildShares({
      people: normalizedPeople,
      orderItems,
      assignments: normalizedAssignments,
      subtotalPaise: toPaise(subtotal),
      taxPaise: toPaise(taxAmount),
      totalPaise: toPaise(totalAmount),
    });

    res.json({
      success: true,
      data: {
        visitId,
        billId,
        isFinalized: Boolean(bill),
        totalAmount,
        people: shares,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;