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
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const Attendance = require('../models/Attendance');
const ProjectAnalyticsSnapshot = require('../models/ProjectAnalyticsSnapshot');

const projectAnalyticsController = require('../controllers/projectAnalytics.controller');
const projectController = require('../controllers/project.controller');
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

async function runErpModule7Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 7: PROJECT ANALYSIS & DASHBOARDS — TEST SUITE');
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
      'erp7.admin@erp.com',
      'erp7.pm@erp.com',
      'erp7.emp1@erp.com',
      'erp7.emp2@erp.com'
    ];

    await ProjectAnalyticsSnapshot.deleteMany({});
    await Attendance.deleteMany({ userId: { $in: await User.find({ email: { $in: testEmails } }).distinct('_id') } });
    await Task.deleteMany({ taskName: { $regex: /ERP Module 7/i } });
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 7/i } });
    await DrawingCategory.deleteMany({ name: 'ERP7 Working Drawing' });
    await Department.deleteMany({ name: { $regex: /ERP7/i } });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 7/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Departments
    const deptArch = await Department.create({ name: 'ERP7 Architecture Dept', code: 'E7-ARC', isActive: true });
    const deptHVAC = await Department.create({ name: 'ERP7 HVAC Engineering', code: 'E7-HVC', isActive: true });

    // 3. Users
    const userAdmin = await User.create({
      name: 'Aditya Birla',
      email: 'erp7.admin@erp.com',
      password: await hashPassword('AdminPass@123'),
      roleId: roleAdmin._id,
      designation: 'Studio Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Vikram Sarabhai',
      email: 'erp7.pm@erp.com',
      password: await hashPassword('PMPass@123'),
      roleId: rolePM._id,
      designation: 'Senior PM',
      isActive: true
    });

    const userEmp1 = await User.create({
      name: 'Nikhil Mehta',
      email: 'erp7.emp1@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      department: deptArch._id,
      designation: 'Architect',
      isActive: true
    });

    const userEmp2 = await User.create({
      name: 'Suresh Raina',
      email: 'erp7.emp2@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      department: deptHVAC._id,
      designation: 'HVAC Engineer',
      isActive: true
    });

    // 4. Create Attendance Records for HRM Cross-Reference
    await Attendance.create({
      userId: userEmp1._id,
      date: '2026-08-01',
      mode: 'OFFICE_AUTO',
      clockInTime: new Date(),
      status: 'PRESENT'
    });

    await Attendance.create({
      userId: userEmp1._id,
      date: '2026-08-02',
      mode: 'SITE_MOBILE',
      clockInTime: new Date(),
      status: 'PRESENT'
    });

    // 5. Projects
    const projectAlpha = await Project.create({
      projectName: 'ERP Module 7 - Commercial Complex Alpha',
      status: 'In Progress',
      progressPercentage: 45,
      budget: 5000000,
      createdBy: userPM._id,
      estimatedCompletion: new Date(Date.now() - 86400000), // Past date -> Delayed!
      teamAssignments: [
        { userId: userEmp1._id, projectRole: 'Lead Architect' },
        { userId: userEmp2._id, projectRole: 'HVAC Specialist' }
      ]
    });

    const projectBeta = await Project.create({
      projectName: 'ERP Module 7 - Residential Tower Beta',
      status: 'Planning',
      progressPercentage: 10,
      budget: 2500000,
      createdBy: userPM._id
    });

    // 6. Create Tasks in projectAlpha
    const task1 = await Task.create({
      projectId: projectAlpha._id,
      departmentId: deptArch._id,
      taskName: 'ERP Module 7 - Structural Detailing Phase 1',
      createdBy: userPM._id,
      assignedEmployee: userEmp1._id,
      status: 'Completed',
      totalWorkingTimeMinutes: 240,
      productivityScore: 90,
      priority: 'High'
    });

    const task2 = await Task.create({
      projectId: projectAlpha._id,
      departmentId: deptArch._id,
      taskName: 'ERP Module 7 - Facade Elevation 3D Model',
      createdBy: userPM._id,
      assignedEmployee: userEmp1._id,
      status: 'Completed',
      totalWorkingTimeMinutes: 180,
      productivityScore: null, // Test null productivity score handling!
      priority: 'Medium'
    });

    const task3 = await Task.create({
      projectId: projectAlpha._id,
      departmentId: deptHVAC._id,
      taskName: 'ERP Module 7 - Ducting Layout Schematic',
      createdBy: userPM._id,
      assignedEmployee: userEmp2._id,
      status: 'In Progress',
      isDelayed: true,
      deadline: new Date(Date.now() - 3600000),
      priority: 'High'
    });

    // 7. Create Drawings in projectAlpha
    const catWorking = await DrawingCategory.create({ name: 'ERP7 Working Drawing' });
    const drawing1 = await Drawing.create({
      projectId: projectAlpha._id,
      drawingName: 'ERP Module 7 - Floor Plan L1',
      categoryId: catWorking._id,
      status: 'APPROVED'
    });

    const drawing2 = await Drawing.create({
      projectId: projectAlpha._id,
      drawingName: 'ERP Module 7 - Structural Column Section',
      categoryId: catWorking._id,
      status: 'DESIGNER_UPLOADED'
    });

    console.log('--- 1. Testing Project Dashboard Aggregation ---');

    const reqDash = { params: { id: projectAlpha._id.toString() }, user: userPM };
    const resDash = mockResponse();
    await projectAnalyticsController.getProjectDashboard(reqDash, resDash);
    assert(resDash.statusCode === 200 && resDash.body.progressPercentage === 45, 'Project dashboard retrieves correct overall progress (45%)');
    assert(resDash.body.isDelayed === true, 'Project delay state correctly evaluated (isDelayed: true)');
    assert(resDash.body.pendingTasksCount === 1 && resDash.body.overdueTaskCount === 1, 'Accurately counts pending (1) and overdue (1) tasks');
    assert(resDash.body.drawingStatusSummary.totalDrawings === 2 && resDash.body.drawingStatusSummary.approvalRate === 50, 'Accurately computes drawing approval rate (50%)');

    console.log('\n--- 2. Testing Employee-Wise Analysis & HRM Cross-Reference ---');

    const reqEmpWise = { params: { id: projectAlpha._id.toString() }, user: userPM };
    const resEmpWise = mockResponse();
    await projectAnalyticsController.getEmployeeWiseAnalysis(reqEmpWise, resEmpWise);
    assert(resEmpWise.statusCode === 200 && resEmpWise.body.employeeAnalytics.length === 2, 'Retrieved employee-wise performance analysis for 2 team members');

    const emp1Data = resEmpWise.body.employeeAnalytics.find(e => e.userId.toString() === userEmp1._id.toString());
    assert(emp1Data && emp1Data.completedTasksCount === 2, 'Emp1 completed tasks counted accurately (2)');
    assert(emp1Data.avgProductivityScore === 90, 'CORRECT AVERAGE SCORE: Null productivity score excluded from average (90% instead of 45%)');
    assert(emp1Data.attendanceSummary.officeDays === 1 && emp1Data.attendanceSummary.siteDays === 1, 'HRM Attendance cross-referenced accurately (1 Office day, 1 Site day)');

    console.log('\n--- 3. Testing Single Employee Deep-Dive ---');

    const reqSingleEmp = {
      params: { id: projectAlpha._id.toString(), userId: userEmp1._id.toString() },
      user: userPM
    };
    const resSingleEmp = mockResponse();
    await projectAnalyticsController.getSingleEmployeeAnalysis(reqSingleEmp, resSingleEmp);
    assert(resSingleEmp.statusCode === 200 && resSingleEmp.body.tasks.length === 2, 'Single employee deep-dive returns task history list');

    console.log('\n--- 4. Testing Task-Wise Analysis & Filtering ---');

    const reqTaskWise = {
      params: { id: projectAlpha._id.toString() },
      query: { priority: 'High' },
      user: userPM
    };
    const resTaskWise = mockResponse();
    await projectAnalyticsController.getTaskWiseAnalysis(reqTaskWise, resTaskWise);
    assert(resTaskWise.statusCode === 200 && resTaskWise.body.totalCount === 2, 'Task-wise reporting view filtered by priority High returns 2 tasks');

    console.log('\n--- 5. Testing Drawing-Wise Progress Analysis ---');

    const reqDrawingWise = { params: { id: projectAlpha._id.toString() }, user: userPM };
    const resDrawingWise = mockResponse();
    await projectAnalyticsController.getDrawingWiseProgress(reqDrawingWise, resDrawingWise);
    assert(resDrawingWise.statusCode === 200 && resDrawingWise.body.categoryBreakdown.length >= 1, 'Drawing-wise progress returns category breakdown');

    console.log('\n--- 6. Testing Department-Wise Progress Analysis ---');

    const reqDeptWise = { params: { id: projectAlpha._id.toString() }, user: userPM };
    const resDeptWise = mockResponse();
    await projectAnalyticsController.getDepartmentWiseProgress(reqDeptWise, resDeptWise);
    assert(resDeptWise.statusCode === 200 && resDeptWise.body.totalDepartments === 2, 'Department-wise progress groups task completion rates across 2 departments');

    console.log('\n--- 7. Testing Fulfill Module 1 Progress Breakdown Placeholders ---');

    const reqModule1Breakdown = { params: { id: projectAlpha._id.toString() }, user: userPM };
    const resModule1Breakdown = mockResponse();
    await projectController.getProgressBreakdown(reqModule1Breakdown, resModule1Breakdown);
    assert(resModule1Breakdown.statusCode === 200 && resModule1Breakdown.body.departmentWise.length === 2, 'Module 1 progress breakdown endpoint populated with real departmentWise data');
    assert(resModule1Breakdown.body.drawingWise.totalDrawings === 2 && resModule1Breakdown.body.taskWise.totalTasks === 3, 'Module 1 progress breakdown endpoint populated with real drawingWise and taskWise data');

    console.log('\n--- 8. Testing Company-Wide Summary Rollup (Admin Dashboard) ---');

    const reqCompany = { user: userAdmin };
    const resCompany = mockResponse();
    await projectAnalyticsController.getCompanyWideSummary(reqCompany, resCompany);
    assert(resCompany.statusCode === 200 && resCompany.body.totalProjects >= 2, 'Company-wide summary aggregates across multiple projects');
    assert(resCompany.body.delayedProjectsCount >= 1, 'Company-wide summary identifies delayed projects');

    console.log('\n--- 9. Testing Snapshot Caching & Manual Refresh ---');

    const reqRefresh = { params: { projectId: projectAlpha._id.toString() }, user: userAdmin };
    const resRefresh = mockResponse();
    await projectAnalyticsController.refreshProjectSnapshot(reqRefresh, resRefresh);
    assert(resRefresh.statusCode === 200 && resRefresh.body.snapshot.progressPercentage === 45, 'Analytics snapshot refreshed and cached in database');

    const reqGetSnapshot = { params: { projectId: projectAlpha._id.toString() }, user: userAdmin };
    const resGetSnapshot = mockResponse();
    await projectAnalyticsController.getCachedSnapshot(reqGetSnapshot, resGetSnapshot);
    assert(resGetSnapshot.statusCode === 200 && resGetSnapshot.body.snapshot.pendingTasksCount === 1, 'Cached snapshot retrieved successfully');

    console.log('\n--- 10. Testing Role-Based Scoping for Detailed Colleague Comparisons ---');

    const reqEmpScoping = { params: { id: projectAlpha._id.toString() }, user: userEmp2 };
    const resEmpScoping = mockResponse();
    await projectAnalyticsController.getEmployeeWiseAnalysis(reqEmpScoping, resEmpScoping);
    assert(resEmpScoping.statusCode === 200 && resEmpScoping.body.isRestrictedView === true && resEmpScoping.body.employeeAnalytics.length === 1, 'Regular employee receives restricted view containing only their personal breakdown');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 7 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 7 test run:', error);
    process.exit(1);
  }
}

runErpModule7Tests();
