const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboard.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Master Aggregated Admin Dashboard Endpoint
router.get('/', adminDashboardController.getAdminDashboard);

// Individual Tile & Analytical Endpoints
router.get('/online-employees', adminDashboardController.getOnlineEmployees);
router.get('/recent-activities', adminDashboardController.getRecentActivities);
router.get('/upcoming-deadlines', adminDashboardController.getUpcomingDeadlines);
router.get('/revenue-summary', adminDashboardController.getRevenueSummary);

// Project Health Score Endpoints
router.get('/project-health/company-average', adminDashboardController.getCompanyAverageHealthScore);
router.get('/project-health/:projectId', adminDashboardController.getProjectHealthScore);

// Snapshot Refresh
router.post('/refresh-snapshot', adminDashboardController.refreshSnapshot);

module.exports = router;
