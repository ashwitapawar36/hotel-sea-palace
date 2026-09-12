const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');

const router = express.Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function validToken(token) {
  return typeof token === 'string' && /^[0-9a-f]{64}$/i.test(token);
}

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

// Start a visit, or resume it using the same private token.
// The frontend will generate and save the token before sending this request,
// so retrying after a lost response can resume the same visit.
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

    // Serialize simultaneous attempts to start a visit for this table.
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

    const activeResult = await client.query(
      `SELECT id, status, opened_at, access_token_hash
       FROM table_visits
       WHERE table_id = $1
         AND status IN ('open', 'bill_requested')`,
      [table.id]
    );

    let visit = activeResult.rows[0];
    let created = false;

    if (visit) {
      if (visit.access_token_hash !== tokenHash) {
        throw fail(
          409,
          'This table already has an active visit. Please ask the manager for assistance.'
        );
      }
    } else {
      // A closed visit's token must not silently start a new visit.
      const previous = await client.query(
        `SELECT id
         FROM table_visits
         WHERE table_id = $1 AND access_token_hash = $2
         LIMIT 1`,
        [table.id, tokenHash]
      );

      if (previous.rows.length) {
        throw fail(
          409,
          'This visit has ended. Please start a new table visit.'
        );
      }

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
      await client.query('ROLLBACK').catch(() => {});
    }
    next(error);
  } finally {
    if (client) client.release();
  }
});

// Retrieve the visit and all its order rounds.
// The token is sent in a header, never in a shareable URL.
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
                 'name', mi.name,
                 'variant_label', mv.label,
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price,
                 'line_total', oi.line_total
               )
               ORDER BY oi.created_at, oi.id
             )
             FROM order_items oi
             JOIN menu_items mi ON mi.id = oi.menu_item_id
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

    res.json({
      success: true,
      data: {
        visit,
        orders: ordersResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;