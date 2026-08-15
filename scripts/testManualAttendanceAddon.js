const mongoose = require('mongoose');
const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const RoleMaster = require('../models/RoleMaster');
const attendanceController = require('../controllers/attendance.controller');
const { getActiveSession } = require('../utils/attendanceGuard');

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

function getPayload(res) {
  if (!res || !res.body) return null;
  return res.body.data || res.body.attendance || res.body;
}

async function runTests() {
  console.log('================================================================================');
  console.log('🚀 HRM ATTENDANCE MODULE: MANUAL CLOCK-IN/OUT ADD-ON TEST SUITE');
  console.log('================================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nirman_architects_db';
  console.log(`🔌 Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);
  console.log('✅ MongoDB Connected!\n');

  try {
    // Setup test users
    let testRole = await RoleMaster.findOne({ roleCode: 'SENIOR_ARCHITECT' });
    if (!testRole) {
      testRole = await RoleMaster.create({ roleName: 'Senior Architect', roleCode: 'SENIOR_ARCHITECT' });
    }

    const uniqueTimestamp = Date.now();
    const testUser = await User.create({
      name: `Test Employee ${uniqueTimestamp}`,
      email: `test_emp_${uniqueTimestamp}@nirman.com`,
      password: 'password123',
      roleId: testRole._id,
      department: 'Architecture',
      designation: 'Architect'
    });

    console.log(`👤 Created Test User: ${testUser.email} (ID: ${testUser._id})\n`);

    // Clean up any existing active attendance for testUser
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 1: Scenario A — Auto-In, Auto-Out (Normal Agent Flow)
    // ------------------------------------------------------------------------
    console.log('--- 1. Testing Scenario A (Auto-In, Auto-Out) ---');
    {
      const reqIn = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { deviceId: 'AGENT_DEV_001', clientTime: new Date().toISOString() }
      };
      const resIn = mockResponse();
      await attendanceController.clockIn(reqIn, resIn, err => { throw err; });

      assert.strictEqual(resIn.statusCode, 201, 'Scenario A Clock-In failed');
      const attIn = getPayload(resIn);
      assert.strictEqual(attIn.clockInSource, 'AGENT_AUTO', 'clockInSource should be AGENT_AUTO');
      assert.strictEqual(attIn.clockOutTime, null, 'clockOutTime should be null initially');

      // Verify active session count for user
      const activeSessions = await Attendance.find({ userId: testUser._id, clockOutTime: null });
      assert.strictEqual(activeSessions.length, 1, 'Exactly 1 active session must exist');

      // Clock Out via Agent
      const reqOut = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { deviceId: 'AGENT_DEV_001', reason: 'End of Shift' }
      };
      const resOut = mockResponse();
      await attendanceController.clockOut(reqOut, resOut, err => { throw err; });

      assert.strictEqual(resOut.statusCode, 200, 'Scenario A Clock-Out failed');
      const attOut = getPayload(resOut);
      assert.strictEqual(attOut.clockOutSource, 'AGENT_AUTO', 'clockOutSource should be AGENT_AUTO');
      assert.notStrictEqual(attOut.clockOutTime, null, 'clockOutTime should be recorded');

      // Verify total records for this session
      const totalRecords = await Attendance.find({ userId: testUser._id });
      assert.strictEqual(totalRecords.length, 1, 'Scenario A should result in EXACTLY 1 database document');
      console.log('  ✅ PASSED: Scenario A created 1 row with clockInSource=AGENT_AUTO and clockOutSource=AGENT_AUTO\n');
    }

    // Clean up
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 2: Scenario B — Auto-In, Manual-Out
    // ------------------------------------------------------------------------
    console.log('--- 2. Testing Scenario B (Auto-In, Manual-Out) ---');
    {
      // Agent clocks in
      const reqIn = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { deviceId: 'AGENT_DEV_002' }
      };
      const resIn = mockResponse();
      await attendanceController.clockIn(reqIn, resIn, err => { throw err; });
      assert.strictEqual(resIn.statusCode, 201, 'Scenario B Clock-In failed');
      const initialRecord = getPayload(resIn);
      const initialId = initialRecord._id;

      // Employee manually clocks out from Web/Mobile
      const reqManualOut = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { reason: 'Leaving early for field visit' }
      };
      const resManualOut = mockResponse();
      await attendanceController.manualClockOut(reqManualOut, resManualOut, err => { throw err; });

      assert.strictEqual(resManualOut.statusCode, 200, 'Manual Clock-Out failed');
      const attOut = getPayload(resManualOut);
      assert.strictEqual(attOut._id.toString(), initialId.toString(), 'Must update THE SAME existing row');
      assert.strictEqual(attOut.clockInSource, 'AGENT_AUTO');
      assert.strictEqual(attOut.clockOutSource, 'MANUAL');

      const totalRecords = await Attendance.find({ userId: testUser._id });
      assert.strictEqual(totalRecords.length, 1, 'Scenario B must result in EXACTLY 1 database document');
      console.log('  ✅ PASSED: Scenario B updated SAME row with clockInSource=AGENT_AUTO and clockOutSource=MANUAL\n');
    }

    // Clean up
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 3: Scenario C — Manual-In, Auto-Out (Agent Adoption)
    // ------------------------------------------------------------------------
    console.log('--- 3. Testing Scenario C (Manual-In, Auto-Out / Agent Adoption) ---');
    {
      // Employee manually clocks in
      const reqManualIn = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: {}
      };
      const resManualIn = mockResponse();
      await attendanceController.manualClockIn(reqManualIn, resManualIn, err => { throw err; });

      assert.strictEqual(resManualIn.statusCode, 201, 'Manual Clock-In failed');
      const manualRecord = getPayload(resManualIn);
      assert.strictEqual(manualRecord.clockInSource, 'MANUAL');
      assert.strictEqual(manualRecord.deviceId, null, 'Manual clock in initially has no deviceId');

      // Later Agent starts and sends clock_in event for same user
      const reqAgentIn = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { deviceId: 'LATER_STARTED_AGENT_123' }
      };
      const resAgentIn = mockResponse();
      await attendanceController.clockIn(reqAgentIn, resAgentIn, err => { throw err; });

      assert.strictEqual(resAgentIn.statusCode, 200, 'Agent Adoption returned wrong status code (expected 200 for adoption)');
      const adoptedRecord = getPayload(resAgentIn);
      assert.strictEqual(adoptedRecord._id.toString(), manualRecord._id.toString(), 'Agent MUST adopt the existing manual row');
      assert.strictEqual(adoptedRecord.deviceId, 'LATER_STARTED_AGENT_123', 'Agent deviceId must be attached to manual row');

      // Agent later clocks out
      const reqAgentOut = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { deviceId: 'LATER_STARTED_AGENT_123', reason: 'PC Shutdown' }
      };
      const resAgentOut = mockResponse();
      await attendanceController.clockOut(reqAgentOut, resAgentOut, err => { throw err; });

      assert.strictEqual(resAgentOut.statusCode, 200);
      const finalRecord = getPayload(resAgentOut);
      assert.strictEqual(finalRecord.clockInSource, 'MANUAL');
      assert.strictEqual(finalRecord.clockOutSource, 'AGENT_AUTO');

      const totalRecords = await Attendance.find({ userId: testUser._id });
      assert.strictEqual(totalRecords.length, 1, 'Scenario C must result in EXACTLY 1 database document');
      console.log('  ✅ PASSED: Scenario C created 1 row, Agent ADOPTED existing manual row and attached deviceId\n');
    }

    // Clean up
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 4: Scenario D — Manual-In, Manual-Out
    // ------------------------------------------------------------------------
    console.log('--- 4. Testing Scenario D (Manual-In, Manual-Out) ---');
    {
      const reqManualIn = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: {}
      };
      const resManualIn = mockResponse();
      await attendanceController.manualClockIn(reqManualIn, resManualIn, err => { throw err; });
      assert.strictEqual(resManualIn.statusCode, 201);

      const reqManualOut = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: { reason: 'End of day' }
      };
      const resManualOut = mockResponse();
      await attendanceController.manualClockOut(reqManualOut, resManualOut, err => { throw err; });
      assert.strictEqual(resManualOut.statusCode, 200);

      const finalRecord = getPayload(resManualOut);
      assert.strictEqual(finalRecord.clockInSource, 'MANUAL');
      assert.strictEqual(finalRecord.clockOutSource, 'MANUAL');

      const totalRecords = await Attendance.find({ userId: testUser._id });
      assert.strictEqual(totalRecords.length, 1, 'Scenario D must result in EXACTLY 1 database document');
      console.log('  ✅ PASSED: Scenario D created 1 row with clockInSource=MANUAL and clockOutSource=MANUAL\n');
    }

    // Clean up
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 5: Conflict Rejection (Attempt Manual Clock-In when already active)
    // ------------------------------------------------------------------------
    console.log('--- 5. Testing Conflict Rejection (Manual Clock-In when already active) ---');
    {
      // Clock in manually first
      const reqIn1 = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: {}
      };
      const resIn1 = mockResponse();
      await attendanceController.manualClockIn(reqIn1, resIn1, err => { throw err; });
      assert.strictEqual(resIn1.statusCode, 201);

      // Attempt second manual clock-in while first is still active
      const reqIn2 = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: {}
      };
      const resIn2 = mockResponse();
      await attendanceController.manualClockIn(reqIn2, resIn2, err => { throw err; });

      assert.strictEqual(resIn2.statusCode, 409, 'Duplicate manual clock-in must return HTTP 409 Conflict');
      assert.strictEqual(resIn2.body.success, false);
      assert.match(resIn2.body.message, /Already clocked in/i);

      const totalRecords = await Attendance.find({ userId: testUser._id });
      assert.strictEqual(totalRecords.length, 1, 'Conflict rejection MUST NOT create a second document');
      console.log('  ✅ PASSED: Duplicate manual clock-in correctly rejected with 409 Conflict\n');
    }

    // Clean up
    await Attendance.deleteMany({ userId: testUser._id });

    // ------------------------------------------------------------------------
    // TEST 6: Manual Clock-Out when NO active session exists
    // ------------------------------------------------------------------------
    console.log('--- 6. Testing Manual Clock-Out when NO active session exists ---');
    {
      const reqOut = {
        user: { id: testUser._id.toString(), userId: testUser._id.toString() },
        body: {}
      };
      const resOut = mockResponse();
      await attendanceController.manualClockOut(reqOut, resOut, err => { throw err; });

      assert.strictEqual(resOut.statusCode, 400, 'Manual clock-out without active session must return HTTP 400');
      assert.strictEqual(resOut.body.success, false);
      assert.match(resOut.body.message, /No active clock-in session/i);
      console.log('  ✅ PASSED: Manual clock-out with no active session correctly rejected with 400 Bad Request\n');
    }

    // ------------------------------------------------------------------------
    // TEST 7: GET /api/attendance/status Endpoint Test
    // ------------------------------------------------------------------------
    console.log('--- 7. Testing GET /api/attendance/status ---');
    {
      // Status when NOT clocked in
      const reqStatus1 = { user: { id: testUser._id.toString(), userId: testUser._id.toString() } };
      const resStatus1 = mockResponse();
      await attendanceController.getStatus(reqStatus1, resStatus1, err => { throw err; });
      assert.strictEqual(resStatus1.statusCode, 200);
      const payload1 = getPayload(resStatus1);
      assert.strictEqual(payload1.isClockedIn, false);
      assert.strictEqual(payload1.activeSession, null);

      // Clock in manually
      const reqIn = { user: { id: testUser._id.toString(), userId: testUser._id.toString() }, body: {} };
      const resIn = mockResponse();
      await attendanceController.manualClockIn(reqIn, resIn, err => { throw err; });

      // Status when clocked in
      const resStatus2 = mockResponse();
      await attendanceController.getStatus(reqStatus1, resStatus2, err => { throw err; });
      assert.strictEqual(resStatus2.statusCode, 200);
      const payload2 = getPayload(resStatus2);
      assert.strictEqual(payload2.isClockedIn, true);
      assert.strictEqual(payload2.clockInSource, 'MANUAL');
      assert.notStrictEqual(payload2.activeSession, null);
      console.log('  ✅ PASSED: GET /api/attendance/status correctly returns real-time isClockedIn and activeSession\n');
    }

    // Clean up test user
    await Attendance.deleteMany({ userId: testUser._id });
    await User.findByIdAndDelete(testUser._id);

    console.log('================================================================================');
    console.log('🎉 ALL HRM ATTENDANCE MANUAL CLOCK-IN/OUT TESTS PASSED PERFECTLY!');
    console.log('================================================================================');
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
