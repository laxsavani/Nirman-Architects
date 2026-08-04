require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientContactActionLog = require('../models/ClientContactActionLog');

const leadController = require('../controllers/lead.controller');
const clientController = require('../controllers/client.controller');
const clientAuthController = require('../controllers/clientAuth.controller');
const clientAuthMiddleware = require('../middlewares/clientAuth.middleware');
const authMiddleware = require('../middlewares/auth.middleware');

// Helper to construct a mock Express response object
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

async function runModule2Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 2: CLIENT MASTER + CLIENT CONTACTS + AUTH — TEST SUITE');
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
    // 1. Setup Test Admin User
    let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN' });
    }

    const testAdmin = await User.findOneAndUpdate(
      { email: 'test.admin.m2@nirman.com' },
      { name: 'Module2 Test Admin', email: 'test.admin.m2@nirman.com', password: 'hash', roleId: adminRole._id },
      { upsert: true, returnDocument: 'after' }
    );

    const adminReqUser = { id: testAdmin._id.toString(), _id: testAdmin._id, roleCode: 'ADMIN' };

    // Clean up test data from previous runs to ensure idempotency
    const testEmails = ['shah.owner@enterprises.com', 'patel.residence@gmail.com', 'ramesh@mehtatextiles.com', 'vikram.site@enterprises.com'];
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });
    await Lead.deleteMany({ email: { $in: testEmails } });

    console.log('--- 1. Testing Lead Conversion to Client & Primary OWNER Contact ---');

    // Create a WON Lead WITH email
    const leadWithEmail = await Lead.create({
      name: 'Shah Enterprises',
      phone: '9988776655',
      email: 'shah.owner@enterprises.com',
      source: 'Website',
      requirementNotes: 'Commercial Office Tower Interior',
      assignedTo: testAdmin._id,
      status: 'QUALIFIED',
      createdBy: testAdmin._id
    });

    // Convert Lead to Client
    const reqConv1 = { params: { id: leadWithEmail._id.toString() }, user: adminReqUser, body: {} };
    const resConv1 = mockResponse();
    await leadController.convertToClient(reqConv1, resConv1);

    assert(resConv1.statusCode === 200 && resConv1.body.success, 'Lead conversion succeeds for lead with email');
    const createdClientId = resConv1.body.client._id.toString();
    const primaryContactId = resConv1.body.primaryContact.id.toString();
    const tempPassLead = resConv1.body.primaryContact.temporaryPassword;

    // Verify Lead record updated
    const updatedLead = await Lead.findById(leadWithEmail._id);
    assert(updatedLead.status === 'WON' && updatedLead.convertedToClientId.toString() === createdClientId, 'Lead status updated to WON and convertedToClientId set');

    // Verify ClientContact created as OWNER and isPrimaryContact
    const primaryContactDoc = await ClientContact.findById(primaryContactId);
    assert(
      primaryContactDoc &&
      primaryContactDoc.permissionLevel === 'OWNER' &&
      primaryContactDoc.isPrimaryContact === true &&
      primaryContactDoc.mustChangePassword === true,
      'Primary ClientContact created with OWNER role, isPrimaryContact:true, and mustChangePassword:true'
    );

    console.log('\n--- 2. Testing Conversion Edge Case: Lead Missing Email ---');

    // Create Lead WITHOUT email
    const leadNoEmail = await Lead.create({
      name: 'Patel Family Residence',
      phone: '9898989898',
      email: null,
      source: 'WalkIn',
      assignedTo: testAdmin._id,
      status: 'NEW',
      createdBy: testAdmin._id
    });

    // Attempt conversion without providing primaryContactEmail -> Rejection 400
    const reqConvNoEmail = { params: { id: leadNoEmail._id.toString() }, user: adminReqUser, body: {} };
    const resConvNoEmail = mockResponse();
    await leadController.convertToClient(reqConvNoEmail, resConvNoEmail);
    assert(resConvNoEmail.statusCode === 400, 'Rejects conversion when Lead has no email and body provides no primaryContactEmail');

    // Supply primaryContactEmail in body -> Conversion succeeds
    const reqConvWithEmail = {
      params: { id: leadNoEmail._id.toString() },
      user: adminReqUser,
      body: { primaryContactEmail: 'patel.residence@gmail.com' }
    };
    const resConvWithEmail = mockResponse();
    await leadController.convertToClient(reqConvWithEmail, resConvWithEmail);
    assert(resConvWithEmail.statusCode === 200, 'Conversion succeeds when primaryContactEmail is supplied in request body');


    console.log('\n--- 3. Testing Direct Client Creation (No Prior Lead) ---');

    const reqDirect = {
      body: {
        name: 'Mehta Textiles Headquarters',
        companyName: 'Mehta Textiles Pvt Ltd',
        phone: '9112233445',
        primaryContactName: 'Ramesh Mehta',
        primaryContactEmail: 'ramesh@mehtatextiles.com',
        primaryContactPhone: '9112233445',
        billingAddress: '101 Textile Market, Ring Road, Surat'
      },
      user: adminReqUser
    };
    const resDirect = mockResponse();
    await clientController.createClient(reqDirect, resDirect);
    assert(resDirect.statusCode === 201 && resDirect.body.client.sourceLeadId === null, 'Direct Client creation creates Client with sourceLeadId: null');
    const directClientId = resDirect.body.client._id.toString();
    const directContactEmail = resDirect.body.primaryContact.email;
    const directTempPass = resDirect.body.primaryContact.temporaryPassword;


    console.log('\n--- 4. Testing Client CRUD Operations (Internal Team) ---');

    // List clients
    const reqList = { query: { search: 'Mehta' }, user: adminReqUser };
    const resList = mockResponse();
    await clientController.getClients(reqList, resList);
    assert(resList.body.clients.length === 1 && resList.body.clients[0].name.includes('Mehta'), 'GET /api/clients supports search filtering');

    // Get client details
    const reqDetail = { params: { id: directClientId }, user: adminReqUser };
    const resDetail = mockResponse();
    await clientController.getClientById(reqDetail, resDetail);
    assert(resDetail.body.contacts.length === 1, 'GET /api/clients/:id retrieves account with associated contacts');

    // Update client
    const reqUpdate = {
      params: { id: directClientId },
      body: { companyName: 'Mehta Global Textiles Ltd' },
      user: adminReqUser
    };
    const resUpdate = mockResponse();
    await clientController.updateClient(reqUpdate, resUpdate);
    assert(resUpdate.body.client.companyName === 'Mehta Global Textiles Ltd', 'PUT /api/clients/:id updates account-level fields');


    console.log('\n--- 5. Testing Client Portal Authentication & Token Isolation ---');

    // Login with primary contact credentials
    const reqLogin = {
      body: {
        email: 'shah.owner@enterprises.com',
        password: tempPassLead
      }
    };
    const resLogin = mockResponse();
    await clientAuthController.login(reqLogin, resLogin);
    assert(resLogin.statusCode === 200 && resLogin.body.token && resLogin.body.contact.mustChangePassword === true, 'Client login issues client-scoped JWT with mustChangePassword: true');
    const clientJwtToken = resLogin.body.token;

    // Verify token structure isolation in clientAuthMiddleware vs authMiddleware
    const reqTestClientAuth = { headers: { authorization: `Bearer ${clientJwtToken}` } };
    const resTestClientAuth = mockResponse();
    let clientAuthPassed = false;
    await clientAuthMiddleware(reqTestClientAuth, resTestClientAuth, () => {
      clientAuthPassed = true;
    });
    assert(clientAuthPassed && reqTestClientAuth.clientContact.permissionLevel === 'OWNER', 'clientAuthMiddleware accepts Client-scoped JWT token');

    // Test: Employee route rejects Client token
    const reqEmpRoute = { headers: { authorization: `Bearer ${clientJwtToken}` } };
    const resEmpRoute = mockResponse();
    let empAuthPassed = false;
    authMiddleware(reqEmpRoute, resEmpRoute, () => {
      empAuthPassed = true;
    });
    assert(!empAuthPassed && resEmpRoute.statusCode === 401, 'HRM Employee authMiddleware strictly rejects Client Portal JWT');


    console.log('\n--- 6. Testing Password Change & Reset Flow ---');

    // Change password from temporary password to permanent password
    const reqChangePass = {
      body: {
        currentPassword: tempPassLead,
        newPassword: 'NewPassword@123'
      },
      clientContact: reqTestClientAuth.clientContact
    };
    const resChangePass = mockResponse();
    await clientAuthController.changePassword(reqChangePass, resChangePass);
    assert(resChangePass.statusCode === 200 && resChangePass.body.mustChangePassword === false, 'Password change sets mustChangePassword: false');

    // Verify old temp password no longer works
    const resLoginOld = mockResponse();
    await clientAuthController.login(reqLogin, resLoginOld);
    assert(resLoginOld.statusCode === 401, 'Old temporary password no longer valid for login after change');

    // Forgot password flow
    const reqForgot = { body: { email: 'shah.owner@enterprises.com' } };
    const resForgot = mockResponse();
    await clientAuthController.forgotPassword(reqForgot, resForgot);
    assert(resForgot.statusCode === 200 && resForgot.body.resetToken, 'Forgot password generates valid reset token');

    // Reset password with resetToken
    const reqReset = {
      body: {
        resetToken: resForgot.body.resetToken,
        newPassword: 'ResetPass@999'
      }
    };
    const resReset = mockResponse();
    await clientAuthController.resetPassword(reqReset, resReset);
    assert(resReset.statusCode === 200, 'Reset password updates contact password using reset token');


    console.log('\n--- 7. Testing Multi-Contact Addition & Permission Boundaries ---');

    // OWNER adds a second contact (MEMBER level)
    const reqAddMember = {
      params: { clientId: createdClientId },
      body: {
        name: 'Vikram Site Engineer',
        email: 'vikram.site@enterprises.com',
        phone: '9876500001',
        permissionLevel: 'MEMBER'
      },
      clientContact: reqTestClientAuth.clientContact
    };
    const resAddMember = mockResponse();
    await clientController.addContact(reqAddMember, resAddMember);
    assert(resAddMember.statusCode === 201 && resAddMember.body.contact.permissionLevel === 'MEMBER', 'OWNER contact can add a new MEMBER ClientContact');
    const memberTempPass = resAddMember.body.contact.temporaryPassword;
    const memberContactId = resAddMember.body.contact.id.toString();

    // Login as the new MEMBER contact
    const reqLoginMember = {
      body: {
        email: 'vikram.site@enterprises.com',
        password: memberTempPass
      }
    };
    const resLoginMember = mockResponse();
    await clientAuthController.login(reqLoginMember, resLoginMember);
    assert(resLoginMember.statusCode === 200, 'Newly added MEMBER contact can log in independently');

    const memberClientContactPayload = {
      contactId: memberContactId,
      clientId: createdClientId,
      permissionLevel: 'MEMBER'
    };

    // MEMBER tries to add another contact -> Rejection (403)
    const reqMemberAddOther = {
      params: { clientId: createdClientId },
      body: { name: 'Illegal Contact', email: 'illegal@enterprises.com' },
      clientContact: memberClientContactPayload
    };
    const resMemberAddOther = mockResponse();
    await clientController.addContact(reqMemberAddOther, resMemberAddOther);
    assert(resMemberAddOther.statusCode === 403, 'MEMBER-level contact is blocked from adding new contacts (403)');


    console.log('\n--- 8. Testing Permission Level Updates & Deactivation Safeguards ---');

    // OWNER promotes MEMBER to VIEW_ONLY
    const reqUpdatePerm = {
      params: { clientId: createdClientId, contactId: memberContactId },
      body: { newPermissionLevel: 'VIEW_ONLY' },
      clientContact: reqTestClientAuth.clientContact
    };
    const resUpdatePerm = mockResponse();
    await clientController.updateContactPermission(reqUpdatePerm, resUpdatePerm);
    assert(resUpdatePerm.statusCode === 200 && resUpdatePerm.body.contact.permissionLevel === 'VIEW_ONLY', 'OWNER can change another contact permission level to VIEW_ONLY');

    // Attempt to deactivate the ONLY OWNER contact -> Rejection (400)
    const reqDeactOwner = {
      params: { clientId: createdClientId, contactId: primaryContactId },
      clientContact: reqTestClientAuth.clientContact
    };
    const resDeactOwner = mockResponse();
    await clientController.deactivateContact(reqDeactOwner, resDeactOwner);
    assert(resDeactOwner.statusCode === 400 && resDeactOwner.body.message.includes('at least one active OWNER'), 'Safeguard blocks deactivating the last active OWNER contact');

    // OWNER deactivates the VIEW_ONLY member contact -> Success
    const reqDeactMember = {
      params: { clientId: createdClientId, contactId: memberContactId },
      clientContact: reqTestClientAuth.clientContact
    };
    const resDeactMember = mockResponse();
    await clientController.deactivateContact(reqDeactMember, resDeactMember);
    assert(resDeactMember.statusCode === 200 && resDeactMember.body.contact.isActive === false, 'OWNER can deactivate a non-owner contact');


    console.log('\n--- 9. Testing Mandatory Audit Logging (ClientContactActionLog) ---');

    const logs = await ClientContactActionLog.find({ clientId: createdClientId }).sort({ createdAt: 1 });
    const actionsLogged = logs.map(l => l.action);
    assert(
      actionsLogged.includes('CONTACT_ADDED') &&
      actionsLogged.includes('LOGIN') &&
      actionsLogged.includes('PERMISSION_CHANGED') &&
      actionsLogged.includes('CONTACT_DEACTIVATED'),
      'All contact management & portal auth actions recorded in ClientContactActionLog'
    );

    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 2 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 2 test run:', error);
    process.exit(1);
  }
}

runModule2Tests();
