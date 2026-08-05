const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedPmAdminRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT'];

/**
 * Internal Team Document Routes
 */
router.use(authMiddleware);

// Get Client Access Log for a Document (PM / Admin / Architect)
router.get('/:documentId/client-access-log', roleMiddleware(allowedPmAdminRoles), documentController.getDocumentAccessLog);

// Get Client Document Engagement Summary (PM / Admin / Architect)
router.get('/client-engagement/:clientId', roleMiddleware(allowedPmAdminRoles), documentController.getClientEngagementSummary);

module.exports = router;
