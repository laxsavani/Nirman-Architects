const express = require('express');
const router = express.Router();
const projectCategoryController = require('../controllers/projectCategory.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Get Active Categories (All Employees)
router.get('/active', projectCategoryController.getActiveCategories);

// Create Category (Admin & Super Admin)
router.post('/create', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), projectCategoryController.createCategory);

// Deactivate Category (Admin & Super Admin)
router.put('/:id/deactivate', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), projectCategoryController.deactivateCategory);

module.exports = router;
