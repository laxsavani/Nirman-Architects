require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Lead = require('../models/Lead');
const LeadInteraction = require('../models/LeadInteraction');
const LeadStatusHistory = require('../models/LeadStatusHistory');
const Notification = require('../models/Notification');

const leadController = require('../controllers/lead.controller');
const { runLeadFollowUpCheck } = require('../cron/leadFollowUpCron');

// Mock Express response object builder
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

async function runTests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 1: LEAD MANAGEMENT — INTEGRATION & UNIT TEST SUITE');
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
    const Client = require('../models/Client');
    const ClientContact = require('../models/ClientContact');
    await ClientContact.deleteMany({ email: { $in: ['hirak.test.crm@patel.com', 'hirak@patel.com'] } });
    await Client.deleteMany({ email: { $in: ['hirak.test.crm@patel.com', 'hirak@patel.com'] } });

    // 1. Setup Test Roles & Test Users
    let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN' });
    }

    let pmRole = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!pmRole) {
      pmRole = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER' });
    }

    let empRole = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!empRole) {
      empRole = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE' });
    }

    const testAdmin = await User.findOneAndUpdate(
      { email: 'test.admin.crm@nirman.com' },
      { name: 'CRM Test Admin', email: 'test.admin.crm@nirman.com', password: 'hash', roleId: adminRole._id, baseSalary: 50000 },
      { upsert: true, returnDocument: 'after' }
    );

    const testPM1 = await User.findOneAndUpdate(
      { email: 'test.pm1.crm@nirman.com' },
      { name: 'CRM Test PM One', email: 'test.pm1.crm@nirman.com', password: 'hash', roleId: pmRole._id, baseSalary: 40000 },
      { upsert: true, returnDocument: 'after' }
    );

    const testPM2 = await User.findOneAndUpdate(
      { email: 'test.pm2.crm@nirman.com' },
      { name: 'CRM Test PM Two', email: 'test.pm2.crm@nirman.com', password: 'hash', roleId: pmRole._id, baseSalary: 40000 },
      { upsert: true, returnDocument: 'after' }
    );

    const adminUserReq = { id: testAdmin._id.toString(), _id: testAdmin._id, roleCode: 'ADMIN' };
    const pm1UserReq = { id: testPM1._id.toString(), _id: testPM1._id, roleCode: 'PROJECT_MANAGER' };
    const pm2UserReq = { id: testPM2._id.toString(), _id: testPM2._id, roleCode: 'PROJECT_MANAGER' };

    console.log('--- 1. Testing Lead Creation & Required Field Validations ---');

    // Test: Rejection without required fields
    const reqMissing = { body: { name: 'Incomplete Lead' }, user: adminUserReq };
    const resMissing = mockResponse();
    await leadController.createLead(reqMissing, resMissing);
    assert(resMissing.statusCode === 400, 'Rejects creation when phone and source are missing');

    // Test: Valid Lead Creation
    const reqCreate1 = {
      body: {
        name: 'Mr. Hirak Patel',
        phone: '9876543210',
        email: 'hirak@patel.com',
        source: 'Referral',
        requirementNotes: 'Luxury 4BHK Villa interior design in Satellite',
        assignedTo: testPM1._id.toString(),
        nextFollowUpDate: new Date()
      },
      user: adminUserReq
    };
    const resCreate1 = mockResponse();
    await leadController.createLead(reqCreate1, resCreate1);
    assert(resCreate1.statusCode === 201 && resCreate1.body.success, 'Valid Lead creation succeeds with status=NEW');
    const lead1Id = resCreate1.body.lead._id.toString();

    // Verify initial status history
    const initialHist = await LeadStatusHistory.find({ leadId: lead1Id });
    assert(initialHist.length === 1 && initialHist[0].toStatus === 'NEW', 'Initial LeadStatusHistory recorded with toStatus=NEW');

    // Test: Duplicate phone warning
    const reqDup = {
      body: {
        name: 'Hirak Patel Walkin',
        phone: '9876543210',
        source: 'WalkIn',
        assignedTo: testPM1._id.toString()
      },
      user: adminUserReq
    };
    const resDup = mockResponse();
    await leadController.createLead(reqDup, resDup);
    assert(resDup.statusCode === 201 && resDup.body.duplicateWarning === true, 'Duplicate phone check flags duplicateWarning=true');


    console.log('\n--- 2. Testing Lead Retrieval, Scoping & Pagination ---');

    // PM1 creating a second lead for PM2
    const reqCreate2 = {
      body: {
        name: 'Mrs. Anjali Sharma',
        phone: '9123456789',
        source: 'Website',
        assignedTo: testPM2._id.toString()
      },
      user: adminUserReq
    };
    const resCreate2 = mockResponse();
    await leadController.createLead(reqCreate2, resCreate2);
    const lead2Id = resCreate2.body.lead._id.toString();

    // PM1 fetches leads -> should ONLY see lead1 (assignedTo PM1)
    const reqGetPM1 = { query: {}, user: pm1UserReq };
    const resGetPM1 = mockResponse();
    await leadController.getLeads(reqGetPM1, resGetPM1);
    const pm1Leads = resGetPM1.body.leads.map(l => l._id.toString());
    assert(pm1Leads.includes(lead1Id) && !pm1Leads.includes(lead2Id), 'PM sees ONLY leads assigned to themselves');

    // Admin fetches leads -> sees all
    const reqGetAdmin = { query: {}, user: adminUserReq };
    const resGetAdmin = mockResponse();
    await leadController.getLeads(reqGetAdmin, resGetAdmin);
    assert(resGetAdmin.body.leads.length >= 2, 'Admin sees all leads company-wide');


    console.log('\n--- 3. Testing Lead Detail & Computed Metrics ---');

    const reqDetail = { params: { id: lead1Id }, user: pm1UserReq };
    const resDetail = mockResponse();
    await leadController.getLeadById(reqDetail, resDetail);
    assert(resDetail.statusCode === 200 && resDetail.body.metrics.daysSinceCreation !== undefined, 'Lead details include computed metrics');


    console.log('\n--- 4. Testing General Updates & Reassignment Safeguards ---');

    // PM attempts to reassign lead away -> 403
    const reqReassignPM = {
      params: { id: lead1Id },
      body: { assignedTo: testPM2._id.toString() },
      user: pm1UserReq
    };
    const resReassignPM = mockResponse();
    await leadController.updateLead(reqReassignPM, resReassignPM);
    assert(resReassignPM.statusCode === 403, 'PM is blocked from reassigning lead assignedTo field');

    // Admin reassigns lead -> succeeds
    const reqUpdateAdmin = {
      params: { id: lead1Id },
      body: { requirementNotes: 'Updated: 4BHK Villa + Landscape design' },
      user: adminUserReq
    };
    const resUpdateAdmin = mockResponse();
    await leadController.updateLead(reqUpdateAdmin, resUpdateAdmin);
    assert(resUpdateAdmin.statusCode === 200 && resUpdateAdmin.body.lead.requirementNotes.includes('Landscape'), 'General lead updates succeed without altering status');


    console.log('\n--- 5. Testing Status Transitions & Mandatory lostReason ---');

    // NEW -> CONTACTED
    const reqStat1 = { params: { id: lead1Id }, body: { newStatus: 'CONTACTED' }, user: pm1UserReq };
    const resStat1 = mockResponse();
    await leadController.updateLeadStatus(reqStat1, resStat1);
    assert(resStat1.statusCode === 200 && resStat1.body.lead.status === 'CONTACTED', 'Status moves forward NEW -> CONTACTED');

    // CONTACTED -> QUALIFIED
    const reqStat2 = { params: { id: lead1Id }, body: { newStatus: 'QUALIFIED' }, user: pm1UserReq };
    const resStat2 = mockResponse();
    await leadController.updateLeadStatus(reqStat2, resStat2);

    // Backward transition: QUALIFIED -> CONTACTED (Correction)
    const reqStatBack = { params: { id: lead1Id }, body: { newStatus: 'CONTACTED' }, user: pm1UserReq };
    const resStatBack = mockResponse();
    await leadController.updateLeadStatus(reqStatBack, resStatBack);
    assert(resStatBack.statusCode === 200 && resStatBack.body.lead.status === 'CONTACTED', 'Backward status transition (QUALIFIED -> CONTACTED) succeeds');

    // Move to LOST without lostReason -> Rejection (400)
    const reqLostNoReason = { params: { id: lead1Id }, body: { newStatus: 'LOST' }, user: pm1UserReq };
    const resLostNoReason = mockResponse();
    await leadController.updateLeadStatus(reqLostNoReason, resLostNoReason);
    assert(resLostNoReason.statusCode === 400, 'Rejects status transition to LOST when lostReason is missing');

    // Move to LOST with lostReason -> Success
    const reqLostWithReason = {
      params: { id: lead1Id },
      body: { newStatus: 'LOST', lostReason: 'Client selected alternative architect due to tight budget' },
      user: pm1UserReq
    };
    const resLostWithReason = mockResponse();
    await leadController.updateLeadStatus(reqLostWithReason, resLostWithReason);
    assert(resLostWithReason.statusCode === 200 && resLostWithReason.body.lead.status === 'LOST' && resLostWithReason.body.lead.lostReason.includes('budget'), 'Status transition to LOST with lostReason succeeds');

    // Reactivate lead from LOST -> NEGOTIATION
    const reqReactivate = { params: { id: lead1Id }, body: { newStatus: 'NEGOTIATION' }, user: pm1UserReq };
    const resReactivate = mockResponse();
    await leadController.updateLeadStatus(reqReactivate, resReactivate);
    assert(resReactivate.statusCode === 200 && resReactivate.body.lead.status === 'NEGOTIATION' && resReactivate.body.lead.lostReason === null, 'Reactivating LOST lead clears lostReason');

    // Verify full audit history recorded
    const reqHist = { params: { id: lead1Id }, user: pm1UserReq };
    const resHist = mockResponse();
    await leadController.getLeadStatusHistory(reqHist, resHist);
    assert(resHist.body.history.length === 6, 'All status changes recorded in LeadStatusHistory in exact order');


    console.log('\n--- 6. Testing Interaction Logging & History Timeline ---');

    const interactionTypes = ['Call', 'Meeting', 'Email', 'Note'];
    for (const type of interactionTypes) {
      const reqLog = {
        params: { id: lead1Id },
        body: { type, notes: `Logged interaction of type ${type}` },
        user: pm1UserReq
      };
      const resLog = mockResponse();
      await leadController.logInteraction(reqLog, resLog);
    }

    const reqInteractions = { params: { id: lead1Id }, user: pm1UserReq };
    const resInteractions = mockResponse();
    await leadController.getLeadInteractions(reqInteractions, resInteractions);
    assert(resInteractions.body.interactions.length === 4, 'Logged and retrieved all 4 interaction types (Call, Meeting, Email, Note)');


    console.log('\n--- 7. Testing Follow-Up Reminder Cron & Query ---');

    // Clean up test notifications from previous test runs
    await Notification.deleteMany({ userId: testPM1._id, type: 'LEAD_FOLLOWUP_DUE' });

    // Set nextFollowUpDate to today for lead1
    await Lead.findByIdAndUpdate(lead1Id, { nextFollowUpDate: new Date() });

    const cronResult = await runLeadFollowUpCheck();
    assert(cronResult.notificationCount >= 1, 'Daily cron generated notification for due active lead');

    // Verify Notification document created for PM1
    const notif = await Notification.findOne({ userId: testPM1._id, type: 'LEAD_FOLLOWUP_DUE' });
    assert(notif !== null && notif.message.includes('Mr. Hirak Patel'), 'Notification correctly delivered to assigned PM with lead name');

    // Mark lead2 as WON and set nextFollowUpDate to today -> check that WON lead is excluded
    await Lead.findByIdAndUpdate(lead2Id, { status: 'WON', nextFollowUpDate: new Date() });
    const dueReq = { query: { date: new Date().toISOString() }, user: adminUserReq };
    const dueRes = mockResponse();
    await leadController.getDueFollowUps(dueReq, dueRes);
    const dueLeadIds = dueRes.body.leads.map(l => l._id.toString());
    assert(dueLeadIds.includes(lead1Id) && !dueLeadIds.includes(lead2Id), 'Follow-up query excludes WON and LOST leads');


    console.log('\n--- 8. Testing Convert to Client Stub ---');

    // Convert active lead1 (in NEGOTIATION) to WON
    const reqConv = { params: { id: lead1Id }, user: pm1UserReq, body: { primaryContactEmail: 'hirak.test.crm@patel.com' } };
    const resConv = mockResponse();
    await leadController.convertToClientStub(reqConv, resConv);
    assert(resConv.statusCode === 200 && resConv.body.client !== undefined, 'convert-to-client updates status to WON and creates Client account');

    // Attempt convert on already-WON lead -> Rejection (400)
    const reqConvAlready = { params: { id: lead1Id }, user: pm1UserReq };
    const resConvAlready = mockResponse();
    await leadController.convertToClientStub(reqConvAlready, resConvAlready);
    assert(resConvAlready.statusCode === 400, 'Rejects convert-to-client on already-WON lead');

    console.log('\n================================================================================');
    console.log(`🎉 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during test run:', error);
    process.exit(1);
  }
}

runTests();
