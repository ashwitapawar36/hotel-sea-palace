const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { jwtSecret, jwtExpiresIn, jwtRefreshSecret, jwtRefreshExpiresIn } = require('../config/env');

function createToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
}

function createRefreshToken(payload) {
  return jwt.sign(payload, jwtRefreshSecret, { expiresIn: jwtRefreshExpiresIn });
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const { rows } = await db.query('SELECT id, username, email, full_name, role, password_hash, is_active FROM managers WHERE username = $1', [username]);

    if (!rows[0]) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const manager = rows[0];
    if (!manager.is_active) {
      return res.status(403).json({ success: false, message: 'Manager account is disabled' });
    }

    const passwordMatches = await bcrypt.compare(password, manager.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = createToken({ id: manager.id, username: manager.username, role: manager.role });
    const refreshToken = createRefreshToken({ id: manager.id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        manager: {
          id: manager.id,
          username: manager.username,
          email: manager.email,
          fullName: manager.full_name,
          role: manager.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function profile(req, res, next) {
  try {
    res.json({ success: true, data: req.manager });
  } catch (error) {
    next(error);
  }
}

async function logout(_req, res) {
  res.json({ success: true, message: 'Logout successful' });
}

module.exports = {
  login,
  profile,
  logout,
};
