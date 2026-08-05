const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedPmAdminRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT'];

/**
 * Internal Team Drawing Routes
 */
router.use(authMiddleware);

// Get Client Approval Log for a Drawing (PM / Admin / Architect)
router.get('/:drawingId/client-approval-log', roleMiddleware(allowedPmAdminRoles), drawingController.getClientApprovalLog);

module.exports = router;
