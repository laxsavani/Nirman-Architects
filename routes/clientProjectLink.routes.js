const express = require('express');
const router = express.Router();
const clientProjectLinkController = require('../controllers/clientProjectLink.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');

const allowedPmAdminRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR'];
const allowedAdminOnlyRoles = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Client-Project Linkage Routes
 */

// --- Client Portal Endpoint ---
router.get('/my', clientAuthMiddleware, clientProjectLinkController.getMyProjects);

// --- Internal Team Endpoints ---
router.use(authMiddleware);

// PM / Admin / SuperAdmin Endpoints
router.post('/create', roleMiddleware(allowedPmAdminRoles), clientProjectLinkController.createLink);
router.post('/', roleMiddleware(allowedPmAdminRoles), clientProjectLinkController.createLink);
router.get('/by-client/:clientId', roleMiddleware(allowedPmAdminRoles), clientProjectLinkController.getLinksByClient);
router.get('/by-project/:projectId', roleMiddleware(allowedPmAdminRoles), clientProjectLinkController.getLinksByProject);
router.put('/:id/visibility', roleMiddleware(allowedPmAdminRoles), clientProjectLinkController.toggleVisibility);

// Admin / SuperAdmin ONLY Endpoint (Unlinking)
router.delete('/:id', roleMiddleware(allowedAdminOnlyRoles), clientProjectLinkController.unlinkProject);

module.exports = router;
