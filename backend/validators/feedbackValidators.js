const { body, param } = require('express-validator');

const submitFeedbackValidator = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be an integer between 1 and 5'),
  body('comment').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }).withMessage('comment is too long'),
  body('recommend').optional().isBoolean().withMessage('recommend must be true or false'),
];

const orderIdParam = [param('orderId').isUUID().withMessage('orderId must be a valid UUID')];

module.exports = { submitFeedbackValidator, orderIdParam };
