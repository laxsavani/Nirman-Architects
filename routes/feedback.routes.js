const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT'];

/**
 * Internal Team Feedback Viewing & Analytics Routes
 * Mounted at /api/feedback
 */
router.use(authMiddleware);
router.use(roleMiddleware(allowedRoles));

// List all submitted client feedback with filtering
router.get('/all', feedbackController.getAllFeedback);

// Compute aggregate satisfaction analytics summary
router.get('/aggregate-summary', feedbackController.getAggregateSummary);

module.exports = router;
