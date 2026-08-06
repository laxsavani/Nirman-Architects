const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const notificationAdminController = require('../controllers/notificationAdmin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedAdminRoles = ['ADMIN', 'SUPER_ADMIN'];
const allowedTeamRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT'];

/**
 * Internal Employee & Admin Notification Routes
 * Mounted at /api/notifications
 */
router.use(authMiddleware);

// Employee notification center
router.get('/my', notificationController.getMyNotifications);
router.get('/', notificationController.getMyNotifications);
router.put('/:id/read', notificationController.markAsRead);

// Delivery audit log debugging (PM / Admin / HR / Architect)
router.get('/:notificationId/delivery-log', roleMiddleware(allowedTeamRoles), notificationAdminController.getDeliveryLog);

// WhatsApp Business API setup (Super Admin / Admin)
router.post('/whatsapp-config', roleMiddleware(allowedAdminRoles), notificationAdminController.configureWhatsApp);
router.get('/whatsapp-config/status', roleMiddleware(allowedTeamRoles), notificationAdminController.getWhatsAppStatus);

module.exports = router;
