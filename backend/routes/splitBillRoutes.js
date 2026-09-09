const express = require('express');
const { createSplitBill, getSplitBill } = require('../controllers/splitBillController');

const router = express.Router();

router.post('/', createSplitBill);
router.get('/:orderId', getSplitBill);

module.exports = router;
