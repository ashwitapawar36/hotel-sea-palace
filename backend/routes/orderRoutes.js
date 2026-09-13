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
// Customer payment controls are removed for the portfolio demo.
// Any manual payment marking is restricted to manager authentication.
router.patch('/:id/pay', authenticateManager, payOrderValidator, handleValidation, payOrder);

module.exports = router;
