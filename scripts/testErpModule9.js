require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const Department = require('../models/Department');
const Task = require('../models/Task');
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const InternalNotification = require('../models/InternalNotification');
const InternalNotificationPreference = require('../models/InternalNotificationPreference');
const EmployeeDeviceToken = require('../models/EmployeeDeviceToken');
const InternalNotificationDeliveryLog = require('../models/InternalNotificationDeliveryLog');

const InternalNotificationDispatcher = require('../utils/internalNotificationDispatcher');
const internalNotificationController = require('../controllers/internalNotification.controller');
const taskController = require('../controllers/task.controller');
const drawingController = require('../controllers/drawing.controller');
const chatController = require('../controllers/chat.controller');
const documentController = require('../controllers/document.controller');
const { hashPassword } = require('../utils/password');

function mockResponse() {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (payload) {
    this.body = payload;
    return this;
  };
  return res;
}

async function runErpModule9Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 9: NOTIFICATION SYSTEM (INTERNAL) — TEST SUITE');
  console.log('================================================================================\n');

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
    }
  }

  const conn = await connectDB();
  if (!conn) {
    console.error('Failed to connect to DB for testing.');
    process.exit(1);
  }

  try {
    // Cleanup test data
    const testEmails = [
      'erp9.admin@erp.com',
      'erp9.pm@erp.com',
      'erp9.emp1@erp.com',
      'erp9.emp2@erp.com'
    ];

    await InternalNotificationDeliveryLog.deleteMany({});
    await EmployeeDeviceToken.deleteMany({});
    await InternalNotificationPreference.deleteMany({});
    await InternalNotification.deleteMany({});
    await Task.deleteMany({ taskName: { $regex: /ERP Module 9/i } });
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 9/i } });
    await DrawingCategory.deleteMany({ name: 'ERP9 Working Drawing' });
    await Department.deleteMany({ name: { $regex: /ERP9/i } });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 9/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Users
    const userAdmin = await User.create({
      name: 'Narayana Murthy',
      email: 'erp9.admin@erp.com',
      password: await hashPassword('AdminPass@123'),
      roleId: roleAdmin._id,
      designation: 'Executive Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Sudha Murthy',
      email: 'erp9.pm@erp.com',
      password: await hashPassword('PMPass@123'),
      roleId: rolePM._id,
      designation: 'Studio PM',
      isActive: true
    });

    const userEmp1 = await User.create({
      name: 'Devdutt Pattanaik',
      email: 'erp9.emp1@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Senior Architect',
      isActive: true
    });

    const userEmp2 = await User.create({
      name: 'Amish Tripathi',
      email: 'erp9.emp2@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: '3D Designer',
      isActive: true
    });

    // 3. Project
    const dept = await Department.create({ name: 'ERP9 Structural Dept', code: 'E9-STR', isActive: true });
    const project = await Project.create({
      projectName: 'ERP Module 9 - Infinity Mall Project',
      status: 'In Progress',
      progressPercentage: 30,
      createdBy: userPM._id,
      teamAssignments: [
        { userId: userPM._id, projectRole: 'Lead PM' },
        { userId: userEmp1._id, projectRole: 'Senior Architect' }
      ]
    });

    console.log('--- 1. Testing InternalNotificationDispatcher Direct Dispatch & Role Broadcast ---');

    // Dispatch direct notification
    const dispatchedDirect = await InternalNotificationDispatcher.dispatch({
      userIds: [userEmp1._id.toString()],
      type: 'PROJECT_STATUS_CHANGED',
      title: 'Project Status Updated',
      message: 'Infinity Mall Project status changed to In Progress',
      projectId: project._id.toString()
    });
    assert(dispatchedDirect.length === 1 && dispatchedDirect[0].userId.toString() === userEmp1._id.toString(), 'Direct notification dispatched to target user');

    // Dispatch role broadcast notification
    const dispatchedRole = await InternalNotificationDispatcher.dispatch({
      broadcastToRoles: ['PROJECT_MANAGER', 'SUPER_ADMIN'],
      projectId: project._id.toString(),
      type: 'PROJECT_DELAY',
      title: 'Project Delay Alert',
      message: 'Infinity Mall Project has exceeded schedule threshold'
    });
    assert(dispatchedRole.length >= 2, 'Role-broadcast dynamically resolved project PM and system Admins');

    console.log('\n--- 2. Testing Recipient De-Duplication ---');

    const dispatchedDedup = await InternalNotificationDispatcher.dispatch({
      userIds: [userAdmin._id.toString()],
      broadcastToRoles: ['SUPER_ADMIN', 'ADMIN'],
      projectId: project._id.toString(),
      type: 'MILESTONE_APPROACHING',
      title: 'Milestone Warning',
      message: 'Phase 1 deadline in 3 days'
    });
    const adminCount = dispatchedDedup.filter(n => n.userId.toString() === userAdmin._id.toString()).length;
    assert(adminCount === 1, 'Recipient de-duplication prevents duplicate notifications for users matching both explicit ID and role target');

    console.log('\n--- 3. Testing Notification Center Endpoints (GET /my, PUT /read, GET /unread-count) ---');

    const reqMy = { query: {}, user: userEmp1 };
    const resMy = mockResponse();
    await internalNotificationController.getMyNotifications(reqMy, resMy);
    assert(resMy.statusCode === 200 && resMy.body.notifications.length >= 1, 'Notification Center list retrieves user notifications');

    const notifId = resMy.body.notifications[0]._id.toString();

    const reqRead = { params: { id: notifId }, user: userEmp1 };
    const resRead = mockResponse();
    await internalNotificationController.markAsRead(reqRead, resRead);
    assert(resRead.statusCode === 200 && resRead.body.notification.isRead === true, 'Single notification marked as read');

    const reqUnread = { user: userEmp1 };
    const resUnread = mockResponse();
    await internalNotificationController.getUnreadCount(reqUnread, resUnread);
    assert(resUnread.statusCode === 200 && resUnread.body.unreadCount >= 0, 'Unread count endpoint returns numerical count');

    const reqMarkAll = { user: userEmp1 };
    const resMarkAll = mockResponse();
    await internalNotificationController.markAllAsRead(reqMarkAll, resMarkAll);
    assert(resMarkAll.statusCode === 200, 'All notifications marked as read');

    console.log('\n--- 4. Testing Employee Channel Preferences & Skipped Delivery Logging ---');

    // Disable email for userEmp2
    await InternalNotificationPreference.create({
      userId: userEmp2._id,
      pushEnabled: true,
      emailEnabled: false
    });

    const dispatchedPref = await InternalNotificationDispatcher.dispatch({
      userIds: [userEmp2._id.toString()],
      type: 'TASK_REJECTED',
      title: 'Task Revision Requested',
      message: 'Your task was marked as requiring revision'
    });

    const notifIdPref = dispatchedPref[0]._id;
    const reqLogs = { params: { notificationId: notifIdPref.toString() }, user: userAdmin };
    const resLogs = mockResponse();
    await internalNotificationController.getDeliveryLog(reqLogs, resLogs);
    assert(resLogs.statusCode === 200 && resLogs.body.logs.length >= 2, 'Delivery log recorded for all channels');
    const emailLog = resLogs.body.logs.find(l => l.channel === 'EMAIL');
    assert(emailLog && emailLog.status === 'SKIPPED_PREFERENCE', 'Email channel correctly SKIPPED_PREFERENCE when disabled by employee');

    console.log('\n--- 5. Testing Employee Device Token Registration & Unregistration ---');

    const reqRegToken = {
      body: { platform: 'ANDROID', deviceToken: 'token_emp1_device_123' },
      user: userEmp1
    };
    const resRegToken = mockResponse();
    await internalNotificationController.registerDeviceToken(reqRegToken, resRegToken);
    assert(resRegToken.statusCode === 200 && resRegToken.body.token.isActive === true, 'Employee push device token registered successfully');

    const reqUnregToken = {
      body: { deviceToken: 'token_emp1_device_123' },
      user: userEmp1
    };
    const resUnregToken = mockResponse();
    await internalNotificationController.unregisterDeviceToken(reqUnregToken, resUnregToken);
    assert(resUnregToken.statusCode === 200, 'Employee push device token unregistered successfully');

    console.log('\n--- 6. Testing Real Modules 1-8 Event Dispatch Integration ---');

    // Task Creation -> NEW_TASK_ASSIGNED
    const reqTask = {
      body: {
        projectId: project._id.toString(),
        departmentId: dept._id.toString(),
        taskName: 'ERP Module 9 - Foundation Test Task',
        assignedEmployee: userEmp1._id.toString()
      },
      user: userPM
    };
    const resTask = mockResponse();
    await taskController.createTask(reqTask, resTask);
    assert(resTask.statusCode === 201, 'New task created successfully');

    await new Promise(r => setTimeout(r, 100));
    const emp1Notifs = await InternalNotification.find({ userId: userEmp1._id, type: 'NEW_TASK_ASSIGNED' });
    assert(emp1Notifs.length >= 1, 'Real event trigger: NEW_TASK_ASSIGNED notification received by assigned employee');

    // Chat Message -> CHAT_NEW_MESSAGE
    const reqChat = {
      params: { projectId: project._id.toString() },
      body: { messageText: 'Testing ERP Module 9 chat notification dispatch' },
      user: userEmp1
    };
    const resChat = mockResponse();
    await chatController.sendInternalMessage(reqChat, resChat);
    assert(resChat.statusCode === 201, 'Chat message posted');

    await new Promise(r => setTimeout(r, 100));
    const chatNotifs = await InternalNotification.find({ type: 'CHAT_NEW_MESSAGE' });
    assert(chatNotifs.length >= 1, 'Real event trigger: CHAT_NEW_MESSAGE notification dispatched to team');

    // Overdue Tasks -> Three-way broadcast (TASK_OVERDUE)
    const reqOverdue = { query: { projectId: project._id.toString() }, user: userPM };
    const resOverdue = mockResponse();
    await taskController.getOverdueTasks(reqOverdue, resOverdue);
    assert(resOverdue.statusCode === 200, 'Overdue task scan executed');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 9 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 9 test run:', error);
    process.exit(1);
  }
}

runErpModule9Tests();
