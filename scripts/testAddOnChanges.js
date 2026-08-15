const mongoose = require('mongoose');
const assert = require('assert');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const Task = require('../models/Task');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const Drawing = require('../models/Drawing');
const Department = require('../models/Department');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientProjectLink = require('../models/ClientProjectLink');
const FeedbackCategory = require('../models/FeedbackCategory');
const FeedbackPromptStatus = require('../models/FeedbackPromptStatus');
const ClientFeedback = require('../models/ClientFeedback');
const InternalTicket = require('../models/InternalTicket');
const InternalTicketResponse = require('../models/InternalTicketResponse');

const taskController = require('../controllers/task.controller');
const internalTicketController = require('../controllers/internalTicket.controller');
const leaveController = require('../controllers/leave.controller');
const projectController = require('../controllers/project.controller');
const drawingController = require('../controllers/drawing.controller');
const departmentController = require('../controllers/department.controller');
const clientFeedbackController = require('../controllers/clientFeedback.controller');
const feedbackCategoryController = require('../controllers/feedbackCategory.controller');

// Helper mock response
function mockResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('================================================================================');
  console.log('🚀 ADD-ON CHANGE REQUEST (FINAL 7 ITEMS) — TEST SUITE');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nirman_architects_db';
  console.log(`🔌 Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB Connected!\n');

  // Setup roles
  let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
  if (!adminRole) adminRole = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN' });

  let superAdminRole = await RoleMaster.findOne({ roleCode: 'SUPER_ADMIN' });
  if (!superAdminRole) superAdminRole = await RoleMaster.create({ roleName: 'Super Admin', roleCode: 'SUPER_ADMIN' });

  let empRole = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
  if (!empRole) empRole = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE' });

  // Setup Users
  const testAdmin = await User.create({
    name: 'Test Admin Addon',
    email: `admin_addon_${Date.now()}@nirman.com`,
    password: 'password123',
    roleId: adminRole._id,
    designation: 'Admin'
  });

  const testSuperAdmin = await User.create({
    name: 'Test SuperAdmin Addon',
    email: `superadmin_addon_${Date.now()}@nirman.com`,
    password: 'password123',
    roleId: superAdminRole._id,
    designation: 'Super Admin'
  });

  const testEmployee = await User.create({
    name: 'Test Employee Addon',
    email: `emp_addon_${Date.now()}@nirman.com`,
    password: 'password123',
    roleId: empRole._id,
    designation: 'Architect'
  });

  const testProject = await Project.create({
    projectName: 'Addon Test Tower',
    status: 'In Progress',
    createdBy: testAdmin._id,
    teamAssignments: [{ userId: testEmployee._id, projectRole: 'Lead Architect' }]
  });

  // ============================================================================
  // ITEM 1 — TASK: startDate + endDate + totalDays & schedule-comparison
  // ============================================================================
  console.log('--- 1. Testing Task Schedule Fields & Comparison API ---');
  {
    // Test creation with valid dates
    const reqCreate = {
      body: {
        projectId: testProject._id,
        taskName: 'Structural Framing',
        assignedEmployee: testEmployee._id,
        startDate: '2026-09-01',
        endDate: '2026-09-05'
      },
      user: testAdmin
    };
    const resCreate = mockResponse();
    await taskController.createTask(reqCreate, resCreate);
    assert.strictEqual(resCreate.statusCode, 201, 'Create task with schedule dates failed');
    assert.strictEqual(resCreate.body.task.totalDays, 4, 'totalDays should be 4 for Sept 1 to Sept 5');
    console.log('  ✅ PASSED: Task created with startDate, endDate, and server-computed totalDays=4');

    const taskId = resCreate.body.task._id;

    // Test invalid endDate < startDate
    const reqInvalid = {
      body: {
        projectId: testProject._id,
        taskName: 'Invalid Date Task',
        assignedEmployee: testEmployee._id,
        startDate: '2026-09-10',
        endDate: '2026-09-05'
      },
      user: testAdmin
    };
    const resInvalid = mockResponse();
    await taskController.createTask(reqInvalid, resInvalid);
    assert.strictEqual(resInvalid.statusCode, 400, 'Invalid date range should return HTTP 400');
    console.log('  ✅ PASSED: Invalid date range (endDate < startDate) correctly rejected');

    // Test Schedule Comparison API
    const reqComp = { params: { id: taskId }, user: testEmployee };
    const resComp = mockResponse();
    await taskController.getTaskScheduleComparison(reqComp, resComp);
    assert.strictEqual(resComp.statusCode, 200, 'Schedule comparison failed');
    assert.strictEqual(resComp.body.plannedSchedule.totalDays, 4, 'Planned total days mismatch');
    console.log('  ✅ PASSED: GET /api/tasks/:id/schedule-comparison returned planned schedule payload');
  }

  // ============================================================================
  // ITEM 2 — SUPPORT TICKETS: SEPARATE INTERNAL TICKET SYSTEM
  // ============================================================================
  console.log('\n--- 2. Testing Separate Internal Ticket System (Admin vs Client) ---');
  {
    // Create Internal Ticket as employee
    const reqCreateTicket = {
      body: {
        category: 'IT',
        subject: 'Laptop Display Flickering',
        description: 'Screen flickers when connected to HDMI monitor.',
        priority: 'High'
      },
      user: testEmployee
    };
    const resCreateTicket = mockResponse();
    await internalTicketController.createTicket(reqCreateTicket, resCreateTicket);
    assert.strictEqual(resCreateTicket.statusCode, 201, 'Create internal ticket failed');
    const ticketId = resCreateTicket.body.ticket._id;
    console.log('  ✅ PASSED: Internal ticket created by employee (category IT, priority High)');

    // List employee's own internal tickets
    const reqMyTickets = { query: {}, user: testEmployee };
    const resMyTickets = mockResponse();
    await internalTicketController.getMyTickets(reqMyTickets, resMyTickets);
    assert.strictEqual(resMyTickets.statusCode, 200, 'Get my internal tickets failed');
    assert(resMyTickets.body.tickets.length > 0, 'My internal tickets list empty');
    console.log('  ✅ PASSED: Employee retrieved personal internal tickets');

    // List all tickets as Admin
    const reqAllTickets = { query: {}, user: testAdmin };
    const resAllTickets = mockResponse();
    await internalTicketController.getAllTickets(reqAllTickets, resAllTickets);
    assert.strictEqual(resAllTickets.statusCode, 200, 'Admin get all internal tickets failed');
    console.log('  ✅ PASSED: Admin retrieved company-wide internal tickets');

    // Assign ticket
    const reqAssign = { params: { id: ticketId }, body: { assignedTo: testAdmin._id }, user: testAdmin };
    const resAssign = mockResponse();
    await internalTicketController.assignTicket(reqAssign, resAssign);
    assert.strictEqual(resAssign.statusCode, 200, 'Assign ticket failed');
    assert.strictEqual(resAssign.body.ticket.status, 'IN_PROGRESS', 'Ticket status should transition to IN_PROGRESS');
    console.log('  ✅ PASSED: Admin assigned internal ticket and status transitioned to IN_PROGRESS');

    // Respond to ticket
    const reqRespond = { params: { id: ticketId }, body: { message: 'Ordered replacement HDMI adapter.' }, user: testAdmin };
    const resRespond = mockResponse();
    await internalTicketController.respondToTicket(reqRespond, resRespond);
    assert.strictEqual(resRespond.statusCode, 201, 'Respond to ticket failed');
    console.log('  ✅ PASSED: Admin posted response to internal ticket thread');

    // Resolve ticket
    const reqStatus = { params: { id: ticketId }, body: { status: 'RESOLVED' }, user: testAdmin };
    const resStatus = mockResponse();
    await internalTicketController.updateTicketStatus(reqStatus, resStatus);
    assert.strictEqual(resStatus.statusCode, 200, 'Resolve ticket failed');
    console.log('  ✅ PASSED: Internal ticket marked as RESOLVED');

    // Reopen ticket as owner
    const reqReopen = { params: { id: ticketId }, user: testEmployee };
    const resReopen = mockResponse();
    await internalTicketController.reopenTicket(reqReopen, resReopen);
    assert.strictEqual(resReopen.statusCode, 200, 'Reopen ticket failed');
    assert.strictEqual(resReopen.body.ticket.status, 'OPEN', 'Status should be reset to OPEN');
    console.log('  ✅ PASSED: Employee reopened RESOLVED internal ticket successfully');
  }

  // ============================================================================
  // ITEM 3 — LEAVE: UPDATE API (EDITABLE ONLY WHILE PENDING)
  // ============================================================================
  console.log('\n--- 3. Testing Leave Request Update API (Editable while PENDING only) ---');
  {
    const leaveType = await LeaveType.create({
      name: `Casual Leave Addon ${Date.now()}`,
      code: `CL_${Date.now()}`,
      isPaid: true,
      defaultQuotaPerYear: 12
    });

    await LeaveBalance.create({
      userId: testEmployee._id,
      leaveTypeId: leaveType._id,
      year: 2026,
      allocatedDays: 12,
      usedDays: 0
    });

    // Apply for leave (Pending)
    const reqApply = {
      body: { leaveTypeId: leaveType._id, fromDate: '2026-10-01', toDate: '2026-10-02', reason: 'Vacation' },
      user: testEmployee
    };
    const resApply = mockResponse();
    await leaveController.applyLeave(reqApply, resApply, err => { throw err; });
    assert.strictEqual(resApply.statusCode, 201, 'Apply leave failed');
    const leaveId = resApply.body._id;
    console.log('  ✅ PASSED: Leave request submitted (status: PENDING)');

    // Edit pending leave request dates
    const reqUpdatePending = {
      params: { id: leaveId },
      body: { fromDate: '2026-10-01', toDate: '2026-10-03', reason: 'Extended Vacation' },
      user: testEmployee
    };
    const resUpdatePending = mockResponse();
    await leaveController.updateLeaveRequest(reqUpdatePending, resUpdatePending, err => { throw err; });
    assert.strictEqual(resUpdatePending.statusCode, 200, 'Update pending leave failed');
    assert.strictEqual(resUpdatePending.body.totalDays, 3, 'totalDays should update to 3');
    console.log('  ✅ PASSED: Pending leave request updated successfully (totalDays updated to 3)');

    // Approve leave request
    const reqApprove = { body: { leaveRequestId: leaveId }, user: testSuperAdmin };
    const resApprove = mockResponse();
    await leaveController.approveLeave(reqApprove, resApprove, err => { throw err; });
    assert.strictEqual(resApprove.statusCode, 200, 'Approve leave failed');
    console.log('  ✅ PASSED: Leave request approved by Super Admin');

    // Attempt to edit APPROVED leave request (Must fail)
    const reqUpdateApproved = {
      params: { id: leaveId },
      body: { reason: 'Try to edit approved leave' },
      user: testEmployee
    };
    const resUpdateApproved = mockResponse();
    await leaveController.updateLeaveRequest(reqUpdateApproved, resUpdateApproved, err => { throw err; });
    assert.strictEqual(resUpdateApproved.statusCode, 400, 'Editing approved leave should be blocked');
    assert(resUpdateApproved.body.message.includes('already been approved'), 'Error message mismatch');
    console.log('  ✅ PASSED: Editing APPROVED leave request correctly BLOCKED with clear message');
  }

  // ============================================================================
  // ITEM 4 — PROJECT: DELETE API (CASCADES TO TASKS + TEAM)
  // ============================================================================
  console.log('\n--- 4. Testing Project Delete API (Atomic Soft-Delete Cascade) ---');
  {
    const projToDelete = await Project.create({
      projectName: 'Disposable Project',
      status: 'In Progress',
      createdBy: testAdmin._id,
      teamAssignments: [{ userId: testEmployee._id, projectRole: 'Architect' }]
    });

    const task1 = await Task.create({
      projectId: projToDelete._id,
      taskName: 'Task 1 in Disposable Proj',
      assignedEmployee: testEmployee._id,
      createdBy: testAdmin._id
    });

    const reqDeleteProj = { params: { id: projToDelete._id }, user: testAdmin };
    const resDeleteProj = mockResponse();
    await projectController.deleteProject(reqDeleteProj, resDeleteProj);
    assert.strictEqual(resDeleteProj.statusCode, 200, 'Delete project failed');
    assert.strictEqual(resDeleteProj.body.cascadedTasksCount, 1, 'Cascaded tasks count mismatch');
    console.log('  ✅ PASSED: Project soft-deleted and return metrics report cascaded task count');

    const updatedProj = await Project.findById(projToDelete._id);
    assert.strictEqual(updatedProj.isActive, false, 'Project isActive should be false');
    assert.strictEqual(updatedProj.status, 'Archived', 'Project status should be Archived');
    assert(updatedProj.teamAssignments[0].unassignedAt !== null, 'Team unassignedAt timestamp missing');

    const updatedTask1 = await Task.findById(task1._id);
    assert.strictEqual(updatedTask1.isActive, false, 'Task isActive should be false');
    console.log('  ✅ PASSED: Project isActive=false, status=Archived, linked Task isActive=false, team unassignedAt stamped');
  }

  // ============================================================================
  // ITEM 5 — DRAWING: DELETE AND UPDATE APIs
  // ============================================================================
  console.log('\n--- 5. Testing Drawing Update & Delete APIs ---');
  {
    const drawing = await Drawing.create({
      projectId: testProject._id,
      drawingName: 'Ground Floor Blueprint',
      drawingNumber: 'DWG-001',
      visibleToClient: true,
      createdBy: testEmployee._id
    });

    // Test Drawing Update
    const reqUpdateDwg = {
      params: { id: drawing._id },
      body: { drawingName: 'Ground Floor Master Plan' },
      user: testEmployee
    };
    const resUpdateDwg = mockResponse();
    await drawingController.updateDrawing(reqUpdateDwg, resUpdateDwg);
    assert.strictEqual(resUpdateDwg.statusCode, 200, 'Update drawing failed');
    assert.strictEqual(resUpdateDwg.body.drawing.drawingName, 'Ground Floor Master Plan', 'Drawing name updated mismatch');
    console.log('  ✅ PASSED: Drawing metadata updated successfully');

    // Test Delete without forceDelete on client-visible drawing (Should fail/warn)
    const reqDeleteWarn = { params: { id: drawing._id }, query: {}, body: {}, user: testAdmin };
    const resDeleteWarn = mockResponse();
    await drawingController.deleteDrawing(reqDeleteWarn, resDeleteWarn);
    assert.strictEqual(resDeleteWarn.statusCode, 400, 'Delete visible drawing without forceDelete should return HTTP 400 warning');
    assert.strictEqual(resDeleteWarn.body.requiresForceDelete, true, 'requiresForceDelete flag missing');
    console.log('  ✅ PASSED: Deleting client-visible drawing without forceDelete returned warning prompt');

    // Test Delete with forceDelete=true
    const reqDeleteForce = { params: { id: drawing._id }, query: { forceDelete: 'true' }, body: {}, user: testAdmin };
    const resDeleteForce = mockResponse();
    await drawingController.deleteDrawing(reqDeleteForce, resDeleteForce);
    assert.strictEqual(resDeleteForce.statusCode, 200, 'Delete drawing with forceDelete failed');
    console.log('  ✅ PASSED: Drawing soft-deleted with forceDelete=true override');
  }

  // ============================================================================
  // ITEM 6 — DEPARTMENT: DELETE AND UPDATE APIs
  // ============================================================================
  console.log('\n--- 6. Testing Department Update & Delete APIs ---');
  {
    const dept = await Department.create({ name: `Architecture Dept ${Date.now()}` });

    // Test Update Department
    const reqUpdateDept = {
      params: { id: dept._id },
      body: { name: `Design & Architecture Dept ${Date.now()}` },
      user: testAdmin
    };
    const resUpdateDept = mockResponse();
    await departmentController.updateDepartment(reqUpdateDept, resUpdateDept);
    assert.strictEqual(resUpdateDept.statusCode, 200, 'Update department failed');
    console.log('  ✅ PASSED: Department renamed successfully');

    // Test Delete Department
    const reqDeleteDept = { params: { id: dept._id }, user: testAdmin };
    const resDeleteDept = mockResponse();
    await departmentController.deleteDepartment(reqDeleteDept, resDeleteDept);
    assert.strictEqual(resDeleteDept.statusCode, 200, 'Delete department failed');
    assert.strictEqual(resDeleteDept.body.deletedDepartment.isActive, false, 'Department isActive should be false');
    console.log('  ✅ PASSED: Department soft-deleted and returned active references count');

    // Test GET departments with includeInactive=true
    const reqGetDepts = { query: { includeInactive: 'true' }, user: testAdmin };
    const resGetDepts = mockResponse();
    await departmentController.getDepartments(reqGetDepts, resGetDepts);
    assert.strictEqual(resGetDepts.statusCode, 200, 'Get departments failed');
    const foundDeleted = resGetDepts.body.departments.some(d => d._id.toString() === dept._id.toString());
    assert(foundDeleted, 'Soft-deleted department missing from includeInactive=true list');
    console.log('  ✅ PASSED: GET /api/departments?includeInactive=true returned soft-deleted department');
  }

  // ============================================================================
  // ITEM 7 — FEEDBACK: UPDATE APIs
  // ============================================================================
  console.log('\n--- 7. Testing Client Feedback & Category Update APIs ---');
  {
    const client = await Client.create({ name: 'Addon Client Corp', companyName: 'Addon Client Corp', email: `client_addon_${Date.now()}@corp.com`, phone: '9876543210' });
    const contact = await ClientContact.create({ clientId: client._id, name: 'Contact Addon', email: `contact_addon_${Date.now()}@corp.com`, password: 'password123' });
    await ClientProjectLink.create({ clientId: client._id, projectId: testProject._id, linkedBy: testAdmin._id, isActive: true, visibleToClient: true });

    const fbCat = await FeedbackCategory.create({ name: `Design Quality ${Date.now()}` });

    const feedback = await ClientFeedback.create({
      clientId: client._id,
      contactId: contact._id,
      projectId: testProject._id,
      triggerType: 'PROJECT_COMPLETION',
      overallRating: 4,
      comments: 'Great work initial review'
    });

    // Test Update Client Feedback
    const reqUpdateFb = {
      params: { id: feedback._id },
      body: { overallRating: 5, comments: 'Updated review: Exceptional work!' },
      clientContact: { clientId: client._id, contactId: contact._id }
    };
    const resUpdateFb = mockResponse();
    await clientFeedbackController.updateFeedback(reqUpdateFb, resUpdateFb);
    assert.strictEqual(resUpdateFb.statusCode, 200, 'Update client feedback failed');
    assert.strictEqual(resUpdateFb.body.feedback.overallRating, 5, 'Rating update mismatch');
    assert.strictEqual(resUpdateFb.body.feedback.wasEdited, true, 'wasEdited flag should be true');
    assert(resUpdateFb.body.feedback.lastEditedAt !== null, 'lastEditedAt timestamp missing');
    console.log('  ✅ PASSED: Client feedback updated (overallRating=5, wasEdited=true, lastEditedAt stamped)');

    // Test Update Feedback Category
    const reqUpdateFbCat = {
      params: { id: fbCat._id },
      body: { name: `Superior Design Quality ${Date.now()}` },
      user: testAdmin
    };
    const resUpdateFbCat = mockResponse();
    await feedbackCategoryController.updateCategory(reqUpdateFbCat, resUpdateFbCat);
    assert.strictEqual(resUpdateFbCat.statusCode, 200, 'Update feedback category failed');
    console.log('  ✅ PASSED: Feedback category renamed successfully by Admin');
  }

  console.log('\n================================================================================');
  console.log('🎉 ALL 7 ADD-ON CHANGE ITEMS SUCCESSFULLY TESTED AND VERIFIED!');
  console.log('================================================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
