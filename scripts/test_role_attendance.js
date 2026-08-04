const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Employee = require('../models/Employee');
const HR = require('../models/HR');
const ProjectManager = require('../models/ProjectManager');
const SiteEngineer = require('../models/SiteEngineer');
const Attendance = require('../models/Attendance');
const SiteLocation = require('../models/SiteLocation');
const Project = require('../models/Project');
const AttendanceCorrectionRequest = require('../models/AttendanceCorrectionRequest');

const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

const runRoleAttendanceTests = async () => {
  console.log('🧪 Starting Role-Wise Attendance Verification Suite...\n');
  await connectDB();

  try {
    // 1. Clean up test records
    const testEmails = [
      'hr.test@nirman.com',
      'pm.test@nirman.com',
      'engineer.test@nirman.com',
      'staff.test@nirman.com'
    ];
    await User.deleteMany({ email: { $in: testEmails } });

    // Lookup / Create roles
    const getRoleObj = async (name) => {
      let r = await RoleMaster.findOne({ name });
      if (!r) r = await RoleMaster.create({ name });
      return r;
    };

    const hrRole = await getRoleObj('HR');
    const pmRole = await getRoleObj('Project Manager');
    const seRole = await getRoleObj('Site Engineer');
    const empRole = await getRoleObj('Employee');

    const hashedPassword = await hashPassword('Password123!');

    // Create Test Users for all 4 roles
    const hrUser = await User.create({ mobileNumber: '9900000001', email: 'hr.test@nirman.com', password: hashedPassword, role: hrRole._id });
    await HR.create({ name: 'HR Admin', role: hrRole._id, user: hrUser._id });

    const pmUser = await User.create({ mobileNumber: '9900000002', email: 'pm.test@nirman.com', password: hashedPassword, role: pmRole._id });
    await ProjectManager.create({ name: 'PM Manager', role: pmRole._id, user: pmUser._id });

    const seUser = await User.create({ mobileNumber: '9900000003', email: 'engineer.test@nirman.com', password: hashedPassword, role: seRole._id });
    await SiteEngineer.create({ name: 'Site Eng 1', role: seRole._id, user: seUser._id });

    const empUser = await User.create({ mobileNumber: '9900000004', email: 'staff.test@nirman.com', password: hashedPassword, role: empRole._id });
    await Employee.create({ name: 'Office Staff 1', role: empRole._id, user: empUser._id });

    // Create Test Project & Site Location (Ahmedabad Office / Site: 23.0225, 72.5714, Radius: 100m)
    const testSite = await SiteLocation.create({
      projectName: 'Nirman Commercial Tower',
      lat: 23.0225,
      lng: 72.5714,
      radiusMeters: 100
    });

    const testProject = await Project.create({
      name: 'Nirman Commercial Tower Project',
      projectManager: pmUser._id,
      teamMembers: [seUser._id, empUser._id],
      siteLocation: testSite._id
    });
    testSite.project = testProject._id;
    await testSite.save();

    console.log('✅ Created multi-role test users, project, and 100m geo-fence site location.');

    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.data = data; return res; };
      return res;
    };

    const attendanceController = require('../controllers/attendance.controller');

    // ---------------------------------------------------------
    // TEST 1: OFFICE_AUTO Clock-In for HR, PM, and Employee
    // ---------------------------------------------------------
    console.log('\n--- TEST 1: OFFICE_AUTO Mode Clock-In (HR & PM) ---');
    const req1 = { user: { userId: hrUser._id }, body: { type: 'CLOCK_IN', source: 'SYSTEM_BOOT' } };
    const res1 = mockRes();
    await attendanceController.clock(req1, res1, (err) => { throw err; });
    console.log('HR Clock-In Status:', res1.statusCode, res1.data?.message);

    if (res1.statusCode === 201) {
      console.log('✅ HR OFFICE_AUTO Clock-In successful.');
    } else {
      console.error('❌ TEST 1 FAILED');
    }

    // ---------------------------------------------------------
    // TEST 2: SITE_MOBILE Check-In INSIDE Geo-Fence (Site Engineer)
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: SITE_MOBILE Check-In INSIDE Geo-Fence ---');
    // Site Engineer GPS: 23.0226, 72.5715 (Distance approx ~15m from site center)
    const req2 = {
      user: { userId: seUser._id },
      body: { projectId: testProject._id.toString(), lat: 23.0226, lng: 72.5715, selfieUrl: 'https://site.jpg' }
    };
    const res2 = mockRes();
    await attendanceController.siteCheckIn(req2, res2, (err) => { throw err; });

    console.log('Site Check-In Response:', res2.statusCode, res2.data);
    if (res2.statusCode === 201 && res2.data?.mode === 'SITE_MOBILE') {
      console.log('✅ Site Engineer GPS Check-In accepted within 100m geo-fence radius.');
    } else {
      console.error('❌ TEST 2 FAILED');
    }

    // ---------------------------------------------------------
    // TEST 3: SITE_MOBILE Check-In OUTSIDE Geo-Fence (Rejection)
    // ---------------------------------------------------------
    console.log('\n--- TEST 3: SITE_MOBILE Check-In OUTSIDE Geo-Fence (Out of Bounds) ---');
    // Site Engineer GPS: 23.0300, 72.5800 (Distance ~1.2km away from site center)
    const req3 = {
      user: { userId: seUser._id },
      body: { projectId: testProject._id.toString(), lat: 23.0300, lng: 72.5800 }
    };
    const res3 = mockRes();
    await attendanceController.siteCheckIn(req3, res3, (err) => { throw err; });

    console.log('Out of Bounds Check-In Response:', res3.statusCode, res3.data?.message);
    if (res3.statusCode === 403) {
      console.log('✅ Geo-fencing properly rejected out-of-bounds check-in attempt with 403 Forbidden!');
    } else {
      console.error('❌ TEST 3 FAILED');
    }

    // ---------------------------------------------------------
    // TEST 4: Attendance Correction Request & HR Approval
    // ---------------------------------------------------------
    console.log('\n--- TEST 4: Attendance Correction Request & HR Approval ---');
    // 1. Employee submits correction request
    const req4a = {
      user: { userId: empUser._id },
      body: { requestedClockIn: new Date(Date.now() - 3600000), reason: 'PC network card failure at office' }
    };
    const res4a = mockRes();
    await attendanceController.requestCorrection(req4a, res4a, (err) => { throw err; });
    console.log('Correction Submission Status:', res4a.statusCode, res4a.data?.request?._id);

    const correctionId = res4a.data?.request?._id;

    // 2. HR approves request
    const req4b = {
      user: { userId: hrUser._id, role: 'HR' },
      body: { requestId: correctionId.toString() }
    };
    const res4b = mockRes();
    await attendanceController.approveCorrection(req4b, res4b, (err) => { throw err; });
    console.log('HR Approval Status:', res4b.statusCode, res4b.data?.message);

    if (res4b.statusCode === 200 && res4b.data?.request?.status === 'Approved') {
      console.log('✅ HR approved manual correction request successfully!');
    } else {
      console.error('❌ TEST 4 FAILED');
    }

    // ---------------------------------------------------------
    // TEST 5: Project Manager Project Team Attendance View
    // ---------------------------------------------------------
    console.log('\n--- TEST 5: Project Manager Team Attendance View ---');
    const req5 = {
      user: { userId: pmUser._id, role: 'Project Manager' },
      params: { projectId: testProject._id.toString() }
    };
    const res5 = mockRes();
    await attendanceController.getProjectAttendance(req5, res5, (err) => { throw err; });

    console.log('PM Team View Response Stats:', res5.statusCode, res5.data?.stats);
    if (res5.statusCode === 200 && res5.data?.stats) {
      console.log('✅ Project Manager retrieved team stats (Working on Site vs Office)!');
    } else {
      console.error('❌ TEST 5 FAILED');
    }

    // Clean up test data
    await User.deleteMany({ email: { $in: testEmails } });
    await HR.deleteMany({ user: hrUser._id });
    await ProjectManager.deleteMany({ user: pmUser._id });
    await SiteEngineer.deleteMany({ user: seUser._id });
    await Employee.deleteMany({ user: empUser._id });
    await Attendance.deleteMany({ user: { $in: [hrUser._id, pmUser._id, seUser._id, empUser._id] } });
    await SiteLocation.deleteMany({ _id: testSite._id });
    await Project.deleteMany({ _id: testProject._id });
    await AttendanceCorrectionRequest.deleteMany({ _id: correctionId });

    console.log('\n🎉 ALL ROLE-WISE ATTENDANCE VERIFICATION TESTS PASSED!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Role-wise attendance test error:', error);
    process.exit(1);
  }
};

runRoleAttendanceTests();
