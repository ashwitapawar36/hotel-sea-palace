const db = require('../config/db');

// Feedback is always tied to a real order (never a free-floating review),
// and it's one submission per order - the UNIQUE constraint on
// feedback.order_id backs that up at the database level too, so this stays
// correct even under a race between two duplicate submissions.
async function submitFeedback(req, res, next) {
  try {
    const { orderId, rating, comment, recommend } = req.body;

    const { rows: orderRows } = await db.query('SELECT id FROM orders WHERE id = $1', [orderId]);
    if (!orderRows[0]) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { rows: existing } = await db.query('SELECT id FROM feedback WHERE order_id = $1', [orderId]);
    if (existing[0]) {
      return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this order' });
    }

    const { rows } = await db.query(
      `INSERT INTO feedback (order_id, rating, comment, recommend)
       VALUES ($1, $2, $3, $4)
       RETURNING id, order_id, rating, comment, recommend, created_at`,
      [orderId, rating, comment || null, recommend === undefined ? null : !!recommend],
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    // A concurrent duplicate submission that slipped past the check above
    // will hit the UNIQUE constraint here instead of crashing the request.
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Feedback has already been submitted for this order' });
    }
    next(error);
  }
}

async function getFeedbackForOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    const { rows } = await db.query('SELECT id, order_id, rating, comment, recommend, created_at FROM feedback WHERE order_id = $1', [orderId]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'No feedback found for this order' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
}

// Manager-only view across all feedback, most recent first, with just
// enough order context (table/order number) to be useful without a second
// round trip.
async function listFeedback(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT f.id, f.order_id, f.rating, f.comment, f.recommend, f.created_at,
              o.order_number, rt.table_number
       FROM feedback f
       JOIN orders o ON o.id = f.order_id
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       ORDER BY f.created_at DESC
       LIMIT 100`,
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = { submitFeedback, getFeedbackForOrder, listFeedback };
