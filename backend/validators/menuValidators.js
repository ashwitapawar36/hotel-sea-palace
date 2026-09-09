const { body, param, query } = require('express-validator');

const categoryValidator = [
  body('name').isString().trim().notEmpty().withMessage('Category name is required'),
  body('slug').optional({ values: 'falsy' }).isString().trim().notEmpty().withMessage('Category slug must be a non-empty string'),
  body('menuType').optional().isIn(['food', 'bar']).withMessage('Menu type must be food or bar'),
  body('foodGroup').optional({ values: 'falsy' }).isIn(['vegetarian', 'non-vegetarian']).withMessage('Food group must be vegetarian or non-vegetarian'),
  body('description').optional().isString(),
  body('displayOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

const variantValidator = body('variants')
  .optional()
  .isArray()
  .withMessage('Variants must be an array')
  .custom((variants) => {
    if (!Array.isArray(variants)) return true;
    return variants.every(
      (v) => v && typeof v.label === 'string' && v.label.trim().length > 0 && typeof v.price === 'number' && v.price >= 0,
    );
  })
  .withMessage('Each variant needs a non-empty label (e.g. "60 ml") and a non-negative price');

const itemValidator = [
  body('categoryId').isUUID().withMessage('Category id must be a valid UUID'),
  body('name').isString().trim().notEmpty().withMessage('Item name is required'),
  body('description').optional().isString(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('imageUrl').optional({ values: 'falsy' }).isString(),
  body('isVeg').optional().isBoolean(),
  body('isAvailable').optional().isBoolean(),
  body('preparationTimeMinutes').optional().isInt({ min: 1 }),
  body('type').optional().isIn(['food', 'bar']),
  variantValidator,
];

const updateItemValidator = [
  body('categoryId').optional().isUUID().withMessage('Category id must be a valid UUID'),
  body('name').optional().isString().trim().notEmpty().withMessage('Item name cannot be empty'),
  body('description').optional().isString(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  body('imageUrl').optional({ values: 'falsy' }).isString(),
  body('isVeg').optional().isBoolean(),
  body('isAvailable').optional().isBoolean(),
  body('preparationTimeMinutes').optional().isInt({ min: 1 }),
  variantValidator,
];

const itemIdParam = [param('id').isUUID().withMessage('Item id must be a valid UUID')];
const categoryIdParam = [param('id').isUUID().withMessage('Category id must be a valid UUID')];
const listQuery = [query('type').optional().isIn(['food', 'bar', 'all'])];

module.exports = { categoryValidator, itemValidator, updateItemValidator, itemIdParam, categoryIdParam, listQuery };
