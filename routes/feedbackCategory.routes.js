const express = require('express');
const router = express.Router();
const feedbackCategoryController = require('../controllers/feedbackCategory.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedAdminRoles = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Feedback Category Master Routes
 * Mounted at /api/feedback-category
 */

// Public / Client / Employee: Get active categories for rendering forms
router.get('/active', feedbackCategoryController.getActiveCategories);

// Admin / SuperAdmin: Create category, update category & toggle status
router.use(authMiddleware);
router.post('/create', roleMiddleware(allowedAdminRoles), feedbackCategoryController.createCategory);
router.put('/:id/update', roleMiddleware(allowedAdminRoles), feedbackCategoryController.updateCategory);
router.put('/:id/deactivate', roleMiddleware(allowedAdminRoles), feedbackCategoryController.toggleCategoryActive);

module.exports = router;
