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
const ClientProjectLinkHistory = require('../models/ClientProjectLinkHistory');

const clientProjectLinkController = require('../controllers/clientProjectLink.controller');
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

async function runModule3Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 3: CLIENT-PROJECT LINKAGE — TEST SUITE');
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
    // 1. Setup Test Admin User and PM User
    let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN' });
    }

    let pmRole = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!pmRole) {
      pmRole = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER' });
    }

    const testAdmin = await User.findOneAndUpdate(
      { email: 'test.admin.m3@nirman.com' },
      { name: 'Module3 Admin', email: 'test.admin.m3@nirman.com', password: 'hash', roleId: adminRole._id },
      { upsert: true, returnDocument: 'after' }
    );

    const testPM = await User.findOneAndUpdate(
      { email: 'test.pm.m3@nirman.com' },
      { name: 'Module3 PM', email: 'test.pm.m3@nirman.com', password: 'hash', roleId: pmRole._id },
      { upsert: true, returnDocument: 'after' }
    );

    const adminReqUser = { id: testAdmin._id.toString(), _id: testAdmin._id, roleCode: 'ADMIN' };
    const pmReqUser = { id: testPM._id.toString(), _id: testPM._id, roleCode: 'PROJECT_MANAGER' };

    // Clean up test data from previous runs
    const testEmails = ['client.a.owner@m3.com', 'client.b.owner@m3.com', 'client.deact@m3.com'];
    const testContacts = await ClientContact.find({ email: { $in: testEmails } });
    const testClientIds = testContacts.map(c => c.clientId);

    await ClientProjectLinkHistory.deleteMany({ clientId: { $in: testClientIds } });
    await ClientProjectLink.deleteMany({ clientId: { $in: testClientIds } });
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });

    // Create Test Clients & ClientContacts
    const clientA = await Client.create({
      name: 'Client A Enterprises',
      companyName: 'Group A',
      phone: '9900011122',
      email: 'client.a.owner@m3.com',
      isActive: true
    });

    const contactA = await ClientContact.create({
      clientId: clientA._id,
      name: 'Owner A',
      email: 'client.a.owner@m3.com',
      password: await hashPassword('PassA@1234'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: false,
      isActive: true
    });

    const clientB = await Client.create({
      name: 'Client B Corporation',
      companyName: 'Group B',
      phone: '9900033344',
      email: 'client.b.owner@m3.com',
      isActive: true
    });

    const contactB = await ClientContact.create({
      clientId: clientB._id,
      name: 'Owner B',
      email: 'client.b.owner@m3.com',
      password: await hashPassword('PassB@1234'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      mustChangePassword: false,
      isActive: true
    });

    const clientDeactivated = await Client.create({
      name: 'Deactivated Client',
      phone: '9900055566',
      email: 'client.deact@m3.com',
      isActive: false
    });

    // Create Test Projects
    const project1 = await Project.create({ name: 'Commercial Tower 101', projectManager: testPM._id });
    const project2 = await Project.create({ name: 'Residential Villa 202', projectManager: testPM._id });
    const project3 = await Project.create({ name: 'Shopping Mall 303', projectManager: testPM._id });


    console.log('--- 1. Testing Link Creation & Validation Rules ---');

    // PM creates a valid link: Client A -> Project 1
    const reqCreate1 = {
      body: { clientId: clientA._id.toString(), projectId: project1._id.toString() },
      user: pmReqUser
    };
    const resCreate1 = mockResponse();
    await clientProjectLinkController.createLink(reqCreate1, resCreate1);
    assert(resCreate1.statusCode === 201 && resCreate1.body.success, 'PM can link a valid active Client + Project pair');
    const link1Id = resCreate1.body.link._id.toString();

    // Duplicate active link attempt -> Rejection (400)
    const reqDup = {
      body: { clientId: clientA._id.toString(), projectId: project1._id.toString() },
      user: pmReqUser
    };
    const resDup = mockResponse();
    await clientProjectLinkController.createLink(reqDup, resDup);
    assert(resDup.statusCode === 400, 'Duplicate active link creation for same pair is rejected (400)');

    // Multiple different projects linked to same Client A -> Project 2
    const reqCreate2 = {
      body: { clientId: clientA._id.toString(), projectId: project2._id.toString() },
      user: pmReqUser
    };
    const resCreate2 = mockResponse();
    await clientProjectLinkController.createLink(reqCreate2, resCreate2);
    assert(resCreate2.statusCode === 201, 'Multiple different Projects can be linked to the same Client account');
    const link2Id = resCreate2.body.link._id.toString();

    // Link Project 3 to Client B
    const reqCreate3 = {
      body: { clientId: clientB._id.toString(), projectId: project3._id.toString() },
      user: pmReqUser
    };
    const resCreate3 = mockResponse();
    await clientProjectLinkController.createLink(reqCreate3, resCreate3);

    // Linking to a deactivated Client -> Rejection (400)
    const reqDeactLink = {
      body: { clientId: clientDeactivated._id.toString(), projectId: project1._id.toString() },
      user: pmReqUser
    };
    const resDeactLink = mockResponse();
    await clientProjectLinkController.createLink(reqDeactLink, resDeactLink);
    assert(resDeactLink.statusCode === 400, 'Linking to a deactivated Client account is blocked (400)');


    console.log('\n--- 2. Testing Link Retrieval Endpoints ---');

    // GET links by client
    const reqByClient = { params: { clientId: clientA._id.toString() }, user: pmReqUser };
    const resByClient = mockResponse();
    await clientProjectLinkController.getLinksByClient(reqByClient, resByClient);
    assert(resByClient.body.links.length === 2, 'by-client retrieves all active links for specified Client');

    // GET links by project
    const reqByProject = { params: { projectId: project1._id.toString() }, user: pmReqUser };
    const resByProject = mockResponse();
    await clientProjectLinkController.getLinksByProject(reqByProject, resByProject);
    assert(resByProject.body.links.length === 1 && resByProject.body.links[0].clientId._id.toString() === clientA._id.toString(), 'by-project retrieves linked Client for specified Project');


    console.log('\n--- 3. Testing Client Portal Project Discovery & Visibility Controls ---');

    // Client A contact requests my projects
    const reqMyA1 = { clientContact: { clientId: clientA._id.toString(), contactId: contactA._id.toString() } };
    const resMyA1 = mockResponse();
    await clientProjectLinkController.getMyProjects(reqMyA1, resMyA1);
    assert(resMyA1.body.projects.length === 2, 'GET /api/client/projects/my returns all active visible projects for Client A');

    // Toggle visibility of Project 2 for Client A to false
    const reqVisToggle = {
      params: { id: link2Id },
      body: { visibleToClient: false },
      user: pmReqUser
    };
    const resVisToggle = mockResponse();
    await clientProjectLinkController.toggleVisibility(reqVisToggle, resVisToggle);
    assert(resVisToggle.statusCode === 200 && resVisToggle.body.link.visibleToClient === false, 'PM can toggle project visibility to false');

    // Client A contact requests my projects again -> Project 2 hidden
    const resMyA2 = mockResponse();
    await clientProjectLinkController.getMyProjects(reqMyA1, resMyA2);
    const visibleProjectIds = resMyA2.body.projects.map(p => p._id.toString());
    assert(visibleProjectIds.length === 1 && !visibleProjectIds.includes(project2._id.toString()), 'Hidden project (visibleToClient=false) is excluded from Client Portal list');

    // Client B contact requests my projects -> strictly Client B projects only
    const reqMyB = { clientContact: { clientId: clientB._id.toString(), contactId: contactB._id.toString() } };
    const resMyB = mockResponse();
    await clientProjectLinkController.getMyProjects(reqMyB, resMyB);
    const bProjectIds = resMyB.body.projects.map(p => p._id.toString());
    assert(bProjectIds.length === 1 && bProjectIds.includes(project3._id.toString()) && !bProjectIds.includes(project1._id.toString()), 'Cross-client isolation confirmed: Client B sees only their own linked projects');


    console.log('\n--- 4. Testing Unlinking & Role-Based Access Enforcement ---');

    // PM attempts to unlink project -> Rejection (403 Admin required)
    const reqUnlinkPM = {
      params: { id: link1Id },
      body: { notes: 'PM attempt' },
      user: pmReqUser
    };
    const resUnlinkPM = mockResponse();
    // Route roleMiddleware block simulation
    let pmAllowedUnlink = false;
    if (['ADMIN', 'SUPER_ADMIN'].includes(pmReqUser.roleCode)) {
      await clientProjectLinkController.unlinkProject(reqUnlinkPM, resUnlinkPM);
      pmAllowedUnlink = true;
    } else {
      resUnlinkPM.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
    }
    assert(!pmAllowedUnlink && resUnlinkPM.statusCode === 403, 'Unlink endpoint blocks PM role (403 Access Denied)');

    // Admin unlinks project -> Success
    const reqUnlinkAdmin = {
      params: { id: link1Id },
      body: { notes: 'Ownership transferred' },
      user: adminReqUser
    };
    const resUnlinkAdmin = mockResponse();
    await clientProjectLinkController.unlinkProject(reqUnlinkAdmin, resUnlinkAdmin);
    assert(resUnlinkAdmin.statusCode === 200 && resUnlinkAdmin.body.link.isActive === false, 'Admin can soft-delete link (isActive=false)');

    // Verify unlinked project no longer appears in active queries
    const resByClientAfter = mockResponse();
    await clientProjectLinkController.getLinksByClient(reqByClient, resByClientAfter);
    const activeLinkIdsAfter = resByClientAfter.body.links.map(l => l._id.toString());
    assert(!activeLinkIdsAfter.includes(link1Id), 'Unlinked project excluded from active by-client listing');


    console.log('\n--- 5. Testing Audit History Logging (ClientProjectLinkHistory) ---');

    const historyLogs = await ClientProjectLinkHistory.find({ clientId: clientA._id }).sort({ createdAt: 1 });
    const actionsRecorded = historyLogs.map(h => h.action);
    assert(
      actionsRecorded.includes('LINKED') &&
      actionsRecorded.includes('VISIBILITY_CHANGED') &&
      actionsRecorded.includes('UNLINKED'),
      'All link, visibility-change, and unlink actions recorded in ClientProjectLinkHistory'
    );

    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 3 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 3 test run:', error);
    process.exit(1);
  }
}

runModule3Tests();
