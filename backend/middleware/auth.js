const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const db = require('../config/db');

async function authenticateManager(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication token missing' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const { rows } = await db.query('SELECT id, username, email, full_name, role, is_active FROM managers WHERE id = $1', [decoded.id]);

    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Manager account is not active' });
    }

    req.manager = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Same JWT check as authenticateManager, but never rejects the request - it
// just leaves req.manager unset if the token is missing/invalid. Used on
// routes that are public for customers but should reveal more (e.g.
// unavailable items) to a signed-in manager.
async function optionalAuthenticateManager(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const decoded = jwt.verify(token, jwtSecret);
    const { rows } = await db.query('SELECT id, username, email, full_name, role, is_active FROM managers WHERE id = $1', [decoded.id]);
    if (rows[0] && rows[0].is_active) {
      req.manager = rows[0];
    }
    next();
  } catch {
    next();
  }
}

module.exports = authenticateManager;
module.exports.optionalAuthenticateManager = optionalAuthenticateManager;
