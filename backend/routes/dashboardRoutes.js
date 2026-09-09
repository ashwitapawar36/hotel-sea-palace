const express = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const authenticateManager = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateManager, getDashboard);

module.exports = router;
