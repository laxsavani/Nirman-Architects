const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Core attendance endpoints (PRD Section 7)
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.get('/today', attendanceController.getToday);

// Event & Sync endpoints
router.post('/event', attendanceController.handleEvent);
router.post('/sync', attendanceController.handleSync);

// Legacy aliases
router.post('/heartbeat', attendanceController.handleEvent);
router.post('/clock', attendanceController.handleEvent);

// Query history
router.get('/my', attendanceController.getMyAttendance);
router.get('/all', roleMiddleware(['SUPER_ADMIN', 'HR']), attendanceController.getAllAttendance);

// Correction requests
router.post('/correction/request', attendanceController.requestCorrection);
router.post('/correction/approve', roleMiddleware(['SUPER_ADMIN', 'HR']), attendanceController.approveCorrection);
router.post('/correction/reject', roleMiddleware(['SUPER_ADMIN', 'HR']), attendanceController.rejectCorrection);

// Config
router.get('/config', attendanceController.getConfig);
router.put('/config', roleMiddleware(['SUPER_ADMIN']), attendanceController.updateConfig);

module.exports = router;
