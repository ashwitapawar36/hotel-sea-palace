const { body, param } = require('express-validator');

const placeOrderValidator = [
  // Every order must be tied to a real table - the frontend always resolves
  // one before calling this (from the ?table= QR param, a stored table, or
  // the manual fallback picker), so tableNumber is required here, not
  // optional. `.exists({ checkNull: true })` is used (instead of relying on
  // `.optional()`) specifically because `.optional()` only skips validation
  // for `undefined`, NOT for an explicit `tableNumber: null` - so a stray
  // null would previously still hit isInt() and fail with an opaque
  // "Invalid value" error instead of this clear message.
  body('tableNumber')
    .exists({ checkNull: true }).withMessage('Table number is required')
    .bail()
    .isInt({ min: 1 }).withMessage('Table number must be a positive integer')
    .toInt(),
  body('customerName').optional().isString().trim(),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.menuItemId').isUUID().withMessage('Each menu item id must be a valid UUID'),
  body('items.*.variantId').optional({ values: 'null' }).isUUID().withMessage('Variant id must be a valid UUID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.notes').optional().isString(),
  body('notes').optional().isString(),
  // NOTE: intentionally no validator for items.*.unitPrice / items.*.price.
  // The server always recalculates price from menu_items / menu_item_variants;
  // any price sent by the client is ignored, not just unvalidated.
];

const orderStatusValidator = [
  param('id').isUUID().withMessage('Order id must be a valid UUID'),
  body('status').isIn(['pending', 'accepted', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid order status'),
];

const payOrderValidator = [
  param('id').isUUID().withMessage('Order id must be a valid UUID'),
  body('paymentMethod').isIn(['cash', 'card', 'upi', 'split']).withMessage('paymentMethod must be one of cash, card, upi, split'),
];

module.exports = { placeOrderValidator, orderStatusValidator, payOrderValidator };
