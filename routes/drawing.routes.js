const express = require('express');
const router = express.Router();
const drawingController = require('../controllers/drawing.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Drawing Creation & Multi-Version Upload
router.post('/create', roleMiddleware(['ARCHITECT', 'DESIGNER', 'PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), drawingController.createDrawing);
router.post('/:drawingId/versions/upload', roleMiddleware(['ARCHITECT', 'DESIGNER', 'PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), drawingController.uploadVersion);

// Drawing Lists, Detail & Version History
router.get('/', drawingController.getDrawings);
router.get('/:id', drawingController.getDrawingById);
router.get('/:id/versions', drawingController.getDrawingVersions);
router.get('/:id/compare', drawingController.compareVersions);

// Internal Approval Workflow Gates
router.put('/versions/:versionId/pm-review', roleMiddleware(['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN']), drawingController.pmReview);
router.put('/versions/:versionId/admin-review', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), drawingController.adminReview);

// GFC Promotion & Lock State Management
router.put('/:id/promote-to-gfc', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), drawingController.promoteToGFC);
router.put('/:id/unlock-gfc', roleMiddleware(['SUPER_ADMIN']), drawingController.unlockGFC);

// Process DWG In-Place Edit (Category-restricted)
router.put('/versions/:versionId/edit-in-place', roleMiddleware(['ADMIN', 'SUPER_ADMIN']), drawingController.editInPlaceProcessDwg);

// CRM Client Approval Audit Log View
router.get('/versions/:versionId/client-approval-log', drawingController.getClientApprovalLog);

module.exports = router;
