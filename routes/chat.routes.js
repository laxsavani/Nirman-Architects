const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * Internal Team Chat Routes
 */
router.use(authMiddleware);

// Get internal project chat history
router.get('/:projectId', chatController.getInternalProjectChat);

// Post internal employee chat message
router.post('/:projectId/message', chatController.sendInternalMessage);

module.exports = router;
