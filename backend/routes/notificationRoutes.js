const express = require('express');
const { listNotifications, markNotificationsRead } = require('../controllers/notificationController');
const authenticateManager = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateManager, listNotifications);
router.patch('/read', authenticateManager, markNotificationsRead);

module.exports = router;
