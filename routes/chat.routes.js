const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Internal Team Chat Routes (ERP Module 5)
 */
router.use(authMiddleware);

// Unread Counts per Project
router.get('/unread-counts', chatController.getUnreadCounts);

// Internal Project Chat Endpoints
router.get('/:projectId', chatController.getInternalProjectChat);
router.post('/:projectId/message', chatController.sendInternalMessage);
router.post('/:projectId/sync', chatController.syncOfflineMessages);
router.put('/:projectId/mark-read', chatController.markChatRead);

module.exports = router;
