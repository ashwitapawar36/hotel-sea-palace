const express = require('express');
const { createBill, getBill } = require('../controllers/billingController');

const router = express.Router();

// Bill generation is triggered by the customer right after checkout (Digital
// Bill screen), so this is intentionally NOT behind authenticateManager -
// manager auth and customer access are kept separate. The only input that
// matters, orderId, is looked up server-side against the orders table, so
// nothing here trusts client-supplied pricing either.
router.post('/', createBill);
router.get('/:id', getBill);

module.exports = router;
