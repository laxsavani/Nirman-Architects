const express = require('express');
const router = express.Router();
const clientPortalController = require('../controllers/clientPortal.controller');
const clientDrawingController = require('../controllers/clientDrawing.controller');
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

// Module 5 — Drawing Approval Workflow (Client Side) Endpoints
router.get('/projects/:projectId/drawings', clientDrawingController.getProjectDrawings);
router.get('/drawings/:drawingId', clientDrawingController.getDrawingDetail);
router.get('/drawings/:drawingId/versions', clientDrawingController.getDrawingVersions);
router.get('/drawings/:drawingId/compare', clientDrawingController.compareDrawingVersions);
router.post('/drawings/:drawingId/approve', clientDrawingController.approveDrawing);
router.post('/drawings/:drawingId/request-changes', clientDrawingController.requestChanges);
router.post('/drawings/:drawingId/comments', clientDrawingController.addComment);
router.get('/drawings/:drawingId/comments', clientDrawingController.getComments);

// Profile Update Endpoint (Name & Phone)
router.put('/profile', clientPortalController.updateProfile);

// Session & Engagement Tracking Endpoints
router.post('/session/log-login', clientPortalController.logSessionLogin);
router.post('/session/heartbeat', clientPortalController.sessionHeartbeat);

module.exports = router;

