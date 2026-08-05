const express = require('express');
const router = express.Router();
const clientPortalController = require('../controllers/clientPortal.controller');
const clientDrawingController = require('../controllers/clientDrawing.controller');
const clientDocumentController = require('../controllers/clientDocument.controller');
const clientChatController = require('../controllers/clientChat.controller');
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

// Module 6 — Client Document Access Endpoints
router.get('/projects/:projectId/documents', clientDocumentController.getProjectDocuments);
router.get('/documents/:documentId/preview', clientDocumentController.previewDocument);
router.get('/documents/:documentId/download', clientDocumentController.downloadDocument);

// Module 7 — Client Chat System Endpoints
router.get('/chat/unread-counts', clientChatController.getUnreadCounts);
router.get('/chat/:projectId', clientChatController.getProjectChat);
router.post('/chat/:projectId/message', clientChatController.sendMessage);
router.post('/chat/:projectId/sync', clientChatController.syncOfflineMessages);
router.put('/chat/:projectId/mark-read', clientChatController.markAsRead);

// Profile Update Endpoint (Name & Phone)
router.put('/profile', clientPortalController.updateProfile);

// Session & Engagement Tracking Endpoints
router.post('/session/log-login', clientPortalController.logSessionLogin);
router.post('/session/heartbeat', clientPortalController.sessionHeartbeat);

module.exports = router;

