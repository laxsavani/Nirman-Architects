const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const clientOrUserAuthMiddleware = require('../middlewares/clientOrUserAuth.middleware');

const allowedInternalRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR'];

/**
 * Client Management Routes (Internal Team & Client Contact Multi-Login)
 */

// Contact management routes (Dual authentication: Internal team OR Client Contact OWNER/Member)
router.post('/:clientId/contacts/add', clientOrUserAuthMiddleware, clientController.addContact);
router.get('/:clientId/contacts', clientOrUserAuthMiddleware, clientController.getClientContacts);
router.put('/:clientId/contacts/:contactId/permission', clientOrUserAuthMiddleware, clientController.updateContactPermission);
router.put('/:clientId/contacts/:contactId/deactivate', clientOrUserAuthMiddleware, clientController.deactivateContact);

// Internal Team Client Management Routes (Protected by Employee Auth & Role Middleware)
router.use(authMiddleware);
router.use(roleMiddleware(allowedInternalRoles));

router.post('/create', clientController.createClient);
router.post('/', clientController.createClient);
router.get('/', clientController.getClients);
router.get('/:id', clientController.getClientById);
router.put('/:id', clientController.updateClient);
router.put('/:id/deactivate', clientController.deactivateClient);

// Admin helper endpoint to reset temp password
router.post('/:clientId/contacts/:contactId/reset-temp-password', clientController.resetTempPassword);

module.exports = router;
