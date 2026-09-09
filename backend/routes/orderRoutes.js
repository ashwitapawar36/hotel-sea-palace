const express = require('express');
const { placeOrder, getOrderStatus, updateOrderStatus, payOrder, listOrders } = require('../controllers/orderController');
const authenticateManager = require('../middleware/auth');
const { placeOrderValidator, orderStatusValidator, payOrderValidator } = require('../validators/orderValidators');
const { handleValidation } = require('../utils/validation');

const router = express.Router();

router.post('/', placeOrderValidator, handleValidation, placeOrder);
router.get('/:id/status', getOrderStatus);
router.get('/', authenticateManager, listOrders);
router.patch('/:id/status', authenticateManager, orderStatusValidator, handleValidation, updateOrderStatus);
// Payment is completed by the customer at checkout, not the manager - kept
// public like placeOrder/getOrderStatus, and separate from authenticateManager
// on purpose (manager auth stays scoped to /manager/* actions only).
router.patch('/:id/pay', payOrderValidator, handleValidation, payOrder);

module.exports = router;
