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
const clientProjectLinkRoutes = require('./clientProjectLink.routes');
const clientPortalRoutes = require('./clientPortal.routes');
const drawingRoutes = require('./drawing.routes');
const documentRoutes = require('./document.routes');
const chatRoutes = require('./chat.routes');

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

// CRM Module 3 - Client-Project Linkage Routes
router.use('/client-project-links', clientProjectLinkRoutes);

// CRM Module 4 - Client Portal Core Routes
router.use('/client', clientPortalRoutes);

// CRM Module 5 - Internal Drawing Routes
router.use('/drawings', drawingRoutes);

// CRM Module 6 - Internal Document Routes
router.use('/documents', documentRoutes);

// CRM Module 7 - Internal Chat Routes
router.use('/chat', chatRoutes);

const clientTicketRoutes = require('./clientTicket.routes');
const ticketRoutes = require('./ticket.routes');
const feedbackCategoryRoutes = require('./feedbackCategory.routes');
const clientFeedbackRoutes = require('./clientFeedback.routes');
const feedbackRoutes = require('./feedback.routes');

// CRM Module 8 - Client Ticketing (Query/Support) Routes
router.use('/client/tickets', clientTicketRoutes);
router.use('/tickets', ticketRoutes);

// CRM Module 9 - Client Feedback & Satisfaction Routes
router.use('/feedback-category', feedbackCategoryRoutes);
router.use('/client/feedback', clientFeedbackRoutes);
router.use('/feedback', feedbackRoutes);

const clientNotificationRoutes = require('./clientNotification.routes');

// CRM Module 10 - Client Notifications Routes
router.use('/client/notifications', clientNotificationRoutes);

const projectRoutes = require('./project.routes');
const projectCategoryRoutes = require('./projectCategory.routes');
const departmentRoutes = require('./department.routes');

// ERP Module 1 - Project Management Routes
router.use('/projects', projectRoutes);
router.use('/project-category', projectCategoryRoutes);
router.use('/department', departmentRoutes);

const taskRoutes = require('./task.routes');

// ERP Module 2 - Task Management System Routes
router.use('/tasks', taskRoutes);

const drawingCategoryRoutes = require('./drawingCategory.routes');
const drawingReviewRoutes = require('./drawingReview.routes');

// ERP Module 3 & 4 - Drawing Management & Review Routes
router.use('/drawing-category', drawingCategoryRoutes);
router.use('/drawings', drawingRoutes);
router.use('/drawing-versions', drawingRoutes);
router.use('/drawing-versions', drawingReviewRoutes);

// Notification & User Routes
router.use('/notifications', notificationRoutes);
router.use('/', userRoutes);




module.exports = router;
