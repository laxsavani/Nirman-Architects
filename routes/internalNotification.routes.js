const express = require('express');
const router = express.Router();
const internalNotificationController = require('../controllers/internalNotification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Notification Center Endpoints
router.get('/my', internalNotificationController.getMyNotifications);
router.get('/unread-count', internalNotificationController.getUnreadCount);
router.put('/mark-all-read', internalNotificationController.markAllAsRead);
router.put('/:id/read', internalNotificationController.markAsRead);

// Preferences & Device Tokens
router.get('/preferences', internalNotificationController.getPreferences);
router.put('/preferences', internalNotificationController.updatePreferences);
router.post('/register-device', internalNotificationController.registerDeviceToken);
router.delete('/unregister-device', internalNotificationController.unregisterDeviceToken);

// Debugging Logs
router.get('/:notificationId/delivery-log', internalNotificationController.getDeliveryLog);

module.exports = router;
