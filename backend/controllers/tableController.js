const db = require('../config/db');

async function listTables(req, res, next) {
  try {
    const { rows } = await db.query(
      'SELECT id, table_number, capacity, status, location, qr_code_text FROM restaurant_tables ORDER BY table_number ASC',
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = { listTables };
