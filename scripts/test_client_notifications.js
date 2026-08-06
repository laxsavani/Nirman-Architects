/**
 * Verification Test Suite for CRM Module 10: Client Notifications
 * 
 * Runs end-to-end multi-channel dispatch, preferences, push device token registration,
 * WhatsApp graceful degradation, chat push debouncing, and delivery audit log testing.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const ClientTicket = require('../models/ClientTicket');

const ClientNotification = require('../models/ClientNotification');
const ClientNotificationPreference = require('../models/ClientNotificationPreference');
const ClientDeviceToken = require('../models/ClientDeviceToken');
const NotificationDeliveryLog = require('../models/NotificationDeliveryLog');
const WhatsAppConfig = require('../models/WhatsAppConfig');

const NotificationDispatcher = require('../utils/notificationDispatcher');
const clientNotificationController = require('../controllers/clientNotification.controller');
const notificationAdminController = require('../controllers/notificationAdmin.controller');
const ticketController = require('../controllers/ticket.controller');
const feedbackController = require('../controllers/feedback.controller');

// Mock Express Helpers
function createMockReq(params = {}, body = {}, query = {}, clientContact = null, user = null) {
  return {
    params,
    body,
    query,
    clientContact,
    user
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    responseData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.responseData = data;
      return this;
    }
  };
  return res;
}

async function runVerificationSuite() {
  console.log('====================================================');
  console.log('🚀 Starting CRM Module 10: Client Notifications Test Suite');
  console.log('====================================================');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log('\n--- Setting Up Test Entities ---');

    // RoleMaster
    let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({
        roleName: 'Admin',
        roleCode: 'ADMIN',
        description: 'System Admin'
      });
    }

    // Admin User
    let testAdmin = await User.findOne({ email: 'admin.notif.test@nirman.com' });
    if (!testAdmin) {
      testAdmin = await User.create({
        name: 'Notif Test Admin',
        email: 'admin.notif.test@nirman.com',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        roleId: adminRole._id,
        phone: '9988771122',
        designation: 'Admin',
        department: 'Management',
        baseSalary: 50000,
        isActive: true
      });
    }

    // Client
    let clientObj = await Client.findOne({ name: 'Client Notif Corp' });
    if (!clientObj) {
      clientObj = await Client.create({
        name: 'Client Notif Corp',
        companyName: 'Notif Systems',
        email: 'info@notifcorp.com',
        phone: '9777711111',
        isActive: true
      });
    }

    // Client Contact 1 (OWNER)
    let contactOwner = await ClientContact.findOne({ email: 'owner.notif@client.com' });
    if (!contactOwner) {
      contactOwner = await ClientContact.create({
        clientId: clientObj._id,
        name: 'Karan Malhotra (Owner)',
        email: 'owner.notif@client.com',
        phone: '9876599991',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'OWNER',
        isPrimaryContact: true,
        isActive: true
      });
    }

    // Clean up prior test notifications & preferences for clean assertion testing
    await ClientNotification.deleteMany({ contactId: contactOwner._id });
    await ClientNotificationPreference.deleteMany({ contactId: contactOwner._id });
    await ClientDeviceToken.deleteMany({ contactId: contactOwner._id });
    await NotificationDeliveryLog.deleteMany({});

    // Project
    let projectObj = await Project.findOne({ name: 'Notif Skyline Towers' });
    if (!projectObj) {
      projectObj = await Project.create({
        name: 'Notif Skyline Towers',
        status: 'In Progress',
        projectManager: testAdmin._id
      });
    }

    // Linkage
    await ClientProjectLink.findOneAndUpdate(
      { clientId: clientObj._id, projectId: projectObj._id },
      { isActive: true, visibleToClient: true },
      { upsert: true }
    );

    console.log('Setup completed.');

    // ----------------------------------------------------
    // TEST 1: Multi-Channel Dispatch & Log Tracking
    // ----------------------------------------------------
    console.log('\n--- Test 1: Multi-Channel Notification Dispatching ---');
    const createdNotifs = await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'TICKET_STATUS_CHANGED',
      title: 'Support Ticket Resolved',
      message: 'Your ticket regarding floor 3 structural layout has been marked as RESOLVED.',
      deepLink: 'client/tickets/123',
      projectId: projectObj._id,
      clientId: clientObj._id
    });

    assert(createdNotifs.length === 1, 'NotificationDispatcher created exactly 1 ClientNotification document');
    const notif1 = createdNotifs[0];
    assert(notif1.isRead === false, 'Notification defaults to isRead = false');

    const logs1 = await NotificationDeliveryLog.find({ notificationId: notif1._id });
    assert(logs1.length >= 3, 'Delivery audit logs recorded entries for IN_APP, PUSH, EMAIL, and WHATSAPP');
    const inAppLog = logs1.find(l => l.channel === 'IN_APP');
    assert(inAppLog && inAppLog.status === 'SENT', 'IN_APP delivery log status is SENT');

    // ----------------------------------------------------
    // TEST 2: Notification Center & Mark-Read Operations
    // ----------------------------------------------------
    console.log('\n--- Test 2: Notification Center & Unread Count Operations ---');
    const reqCenter = createMockReq({}, {}, {}, { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() });
    const resCenter = createMockRes();
    await clientNotificationController.getMyNotifications(reqCenter, resCenter);

    assert(resCenter.statusCode === 200, 'getMyNotifications returned HTTP 200');
    assert(resCenter.responseData.unreadCount === 1, 'unreadCount is currently 1');

    // Mark single notification read
    const reqRead = createMockReq(
      { id: notif1._id.toString() },
      {},
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }
    );
    const resRead = createMockRes();
    await clientNotificationController.markAsRead(reqRead, resRead);

    assert(resRead.statusCode === 200, 'markAsRead returned HTTP 200');
    assert(resRead.responseData.unreadCount === 0, 'unreadCount decremented to 0');

    // Dispatch 2 more notifications and test markAllAsRead
    await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'DOCUMENT_SHARED',
      title: 'New Document Shared',
      message: 'Architectural Blueprint Rev-2 has been shared with your account.',
      clientId: clientObj._id
    });

    await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'CHAT_MENTION',
      title: 'You were mentioned in Chat',
      message: 'PM Rohan Sharma mentioned you in project chat.',
      clientId: clientObj._id
    });

    const resUnreadBefore = createMockRes();
    await clientNotificationController.getUnreadCount(reqCenter, resUnreadBefore);
    assert(resUnreadBefore.responseData.unreadCount === 2, 'Unread count is 2 after receiving 2 new notifications');

    const reqMarkAll = createMockReq({}, {}, {}, { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() });
    const resMarkAll = createMockRes();
    await clientNotificationController.markAllAsRead(reqMarkAll, resMarkAll);

    assert(resMarkAll.statusCode === 200, 'markAllAsRead returned HTTP 200');
    assert(resMarkAll.responseData.unreadCount === 0, 'unreadCount reset to 0 after markAllAsRead');

    // ----------------------------------------------------
    // TEST 3: Channel Delivery Preferences
    // ----------------------------------------------------
    console.log('\n--- Test 3: Channel Delivery Preferences ---');
    const reqPrefUpdate = createMockReq(
      {},
      { pushEnabled: false, emailEnabled: true },
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }
    );
    const resPrefUpdate = createMockRes();
    await clientNotificationController.updatePreferences(reqPrefUpdate, resPrefUpdate);

    assert(resPrefUpdate.statusCode === 200, 'updatePreferences returned HTTP 200');
    assert(resPrefUpdate.responseData.preferences.pushEnabled === false, 'pushEnabled updated to false');

    const notifPrefTest = (await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'DRAWING_PENDING_APPROVAL',
      title: 'Drawing Approval Required',
      message: 'New drawing pending approval.',
      clientId: clientObj._id
    }))[0];

    const logsPrefTest = await NotificationDeliveryLog.find({ notificationId: notifPrefTest._id });
    const pushLogPref = logsPrefTest.find(l => l.channel === 'PUSH');
    assert(pushLogPref && pushLogPref.status === 'SKIPPED_PREFERENCE', 'PUSH channel status is SKIPPED_PREFERENCE when pushEnabled=false');

    // Restore pushEnabled = true
    await clientNotificationController.updatePreferences(
      createMockReq({}, { pushEnabled: true }, {}, { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }),
      createMockRes()
    );

    // ----------------------------------------------------
    // TEST 4: Push Device Token Registration
    // ----------------------------------------------------
    console.log('\n--- Test 4: Push Device Token Registration ---');
    const reqDeviceReg = createMockReq(
      {},
      { platform: 'ANDROID', deviceToken: 'fcm_token_test_998877' },
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }
    );
    const resDeviceReg = createMockRes();
    await clientNotificationController.registerDeviceToken(reqDeviceReg, resDeviceReg);

    assert(resDeviceReg.statusCode === 200, 'registerDeviceToken returned HTTP 200');

    const notifDeviceTest = (await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'DRAWING_APPROVAL_REMINDER',
      title: 'Approval Reminder',
      message: 'Pending approval reminder.',
      clientId: clientObj._id
    }))[0];

    const logsDeviceTest = await NotificationDeliveryLog.find({ notificationId: notifDeviceTest._id });
    const pushLogActive = logsDeviceTest.find(l => l.channel === 'PUSH');
    assert(pushLogActive && pushLogActive.status === 'SENT', 'PUSH channel status is SENT when active device token exists');

    // Unregister device token
    const reqDeviceUnreg = createMockReq(
      {},
      { deviceToken: 'fcm_token_test_998877' },
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }
    );
    const resDeviceUnreg = createMockRes();
    await clientNotificationController.unregisterDeviceToken(reqDeviceUnreg, resDeviceUnreg);

    assert(resDeviceUnreg.statusCode === 200, 'unregisterDeviceToken returned HTTP 200');
    const deviceTokenDoc = await ClientDeviceToken.findOne({ deviceToken: 'fcm_token_test_998877' });
    assert(deviceTokenDoc.isActive === false, 'Device token set to isActive = false after unregistration');

    // ----------------------------------------------------
    // TEST 5: WhatsApp Graceful Degradation
    // ----------------------------------------------------
    console.log('\n--- Test 5: WhatsApp Graceful Degradation ---');
    // Enable whatsapp preference for contact
    await clientNotificationController.updatePreferences(
      createMockReq({}, { whatsappEnabled: true }, {}, { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }),
      createMockRes()
    );

    // Deactivate any active WhatsApp config
    await WhatsAppConfig.updateMany({}, { isActive: false });

    const notifWATest = (await NotificationDispatcher.dispatch({
      contactIds: [contactOwner._id],
      type: 'PROJECT_DELAY',
      title: 'Timeline Alert',
      message: 'Project timeline updated.',
      clientId: clientObj._id
    }))[0];

    const logsWATest = await NotificationDeliveryLog.find({ notificationId: notifWATest._id });
    const waLog = logsWATest.find(l => l.channel === 'WHATSAPP');
    assert(waLog && waLog.status === 'SKIPPED_NOT_CONFIGURED', 'WHATSAPP status is SKIPPED_NOT_CONFIGURED when API config is missing/inactive');

    // ----------------------------------------------------
    // TEST 6: Chat Push Debouncing / Batching
    // ----------------------------------------------------
    console.log('\n--- Test 6: Chat Push Debouncing / Batching ---');
    const batchedNotifs = await NotificationDispatcher.dispatchChatBatch({
      contactIds: [contactOwner._id],
      projectId: projectObj._id,
      messageCount: 4,
      lastSenderName: 'Senior Architect Staff',
      clientId: clientObj._id
    });

    assert(batchedNotifs.length === 1, 'Chat batch dispatcher generated 1 consolidated push notification payload');
    assert(batchedNotifs[0].message.includes('4 new chat message(s)'), 'Batch notification message includes total count summary');

    // ----------------------------------------------------
    // TEST 7: Module Hookpoint Integration (Ticket Status Update)
    // ----------------------------------------------------
    console.log('\n--- Test 7: Module Hookpoint Integration (Ticket Status Update) ---');
    const testTicket = await ClientTicket.create({
      clientId: clientObj._id,
      projectId: projectObj._id,
      raisedBy: contactOwner._id,
      subject: 'Module 10 Integration Ticket Test',
      description: 'Testing ticket status update notification trigger',
      status: 'OPEN',
      assignedTo: testAdmin._id
    });

    // Internal PM updates ticket status
    const reqStatusUpdate = createMockReq(
      { id: testTicket._id.toString() },
      { newStatus: 'RESOLVED' },
      {},
      null,
      { id: testAdmin._id.toString() }
    );
    const resStatusUpdate = createMockRes();
    await ticketController.updateTicketStatus(reqStatusUpdate, resStatusUpdate);

    assert(resStatusUpdate.statusCode === 200, 'Ticket status updated to RESOLVED');

    const ticketNotif = await ClientNotification.findOne({
      contactId: contactOwner._id,
      refId: testTicket._id,
      type: 'TICKET_STATUS_CHANGED'
    });
    assert(ticketNotif !== null, 'Ticket status update automatically fired ClientNotification to raisedBy contact');

    // ----------------------------------------------------
    // TEST 8: Internal Delivery Audit Log Debugging Endpoint
    // ----------------------------------------------------
    console.log('\n--- Test 8: Internal Delivery Audit Log Debugging ---');
    const reqAuditLog = createMockReq(
      { notificationId: notif1._id.toString() },
      {},
      {},
      null,
      { id: testAdmin._id.toString() }
    );
    const resAuditLog = createMockRes();
    await notificationAdminController.getDeliveryLog(reqAuditLog, resAuditLog);

    assert(resAuditLog.statusCode === 200, 'getDeliveryLog returned HTTP 200');
    assert(resAuditLog.responseData.logs.length >= 3, 'Delivery audit logs retrieved for specified notification ID');

    console.log('\n====================================================');
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('CRITICAL ERROR in notifications test suite:', err);
    process.exit(1);
  }
}

runVerificationSuite();
