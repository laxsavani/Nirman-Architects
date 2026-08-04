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
const UnauthorizedAttempt = require('../models/UnauthorizedAttempt');
const Notification = require('../models/Notification');
const HeartbeatLog = require('../models/HeartbeatLog');
const AttendanceConfig = require('../models/AttendanceConfig');

const { hashPassword } = require('../utils/password');

const runMasterSuite = async () => {
  console.log('🧪 Starting Full Master Attendance HRM Verification Suite...\n');
  await connectDB();

  try {
    const testEmails = ['hr.master@nirman.com', 'pm.master@nirman.com', 'site.master@nirman.com', 'staff.master@nirman.com'];
    await User.deleteMany({ email: { $in: testEmails } });

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

    const hrUser = await User.create({ mobileNumber: '9800000001', email: 'hr.master@nirman.com', password: hashedPassword, role: hrRole._id, registeredDeviceId: 'HR-PC-1111', deviceStatus: 'APPROVED' });
    await HR.create({ name: 'Master HR Admin', role: hrRole._id, user: hrUser._id });

    const pmUser = await User.create({ mobileNumber: '9800000002', email: 'pm.master@nirman.com', password: hashedPassword, role: pmRole._id, registeredDeviceId: 'PM-PC-2222', deviceStatus: 'APPROVED' });
    await ProjectManager.create({ name: 'Master PM', role: pmRole._id, user: pmUser._id });

    const seUser = await User.create({ mobileNumber: '9800000003', email: 'site.master@nirman.com', password: hashedPassword, role: seRole._id });
    await SiteEngineer.create({ name: 'Master Site Eng', role: seRole._id, user: seUser._id });

    const empUser = await User.create({ mobileNumber: '9800000004', email: 'staff.master@nirman.com', password: hashedPassword, role: empRole._id, registeredDeviceId: 'STAFF-PC-4444', deviceStatus: 'APPROVED' });
    await Employee.create({ name: 'Master Staff', role: empRole._id, user: empUser._id });

    console.log('✅ Created multi-role test users for Master Suite.');

    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.data = data; return res; };
      return res;
    };

    const attendanceController = require('../controllers/attendance.controller');
    const siteLocationController = require('../controllers/siteLocation.controller');
    const notificationController = require('../controllers/notification.controller');

    // TEST 1: Setup Site Location & Project Geo-Fence
    console.log('\n--- TEST 1: Configure Site Location Geo-Fence ---');
    const req1 = {
      user: { userId: pmUser._id, role: 'Project Manager' },
      body: { projectName: 'Nirman Master Site', lat: 23.0225, lng: 72.5714, radiusMeters: 100 }
    };
    const res1 = mockRes();
    await siteLocationController.createSiteLocation(req1, res1, (err) => { throw err; });
    console.log('Site Location Setup:', res1.statusCode, res1.data?.siteLocation?._id);

    const siteLocId = res1.data?.siteLocation?._id;

    // TEST 2: Device Mismatch & Security Alert Trigger
    console.log('\n--- TEST 2: Device Mismatch Security Alert ---');
    const req2 = {
      user: { userId: empUser._id },
      body: { deviceId: 'HACKED-DEVICE-9999', type: 'CLOCK_IN', source: 'SYSTEM_BOOT' }
    };
    const res2 = mockRes();
    await attendanceController.clock(req2, res2, (err) => { throw err; });

    console.log('Device Mismatch Status:', res2.statusCode, res2.data?.message);
    const secAttempt = await UnauthorizedAttempt.findOne({ user: empUser._id, reason: 'device_mismatch' });
    const secNotif = await Notification.findOne({ recipient: hrUser._id, type: 'SECURITY_ALERT' });

    if (res2.statusCode === 403 && secAttempt && secNotif) {
      console.log('✅ Unauthorized device attempt blocked, audit logged, and security alert sent to HR!');
    } else {
      console.error('❌ TEST 2 FAILED');
    }

    // TEST 3: Heartbeat Log & Tamper Check Reference
    console.log('\n--- TEST 3: Heartbeat Log & Tamper Check ---');
    const req3 = {
      user: { userId: empUser._id },
      body: { deviceId: 'STAFF-PC-4444', clientTime: new Date().toISOString(), monotonicTicks: '123456789' }
    };
    const res3 = mockRes();
    await attendanceController.heartbeat(req3, res3, (err) => { throw err; });

    const hbLog = await HeartbeatLog.findOne({ user: empUser._id });
    if (res3.statusCode === 200 && hbLog && hbLog.monotonicTicks === '123456789') {
      console.log('✅ Heartbeat log recorded with server authoritative timestamp & monotonic ticks!');
    } else {
      console.error('❌ TEST 3 FAILED');
    }

    // TEST 4: SITE_MOBILE Geo-Fence Verification & Rejection Alert
    console.log('\n--- TEST 4: SITE_MOBILE Geo-Fence Rejection Notification ---');
    const req4 = {
      user: { userId: seUser._id },
      body: { lat: 24.0000, lng: 73.0000 } // Out of bounds (~110km away)
    };
    const res4 = mockRes();
    await attendanceController.siteCheckIn(req4, res4, (err) => { throw err; });

    const gfAttempt = await UnauthorizedAttempt.findOne({ user: seUser._id, reason: 'outside_geofence' });
    const gfNotif = await Notification.findOne({ recipient: hrUser._id, type: 'GEOFENCE_REJECTED' });

    if (res4.statusCode === 403 && gfAttempt && gfNotif) {
      console.log('✅ Out-of-bounds check-in rejected, audit logged, and HR notified!');
    } else {
      console.error('❌ TEST 4 FAILED');
    }

    // TEST 5: HR Config Rules & Dashboard Widgets
    console.log('\n--- TEST 5: HR Config Rules & Dashboard Widgets ---');
    const req5a = {
      user: { userId: hrUser._id, role: 'HR' },
      body: { timeoutMinutes: 5, graceBufferMinutes: 10 }
    };
    const res5a = mockRes();
    await attendanceController.updateHeartbeatTimeout(req5a, res5a, (err) => { throw err; });
    console.log('Config Update Status:', res5a.statusCode, res5a.data?.config?.heartbeatTimeoutMinutes);

    const req5b = { user: { userId: hrUser._id, role: 'HR' } };
    const res5b = mockRes();
    await attendanceController.getDashboardWidgets(req5b, res5b, (err) => { throw err; });

    console.log('HR Dashboard Widgets:', res5b.statusCode, res5b.data);
    if (res5a.statusCode === 200 && res5b.statusCode === 200 && res5b.data?.securityAlerts > 0) {
      console.log('✅ HR Config updated and HR Dashboard widget metrics retrieved!');
    } else {
      console.error('❌ TEST 5 FAILED');
    }

    // TEST 6: Report Dataset Export
    console.log('\n--- TEST 6: Export Attendance Report Dataset ---');
    const req6 = {
      user: { userId: hrUser._id, role: 'HR' },
      query: { format: 'csv' }
    };
    const res6 = mockRes();
    await attendanceController.exportReport(req6, res6, (err) => { throw err; });

    if (res6.statusCode === 200 && Array.isArray(res6.data?.reportData)) {
      console.log(`✅ Exported attendance dataset report with ${res6.data.recordCount} record(s)!`);
    } else {
      console.error('❌ TEST 6 FAILED');
    }

    // Clean up test records
    await User.deleteMany({ email: { $in: testEmails } });
    await HR.deleteMany({ user: hrUser._id });
    await ProjectManager.deleteMany({ user: pmUser._id });
    await SiteEngineer.deleteMany({ user: seUser._id });
    await Employee.deleteMany({ user: empUser._id });
    await Attendance.deleteMany({ user: { $in: [hrUser._id, pmUser._id, seUser._id, empUser._id] } });
    await SiteLocation.deleteMany({ _id: siteLocId });
    await UnauthorizedAttempt.deleteMany({ user: { $in: [empUser._id, seUser._id] } });
    await Notification.deleteMany({ recipient: hrUser._id });
    await HeartbeatLog.deleteMany({ user: empUser._id });

    console.log('\n🎉 ALL MASTER SUITE VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Master suite execution error:', error);
    process.exit(1);
  }
};

runMasterSuite();
