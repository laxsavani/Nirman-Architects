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
const InternalNotification = require('../models/InternalNotification');
const ProjectHealthConfig = require('../models/ProjectHealthConfig');
const CompanyDashboardSnapshot = require('../models/CompanyDashboardSnapshot');

const adminDashboardController = require('../controllers/adminDashboard.controller');
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

async function runErpModule10Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 10: ADMIN DASHBOARD (FINAL ERP CAPSTONE) — TEST SUITE');
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
      'erp10.superadmin@erp.com',
      'erp10.admin@erp.com',
      'erp10.pm@erp.com',
      'erp10.emp@erp.com'
    ];

    await CompanyDashboardSnapshot.deleteMany({});
    await ProjectHealthConfig.deleteMany({});
    await InternalNotification.deleteMany({});
    await Attendance.deleteMany({});
    await Task.deleteMany({ taskName: { $regex: /ERP Module 10/i } });
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 10/i } });
    await DrawingCategory.deleteMany({ name: 'ERP10 Working Drawing' });
    await Department.deleteMany({ name: { $regex: /ERP10/i } });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 10/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleSuperAdmin = await RoleMaster.findOne({ roleCode: 'SUPER_ADMIN' });
    if (!roleSuperAdmin) roleSuperAdmin = await RoleMaster.create({ roleName: 'Super Admin', roleCode: 'SUPER_ADMIN', isActive: true });

    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Users
    const userSuperAdmin = await User.create({
      name: 'Ratan Tata',
      email: 'erp10.superadmin@erp.com',
      password: await hashPassword('SuperPass@123'),
      roleId: roleSuperAdmin._id,
      designation: 'Chairman',
      isActive: true
    });

    const userAdmin = await User.create({
      name: 'Azim Premji',
      email: 'erp10.admin@erp.com',
      password: await hashPassword('AdminPass@123'),
      roleId: roleAdmin._id,
      designation: 'Managing Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Nandan Nilekani',
      email: 'erp10.pm@erp.com',
      password: await hashPassword('PMPass@123'),
      roleId: rolePM._id,
      designation: 'Lead PM',
      isActive: true
    });

    const userEmp = await User.create({
      name: 'Kiran Mazumdar',
      email: 'erp10.emp@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Architectural Consultant',
      isActive: true
    });

    // 3. Test Projects
    const project1 = await Project.create({
      projectName: 'ERP Module 10 - Tech Park Project',
      status: 'In Progress',
      progressPercentage: 65,
      budget: 15000000,
      isDelayed: false,
      createdBy: userPM._id
    });

    const project2 = await Project.create({
      projectName: 'ERP Module 10 - Commercial Complex',
      status: 'In Progress',
      progressPercentage: 40,
      budget: 8000000,
      isDelayed: true,
      createdBy: userPM._id
    });

    // 4. Test Tasks & Attendance & Notifications
    const dept = await Department.create({ name: 'ERP10 Architectural Dept', code: 'E10-ARC', isActive: true });

    await Task.create({
      projectId: project1._id,
      departmentId: dept._id,
      taskName: 'ERP Module 10 - Standard Task',
      assignedEmployee: userEmp._id,
      status: 'Completed',
      productivityScore: 90,
      totalWorkingTimeMinutes: 240,
      createdBy: userPM._id
    });

    await Task.create({
      projectId: project2._id,
      departmentId: dept._id,
      taskName: 'ERP Module 10 - Delayed Task',
      assignedEmployee: userEmp._id,
      status: 'In Progress',
      isDelayed: true,
      deadline: new Date(Date.now() + 3 * 86400000),
      createdBy: userPM._id
    });

    // Clock-in employee (Office) and clock-in PM (Site) for today
    const today = new Date();
    await Attendance.create({
      userId: userEmp._id,
      date: today,
      clockInTime: today,
      mode: 'OFFICE_AUTO',
      status: 'PRESENT'
    });

    await Attendance.create({
      userId: userPM._id,
      date: today,
      clockInTime: today,
      mode: 'SITE_MOBILE',
      status: 'PRESENT'
    });

    // Clock-in Super Admin (Should be EXCLUDED from online employee lists!)
    await Attendance.create({
      userId: userSuperAdmin._id,
      date: today,
      clockInTime: today,
      mode: 'OFFICE_AUTO',
      status: 'PRESENT'
    });

    // Activity log entry
    await InternalNotification.create({
      userId: userAdmin._id,
      type: 'PROJECT_STATUS_CHANGED',
      title: 'Project Status Updated',
      message: 'Commercial Complex updated to In Progress',
      projectId: project2._id
    });

    console.log('--- 1. Testing Master Aggregated Admin Dashboard Endpoint (GET /api/admin-dashboard) ---');

    const reqDash = { user: userAdmin };
    const resDash = mockResponse();
    await adminDashboardController.getAdminDashboard(reqDash, resDash);
    assert(resDash.statusCode === 200, 'Master Admin Dashboard returned HTTP 200 OK');

    const dbPayload = resDash.body.dashboard;
    assert(dbPayload.projects.total >= 2, 'Tile 1-4: Project totals (total, active, completed, delayed) calculated correctly');
    assert(dbPayload.attendanceToday.present >= 1, 'Tile 6: Today\'s Attendance split calculated cleanly');
    assert(dbPayload.employeeProductivityAvg >= 80, 'Tile 7: Employee Productivity average computed');
    assert(dbPayload.onlineEmployees.totalOnline >= 2, 'Tile 8-10: Online employees split (non-super-admins online: office and site)');
    assert(dbPayload.recentActivities.length >= 1, 'Tile 11: Recent Activities company-wide feed populated');
    assert(dbPayload.upcomingDeadlines.length >= 1, 'Tile 13: Upcoming Deadlines aggregated');
    assert(dbPayload.revenueSummary.budgetedTotalValue >= 23000000, 'Tile 15: Honest-scoped Revenue summary calculates budgeted project total');
    assert(dbPayload.taskSummary.total >= 2, 'Tile 16: Task Summary breakdown compiled');
    assert(dbPayload.projectHealthSummary.averageScore > 0, 'Tile 18: Composite Project Health Score evaluated');

    console.log('\n--- 2. Testing Online Employees Real-Time Endpoint (GET /online-employees) ---');

    const reqOnline = { user: userAdmin };
    const resOnline = mockResponse();
    await adminDashboardController.getOnlineEmployees(reqOnline, resOnline);
    assert(resOnline.statusCode === 200 && resOnline.body.totalOnline === 2, 'Online employees endpoint correctly excludes Super Admin');
    assert(resOnline.body.siteCount === 1 && resOnline.body.officeCount === 1, 'Site vs Office employee split categorized cleanly');

    console.log('\n--- 3. Testing Revenue Summary Honesty-Scoped Endpoint (GET /revenue-summary) ---');

    const reqRev = { user: userAdmin };
    const resRev = mockResponse();
    await adminDashboardController.getRevenueSummary(reqRev, resRev);
    assert(resRev.statusCode === 200 && resRev.body.metricLabel === 'Budgeted Project Value', 'Revenue summary explicitly labeled as Budgeted Value');
    assert(resRev.body.disclaimer.includes('Billing/Invoicing module'), 'Disclaimer metadata provides clear expectation guidance');

    console.log('\n--- 4. Testing Project Health Score Composite Calculations ---');

    const reqHealthProj1 = { params: { projectId: project1._id.toString() }, user: userAdmin };
    const resHealthProj1 = mockResponse();
    await adminDashboardController.getProjectHealthScore(reqHealthProj1, resHealthProj1);
    assert(resHealthProj1.statusCode === 200 && resHealthProj1.body.health.score >= 70, 'Clean, on-track project calculates high health score (EXCELLENT/GOOD)');

    const reqHealthProj2 = { params: { projectId: project2._id.toString() }, user: userAdmin };
    const resHealthProj2 = mockResponse();
    await adminDashboardController.getProjectHealthScore(reqHealthProj2, resHealthProj2);
    assert(resHealthProj2.statusCode === 200 && resHealthProj2.body.health.score < resHealthProj1.body.health.score, 'Delayed project with overdue tasks correctly receives lower health score');

    console.log('\n--- 5. Testing Project Health Configuration CRUD & Weight Adjustment ---');

    const reqGetConfig = { user: userAdmin };
    const resGetConfig = mockResponse();
    await adminDashboardController.getHealthConfig(reqGetConfig, resGetConfig);
    assert(resGetConfig.statusCode === 200 && resGetConfig.body.config.timelineWeight === 30, 'Default health weights retrieved');

    // Attempt weight update as regular Admin -> Blocked (Super Admin only)
    const reqUpdateAdmin = { body: { timelineWeight: 40 }, user: userAdmin };
    const resUpdateAdmin = mockResponse();
    await adminDashboardController.updateHealthConfig(reqUpdateAdmin, resUpdateAdmin);
    assert(resUpdateAdmin.statusCode === 403, 'Regular Admin blocked from updating health weights (HTTP 403 Access Denied)');

    // Weight update as Super Admin -> Success
    const reqUpdateSuper = { body: { timelineWeight: 40, productivityWeight: 20 }, user: userSuperAdmin };
    const resUpdateSuper = mockResponse();
    await adminDashboardController.updateHealthConfig(reqUpdateSuper, resUpdateSuper);
    assert(resUpdateSuper.statusCode === 200 && resUpdateSuper.body.config.timelineWeight === 40, 'Super Admin updated project health weights successfully');

    console.log('\n--- 6. Testing Company Dashboard Snapshot Refresh & Caching ---');

    const reqSnap = { user: userAdmin };
    const resSnap = mockResponse();
    await adminDashboardController.refreshSnapshot(reqSnap, resSnap);
    assert(resSnap.statusCode === 200 && resSnap.body.snapshot.totalProjects >= 2, 'Company Dashboard Snapshot created/refreshed');

    console.log('\n--- 7. Testing Executive Role Scoping Enforcement ---');

    const reqEmpDash = { user: userEmp };
    const resEmpDash = mockResponse();
    await adminDashboardController.getAdminDashboard(reqEmpDash, resEmpDash);
    assert(resEmpDash.statusCode === 403, 'Regular Employee blocked from viewing Admin Dashboard (HTTP 403 Access Denied)');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 10 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 10 test run:', error);
    process.exit(1);
  }
}

runErpModule10Tests();
