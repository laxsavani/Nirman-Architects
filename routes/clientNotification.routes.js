const express = require('express');
const router = express.Router();
const clientNotificationController = require('../controllers/clientNotification.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');

/**
 * Client Portal Notification Routes
 * Mounted at /api/client/notifications
 * Protected by clientAuthMiddleware
 */
router.use(clientAuthMiddleware);

// Get paginated notifications for calling contact
router.get('/my', clientNotificationController.getMyNotifications);

// Get unread notification count for bell badge
router.get('/unread-count', clientNotificationController.getUnreadCount);

// Mark single notification as read
router.put('/:id/read', clientNotificationController.markAsRead);

// Bulk mark all notifications as read
router.put('/mark-all-read', clientNotificationController.markAllAsRead);

// Notification channel delivery preferences
router.get('/preferences', clientNotificationController.getPreferences);
router.put('/preferences', clientNotificationController.updatePreferences);

// Push notification device token registration & unregistration
router.post('/register-device', clientNotificationController.registerDeviceToken);
router.delete('/unregister-device', clientNotificationController.unregisterDeviceToken);

module.exports = router;
