const db = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CGST_RATE = 0.025;
const SGST_RATE = 0.025;
const VAT_RATE = 0.10;

function buildOrderNumber() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// SECURITY: the client only ever sends `menuItemId`, an optional `variantId`,
// and a `quantity`. It is never trusted to send a price - every unit_price
// and line_total here is looked up from the database inside the same
// transaction that creates the order, so a tampered request body cannot
// change what the guest is charged.
async function placeOrder(req, res, next) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { tableNumber, customerName, items, notes } = req.body;
    const orderNumber = buildOrderNumber();

    // tableNumber is required and validated as a positive integer by
    // placeOrderValidator before this ever runs, so by this point it's a
    // real number - but it still has to match an actual table row, or the
    // order would silently end up with no table attached at all.
    const { rows: tableRows } = await client.query('SELECT id FROM restaurant_tables WHERE table_number = $1', [tableNumber]);
    if (!tableRows[0]) {
      throw Object.assign(new Error(`Table ${tableNumber} does not exist`), { status: 400 });
    }
    const tableId = tableRows[0].id;
    const { visitId, submissionKey } = req.body;
    const visitToken = req.get('X-Visit-Token');

    if (
      !UUID_PATTERN.test(String(visitId || '')) ||
      !UUID_PATTERN.test(String(submissionKey || '')) ||
      typeof visitToken !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(visitToken)
    ) {
      throw Object.assign(
        new Error('Valid visit details are required to submit an order.'),
        { status: 400 }
      );
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(visitToken)
      .digest('hex');

    // Lock the visit so simultaneous submissions are handled in order.
    // Final billing must use this same lock when we add that endpoint.
    const { rows: visitRows } = await client.query(
      `SELECT id, table_id, status
      FROM table_visits
      WHERE id = $1 AND access_token_hash = $2
      FOR UPDATE`,
      [visitId, tokenHash]
    );

    const visit = visitRows[0];

    if (!visit || visit.table_id !== tableId) {
      throw Object.assign(
        new Error('Visit not found or access denied.'),
        { status: 403 }
      );
    }

    // Check for a completed earlier submission before checking visit status.
    // A retry should still recover its order after a bill was requested.
    const { rows: previousOrders } = await client.query(
      `SELECT *
      FROM orders
      WHERE visit_id = $1 AND submission_key = $2`,
      [visitId, submissionKey]
    );

    if (previousOrders[0]) {
      const previousOrder = previousOrders[0];

      const { rows: previousItems } = await client.query(
        `SELECT oi.id, oi.menu_item_id, oi.variant_id,
                oi.quantity, oi.unit_price, oi.line_total, oi.notes,
                mi.name, mv.label AS variant_label
        FROM order_items oi
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at, oi.id`,
        [previousOrder.id]
      );

      // A submission key can only be reused for the same cart contents.
      const signature = (lines) =>
        JSON.stringify(
          lines.map((line) => JSON.stringify([
            String(line.menuItemId ?? line.menu_item_id).toLowerCase(),
            String(line.variantId ?? line.variant_id ?? '').toLowerCase(),
            Number(line.quantity),
            line.notes || null,
          ])).sort()
        );

      if (
        signature(items) !== signature(previousItems) ||
        (customerName || 'Guest') !== previousOrder.customer_name ||
        (notes || null) !== previousOrder.notes
      ) {
        throw Object.assign(
          new Error('This submission key was already used for different items.'),
          { status: 409 }
        );
      }

      await client.query('COMMIT');

      // Return the saved order without inserting another notification
      // or broadcasting another new_order event.
      return res.status(200).json({
        success: true,
        data: {
          replayed: true,
          order: {
            ...previousOrder,
            table_number: Number(tableNumber),
            items: previousItems,
          },
        },
      });
    }

    if (visit.status !== 'open') {
      throw Object.assign(
        new Error(
          'The final bill has already been requested or this visit has ended. Please contact the manager.'
        ),
        { status: 409 }
      );
    }
    // Resolve every line's authoritative price (and alcoholic status) from
    // the database first, before any order/order_item rows are written.
    // Tax rules are per-item, not per-order: a table that orders both food
    // and a beer gets CGST+SGST on the food lines and VAT on the beer line,
    // in the same order.
    const resolvedLines = [];
    for (const item of items) {
      const { rows: menuRows } = await client.query(
        'SELECT id, name, price, is_available, is_alcoholic FROM menu_items WHERE id = $1',
        [item.menuItemId],
      );
      const menuItem = menuRows[0];
      if (!menuItem) {
        throw Object.assign(new Error(`Menu item not found: ${item.menuItemId}`), { status: 400 });
      }
      if (!menuItem.is_available) {
        throw Object.assign(new Error(`"${menuItem.name}" is currently unavailable`), { status: 400 });
      }

      let unitPrice = Number(menuItem.price);
      let variantId = null;
      let variantLabel = null;

      if (item.variantId) {
        const { rows: variantRows } = await client.query(
          'SELECT id, label, price FROM menu_item_variants WHERE id = $1 AND menu_item_id = $2',
          [item.variantId, item.menuItemId],
        );
        const variant = variantRows[0];
        if (!variant) {
          throw Object.assign(new Error(`Variant ${item.variantId} does not belong to menu item ${item.menuItemId}`), { status: 400 });
        }
        unitPrice = Number(variant.price);
        variantId = variant.id;
        variantLabel = variant.label;
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw Object.assign(new Error('Quantity must be a positive integer'), { status: 400 });
      }

      resolvedLines.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        variantId,
        variantLabel,
        quantity,
        unitPrice,
        isAlcoholic: !!menuItem.is_alcoholic,
        lineTotal: round2(unitPrice * quantity),
        notes: item.notes || null,
      });
    }

    // Split the subtotal by tax treatment, then tax each half with its own
    // rate. CGST/SGST never touch the alcohol subtotal and VAT never touches
    // the food/non-alcoholic subtotal - see the constants above.
    const foodSubtotal = round2(resolvedLines.filter((l) => !l.isAlcoholic).reduce((sum, l) => sum + l.lineTotal, 0));
    const alcoholSubtotal = round2(resolvedLines.filter((l) => l.isAlcoholic).reduce((sum, l) => sum + l.lineTotal, 0));
    const subtotal = round2(foodSubtotal + alcoholSubtotal);

    const cgstAmount = round2(foodSubtotal * CGST_RATE);
    const sgstAmount = round2(foodSubtotal * SGST_RATE);
    const vatAmount = round2(alcoholSubtotal * VAT_RATE);
    const taxAmount = round2(cgstAmount + sgstAmount + vatAmount);
    const totalAmount = round2(subtotal + taxAmount);

    const { rows: orderRows } = await client.query(
  `INSERT INTO orders (
     table_id,
     order_number,
     customer_name,
     status,
     payment_status,
     subtotal,
     tax_amount,
     food_subtotal,
     alcohol_subtotal,
     cgst_amount,
     sgst_amount,
     vat_amount,
     total_amount,
     notes,
     visit_id,
     submission_key
   )
   VALUES (
     $1, $2, $3, 'pending', 'unpaid',
     $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
   )
   RETURNING
     id, order_number, status, payment_status,
     subtotal, tax_amount, food_subtotal, alcohol_subtotal,
     cgst_amount, sgst_amount, vat_amount, total_amount,
     created_at, visit_id, submission_key`,
  [
    tableId,
    orderNumber,
    customerName || 'Guest',
    subtotal,
    taxAmount,
    foodSubtotal,
    alcoholSubtotal,
    cgstAmount,
    sgstAmount,
    vatAmount,
    totalAmount,
    notes || null,
    visitId,
    submissionKey,
  ]
);

    const order = orderRows[0];
    const insertedItems = [];
    for (const line of resolvedLines) {
      const { rows } = await client.query(
        `INSERT INTO order_items (
           order_id, menu_item_id, variant_id, quantity, unit_price, line_total, notes,
           item_name, variant_label, is_alcoholic
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, menu_item_id, variant_id, quantity, unit_price, line_total, notes, item_name, variant_label, is_alcoholic`,
        [
          order.id,
          line.menuItemId,
          line.variantId,
          line.quantity,
          line.unitPrice,
          line.lineTotal,
          line.notes,
          line.name,
          line.variantLabel,
          line.isAlcoholic,
        ],
      );
      insertedItems.push({
        ...rows[0],
        name: line.name,
        variant_label: line.variantLabel,
      });
    }

    const { rows: managers } = await client.query('SELECT id FROM managers WHERE is_active = TRUE');
    for (const manager of managers) {
      await client.query(
        `INSERT INTO notifications (manager_id, order_id, title, message, type, is_read)
         VALUES ($1, $2, $3, $4, 'order', FALSE)`,
        [manager.id, order.id, 'New Order Received', `Order ${order.order_number} has been placed.`],
      );
    }

    await client.query('COMMIT');

    const io = req.app.locals.io;
    if (io) {
      io.emit('new_order', {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        message: 'A new order has been placed',
      });
    }

    res.status(201).json({ success: true, data: { order: { ...order, table_number: Number(tableNumber), items: insertedItems } } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  } finally {
    client.release();
  }
}

async function getOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT id, order_number, status, payment_status, payment_method, paid_at, customer_name, subtotal, tax_amount, food_subtotal, alcohol_subtotal, cgst_amount, sgst_amount, vat_amount, total_amount, created_at, visit_id
       FROM orders WHERE id = $1`,
      [id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = rows[0];

    // Authorization check: either valid visit token for the order's visit, or manager auth
    const visitToken = req.get('X-Visit-Token');
    const authHeader = req.get('Authorization');
    let authorized = false;

    if (order.visit_id && visitToken && /^[0-9a-f]{64}$/i.test(visitToken)) {
      const tokenHash = crypto.createHash('sha256').update(visitToken).digest('hex');
      const { rows: visitRows } = await db.query(
        `SELECT id FROM table_visits WHERE id = $1 AND access_token_hash = $2`,
        [order.visit_id, tokenHash]
      );
      if (visitRows[0]) authorized = true;
    }

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
      return res.status(403).json({ success: false, message: 'Access denied. Valid visit token or manager authorization required.' });
    }

    const { rows: itemRows } = await db.query(
      `SELECT oi.id, oi.menu_item_id, mi.name, oi.variant_id, mv.label AS variant_label,
              oi.quantity, oi.unit_price, oi.line_total, oi.notes
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [id],
    );

    res.json({ success: true, data: { ...order, items: itemRows } });
  } catch (error) {
    next(error);
  }
}

// Records an actual completed payment - this is the ONLY place
// orders.payment_status ever becomes 'paid'. Generating a bill/PDF
// (billingController.createBill) never touches this. Idempotent: paying an
// already-paid order just returns its current state rather than erroring,
// so a duplicate/retried request from a flaky connection can't double-charge
// or throw a confusing error.
async function payOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const { rows: existing } = await db.query('SELECT id, payment_status, payment_method, paid_at, order_number, total_amount FROM orders WHERE id = $1', [id]);
    if (!existing[0]) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (existing[0].payment_status === 'paid') {
      return res.status(200).json({ success: true, data: existing[0], message: 'Order was already marked as paid' });
    }

    const { rows } = await db.query(
      `UPDATE orders SET payment_status = 'paid', payment_method = $1, paid_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_number, status, payment_status, payment_method, paid_at, total_amount`,
      [paymentMethod, id],
    );

    // Keep the invoice (if one was already generated) in sync too, so the
    // PDF and the order agree on how/when it was paid.
    await db.query(
      `UPDATE bills SET payment_method = $1, paid_at = NOW(), updated_at = NOW() WHERE order_id = $2`,
      [paymentMethod, id],
    );

    const io = req.app.locals.io;
    if (io) {
      io.emit('order_payment_updated', { orderId: rows[0].id, orderNumber: rows[0].order_number, paymentStatus: 'paid', paymentMethod });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;

    // Look up the visit without locking the order first.
    const lookup = await client.query(
      'SELECT visit_id FROM orders WHERE id = $1',
      [id],
    );

    if (!lookup.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const visitId = lookup.rows[0].visit_id;
    let visit = null;

    // Always lock the visit before the order, matching final billing.
    if (visitId) {
      const visitResult = await client.query(
        `SELECT id, status
         FROM table_visits
         WHERE id = $1
         FOR UPDATE`,
        [visitId],
      );

      visit = visitResult.rows[0];

      if (!visit) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Visit not found. Refresh the orders page.',
        });
      }
    }

    const orderResult = await client.query(
      `SELECT id, order_number, status, visit_id
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );

    const order = orderResult.rows[0];

    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.visit_id !== visitId) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'The order visit changed. Refresh and try again.',
      });
    }

    // Repeating the current status is harmless.
    if (order.status === status) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        data: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
        },
      });
    }

    if (visit?.status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'This visit is closed. Its orders cannot be changed.',
      });
    }

    // Both cancelling and restoring a cancelled order change the bill.
    const changesBill =
      order.status === 'cancelled' || status === 'cancelled';

    if (visit && changesBill) {
      const billResult = await client.query(
        `SELECT id
         FROM visit_bills
         WHERE visit_id = $1 AND is_active = TRUE
         LIMIT 1`,
        [visitId],
      );

      if (visit.status !== 'open' || billResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message:
            'Reopen this visit before cancelling or restoring an order. Then request a new final bill.',
        });
      }
    }

    const { rows } = await client.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, order_number, status`,
      [status, id],
    );

    await client.query('COMMIT');

    const io = req.app.locals.io;

    if (io) {
      io.emit('order_status_updated', {
        orderId: rows[0].id,
        orderNumber: rows[0].order_number,
        status: rows[0].status,
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    next(error);
  } finally {
    if (client) client.release();
  }
}
    
async function listOrders(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT o.id, o.order_number, o.customer_name, o.status, o.payment_status, o.payment_method, o.paid_at, o.total_amount, o.created_at,
              rt.table_number,
              COALESCE(
                (SELECT json_agg(json_build_object(
                    'name', mi.name,
                    'variantLabel', mv.label,
                    'quantity', oi.quantity
                  ) ORDER BY oi.created_at)
                 FROM order_items oi
                 JOIN menu_items mi ON mi.id = oi.menu_item_id
                 LEFT JOIN menu_item_variants mv ON mv.id = oi.variant_id
                 WHERE oi.order_id = o.id),
                '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       ORDER BY o.created_at DESC LIMIT 50`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = { placeOrder, getOrderStatus, updateOrderStatus, payOrder, listOrders };
