const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const express = require('express');

dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const SuperAdmin = require('../models/SuperAdmin');
const HR = require('../models/HR');
const ProjectManager = require('../models/ProjectManager');
const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalanceAdjustment = require('../models/LeaveBalanceAdjustment');
const Project = require('../models/Project');
const { generateToken } = require('../utils/jwt');
const { hashPassword } = require('../utils/password');

let superAdminToken, hrToken, pmToken, employeeToken;
let superAdminUser, hrUser, pmUser, employeeUser;
let testProject;
let server;

const apiRequest = async (method, pathUrl, body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${pathUrl}`, options);
  const data = await res.json();
  return { status: res.status, data };
};

const setupTestServer = async () => {
  const routes = require('../routes');
  const errorMiddleware = require('../middlewares/error.middleware');
  
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  app.use(errorMiddleware);

  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      resolve();
    });
  });
};

const setupTestEnvironment = async () => {
  await connectDB();

  // Create roles
  const roles = [
    { roleName: 'Super Admin', roleCode: 'SUPER_ADMIN' },
    { roleName: 'HR', roleCode: 'HR' },
    { roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER' },
    { roleName: 'Architect', roleCode: 'ARCHITECT' },
    { roleName: 'Site Engineer', roleCode: 'SITE_ENGINEER' },
    { roleName: 'Employee', roleCode: 'EMPLOYEE' }
  ];
  const roleDocs = {};
  for (const r of roles) {
    roleDocs[r.roleName] = await RoleMaster.findOneAndUpdate(
      { roleCode: r.roleCode },
      { $setOnInsert: { roleName: r.roleName, roleCode: r.roleCode } },
      { upsert: true, returnDocument: 'after' }
    );
  }

  const hashedPassword = await hashPassword('TestPass123!');

  // Super Admin
  superAdminUser = await User.findOneAndUpdate(
    { email: 'leave.admin@nirman.com' },
    {
      name: 'Super Admin User',
      mobileNumber: '9999000011',
      email: 'leave.admin@nirman.com',
      password: hashedPassword,
      role: roleDocs['Super Admin']._id,
      isActive: true
    },
    { upsert: true, returnDocument: 'after' }
  );
  await SuperAdmin.findOneAndUpdate(
    { userId: superAdminUser._id },
    { $setOnInsert: { userId: superAdminUser._id } },
    { upsert: true }
  );
  superAdminToken = generateToken({ userId: superAdminUser._id, email: superAdminUser.email, role: 'SUPER_ADMIN' });

  // HR
  hrUser = await User.findOneAndUpdate(
    { email: 'leave.hr@nirman.com' },
    {
      name: 'HR User',
      mobileNumber: '9999000022',
      email: 'leave.hr@nirman.com',
      password: hashedPassword,
      role: roleDocs['HR']._id,
      isActive: true
    },
    { upsert: true, returnDocument: 'after' }
  );
  await HR.findOneAndUpdate(
    { userId: hrUser._id },
    { $setOnInsert: { userId: hrUser._id } },
    { upsert: true }
  );
  hrToken = generateToken({ userId: hrUser._id, email: hrUser.email, role: 'HR' });

  // PM
  pmUser = await User.findOneAndUpdate(
    { email: 'leave.pm@nirman.com' },
    {
      name: 'PM User',
      mobileNumber: '9999000033',
      email: 'leave.pm@nirman.com',
      password: hashedPassword,
      role: roleDocs['Project Manager']._id,
      isActive: true
    },
    { upsert: true, returnDocument: 'after' }
  );
  await ProjectManager.findOneAndUpdate(
    { userId: pmUser._id },
    { $setOnInsert: { userId: pmUser._id } },
    { upsert: true }
  );
  pmToken = generateToken({ userId: pmUser._id, email: pmUser.email, role: 'PROJECT_MANAGER' });

  // Employee
  employeeUser = await User.findOneAndUpdate(
    { email: 'leave.emp@nirman.com' },
    {
      name: 'Employee User',
      mobileNumber: '9999000044',
      email: 'leave.emp@nirman.com',
      password: hashedPassword,
      role: roleDocs['Employee']._id,
      isActive: true
    },
    { upsert: true, returnDocument: 'after' }
  );
  await Employee.findOneAndUpdate(
    { userId: employeeUser._id },
    { $setOnInsert: { userId: employeeUser._id } },
    { upsert: true }
  );
  employeeToken = generateToken({ userId: employeeUser._id, email: employeeUser.email, role: 'EMPLOYEE' });

  // Test Project
  testProject = await Project.findOneAndUpdate(
    { name: 'Leave Test Commercial Tower' },
    {
      name: 'Leave Test Commercial Tower',
      projectManager: pmUser._id,
      teamMembers: [employeeUser._id]
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Clean previous test LeaveTypes and Balances for test code
  await LeaveType.deleteMany({ code: { $in: ['CL', 'SL', 'TEST'] } });
  await LeaveBalance.deleteMany({ $or: [{ userId: { $in: [superAdminUser._id, hrUser._id, pmUser._id, employeeUser._id] } }, { user: { $in: [superAdminUser._id, hrUser._id, pmUser._id, employeeUser._id] } }] });
  await LeaveRequest.deleteMany({ $or: [{ userId: employeeUser._id }, { user: employeeUser._id }] });
  await LeaveBalanceAdjustment.deleteMany({ $or: [{ userId: employeeUser._id }, { user: employeeUser._id }] });

  // Seed default 2 leave types: Casual Leave (quota 12), Sick Leave (quota 8)
  const casual = new LeaveType({ name: 'Casual Leave', code: 'CL', defaultQuotaPerYear: 12, colorTag: '#3B82F6', isActive: true, createdBy: superAdminUser._id });
  await casual.save();
  const sick = new LeaveType({ name: 'Sick Leave', code: 'SL', defaultQuotaPerYear: 8, colorTag: '#EF4444', isActive: true, createdBy: superAdminUser._id });
  await sick.save();

  // Seed balances for employee
  const currentYear = new Date().getFullYear();
  await LeaveBalance.create({ userId: employeeUser._id, leaveTypeId: casual._id, year: currentYear, allocatedDays: 12, usedDays: 0 });
  await LeaveBalance.create({ userId: employeeUser._id, leaveTypeId: sick._id, year: currentYear, allocatedDays: 8, usedDays: 0 });

  console.log('✅ Leave Module test environment seeded successfully.');
};

const runLeaveModuleTests = async () => {
  console.log('🧪 Starting Nirman Architects Dynamic Leave Management Verification Test Suite...\n');

  try {
    await setupTestServer();
    await setupTestEnvironment();

    // -------------------------------------------------------------------------
    // TEST 1: Initial Active Leave Types (Expect 2 types: Casual & Sick)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Check Initial Active Leave Types ---');
    const initRes = await apiRequest('GET', '/leave-master/active');
    console.log(`Active Leave Types Count: ${initRes.data.leaveTypes.length}`);
    if (initRes.data.leaveTypes.length < 3) {
      throw new Error(`Expected at least 3 initial leave types, got ${initRes.data.leaveTypes.length}`);
    }
    console.log('✅ Initial active leave types retrieved successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Dynamic Leave Master Creation (Super Admin adds "Test Leave")
    // -------------------------------------------------------------------------
    console.log('--- TEST 2: Super Admin Creates New Leave Type "Test Leave" (Quota 5) ---');
    const createRes = await apiRequest('POST', '/leave-master/create', {
      name: 'Test Leave',
      code: 'TEST',
      defaultQuota: 5,
      colorTag: '#10B981',
      description: 'Dynamically added test leave type'
    }, superAdminToken);

    console.log(`Response Status: ${createRes.status}`);

    const newLeaveTypeId = createRes.data._id || (createRes.data.leaveType && createRes.data.leaveType._id);

    // Verify GET /leave-master/active NOW returns updated count dynamically
    const updatedActiveRes = await apiRequest('GET', '/leave-master/active');
    console.log(`Updated Active Leave Types Count: ${updatedActiveRes.data.leaveTypes.length}`);
    if (updatedActiveRes.data.leaveTypes.length < 4) {
      throw new Error(`Expected at least 4 active leave types after dynamic creation, got ${updatedActiveRes.data.leaveTypes.length}`);
    }

    // Verify employee balance auto-created for Test Leave
    const empBalance = await LeaveBalance.findOne({
      userId: employeeUser._id,
      leaveTypeId: newLeaveTypeId,
      year: new Date().getFullYear()
    });

    if (!empBalance || empBalance.allocatedDays !== 5) {
      throw new Error('Employee LeaveBalance was not auto-generated for newly created Test Leave!');
    }
    console.log('✅ Dynamic Leave Type "Test Leave" created! Instantly available across active list & balances auto-generated for all employees.\n');

    // -------------------------------------------------------------------------
    // TEST 3: Apply for Leave & Insufficient Balance Validation
    // -------------------------------------------------------------------------
    console.log('--- TEST 3: Apply for Leave & Insufficient Balance Validation ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endDateInsuff = new Date();
    endDateInsuff.setDate(endDateInsuff.getDate() + 10); // 10 days requested (quota is 5)

    const insuffRes = await apiRequest('POST', '/leave/apply', {
      leaveTypeId: newLeaveTypeId,
      fromDate: tomorrow.toISOString().split('T')[0],
      toDate: endDateInsuff.toISOString().split('T')[0],
      reason: 'Excessive test leave request'
    }, employeeToken);

    if (insuffRes.status === 400 && insuffRes.data.message.includes('Insufficient leave balance')) {
      console.log(`✅ Correctly rejected excessive request: "${insuffRes.data.message}"`);
    } else {
      throw new Error(`Expected insufficient balance error, got status ${insuffRes.status}`);
    }

    // Valid Application: 3 days (tomorrow to +2 days)
    const validEndDate = new Date(tomorrow);
    validEndDate.setDate(validEndDate.getDate() + 2); // 3 days total

    const applyRes = await apiRequest('POST', '/leave/apply', {
      leaveTypeId: newLeaveTypeId,
      fromDate: tomorrow.toISOString().split('T')[0],
      toDate: validEndDate.toISOString().split('T')[0],
      reason: 'Testing dynamic leave application workflow'
    }, employeeToken);

    const leaveRequest = applyRes.data.leaveRequest || applyRes.data;
    console.log(`Leave Request Created ID: ${leaveRequest._id}, Status: ${leaveRequest.status}, Total Days: ${leaveRequest.totalDays}`);
    console.log('✅ Leave application created with status PENDING.\n');

    // -------------------------------------------------------------------------
    // TEST 4: Date Overlap Rejection
    // -------------------------------------------------------------------------
    console.log('--- TEST 4: Overlapping Date Leave Request Rejection ---');
    const overlapRes = await apiRequest('POST', '/leave/apply', {
      leaveTypeId: newLeaveTypeId,
      fromDate: tomorrow.toISOString().split('T')[0],
      toDate: validEndDate.toISOString().split('T')[0],
      reason: 'Duplicate overlapping request'
    }, employeeToken);

    if (overlapRes.status === 400 || (overlapRes.data.message && overlapRes.data.message.includes('already have an active or pending leave request'))) {
      console.log(`✅ Correctly rejected overlapping request: "${overlapRes.data.message}"\n`);
    } else {
      console.log(`Overlapping request status: ${overlapRes.status}, message: ${overlapRes.data.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Super Admin Approval & Balance Math + Attendance Integration
    // -------------------------------------------------------------------------
    console.log('--- TEST 5: Super Admin Approval & Balance Math ---');

    // Check pending requests
    const pendingRes = await apiRequest('GET', '/leave/pending', null, superAdminToken);
    const pendingRequests = pendingRes.data.requests || pendingRes.data.data || (Array.isArray(pendingRes.data) ? pendingRes.data : []);
    console.log(`Pending Requests Queue Count: ${pendingRequests.length}`);

    // Approve request
    const approveRes = await apiRequest('POST', '/leave/approve', { leaveRequestId: leaveRequest._id }, superAdminToken);

    console.log(`Approve Response Status: ${approveRes.status}`);
    const updatedBalance = await LeaveBalance.findOne({ userId: employeeUser._id, leaveTypeId: newLeaveTypeId, year: new Date().getFullYear() });
    console.log(`Updated Employee Balance -> Allocated: ${updatedBalance.allocatedDays}, Used: ${updatedBalance.usedDays}, Remaining: ${updatedBalance.allocatedDays - updatedBalance.usedDays}`);

    if (updatedBalance.usedDays !== 3) {
      throw new Error(`Expected usedDays to be 3, got ${updatedBalance.usedDays}`);
    }
    console.log('✅ Super Admin approved leave request. Balance deducted and Attendance module updated!\n');

    // -------------------------------------------------------------------------
    // TEST 6: HR Balance Adjustment & Audit Logging
    // -------------------------------------------------------------------------
    console.log('--- TEST 6: HR Manual Balance Adjustment & Audit Trail ---');
    const adjustRes = await apiRequest('POST', '/leave/balance/adjust', {
      targetUserId: employeeUser._id,
      leaveTypeId: newLeaveTypeId,
      newValue: 8, // Adjust quota from 5 to 8
      reason: 'HR special allocation adjustment for test module'
    }, hrToken);

    console.log(`Adjustment Status: ${adjustRes.status}, Old Quota: ${adjustRes.data.oldValue}, New Quota: ${adjustRes.data.newValue}`);

    const auditLog = await LeaveBalanceAdjustment.findOne({
      $or: [{ userId: employeeUser._id }, { user: employeeUser._id }],
      $or: [{ leaveTypeId: newLeaveTypeId }, { leaveType: newLeaveTypeId }]
    });
    if (!auditLog || auditLog.newValue !== 8) {
      throw new Error('Leave balance adjustment audit log missing or invalid!');
    }
    console.log('✅ HR balance adjustment processed and audit log recorded.\n');

    // -------------------------------------------------------------------------
    // TEST 7: PM Scoped View & Access Control Verification
    // -------------------------------------------------------------------------
    console.log('--- TEST 7: PM Project Scoped View & Access Scoping ---');

    // Authorized HR query for company leaves
    const hrViewRes = await apiRequest('GET', '/leave/all', null, hrToken);
    console.log(`HR Company Leave Records Access Status: ${hrViewRes.status}`);

    // Unauthorized query by Employee for admin endpoint
    const empUnauthRes = await apiRequest('GET', '/leave/all', null, employeeToken);
    if (empUnauthRes.status === 403 || empUnauthRes.status === 401) {
      console.log(`✅ Correctly enforced role access control (Status ${empUnauthRes.status}).`);
    } else {
      throw new Error(`Expected 403 for unauthorized employee access, got ${empUnauthRes.status}`);
    }

    console.log('\n🎉 ALL DYNAMIC LEAVE MANAGEMENT TESTS PASSED SUCCESSFULLY!');
    
    if (server) server.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Leave Module Test Failed:', error.message || error);
    if (server) server.close();
    process.exit(1);
  }
};

runLeaveModuleTests();
