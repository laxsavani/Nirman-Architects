const express = require('express');
const router = express.Router();
const clientPortalController = require('../controllers/clientPortal.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');

/**
 * Client Portal Core Routes (Web + Mobile)
 * All endpoints protected by clientAuthMiddleware
 */
router.use(clientAuthMiddleware);

// Dashboard Aggregation Endpoint
router.get('/dashboard', clientPortalController.getDashboard);

// Project Detail, Milestones, and Timeline Endpoints
router.get('/projects/:projectId', clientPortalController.getProjectDetail);
router.get('/projects/:projectId/milestones', clientPortalController.getProjectMilestones);
router.get('/projects/:projectId/timeline', clientPortalController.getProjectTimeline);

// Profile Update Endpoint (Name & Phone)
router.put('/profile', clientPortalController.updateProfile);

// Session & Engagement Tracking Endpoints
router.post('/session/log-login', clientPortalController.logSessionLogin);
router.post('/session/heartbeat', clientPortalController.sessionHeartbeat);

module.exports = router;
