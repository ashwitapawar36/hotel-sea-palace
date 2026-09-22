const express = require('express');
const { createBill, getBill, downloadBillPdf } = require('../controllers/billingController');

const router = express.Router();

router.post('/', createBill);
router.get('/:id/pdf', downloadBillPdf);
router.get('/:id', getBill);

module.exports = router;
