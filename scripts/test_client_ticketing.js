/**
 * Verification Test Suite for CRM Module 8: Client Ticketing (Query/Support)
 * 
 * Runs end-to-end functional and security isolation validation for Client Tickets.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const ClientTicket = require('../models/ClientTicket');
const ClientTicketResponse = require('../models/ClientTicketResponse');
const ClientTicketAssignmentLog = require('../models/ClientTicketAssignmentLog');

const clientTicketController = require('../controllers/clientTicket.controller');
const ticketController = require('../controllers/ticket.controller');

// Mock Express Request / Response helpers
function createMockReq(params = {}, body = {}, query = {}, clientContact = null, user = null, files = []) {
  return {
    params,
    body,
    query,
    clientContact,
    user,
    files
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
  console.log('🚀 Starting CRM Module 8: Client Ticketing Test Suite');
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
    // 1. Setup Test Entities
    console.log('\n--- Setting Up Test Entities ---');

    // Fetch or Create RoleMaster for testing
    const RoleMaster = require('../models/RoleMaster');
    let pmRole = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!pmRole) {
      pmRole = await RoleMaster.create({
        roleName: 'Project Manager',
        roleCode: 'PROJECT_MANAGER',
        description: 'Manages architecture projects'
      });
    }

    // Internal PM User
    let testPM = await User.findOne({ email: 'test.pm.ticket@nirman.com' });
    if (!testPM) {
      testPM = await User.create({
        name: 'Test PM User',
        email: 'test.pm.ticket@nirman.com',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        roleId: pmRole._id,
        phone: '9900112233',
        designation: 'Project Manager',
        department: 'Management',
        baseSalary: 45000,
        isActive: true
      });
    }

    // Secondary Internal Staff User
    let testStaff = await User.findOne({ email: 'test.staff.ticket@nirman.com' });
    if (!testStaff) {
      testStaff = await User.create({
        name: 'Test Senior Architect Staff',
        email: 'test.staff.ticket@nirman.com',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        roleId: pmRole._id,
        phone: '9900112244',
        designation: 'Senior Architect',
        department: 'Design',
        baseSalary: 55000,
        isActive: true
      });
    }

    // Client A & Client B
    let clientA = await Client.findOne({ name: 'Client Alpha Corp' });
    if (!clientA) {
      clientA = await Client.create({
        name: 'Client Alpha Corp',
        companyName: 'Alpha Real Estate',
        email: 'info@alphacorp.com',
        phone: '9888877771',
        isActive: true
      });
    }

    let clientB = await Client.findOne({ name: 'Client Beta Ltd' });
    if (!clientB) {
      clientB = await Client.create({
        name: 'Client Beta Ltd',
        companyName: 'Beta Properties',
        email: 'info@betaproperties.com',
        phone: '9888877772',
        isActive: true
      });
    }

    // Client A Contacts
    let contactOwnerA = await ClientContact.findOne({ email: 'owner.alpha@client.com' });
    if (!contactOwnerA) {
      contactOwnerA = await ClientContact.create({
        clientId: clientA._id,
        name: 'Priya Patel (Owner)',
        email: 'owner.alpha@client.com',
        phone: '9876500001',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'OWNER',
        isPrimaryContact: true,
        isActive: true
      });
    }

    let contactMemberA = await ClientContact.findOne({ email: 'member.alpha@client.com' });
    if (!contactMemberA) {
      contactMemberA = await ClientContact.create({
        clientId: clientA._id,
        name: 'Rajesh Kumar (Engineer)',
        email: 'member.alpha@client.com',
        phone: '9876500002',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'MEMBER',
        isActive: true
      });
    }

    let contactViewOnlyA = await ClientContact.findOne({ email: 'view.alpha@client.com' });
    if (!contactViewOnlyA) {
      contactViewOnlyA = await ClientContact.create({
        clientId: clientA._id,
        name: 'Suresh Viewer (Auditor)',
        email: 'view.alpha@client.com',
        phone: '9876500003',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'VIEW_ONLY',
        isActive: true
      });
    }

    // Client B Contact
    let contactOwnerB = await ClientContact.findOne({ email: 'owner.beta@client.com' });
    if (!contactOwnerB) {
      contactOwnerB = await ClientContact.create({
        clientId: clientB._id,
        name: 'Anita Shah (Beta Owner)',
        email: 'owner.beta@client.com',
        phone: '9876500004',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'OWNER',
        isPrimaryContact: true,
        isActive: true
      });
    }

    // Project 1 (Client A) & Project 2 (Client B)
    let project1 = await Project.findOne({ name: 'Alpha Horizon Towers' });
    if (!project1) {
      project1 = await Project.create({
        name: 'Alpha Horizon Towers',
        status: 'In Progress',
        projectManager: testPM._id
      });
    } else {
      project1.projectManager = testPM._id;
      await project1.save();
    }

    let project2 = await Project.findOne({ name: 'Beta Commercial Park' });
    if (!project2) {
      project2 = await Project.create({
        name: 'Beta Commercial Park',
        status: 'In Progress',
        projectManager: testPM._id
      });
    } else {
      project2.projectManager = testPM._id;
      await project2.save();
    }

    // Client-Project Linkages
    await ClientProjectLink.findOneAndUpdate(
      { clientId: clientA._id, projectId: project1._id },
      { isActive: true, visibleToClient: true },
      { upsert: true }
    );

    await ClientProjectLink.findOneAndUpdate(
      { clientId: clientB._id, projectId: project2._id },
      { isActive: true, visibleToClient: true },
      { upsert: true }
    );

    console.log('Setup finished successfully.');

    // ----------------------------------------------------
    // TEST 1: Creation by VIEW_ONLY contact (Must Fail with 403)
    // ----------------------------------------------------
    console.log('\n--- Test 1: Ticket Creation as VIEW_ONLY ---');
    const req1 = createMockReq(
      {},
      { projectId: project1._id.toString(), subject: 'View Only Test', description: 'Testing VIEW_ONLY block' },
      {},
      { contactId: contactViewOnlyA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'VIEW_ONLY' }
    );
    const res1 = createMockRes();
    await clientTicketController.createTicket(req1, res1);

    assert(res1.statusCode === 403, 'VIEW_ONLY contact is rejected from creating ticket with HTTP 403');

    // ----------------------------------------------------
    // TEST 2: Creation for Unlinked Project (Must Fail with 403)
    // ----------------------------------------------------
    console.log('\n--- Test 2: Ticket Creation for Unlinked Project ---');
    const req2 = createMockReq(
      {},
      { projectId: project2._id.toString(), subject: 'Unlinked Project Test', description: 'Testing linkage check' },
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res2 = createMockRes();
    await clientTicketController.createTicket(req2, res2);

    assert(res2.statusCode === 403, 'Ticket creation for unlinked project rejected with HTTP 403');

    // ----------------------------------------------------
    // TEST 3: Creation by OWNER contact (Must Succeed with Auto-Assignment)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Valid Ticket Creation as OWNER ---');
    const req3 = createMockReq(
      {},
      {
        projectId: project1._id.toString(),
        subject: 'Structural Revision Concern on Floor 3',
        description: 'The column dimensions specified on drawing revision 2 appear inconsistent with site measurements.',
        priority: 'High'
      },
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res3 = createMockRes();
    await clientTicketController.createTicket(req3, res3);

    assert(res3.statusCode === 201, 'Ticket created successfully with HTTP 201');
    const ticket1 = res3.responseData.ticket;
    assert(ticket1.status === 'OPEN', 'Ticket status defaults to OPEN');
    assert(ticket1.assignedTo._id.toString() === testPM._id.toString(), 'Ticket auto-assigned to Project PM');

    // ----------------------------------------------------
    // TEST 4: Shared Client Visibility (MEMBER Sees OWNER Ticket)
    // ----------------------------------------------------
    console.log('\n--- Test 4: Shared Visibility Across Client Contacts ---');
    const req4 = createMockReq(
      {},
      {},
      { projectId: project1._id.toString() },
      { contactId: contactMemberA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'MEMBER' }
    );
    const res4 = createMockRes();
    await clientTicketController.getMyTickets(req4, res4);

    assert(res4.statusCode === 200, 'MEMBER contact fetched tickets successfully');
    const ticketsList = res4.responseData.tickets;
    const foundTicket = ticketsList.find(t => t._id.toString() === ticket1._id.toString());
    assert(foundTicket !== undefined, 'MEMBER contact under Client A can see ticket raised by OWNER contact');
    assert(foundTicket.formattedRaisedBy.includes('OWNER'), 'Formatted author name includes permission level role');

    // ----------------------------------------------------
    // TEST 5: Cross-Client Security Boundary Check
    // ----------------------------------------------------
    console.log('\n--- Test 5: Cross-Client Security Isolation ---');
    const req5 = createMockReq(
      { id: ticket1._id.toString() },
      {},
      {},
      { contactId: contactOwnerB._id.toString(), clientId: clientB._id.toString(), permissionLevel: 'OWNER' }
    );
    const res5 = createMockRes();
    await clientTicketController.getTicketDetail(req5, res5);

    assert(res5.statusCode === 403, 'Client B attempting to access Client A ticket blocked with HTTP 403');

    // ----------------------------------------------------
    // TEST 6: Response Threading (Client & Staff Responses)
    // ----------------------------------------------------
    console.log('\n--- Test 6: Threaded Responses ---');
    // Client MEMBER responds
    const req6a = createMockReq(
      { id: ticket1._id.toString() },
      { message: 'Attaching site survey photo for reference. Please review.' },
      {},
      { contactId: contactMemberA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'MEMBER' }
    );
    const res6a = createMockRes();
    await clientTicketController.respondToTicket(req6a, res6a);

    assert(res6a.statusCode === 201, 'Client MEMBER response added to thread');

    // Internal Staff responds
    const req6b = createMockReq(
      { id: ticket1._id.toString() },
      { message: 'We have received the photo and our structural engineer is reviewing drawing Rev-2.' },
      {},
      null,
      { id: testStaff._id.toString(), name: testStaff.name, email: testStaff.email }
    );
    const res6b = createMockRes();
    await ticketController.respondToTicket(req6b, res6b);

    assert(res6b.statusCode === 201, 'Internal Staff response added to thread');
    assert(res6b.responseData.ticketStatus === 'IN_PROGRESS', 'Ticket status auto-transitioned from OPEN to IN_PROGRESS upon staff response');

    // Fetch full ticket detail
    const req6c = createMockReq(
      { id: ticket1._id.toString() },
      {},
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res6c = createMockRes();
    await clientTicketController.getTicketDetail(req6c, res6c);

    const responses = res6c.responseData.responses;
    assert(responses.length === 2, 'Response thread contains exactly 2 responses');
    assert(responses[0].authorType === 'CLIENT_CONTACT', 'First response authorType is CLIENT_CONTACT');
    assert(responses[1].authorType === 'EMPLOYEE', 'Second response authorType is EMPLOYEE');

    // ----------------------------------------------------
    // TEST 7: Lifecycle Status Updates (RESOLVED -> CLOSED)
    // ----------------------------------------------------
    console.log('\n--- Test 7: Status Updates (RESOLVED -> CLOSED) ---');
    // Staff resolves ticket
    const req7a = createMockReq(
      { id: ticket1._id.toString() },
      { newStatus: 'RESOLVED' },
      {},
      null,
      { id: testPM._id.toString() }
    );
    const res7a = createMockRes();
    await ticketController.updateTicketStatus(req7a, res7a);

    assert(res7a.statusCode === 200, 'Ticket status updated to RESOLVED');
    assert(res7a.responseData.ticket.resolvedAt !== null, 'resolvedAt timestamp set correctly');

    // Staff closes ticket
    const req7b = createMockReq(
      { id: ticket1._id.toString() },
      { newStatus: 'CLOSED' },
      {},
      null,
      { id: testPM._id.toString() }
    );
    const res7b = createMockRes();
    await ticketController.updateTicketStatus(req7b, res7b);

    assert(res7b.statusCode === 200, 'Ticket status updated to CLOSED');
    assert(res7b.responseData.ticket.closedAt !== null, 'closedAt timestamp set correctly');

    // ----------------------------------------------------
    // TEST 8: Reopen Grace Period Validation
    // ----------------------------------------------------
    console.log('\n--- Test 8: Reopen Grace Period Validation ---');
    // 8a: Reopen within grace period (Should Succeed)
    const req8a = createMockReq(
      { id: ticket1._id.toString() },
      { reason: 'Concern resurfaced after latest site visit' },
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res8a = createMockRes();
    await clientTicketController.reopenTicket(req8a, res8a);

    assert(res8a.statusCode === 200, 'CLOSED ticket successfully reopened within grace period');
    assert(res8a.responseData.ticket.status === 'OPEN', 'Status reset to OPEN');
    assert(res8a.responseData.ticket.reopenedCount === 1, 'reopenedCount incremented to 1');

    // 8b: Close ticket again, backdate closedAt to 15 days ago, attempt reopen (Must Fail)
    await ClientTicket.findByIdAndUpdate(ticket1._id, {
      status: 'CLOSED',
      closedAt: new Date(Date.now() - (15 * 24 * 60 * 60 * 1000))
    });

    const req8b = createMockReq(
      { id: ticket1._id.toString() },
      { reason: 'Attempting late reopen' },
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res8b = createMockRes();
    await clientTicketController.reopenTicket(req8b, res8b);

    assert(res8b.statusCode === 400, 'Reopen request rejected with HTTP 400 when grace period has expired');

    // ----------------------------------------------------
    // TEST 9: Cancellation Workflow
    // ----------------------------------------------------
    console.log('\n--- Test 9: Cancellation Workflow ---');
    // Create new ticket to cancel
    const req9a = createMockReq(
      {},
      { projectId: project1._id.toString(), subject: 'Duplicate query to cancel', description: 'Raised by mistake' },
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res9a = createMockRes();
    await clientTicketController.createTicket(req9a, res9a);
    const cancelTicketObj = res9a.responseData.ticket;

    // Cancel ticket
    const req9b = createMockReq(
      { id: cancelTicketObj._id.toString() },
      {},
      {},
      { contactId: contactOwnerA._id.toString(), clientId: clientA._id.toString(), permissionLevel: 'OWNER' }
    );
    const res9b = createMockRes();
    await clientTicketController.cancelTicket(req9b, res9b);

    assert(res9b.statusCode === 200, 'Ticket cancelled successfully');
    assert(res9b.responseData.ticket.status === 'CANCELLED', 'Ticket status updated to CANCELLED');

    // ----------------------------------------------------
    // TEST 10: Staff Ticket Reassignment & Assignment Log
    // ----------------------------------------------------
    console.log('\n--- Test 10: Staff Ticket Reassignment ---');
    const req10 = createMockReq(
      { id: ticket1._id.toString() },
      { newAssignedTo: testStaff._id.toString() },
      {},
      null,
      { id: testPM._id.toString() }
    );
    const res10 = createMockRes();
    await ticketController.reassignTicket(req10, res10);

    assert(res10.statusCode === 200, 'Ticket reassigned to secondary staff member');
    assert(res10.responseData.ticket.assignedTo._id.toString() === testStaff._id.toString(), 'assignedTo updated to testStaff ID');
    
    const logs = await ClientTicketAssignmentLog.find({ ticketId: ticket1._id });
    assert(logs.length > 0, 'Reassignment history entry created in ClientTicketAssignmentLog');

    console.log('\n====================================================');
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('CRITICAL ERROR in verification test suite:', err);
    process.exit(1);
  }
}

runVerificationSuite();
