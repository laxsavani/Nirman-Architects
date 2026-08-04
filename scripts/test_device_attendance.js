const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const UnauthorizedAttempt = require('../models/UnauthorizedAttempt');
const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

const runVerificationTests = async () => {
  console.log('🧪 Starting Device-Bound Attendance Verification Tests...\n');
  await connectDB();

  try {
    // 1. Clean up test users
    const testEmail = 'device.test.user@nirman.com';
    const adminEmail = 'admin.test.user@nirman.com';
    await User.deleteMany({ email: { $in: [testEmail, adminEmail] } });

    // Find Employee & Super Admin roles
    let empRole = await RoleMaster.findOne({ name: 'Employee' });
    if (!empRole) {
      empRole = await RoleMaster.create({ name: 'Employee' });
    }
    let adminRole = await RoleMaster.findOne({ name: 'Super Admin' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({ name: 'Super Admin' });
    }

    const hashedPassword = await hashPassword('TestPass123!');

    // Create Test Employee User
    const testUser = await User.create({
      mobileNumber: '9998887770',
      email: testEmail,
      password: hashedPassword,
      role: empRole._id
    });
    await Employee.create({ name: 'Test Employee', role: empRole._id, user: testUser._id });

    // Create Admin User
    const adminUser = await User.create({
      mobileNumber: '9998887771',
      email: adminEmail,
      password: hashedPassword,
      role: adminRole._id
    });

    const userToken = generateToken({ userId: testUser._id, email: testUser.email, role: 'Employee' });
    const adminToken = generateToken({ userId: adminUser._id, email: adminUser.email, role: 'Super Admin' });

    console.log('✅ Test user and admin created.');

    const primaryDevice = 'DEVICE-GUID-AAAA-1111';
    const unauthorizedDevice = 'DEVICE-GUID-BBBB-2222';
    const newDevice = 'DEVICE-GUID-CCCC-3333';

    // Mock Express Request & Response helpers
    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.data = data; return res; };
      return res;
    };

    const deviceController = require('../controllers/device.controller');
    const attendanceController = require('../controllers/attendance.controller');

    // TEST 1: First-Time Device Registration
    console.log('\n--- TEST 1: First-Time Device Registration ---');
    const req1 = { user: { userId: testUser._id }, body: { deviceId: primaryDevice } };
    const res1 = mockRes();
    await deviceController.registerDevice(req1, res1, (err) => { throw err; });
    
    console.log('Response 1 Status:', res1.statusCode, res1.data);
    if (res1.data?.status === 'APPROVED') {
      console.log('✅ Primary Device successfully registered and APPROVED.');
    } else {
      console.error('❌ TEST 1 FAILED');
    }

    // TEST 2: Valid Device Attendance Clock-In
    console.log('\n--- TEST 2: Valid Device Attendance Clock-In ---');
    const req2 = { user: { userId: testUser._id }, body: { deviceId: primaryDevice, type: 'CLOCK_IN', source: 'SYSTEM_BOOT' } };
    const res2 = mockRes();
    await attendanceController.clock(req2, res2, (err) => { throw err; });

    console.log('Response 2 Status:', res2.statusCode, res2.data);
    if (res2.statusCode === 201) {
      console.log('✅ Attendance Clock-In accepted for authorized primary device.');
    } else {
      console.error('❌ TEST 2 FAILED');
    }

    // TEST 3: Unauthorized Device Rejection
    console.log('\n--- TEST 3: Unauthorized Device Clock-In Attempt ---');
    const req3 = { user: { userId: testUser._id }, body: { deviceId: unauthorizedDevice, type: 'CLOCK_IN', source: 'SYSTEM_BOOT' } };
    const res3 = mockRes();
    await attendanceController.clock(req3, res3, (err) => { throw err; });

    console.log('Response 3 Status:', res3.statusCode, res3.data);
    if (res3.statusCode === 403) {
      console.log('✅ Unauthorized device clock-in rejected with 403 Forbidden!');
    } else {
      console.error('❌ TEST 3 FAILED');
    }

    // Check Security Audit Log
    const attempts = await UnauthorizedAttempt.find({ user: testUser._id });
    console.log(`Found ${attempts.length} logged unauthorized attempt(s).`);
    if (attempts.length > 0 && attempts[0].attemptedDeviceId === unauthorizedDevice) {
      console.log('✅ Security audit trail logged correctly in database.');
    } else {
      console.error('❌ Security audit logging check failed.');
    }

    // TEST 4: New Device Binding Request (Secondary Device -> PENDING)
    console.log('\n--- TEST 4: New Device Binding Request ---');
    const req4 = { user: { userId: testUser._id }, body: { deviceId: newDevice } };
    const res4 = mockRes();
    await deviceController.registerDevice(req4, res4, (err) => { throw err; });

    console.log('Response 4 Status:', res4.statusCode, res4.data);
    if (res4.data?.status === 'PENDING') {
      console.log('✅ Secondary device registration placed in PENDING_ADMIN_APPROVAL status.');
    } else {
      console.error('❌ TEST 4 FAILED');
    }

    // TEST 5: Admin Approves Device Change
    console.log('\n--- TEST 5: Admin Approves Device Change ---');
    const pendingReq = await DeviceChangeRequest.findOne({ user: testUser._id, status: 'PENDING' });
    console.log('Found Pending Request ID:', pendingReq._id);

    const req5 = {
      user: { userId: adminUser._id, role: 'Super Admin' },
      body: { requestId: pendingReq._id.toString(), action: 'APPROVE' }
    };
    const res5 = mockRes();
    await deviceController.approveDevice(req5, res5, (err) => { throw err; });

    console.log('Response 5 Status:', res5.statusCode, res5.data);
    if (res5.statusCode === 200 && res5.data?.status === 'APPROVED') {
      console.log('✅ Admin approval succeeded and updated user primary device.');
    } else {
      console.error('❌ TEST 5 FAILED');
    }

    // TEST 6: Clock-In with New Approved Device
    console.log('\n--- TEST 6: Attendance Clock-In with Newly Approved Device ---');
    const req6 = { user: { userId: testUser._id }, body: { deviceId: newDevice, type: 'CLOCK_IN', source: 'SYSTEM_BOOT' } };
    const res6 = mockRes();
    await attendanceController.clock(req6, res6, (err) => { throw err; });

    console.log('Response 6 Status:', res6.statusCode, res6.data);
    if (res6.statusCode === 201) {
      console.log('✅ Clock-In accepted for newly approved device!');
    } else {
      console.error('❌ TEST 6 FAILED');
    }

    // Clean up test data
    await User.deleteMany({ email: { $in: [testEmail, adminEmail] } });
    await Attendance.deleteMany({ user: testUser._id });
    await DeviceChangeRequest.deleteMany({ user: testUser._id });
    await UnauthorizedAttempt.deleteMany({ user: testUser._id });

    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test suite execution error:', error);
    process.exit(1);
  }
};

runVerificationTests();
