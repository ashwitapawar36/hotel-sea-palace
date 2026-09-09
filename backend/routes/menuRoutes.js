const express = require('express');
const { listCategories, createCategory, updateCategory, deleteCategory, listMenuItems, listPopularItems, createMenuItem, updateMenuItem, deleteMenuItem, toggleSpecial, uploadImage } = require('../controllers/menuController');
const authenticateManager = require('../middleware/auth');
const { optionalAuthenticateManager } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { categoryValidator, itemValidator, updateItemValidator, itemIdParam, categoryIdParam, listQuery } = require('../validators/menuValidators');
const { handleValidation } = require('../utils/validation');

const router = express.Router();

router.get('/categories', listCategories);
router.post('/categories', authenticateManager, categoryValidator, handleValidation, createCategory);
router.get('/popular', listPopularItems);
router.get('/items', optionalAuthenticateManager, listQuery, handleValidation, listMenuItems);
router.post('/items', authenticateManager, itemValidator, handleValidation, createMenuItem);
router.put('/items/:id', authenticateManager, itemIdParam, updateItemValidator, handleValidation, updateMenuItem);
router.patch('/items/:id/special', authenticateManager, itemIdParam, handleValidation, toggleSpecial);
router.delete('/items/:id', authenticateManager, itemIdParam, handleValidation, deleteMenuItem);
router.post('/upload', authenticateManager, upload.single('image'), uploadImage);
router.put('/categories/:id', authenticateManager, categoryIdParam, categoryValidator, handleValidation, updateCategory);
router.delete('/categories/:id', authenticateManager, categoryIdParam, handleValidation, deleteCategory);

module.exports = router;
