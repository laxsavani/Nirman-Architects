require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const Task = require('../models/Task');
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const ChatMessage = require('../models/ChatMessage');
const EmployeeChatReadStatus = require('../models/EmployeeChatReadStatus');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientProjectLink = require('../models/ClientProjectLink');

const chatController = require('../controllers/chat.controller');
const clientChatController = require('../controllers/clientChat.controller');
const drawingController = require('../controllers/drawing.controller');
const taskController = require('../controllers/task.controller');
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

async function runErpModule5Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 5: INTERNAL PROJECT CHAT — TEST SUITE');
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
      'erp5.admin@erp.com',
      'erp5.assigned@erp.com',
      'erp5.unassigned@erp.com',
      'erp5.client@client.com'
    ];

    await EmployeeChatReadStatus.deleteMany({});
    await ChatMessage.deleteMany({});
    await Task.deleteMany({ taskName: { $regex: /ERP Module 5/i } });
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 5/i } });
    await DrawingCategory.deleteMany({ name: 'ERP5 Working Drawing' });
    await ClientProjectLink.deleteMany({});
    await ClientContact.deleteMany({ email: 'erp5.client@client.com' });
    await Client.deleteMany({ companyName: 'ERP5 Corporate Client' });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 5/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Users
    const userAdmin = await User.create({
      name: 'Aditya Birla',
      email: 'erp5.admin@erp.com',
      password: await hashPassword('Admin@123'),
      roleId: roleAdmin._id,
      designation: 'Studio Director',
      isActive: true
    });

    const userAssigned = await User.create({
      name: 'Nikhil Mehta',
      email: 'erp5.assigned@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Project Architect',
      isActive: true
    });

    const userUnassigned = await User.create({
      name: 'Suresh Raina',
      email: 'erp5.unassigned@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Draftsman',
      isActive: true
    });

    // 3. Client & Contact
    const client = await Client.create({ name: 'ERP5 Corporate Client', companyName: 'ERP5 Corporate Client', phone: '+919876543222' });
    const contactClient = await ClientContact.create({
      clientId: client._id,
      name: 'Sunil Mittal',
      email: 'erp5.client@client.com',
      password: await hashPassword('ClientPass@123'),
      permissionLevel: 'OWNER'
    });

    // 4. Projects (Alpha assigned to userAssigned; Beta separate for cross-project test)
    const projectAlpha = await Project.create({
      projectName: 'ERP Module 5 - Project Alpha Workspace',
      status: 'In Progress',
      createdBy: userAdmin._id,
      teamAssignments: [{ userId: userAssigned._id, projectRole: 'Project Architect' }]
    });

    const projectBeta = await Project.create({
      projectName: 'ERP Module 5 - Project Beta Workspace',
      status: 'In Progress',
      createdBy: userAdmin._id,
      teamAssignments: []
    });

    await ClientProjectLink.create({
      clientId: client._id,
      projectId: projectAlpha._id,
      linkedBy: userAdmin._id,
      visibleToClient: true,
      isActive: true
    });

    // 5. Create Task and Drawing in Project Alpha for Cross-Linking
    const taskAlpha = await Task.create({
      projectId: projectAlpha._id,
      taskName: 'ERP Module 5 - HVAC Section Detailing Task',
      createdBy: userAdmin._id,
      assignedEmployee: userAssigned._id,
      status: 'In Progress'
    });

    const taskBeta = await Task.create({
      projectId: projectBeta._id,
      taskName: 'ERP Module 5 - Beta Site Survey Task',
      createdBy: userAdmin._id,
      assignedEmployee: userAdmin._id
    });

    const catWorking = await DrawingCategory.create({ name: 'ERP5 Working Drawing' });
    const drawingAlpha = await Drawing.create({
      projectId: projectAlpha._id,
      drawingName: 'ERP Module 5 - HVAC Layout Plan',
      categoryId: catWorking._id
    });

    const versionAlpha = await DrawingVersion.create({
      drawingId: drawingAlpha._id,
      versionNumber: 1,
      filePath: '/uploads/dwg/hvac_v1.dwg',
      uploadedBy: userAssigned._id
    });

    console.log('--- 1. Testing Team-Scoped Access Control ---');

    // Assigned Employee views Project Alpha chat -> SUCCEEDS
    const reqGetAssigned = { params: { projectId: projectAlpha._id.toString() }, user: userAssigned };
    const resGetAssigned = mockResponse();
    await chatController.getInternalProjectChat(reqGetAssigned, resGetAssigned);
    assert(resGetAssigned.statusCode === 200, 'Assigned team member retrieves project chat history (HTTP 200 OK)');

    // Unassigned Employee views Project Alpha chat -> REJECTED (HTTP 403)
    const reqGetUnassigned = { params: { projectId: projectAlpha._id.toString() }, user: userUnassigned };
    const resGetUnassigned = mockResponse();
    await chatController.getInternalProjectChat(reqGetUnassigned, resGetUnassigned);
    assert(resGetUnassigned.statusCode === 403, 'Unassigned employee blocked from viewing project chat (HTTP 403 Access Denied)');

    // Admin views Project Alpha chat -> SUCCEEDS (Company-wide oversight)
    const reqGetAdmin = { params: { projectId: projectAlpha._id.toString() }, user: userAdmin };
    const resGetAdmin = mockResponse();
    await chatController.getInternalProjectChat(reqGetAdmin, resGetAdmin);
    assert(resGetAdmin.statusCode === 200, 'Admin accesses project chat without formal team assignment (Company-wide oversight)');

    console.log('\n--- 2. Testing Message Sending with Task & Drawing Cross-Linking ---');

    // Valid message linking taskAlpha and versionAlpha
    const reqMsgLink = {
      params: { projectId: projectAlpha._id.toString() },
      body: {
        messageText: 'Check Task HVAC section detailing alongside drawing v1 layout.',
        linkedTaskId: taskAlpha._id.toString(),
        linkedDrawingVersionId: versionAlpha._id.toString()
      },
      user: userAssigned
    };
    const resMsgLink = mockResponse();
    await chatController.sendInternalMessage(reqMsgLink, resMsgLink);
    assert(resMsgLink.statusCode === 201 && resMsgLink.body.message.linkedTaskId.taskName === 'ERP Module 5 - HVAC Section Detailing Task', 'Message sent with resolved linkedTaskId metadata');
    assert(resMsgLink.body.message.linkedDrawingVersionId.versionNumber === 1, 'Message sent with resolved linkedDrawingVersionId metadata');

    // Attempt sending message with taskBeta (different project) -> REJECTED (HTTP 400)
    const reqMsgCrossLink = {
      params: { projectId: projectAlpha._id.toString() },
      body: {
        messageText: 'Illegal cross-project task reference',
        linkedTaskId: taskBeta._id.toString()
      },
      user: userAssigned
    };
    const resMsgCrossLink = mockResponse();
    await chatController.sendInternalMessage(reqMsgCrossLink, resMsgCrossLink);
    assert(resMsgCrossLink.statusCode === 400, 'Cross-project task linking rejected with HTTP 400 Bad Request');

    console.log('\n--- 3. Testing Offline Batch Sync ---');

    const reqSync = {
      params: { projectId: projectAlpha._id.toString() },
      body: {
        messages: [
          { messageText: 'Offline note 1: Site inspection complete', localComposedAt: new Date(Date.now() - 3600000) },
          { messageText: 'Offline note 2: Updated ducting specs', localComposedAt: new Date(Date.now() - 1800000) }
        ]
      },
      user: userAssigned
    };
    const resSync = mockResponse();
    await chatController.syncOfflineMessages(reqSync, resSync);
    assert(resSync.statusCode === 201 && resSync.body.count === 2, 'Batch sync of 2 offline messages processed with isOfflineSync: true');

    console.log('\n--- 4. Testing Read Receipts & Unread Badges ---');

    // Check unread counts before mark-read
    const reqUnread1 = { user: userAssigned };
    const resUnread1 = mockResponse();
    await chatController.getUnreadCounts(reqUnread1, resUnread1);
    assert(resUnread1.statusCode === 200 && resUnread1.body.unreadSummary.length >= 1 && resUnread1.body.unreadSummary[0].unreadCount >= 3, 'Unread message count retrieved accurately before mark-read');

    // Mark chat read for projectAlpha
    const reqMarkRead = { params: { projectId: projectAlpha._id.toString() }, user: userAssigned };
    const resMarkRead = mockResponse();
    await chatController.markChatRead(reqMarkRead, resMarkRead);
    assert(resMarkRead.statusCode === 200 && resMarkRead.body.readStatus.lastReadMessageAt !== null, 'Chat marked as read successfully');

    // Check unread counts after mark-read -> SHOULD BE 0
    const reqUnread2 = { user: userAssigned };
    const resUnread2 = mockResponse();
    await chatController.getUnreadCounts(reqUnread2, resUnread2);
    const alphaSummary = resUnread2.body.unreadSummary.find(s => s.projectId.toString() === projectAlpha._id.toString());
    assert(alphaSummary && alphaSummary.unreadCount === 0, 'Unread count resets to 0 after mark-read endpoint call');

    console.log('\n--- 5. Testing Unified Interleaving with Client Messages (CRM Module 7 Integration) ---');

    // Client posts message into projectAlpha via CRM Module 7 client endpoint
    const reqClientMsg = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Client Inquiry: When will HVAC drawings be ready for approval?' },
      clientContact: { contactId: contactClient._id.toString(), clientId: client._id.toString() }
    };
    const resClientMsg = mockResponse();
    await clientChatController.sendMessage(reqClientMsg, resClientMsg);
    assert(resClientMsg.statusCode === 201, 'Client posts message into projectAlpha thread via CRM Module 7 endpoint');

    // Internal employee fetches history -> Sees interleaved client message!
    const reqHistory = { params: { projectId: projectAlpha._id.toString() }, user: userAssigned };
    const resHistory = mockResponse();
    await chatController.getInternalProjectChat(reqHistory, resHistory);
    assert(resHistory.statusCode === 200 && resHistory.body.messages.some(m => m.authorType === 'CLIENT_CONTACT'), 'Internal team chat history seamlessly interleaves ClientContact-authored messages');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 5 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 5 test run:', error);
    process.exit(1);
  }
}

runErpModule5Tests();
