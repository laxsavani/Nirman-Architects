const express = require('express');
const router = express.Router();
const clientFeedbackController = require('../controllers/clientFeedback.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');

/**
 * Client Portal Feedback Routes
 * Mounted at /api/client/feedback
 * Protected by clientAuthMiddleware (OWNER, MEMBER, and VIEW_ONLY allowed)
 */
router.use(clientAuthMiddleware);

// Get pending feedback prompts for calling contact
router.get('/pending-prompts', clientFeedbackController.getPendingPrompts);

// Submit feedback for a prompt (OWNER, MEMBER, and VIEW_ONLY permitted)
router.post('/:promptId/submit', clientFeedbackController.submitFeedback);

// Skip a pending prompt permanently for this trigger event
router.post('/:promptId/skip', clientFeedbackController.skipPrompt);

// Get calling contact's own feedback history
router.get('/my', clientFeedbackController.getMyFeedbackHistory);

// Get all feedback for a project submitted by any contact under client account
router.get('/project/:projectId', clientFeedbackController.getProjectClientFeedback);

module.exports = router;
