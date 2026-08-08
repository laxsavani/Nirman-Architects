const express = require('express');
const router = express.Router();
const drawingCategoryController = require('../controllers/drawingCategory.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

router.post('/create', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), drawingCategoryController.createCategory);
router.get('/active', drawingCategoryController.getActiveCategories);
router.put('/:id/deactivate', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), drawingCategoryController.deactivateCategory);

module.exports = router;
