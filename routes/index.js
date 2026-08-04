const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const roleMasterRoutes = require('./roleMaster.routes');
const attendanceRoutes = require('./attendance.routes');
const deviceRoutes = require('./device.routes');
const siteLocationRoutes = require('./siteLocation.routes');
const notificationRoutes = require('./notification.routes');
const userRoutes = require('./user.routes');
const leaveMasterRoutes = require('./leaveMaster.routes');
const leaveRoutes = require('./leave.routes');
const payrollRoutes = require('./payroll.routes');
const offerLetterRoutes = require('./offerLetter.routes');
const screenshotRoutes = require('./screenshot.routes');
const appUsageRoutes = require('./appUsage.routes');
const leadRoutes = require('./lead.routes');
const clientRoutes = require('./client.routes');
const clientAuthRoutes = require('./clientAuth.routes');

// Health Check Endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Nirman Architects API',
    serverTime: new Date().toISOString()
  });
});

// Auth & Role Master Routes
router.use('/auth', authRoutes);
router.use('/', authRoutes);
router.use('/role-master', roleMasterRoutes);

// Attendance & Device Routes
router.use('/attendance', attendanceRoutes);
router.use('/device', deviceRoutes);
router.use('/site-locations', siteLocationRoutes);

// Screenshot & App Usage Routes
router.use('/screenshot', screenshotRoutes);
router.use('/app-usage', appUsageRoutes);

// Leave Management Routes
router.use('/leave-type', leaveMasterRoutes);
router.use('/leave-master', leaveMasterRoutes);
router.use('/leave-balance', leaveRoutes);
router.use('/leave', leaveRoutes);

// Payroll & Offer Letter Routes
router.use('/payroll', payrollRoutes);
router.use('/offer-letter', offerLetterRoutes);

// CRM Module 1 - Lead Management Routes
router.use('/leads', leadRoutes);

// CRM Module 2 - Client Master & Client Auth Routes
router.use('/clients', clientRoutes);
router.use('/client-auth', clientAuthRoutes);

// Notification & User Routes
router.use('/notifications', notificationRoutes);
router.use('/', userRoutes);


module.exports = router;
