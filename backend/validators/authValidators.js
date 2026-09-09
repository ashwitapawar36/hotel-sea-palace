const { body } = require('express-validator');

const loginValidator = [
  body('username').isString().trim().notEmpty().withMessage('Username is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

module.exports = {
  loginValidator,
};
