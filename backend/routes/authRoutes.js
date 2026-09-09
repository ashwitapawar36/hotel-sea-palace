const express = require('express');
const { login, profile, logout } = require('../controllers/authController');
const authenticateManager = require('../middleware/auth');
const { loginValidator } = require('../validators/authValidators');
const { handleValidation } = require('../utils/validation');

const router = express.Router();

router.post('/login', loginValidator, handleValidation, login);
router.get('/profile', authenticateManager, profile);
router.post('/logout', authenticateManager, logout);

module.exports = router;
