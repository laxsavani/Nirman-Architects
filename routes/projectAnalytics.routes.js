const express = require('express');
const router = express.Router({ mergeParams: true });
const projectAnalyticsController = require('../controllers/projectAnalytics.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Company-Wide Rollup (Admin Dashboard)
router.get('/company-wide-summary', projectAnalyticsController.getCompanyWideSummary);

// Snapshot Caching
router.post('/refresh-snapshot/:projectId', projectAnalyticsController.refreshProjectSnapshot);
router.get('/snapshot/:projectId', projectAnalyticsController.getCachedSnapshot);

// Per-Project Dashboard & Analysis Endpoints
router.get('/:id/dashboard', projectAnalyticsController.getProjectDashboard);
router.get('/:id/analysis/employee-wise', projectAnalyticsController.getEmployeeWiseAnalysis);
router.get('/:id/analysis/employee-wise/:userId', projectAnalyticsController.getSingleEmployeeAnalysis);
router.get('/:id/analysis/task-wise', projectAnalyticsController.getTaskWiseAnalysis);
router.get('/:id/analysis/drawing-wise', projectAnalyticsController.getDrawingWiseProgress);
router.get('/:id/analysis/department-wise', projectAnalyticsController.getDepartmentWiseProgress);

module.exports = router;
