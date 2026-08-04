require('../utils/logger');
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
const ClientPortalSession = require('../models/ClientPortalSession');
const SiteLocation = require('../models/SiteLocation');

const clientPortalController = require('../controllers/clientPortal.controller');
const clientAuthController = require('../controllers/clientAuth.controller');
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

async function runModule4Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 4: CLIENT PORTAL CORE — TEST SUITE');
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
    const testEmails = ['client.alpha.owner@m4.com', 'client.beta.owner@m4.com', 'client.empty@m4.com'];
    const existingContacts = await ClientContact.find({ email: { $in: testEmails } });
    const existingClientIds = existingContacts.map(c => c.clientId);

    await ClientPortalSession.deleteMany({ contactId: { $in: existingContacts.map(c => c._id) } });
    await ClientProjectLink.deleteMany({ clientId: { $in: existingClientIds } });
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });

    // 1. Create Test Clients & Contacts
    const clientAlpha = await Client.create({
      name: 'Client Alpha Corporation',
      companyName: 'Alpha Group',
      phone: '9911122233',
      email: 'client.alpha.owner@m4.com',
      isActive: true
    });

    const contactAlphaOwner = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha Owner',
      email: 'client.alpha.owner@m4.com',
      password: await hashPassword('TempAlpha@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: true,
      isActive: true
    });

    const clientBeta = await Client.create({
      name: 'Client Beta Ltd',
      phone: '9944455566',
      email: 'client.beta.owner@m4.com',
      isActive: true
    });

    const contactBetaOwner = await ClientContact.create({
      clientId: clientBeta._id,
      name: 'Beta Owner',
      email: 'client.beta.owner@m4.com',
      password: await hashPassword('PassBeta@1234'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: false,
      isActive: true
    });

    const clientEmpty = await Client.create({
      name: 'Empty Client (No Projects Yet)',
      phone: '9977788899',
      email: 'client.empty@m4.com',
      isActive: true
    });

    const contactEmptyOwner = await ClientContact.create({
      clientId: clientEmpty._id,
      name: 'Empty Owner',
      email: 'client.empty@m4.com',
      password: await hashPassword('PassEmpty@1234'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: false,
      isActive: true
    });

    // 2. Create Test Projects (Active & Completed with Milestones)
    const projectActive = await Project.create({
      name: 'Alpha Commercial Tower',
      status: 'In Progress',
      progressPercent: 45,
      startDate: new Date('2026-01-15'),
      estimatedCompletion: new Date('2026-12-31'),
      thumbnailUrl: 'https://cdn.nirman.com/p1.jpg',
      milestones: [
        { title: 'Excavation & Footing', dueDate: new Date('2026-03-01'), completedDate: new Date('2026-03-05'), isCompleted: true },
        { title: 'Structural Slab L1-L5', dueDate: new Date('2026-08-30'), isCompleted: false },
        { title: 'Interior Fitout', dueDate: new Date('2026-11-15'), isCompleted: false }
      ]
    });

    const projectCompleted = await Project.create({
      name: 'Alpha Executive Residency',
      status: 'Completed',
      progressPercent: 100,
      startDate: new Date('2025-01-01'),
      actualCompletion: new Date('2025-12-20'),
      thumbnailUrl: 'https://cdn.nirman.com/p2.jpg'
    });

    const projectBetaOnly = await Project.create({
      name: 'Beta Shopping Mall',
      status: 'Site Work',
      progressPercent: 20
    });

    // Link Projects to Clients via ClientProjectLink (Module 3)
    const linkAlpha1 = await ClientProjectLink.create({
      clientId: clientAlpha._id,
      projectId: projectActive._id,
      visibleToClient: true,
      linkedBy: new mongoose.Types.ObjectId()
    });

    const linkAlpha2 = await ClientProjectLink.create({
      clientId: clientAlpha._id,
      projectId: projectCompleted._id,
      visibleToClient: true,
      linkedBy: new mongoose.Types.ObjectId()
    });

    const linkBeta = await ClientProjectLink.create({
      clientId: clientBeta._id,
      projectId: projectBetaOnly._id,
      visibleToClient: true,
      linkedBy: new mongoose.Types.ObjectId()
    });


    console.log('--- 1. Testing Login & mustChangePassword Enforcement ---');

    const reqLogin = { body: { email: 'client.alpha.owner@m4.com', password: 'TempAlpha@123' } };
    const resLogin = mockResponse();
    await clientAuthController.login(reqLogin, resLogin);
    assert(
      resLogin.statusCode === 200 && resLogin.body.contact.mustChangePassword === true,
      'First login returns contact profile flagged with mustChangePassword: true'
    );


    console.log('\n--- 2. Testing Aggregated Dashboard (GET /api/client/dashboard) ---');

    const reqDashAlpha = {
      clientContact: {
        clientId: clientAlpha._id.toString(),
        contactId: contactAlphaOwner._id.toString(),
        permissionLevel: 'OWNER'
      }
    };
    const resDashAlpha = mockResponse();
    await clientPortalController.getDashboard(reqDashAlpha, resDashAlpha);
    const bodyAlpha = resDashAlpha.body;

    assert(resDashAlpha.statusCode === 200 && bodyAlpha.success, 'Dashboard API responds with HTTP 200 Success');
    assert(bodyAlpha.activeProjects.length === 1 && bodyAlpha.activeProjects[0].name === 'Alpha Commercial Tower', 'Dashboard correctly groups Active projects');
    assert(bodyAlpha.pastProjects.length === 1 && bodyAlpha.pastProjects[0].name === 'Alpha Executive Residency', 'Dashboard correctly groups Past/Completed projects');
    assert(bodyAlpha.activeProjects[0].nextMilestone.title === 'Structural Slab L1-L5', 'Dashboard identifies next incomplete milestone correctly');


    console.log('\n--- 3. Testing Empty State for Client with Zero Linked Projects ---');

    const reqDashEmpty = {
      clientContact: {
        clientId: clientEmpty._id.toString(),
        contactId: contactEmptyOwner._id.toString(),
        permissionLevel: 'OWNER'
      }
    };
    const resDashEmpty = mockResponse();
    await clientPortalController.getDashboard(reqDashEmpty, resDashEmpty);
    assert(
      resDashEmpty.statusCode === 200 &&
      resDashEmpty.body.activeProjects.length === 0 &&
      resDashEmpty.body.pastProjects.length === 0 &&
      resDashEmpty.body.totalProjectsCount === 0,
      'Client with no linked projects returns clean empty dashboard arrays without erroring'
    );


    console.log('\n--- 4. Testing Cross-Client Security Isolation (Project Detail & Sub-resources) ---');

    // Client Alpha attempts to access Client Beta's project -> REJECTED (403)
    const reqDetailCross = {
      params: { projectId: projectBetaOnly._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDetailCross = mockResponse();
    await clientPortalController.getProjectDetail(reqDetailCross, resDetailCross);
    assert(
      resDetailCross.statusCode === 403,
      'Cross-Client ID-guessing attack rejected with 403 Access Denied on Project Detail'
    );

    const resMilestonesCross = mockResponse();
    await clientPortalController.getProjectMilestones(reqDetailCross, resMilestonesCross);
    assert(resMilestonesCross.statusCode === 403, 'Cross-Client ID-guessing attack rejected with 403 Access Denied on Milestones');

    const resTimelineCross = mockResponse();
    await clientPortalController.getProjectTimeline(reqDetailCross, resTimelineCross);
    assert(resTimelineCross.statusCode === 403, 'Cross-Client ID-guessing attack rejected with 403 Access Denied on Timeline');


    console.log('\n--- 5. Testing Authorized Project Detail, Milestones & Timeline ---');

    // Authorized Client Alpha fetches own active project
    const reqDetailAuth = {
      params: { projectId: projectActive._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDetailAuth = mockResponse();
    await clientPortalController.getProjectDetail(reqDetailAuth, resDetailAuth);
    assert(resDetailAuth.statusCode === 200 && resDetailAuth.body.project.name === 'Alpha Commercial Tower', 'Authorized Client can retrieve genuine linked project details');

    const resMilestonesAuth = mockResponse();
    await clientPortalController.getProjectMilestones(reqDetailAuth, resMilestonesAuth);
    assert(resMilestonesAuth.statusCode === 200 && resMilestonesAuth.body.milestones.length === 3, 'Authorized Client retrieves project milestones');

    const resTimelineAuth = mockResponse();
    await clientPortalController.getProjectTimeline(reqDetailAuth, resTimelineAuth);
    assert(resTimelineAuth.statusCode === 200 && resTimelineAuth.body.timeline.length > 0, 'Authorized Client retrieves formatted timeline events');


    console.log('\n--- 6. Testing Graceful Degradation for Project with No Milestones ---');

    const reqMilestonesEmpty = {
      params: { projectId: projectCompleted._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resMilestonesEmpty = mockResponse();
    await clientPortalController.getProjectMilestones(reqMilestonesEmpty, resMilestonesEmpty);
    assert(resMilestonesEmpty.statusCode === 200 && resMilestonesEmpty.body.milestones.length === 0, 'Project with no milestones degrades gracefully to empty array');


    console.log('\n--- 7. Testing Profile Update (PUT /api/client-auth/profile) ---');

    const reqProfileUpdate = {
      body: { name: 'Alpha Owner Updated', phone: '9911199999' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resProfileUpdate = mockResponse();
    await clientPortalController.updateProfile(reqProfileUpdate, resProfileUpdate);
    assert(resProfileUpdate.statusCode === 200 && resProfileUpdate.body.contact.name === 'Alpha Owner Updated', 'ClientContact can update own name and phone number');


    console.log('\n--- 8. Testing Session Logging & Heartbeat (Web & Mobile) ---');

    // Log Session (Web)
    const reqSessionWeb = {
      body: { platform: 'WEB' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resSessionWeb = mockResponse();
    await clientPortalController.logSessionLogin(reqSessionWeb, resSessionWeb);
    assert(resSessionWeb.statusCode === 201 && resSessionWeb.body.session.platform === 'WEB', 'ClientPortalSession logs WEB platform login');
    const sessionId = resSessionWeb.body.session._id;

    // Log Session (Android Mobile)
    const reqSessionAndroid = {
      body: { platform: 'ANDROID' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resSessionAndroid = mockResponse();
    await clientPortalController.logSessionLogin(reqSessionAndroid, resSessionAndroid);
    assert(resSessionAndroid.statusCode === 201 && resSessionAndroid.body.session.platform === 'ANDROID', 'ClientPortalSession logs ANDROID mobile platform login');

    // Heartbeat
    const reqHeartbeat = {
      body: { sessionId },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resHeartbeat = mockResponse();
    await clientPortalController.sessionHeartbeat(reqHeartbeat, resHeartbeat);
    assert(resHeartbeat.statusCode === 200 && resHeartbeat.body.serverTimestamp !== undefined, 'Session heartbeat updates lastActiveAt and returns server timestamp');


    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 4 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 4 test run:', error);
    process.exit(1);
  }
}

runModule4Tests();
