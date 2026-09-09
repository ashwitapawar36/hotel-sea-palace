const express = require('express');
const { submitFeedback, getFeedbackForOrder, listFeedback } = require('../controllers/feedbackController');
const authenticateManager = require('../middleware/auth');
const { submitFeedbackValidator, orderIdParam } = require('../validators/feedbackValidators');
const { handleValidation } = require('../utils/validation');

const router = express.Router();

// Customer-facing: submitting/reading feedback for your own order needs no
// manager credential, same pattern as orders/bills.
router.post('/', submitFeedbackValidator, handleValidation, submitFeedback);
router.get('/order/:orderId', orderIdParam, handleValidation, getFeedbackForOrder);

// Manager-only: browse everything that's come in.
router.get('/', authenticateManager, listFeedback);

module.exports = router;
