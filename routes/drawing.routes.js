const express = require('express');
const router = express.Router();
const multer = require('multer');
const drawingController = require('../controllers/drawing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const allowedUploadRoles = ['DESIGNER', 'ARCHITECT', 'PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN'];
const allowedPmAdminRoles = ['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR', 'ARCHITECT', 'DESIGNER'];

// Multer memory storage for Cloudinary processing (50MB max file limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

/**
 * Internal Team Drawing Routes
 */
router.use(authMiddleware);

// Upload New Drawing to Cloudinary & Save to DB
router.post('/upload', roleMiddleware(allowedUploadRoles), upload.single('file'), drawingController.uploadDrawing);

// Upload New Revision Version (V2, V3...) of Existing Drawing to Cloudinary
router.post('/:drawingId/upload-version', roleMiddleware(allowedUploadRoles), upload.single('file'), drawingController.uploadDrawingVersion);

// Get Client Approval Log for a Drawing (PM / Admin / Architect)
router.get('/:drawingId/client-approval-log', roleMiddleware(allowedPmAdminRoles), drawingController.getClientApprovalLog);

module.exports = router;

