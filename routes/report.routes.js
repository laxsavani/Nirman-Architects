const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Generic Report Generation & Management
router.post('/generate', reportController.generateReport);
router.get('/my', reportController.getMyReports);
router.get('/:id/status', reportController.getReportStatus);
router.get('/:id/download', reportController.downloadReport);

// Convenience Endpoints for Specific Report Types
router.post('/attendance', reportController.generateAttendanceReport);
router.post('/productivity', reportController.generateProductivityReport);
router.post('/project', reportController.generateProjectReport);
router.post('/employee', reportController.generateEmployeeReport);
router.post('/drawing', reportController.generateDrawingReport);
router.post('/site', reportController.generateSiteReport);
router.post('/daily-progress', reportController.generateDailyProgressReport);
router.post('/monthly-progress', reportController.generateMonthlyProgressReport);
router.post('/customer', reportController.generateCustomerReport);
router.post('/task', reportController.generateTaskReport);
router.post('/approval', reportController.generateApprovalReport);

// Scheduled Report Management
router.post('/scheduled/create', reportController.createScheduledReport);
router.get('/scheduled/my', reportController.getMyScheduledReports);
router.delete('/scheduled/:id', reportController.deleteScheduledReport);

module.exports = router;
