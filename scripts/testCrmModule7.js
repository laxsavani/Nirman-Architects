require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const ChatMessage = require('../models/ChatMessage');
const ClientChatReadStatus = require('../models/ClientChatReadStatus');

const clientChatController = require('../controllers/clientChat.controller');
const chatController = require('../controllers/chat.controller');
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

async function runModule7Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 7: CLIENT CHAT SYSTEM — TEST SUITE');
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
    // Cleanup previous test data
    const testEmails = [
      'client.m7.owner@m7.com',
      'client.m7.member@m7.com',
      'client.m7.viewonly@m7.com',
      'client.beta.m7@m7.com',
      'employee.architect.m7@m7.com'
    ];

    const existingContacts = await ClientContact.find({ email: { $in: testEmails } });
    const existingClientIds = existingContacts.map(c => c.clientId);

    await ClientChatReadStatus.deleteMany({});
    await ChatMessage.deleteMany({});
    await ClientProjectLink.deleteMany({ clientId: { $in: existingClientIds } });
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });
    await User.deleteMany({ email: 'employee.architect.m7@m7.com' });

    // 1. Create Internal Employee User
    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) {
      rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });
    }

    const employeePM = await User.create({
      name: 'Rohan Sharma',
      email: 'employee.architect.m7@m7.com',
      password: await hashPassword('EmpPass@123'),
      roleId: rolePM._id,
      designation: 'Senior Project Manager',
      baseSalary: 45000,
      isActive: true
    });

    // 2. Create Test Clients
    const clientAlpha = await Client.create({
      name: 'Alpha Horizon Realty',
      companyName: 'Horizon Group',
      phone: '9666611111',
      email: 'client.m7.owner@m7.com',
      isActive: true
    });

    const clientBeta = await Client.create({
      name: 'Beta Estate Ventures',
      phone: '9666622222',
      email: 'client.beta.m7@m7.com',
      isActive: true
    });

    // 3. Create Contacts under Client Alpha (OWNER, MEMBER, VIEW_ONLY)
    const contactAlphaOwner = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Rajesh Patel',
      email: 'client.m7.owner@m7.com',
      password: await hashPassword('OwnerPass@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    const contactAlphaMember = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Priya Patel',
      email: 'client.m7.member@m7.com',
      password: await hashPassword('MemberPass@123'),
      permissionLevel: 'MEMBER',
      isPrimaryContact: false,
      isActive: true
    });

    const contactAlphaViewOnly = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Suresh Kumar',
      email: 'client.m7.viewonly@m7.com',
      password: await hashPassword('ViewPass@123'),
      permissionLevel: 'VIEW_ONLY',
      isPrimaryContact: false,
      isActive: true
    });

    const contactBetaOwner = await ClientContact.create({
      clientId: clientBeta._id,
      name: 'Beta Contact',
      email: 'client.beta.m7@m7.com',
      password: await hashPassword('BetaPass@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    // 4. Create Projects & Links
    const projectAlpha = await Project.create({
      name: 'Alpha Horizon Residency',
      status: 'In Progress',
      projectManager: employeePM._id
    });

    const projectBeta = await Project.create({
      name: 'Beta Business Park',
      status: 'In Progress'
    });

    await ClientProjectLink.create({
      clientId: clientAlpha._id,
      projectId: projectAlpha._id,
      visibleToClient: true,
      linkedBy: employeePM._id
    });

    await ClientProjectLink.create({
      clientId: clientBeta._id,
      projectId: projectBeta._id,
      visibleToClient: true,
      linkedBy: employeePM._id
    });

    console.log('\n--- 1. Testing Chat Message Posting by Internal Employee & Client Contact ---');

    // 1. Employee posts initial message
    const msg1 = await ChatMessage.create({
      projectId: projectAlpha._id,
      authorType: 'EMPLOYEE',
      authorId: employeePM._id,
      authorModel: 'User',
      messageText: 'Welcome to the Alpha Horizon project chat workspace!',
      sentAt: new Date(Date.now() - 10000)
    });
    assert(msg1 && msg1.authorType === 'EMPLOYEE', 'Internal employee message created in chat workspace');

    // 2. Client OWNER posts message via API
    const reqPostOwner = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Hello team, we reviewed the latest structural layout.' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString(), permissionLevel: 'OWNER' }
    };
    const resPostOwner = mockResponse();
    await clientChatController.sendMessage(reqPostOwner, resPostOwner);
    assert(resPostOwner.statusCode === 201 && resPostOwner.body.message.formattedAuthorName === 'Rajesh Patel (OWNER)', 'Client OWNER posts message with specific contact attribution ("Rajesh Patel (OWNER)")');

    const msgOwnerId = resPostOwner.body.message._id;

    // 3. Client MEMBER posts threaded reply
    const reqPostReply = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Agreed! I have also verified the site dimensions.', replyToMessageId: msgOwnerId.toString(), mentionedIds: [employeePM._id.toString()] },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString(), permissionLevel: 'MEMBER' }
    };
    const resPostReply = mockResponse();
    await clientChatController.sendMessage(reqPostReply, resPostReply);
    assert(resPostReply.statusCode === 201 && resPostReply.body.message.formattedAuthorName === 'Priya Patel (MEMBER)', 'Client MEMBER posts threaded reply with contact attribution ("Priya Patel (MEMBER)")');
    assert(resPostReply.body.message.replyToMessageId !== null, 'Threaded reply references original message correctly');

    console.log('\n--- 2. Testing Permission-Aware Access (VIEW_ONLY Block) ---');

    // VIEW_ONLY contact attempts to post message -> REJECTED (403)
    const reqPostViewOnly = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Attempting to send as View Only' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaViewOnly._id.toString(), permissionLevel: 'VIEW_ONLY' }
    };
    const resPostViewOnly = mockResponse();
    await clientChatController.sendMessage(reqPostViewOnly, resPostViewOnly);
    assert(resPostViewOnly.statusCode === 403, 'VIEW_ONLY contact blocked from posting chat message (HTTP 403 Access Denied)');

    console.log('\n--- 3. Testing Cross-Client Security Linkage Isolation ---');

    // Client Beta attempts to fetch Client Alpha's project chat -> REJECTED (403)
    const reqCrossChat = {
      params: { projectId: projectAlpha._id.toString() },
      query: {},
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString() }
    };
    const resCrossChat = mockResponse();
    await clientChatController.getProjectChat(reqCrossChat, resCrossChat);
    assert(resCrossChat.statusCode === 403, 'Cross-client chat history request rejected with HTTP 403 Access Denied');

    // Client Beta attempts to send message to Client Alpha's project chat -> REJECTED (403)
    const reqCrossSend = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Unauthenticated message attempt' },
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString(), permissionLevel: 'OWNER' }
    };
    const resCrossSend = mockResponse();
    await clientChatController.sendMessage(reqCrossSend, resCrossSend);
    assert(resCrossSend.statusCode === 403, 'Cross-client message posting attempt rejected with HTTP 403 Access Denied');

    console.log('\n--- 4. Testing Chat History Retrieval & Chronological Interleaved Timeline ---');

    // VIEW_ONLY contact retrieves chat history -> SUCCEEDS (200)
    const reqGetChat = {
      params: { projectId: projectAlpha._id.toString() },
      query: {},
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaViewOnly._id.toString(), permissionLevel: 'VIEW_ONLY' }
    };
    const resGetChat = mockResponse();
    await clientChatController.getProjectChat(reqGetChat, resGetChat);
    assert(resGetChat.statusCode === 200 && resGetChat.body.totalCount === 3, 'Authorized contact retrieves full project chat history (3 messages)');
    assert(resGetChat.body.messages[0].formattedAuthorName.includes('Rohan Sharma'), 'Interleaved timeline orders internal employee message first');
    assert(resGetChat.body.messages[1].formattedAuthorName.includes('Rajesh Patel'), 'Interleaved timeline includes client OWNER message second');
    assert(resGetChat.body.messages[2].formattedAuthorName.includes('Priya Patel'), 'Interleaved timeline includes client MEMBER reply third');

    console.log('\n--- 5. Testing Offline Batch Message Sync ---');

    const reqSyncOffline = {
      params: { projectId: projectAlpha._id.toString() },
      body: {
        messages: [
          { messageText: 'Offline note 1: Checked site boundary wall', localComposedAt: new Date(Date.now() - 5000).toISOString() },
          { messageText: 'Offline note 2: Soil sample sent to lab', localComposedAt: new Date(Date.now() - 2000).toISOString() }
        ]
      },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString(), permissionLevel: 'OWNER' }
    };
    const resSyncOffline = mockResponse();
    await clientChatController.syncOfflineMessages(reqSyncOffline, resSyncOffline);
    assert(resSyncOffline.statusCode === 200 && resSyncOffline.body.syncedCount === 2, 'Batch offline messages synced successfully (syncedCount: 2)');

    const syncedDocs = await ChatMessage.find({ projectId: projectAlpha._id, isOfflineSync: true });
    assert(syncedDocs.length === 2, 'Synced messages persisted with isOfflineSync: true flag');

    console.log('\n--- 6. Testing Read Status Tracking & Unread Counts ---');

    // Fetch unread counts for contactAlphaMember before marking read
    const reqUnreadBefore = {
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString() }
    };
    const resUnreadBefore = mockResponse();
    await clientChatController.getUnreadCounts(reqUnreadBefore, resUnreadBefore);
    assert(resUnreadBefore.statusCode === 200 && resUnreadBefore.body.unreadCounts[0].unreadCount === 5, 'Unread message count accurately reflects un-read messages (5)');

    // Mark chat as read for contactAlphaMember
    const reqMarkRead = {
      params: { projectId: projectAlpha._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString() }
    };
    const resMarkRead = mockResponse();
    await clientChatController.markAsRead(reqMarkRead, resMarkRead);
    assert(resMarkRead.statusCode === 200, 'Chat marked as read successfully');

    // Fetch unread counts after marking read -> should reset to 0
    const resUnreadAfter = mockResponse();
    await clientChatController.getUnreadCounts(reqUnreadBefore, resUnreadAfter);
    assert(resUnreadAfter.statusCode === 200 && resUnreadAfter.body.unreadCounts[0].unreadCount === 0, 'Unread message count resets to 0 after markAsRead');

    console.log('\n--- 7. Testing Internal Team Chat Controller (GET & POST /api/chat/:projectId) ---');

    const reqInternalGet = {
      params: { projectId: projectAlpha._id.toString() },
      query: {}
    };
    const resInternalGet = mockResponse();
    await chatController.getInternalProjectChat(reqInternalGet, resInternalGet);
    assert(resInternalGet.statusCode === 200 && resInternalGet.body.totalCount === 5, 'Internal team retrieves unified project chat history (5 messages)');

    const reqInternalPost = {
      params: { projectId: projectAlpha._id.toString() },
      body: { messageText: 'Internal PM note: Site inspection scheduled for tomorrow.' },
      user: { _id: employeePM._id, name: 'Rohan Sharma', designation: 'Senior Project Manager' }
    };
    const resInternalPost = mockResponse();
    await chatController.sendInternalMessage(reqInternalPost, resInternalPost);
    assert(resInternalPost.statusCode === 201 && resInternalPost.body.message.formattedAuthorName === 'Rohan Sharma (Senior Project Manager)', 'Internal team sends message with employee designation attribution');

    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 7 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 7 test run:', error);
    process.exit(1);
  }
}

runModule7Tests();
