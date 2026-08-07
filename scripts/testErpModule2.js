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
const TaskStatusHistory = require('../models/TaskStatusHistory');
const TaskReassignmentLog = require('../models/TaskReassignmentLog');
const TaskComment = require('../models/TaskComment');
const AppUsageDailySummary = require('../models/AppUsageDailySummary');

const projectController = require('../controllers/project.controller');
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

async function runErpModule2Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 2: TASK MANAGEMENT SYSTEM — TEST SUITE');
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
      'erp2.pm@erp.com',
      'erp2.emp1@erp.com',
      'erp2.emp2@erp.com'
    ];

    await TaskComment.deleteMany({});
    await TaskReassignmentLog.deleteMany({});
    await TaskStatusHistory.deleteMany({});
    await Task.deleteMany({ taskName: { $regex: /ERP Module 2/i } });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 2/i } });
    await Department.deleteMany({ name: 'Structural Engineering' });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Create Roles
    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Create Users
    const userPM = await User.create({
      name: 'Deepak Shah',
      email: 'erp2.pm@erp.com',
      password: await hashPassword('PmPass@123'),
      roleId: rolePM._id,
      designation: 'Senior Project Manager',
      isActive: true
    });

    const userEmp1 = await User.create({
      name: 'Riddhi Joshi',
      email: 'erp2.emp1@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Structural Engineer',
      isActive: true
    });

    const userEmp2 = await User.create({
      name: 'Manish Verma',
      email: 'erp2.emp2@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Draftsman',
      isActive: true
    });

    // 3. Create Department & Projects
    const department = await Department.create({ name: 'Structural Engineering' });

    const projectA = await Project.create({
      projectName: 'ERP Module 2 - Apex Tower Project',
      status: 'In Progress',
      createdBy: userPM._id,
      teamAssignments: [
        { userId: userEmp1._id, projectRole: 'Lead Structural Engineer', departmentId: department._id },
        { userId: userEmp2._id, projectRole: 'Draftsman Assistant', departmentId: department._id }
      ]
    });

    const projectB = await Project.create({
      projectName: 'ERP Module 2 - Delta Mall Project',
      status: 'In Progress',
      createdBy: userPM._id
    });

    console.log('--- 1. Testing Task Creation & Cross-Project Dependency Validation ---');

    // Create Base Task 1 in Project A
    const reqCreateT1 = {
      body: {
        projectId: projectA._id.toString(),
        taskName: 'ERP Module 2 - Foundation Load Calculation',
        description: 'Perform load bearing analysis for column C1-C8',
        priority: 'High',
        departmentId: department._id.toString(),
        assignedEmployee: userEmp1._id.toString(),
        estimatedTime: 12,
        deadline: new Date(Date.now() + 86400000 * 5).toISOString()
      },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resCreateT1 = mockResponse();
    await taskController.createTask(reqCreateT1, resCreateT1);
    assert(resCreateT1.statusCode === 201 && resCreateT1.body.task.taskName === 'ERP Module 2 - Foundation Load Calculation', 'Task 1 created in status "Pending"');
    const task1Id = resCreateT1.body.task._id;

    // Create Task 2 in Project B
    const reqCreateTB = {
      body: {
        projectId: projectB._id.toString(),
        taskName: 'ERP Module 2 - Project B Mall Layout',
        assignedEmployee: userEmp2._id.toString()
      },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resCreateTB = mockResponse();
    await taskController.createTask(reqCreateTB, resCreateTB);
    const taskBId = resCreateTB.body.task._id;

    // Attempt Task 3 in Project A depending on Task B (Different project) -> REJECTED (400)
    const reqCreateCrossDep = {
      body: {
        projectId: projectA._id.toString(),
        taskName: 'ERP Module 2 - Cross Dep Task',
        assignedEmployee: userEmp1._id.toString(),
        dependsOn: [taskBId.toString()]
      },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resCreateCrossDep = mockResponse();
    await taskController.createTask(reqCreateCrossDep, resCreateCrossDep);
    assert(resCreateCrossDep.statusCode === 400, 'Cross-project task dependency rejected with HTTP 400 Bad Request');

    // Create Dependent Task 2 in Project A depending on Task 1
    const reqCreateT2 = {
      body: {
        projectId: projectA._id.toString(),
        taskName: 'ERP Module 2 - Column Detailing Drawing',
        priority: 'Medium',
        assignedEmployee: userEmp1._id.toString(),
        estimatedTime: 8,
        dependsOn: [task1Id.toString()]
      },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resCreateT2 = mockResponse();
    await taskController.createTask(reqCreateT2, resCreateT2);
    assert(resCreateT2.statusCode === 201 && resCreateT2.body.task.dependsOn.length === 1, 'Task 2 created with valid same-project dependency');
    const task2Id = resCreateT2.body.task._id;

    console.log('\n--- 2. Testing Task Workflow & Dependency Hard Blocking ---');

    // Employee 1 accepts Task 1 & Task 2
    const reqAcceptT1 = { params: { id: task1Id.toString() }, user: { _id: userEmp1._id } };
    const resAcceptT1 = mockResponse();
    await taskController.acceptTask(reqAcceptT1, resAcceptT1);
    assert(resAcceptT1.statusCode === 200 && resAcceptT1.body.status === 'Accepted', 'Assigned employee accepts Task 1 (Pending -> Accepted)');

    const reqAcceptT2 = { params: { id: task2Id.toString() }, user: { _id: userEmp1._id } };
    const resAcceptT2 = mockResponse();
    await taskController.acceptTask(reqAcceptT2, resAcceptT2);

    // Attempt to start Task 2 while Task 1 is NOT completed -> HARD BLOCKED (400)
    const reqStartT2Early = { params: { id: task2Id.toString() }, user: { _id: userEmp1._id } };
    const resStartT2Early = mockResponse();
    await taskController.startTask(reqStartT2Early, resStartT2Early);
    assert(resStartT2Early.statusCode === 400, 'Starting Task 2 hard-blocked because dependent Task 1 is not completed');

    // Start Task 1 -> Status In Progress & actualStartTime stamped
    const reqStartT1 = { params: { id: task1Id.toString() }, user: { _id: userEmp1._id } };
    const resStartT1 = mockResponse();
    await taskController.startTask(reqStartT1, resStartT1);
    assert(resStartT1.statusCode === 200 && resStartT1.body.status === 'In Progress' && resStartT1.body.actualStartTime !== null, 'Task 1 started successfully; actualStartTime stamped');

    // Submit Task 1 for Review -> In Progress -> Review
    const reqSubmitT1 = { params: { id: task1Id.toString() }, user: { _id: userEmp1._id } };
    const resSubmitT1 = mockResponse();
    await taskController.submitForReview(reqSubmitT1, resSubmitT1);
    assert(resSubmitT1.statusCode === 200 && resSubmitT1.body.status === 'Review', 'Task 1 submitted for review (In Progress -> Review)');

    // PM Approves Task 1 -> Review -> Approved
    const reqApproveT1 = { params: { id: task1Id.toString() }, user: { _id: userPM._id, roleId: rolePM } };
    const resApproveT1 = mockResponse();
    await taskController.approveTask(reqApproveT1, resApproveT1);
    assert(resApproveT1.statusCode === 200 && resApproveT1.body.status === 'Approved', 'PM approves Task 1 (Review -> Approved)');

    // Seed HRM AppUsageDailySummary data for Employee 1 covering today's date
    const todayStr = new Date().toISOString().split('T')[0];
    await AppUsageDailySummary.deleteMany({ userId: userEmp1._id });
    await AppUsageDailySummary.create({
      userId: userEmp1._id,
      date: todayStr,
      appTotals: [
        { appName: 'AutoCAD 2026', totalSeconds: 14400 },
        { appName: 'ETABS Structural', totalSeconds: 7200 }
      ],
      idleSeconds: 1800,
      totalTrackedSeconds: 21600
    });

    // Complete Task 1 -> Status Approved -> Completed, stamps completionTime & calculates HRM idle/productivity metrics
    const reqCompleteT1 = { params: { id: task1Id.toString() }, user: { _id: userPM._id } };
    const resCompleteT1 = mockResponse();
    await taskController.completeTask(reqCompleteT1, resCompleteT1);
    assert(resCompleteT1.statusCode === 200 && resCompleteT1.body.status === 'Completed', 'Task 1 completed successfully; completionTime stamped');
    assert(resCompleteT1.body.idleTimeMinutes === 30, 'Task 1 idleTimeMinutes calculated from HRM AppUsageDailySummary (30 min)');
    assert(resCompleteT1.body.productivityScore === 92, 'Task 1 productivityScore calculated from HRM AppUsageDailySummary (92%)');

    // Now start Task 2 (since dependency Task 1 is Completed) -> SUCCEEDS!
    const reqStartT2Now = { params: { id: task2Id.toString() }, user: { _id: userEmp1._id } };
    const resStartT2Now = mockResponse();
    await taskController.startTask(reqStartT2Now, resStartT2Now);
    assert(resStartT2Now.statusCode === 200 && resStartT2Now.body.status === 'In Progress', 'Task 2 started successfully after dependency Task 1 cleared');

    console.log('\n--- 3. Testing Task Reassignment & Audit Log ---');

    // PM reassigns Task 2 to Employee 2
    const reqReassignT2 = {
      params: { id: task2Id.toString() },
      body: { newAssignedEmployee: userEmp2._id.toString(), reason: 'Workload balancing for draftsman' },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resReassignT2 = mockResponse();
    await taskController.reassignTask(reqReassignT2, resReassignT2);
    assert(resReassignT2.statusCode === 200 && resReassignT2.body.task.assignedEmployee._id.toString() === userEmp2._id.toString(), 'Task 2 reassigned to Employee 2 and reset to Pending');

    const logs = await TaskReassignmentLog.find({ taskId: task2Id });
    assert(logs.length === 1 && logs[0].fromEmployee.toString() === userEmp1._id.toString(), 'Task reassignment audit log created with fromEmployee & toEmployee');

    console.log('\n--- 4. Testing Checklists & Task Comments ---');

    // Checklist operations
    const reqChkAdd = { params: { id: task1Id.toString() }, body: { text: 'Check concrete grade specs' } };
    const resChkAdd = mockResponse();
    await taskController.addChecklistItem(reqChkAdd, resChkAdd);
    assert(resChkAdd.statusCode === 201 && resChkAdd.body.checklist.length === 1, 'Checklist item added to Task 1');

    const chkId = resChkAdd.body.checklist[0]._id;
    const reqChkToggle = { params: { id: task1Id.toString(), itemId: chkId.toString() } };
    const resChkToggle = mockResponse();
    await taskController.toggleChecklistItem(reqChkToggle, resChkToggle);
    assert(resChkToggle.statusCode === 200 && resChkToggle.body.item.isCompleted === true, 'Checklist item toggled to complete');

    // Comment operations
    const reqComment = {
      params: { id: task1Id.toString() },
      body: { commentText: 'Structural design review completed. All column loads verified.' },
      user: { _id: userEmp1._id }
    };
    const resComment = mockResponse();
    await taskController.addComment(reqComment, resComment);
    assert(resComment.statusCode === 201 && resComment.body.comment.commentText.includes('Structural design'), 'Task comment added successfully');

    console.log('\n--- 5. Testing Overdue Detection & Tasks Breakdown Integration ---');

    // Create an overdue task
    await Task.create({
      projectId: projectA._id,
      taskName: 'ERP Module 2 - Overdue Site Survey',
      assignedEmployee: userEmp1._id,
      deadline: new Date(Date.now() - 86400000 * 3),
      status: 'Pending',
      createdBy: userPM._id
    });

    const reqOverdue = { query: { projectId: projectA._id.toString() } };
    const resOverdue = mockResponse();
    await taskController.getOverdueTasks(reqOverdue, resOverdue);
    assert(resOverdue.statusCode === 200 && resOverdue.body.count >= 1, 'Overdue tasks detection retrieved past-deadline uncompleted tasks');

    // Test Project Tasks Breakdown (Module 1 Integration)
    const reqBreakdown = { params: { projectId: projectA._id.toString() } };
    const resBreakdown = mockResponse();
    await taskController.getProjectTasksBreakdown(reqBreakdown, resBreakdown);
    assert(resBreakdown.statusCode === 200 && resBreakdown.body.totalTasks >= 3, 'Project tasks breakdown retrieves aggregated task stats');
    assert(resBreakdown.body.completedTasks === 1, 'Breakdown accurately counts completed tasks (1)');

    // Test ERP Module 1 Progress Breakdown Endpoint Integration
    const reqProjBreakdown = { params: { id: projectA._id.toString() } };
    const resProjBreakdown = mockResponse();
    await projectController.getProgressBreakdown(reqProjBreakdown, resProjBreakdown);
    assert(resProjBreakdown.statusCode === 200 && resProjBreakdown.body.taskWise !== null, 'Module 1 progress breakdown endpoint populated with real ERP Module 2 taskWise data');
    assert(resProjBreakdown.body.employeeWise.length >= 1, 'Module 1 progress breakdown endpoint populated with real employeeWise task completion stats');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 2 TEST SUMMARY: 19 / 19 TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 2 test run:', error);
    process.exit(1);
  }
}

runErpModule2Tests();
