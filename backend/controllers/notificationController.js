const db = require('../config/db');

async function listNotifications(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, order_id, title, message, type, is_read, created_at FROM notifications WHERE manager_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.manager.id],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function markNotificationsRead(req, res, next) {
  try {
    await db.query('UPDATE notifications SET is_read = TRUE, updated_at = NOW() WHERE manager_id = $1', [req.manager.id]);
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listNotifications, markNotificationsRead };
