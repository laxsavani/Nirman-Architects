const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AttendanceConfig = require('../models/AttendanceConfig');
const { getRoleModel } = require('./roles');

/**
 * Scans the database for active OFFICE_AUTO sessions whose last heartbeat is older than timeout config
 * and automatically registers a back-dated CLOCK_OUT event with autoClosed = true.
 */
const checkHeartbeats = async () => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[HEARTBEAT WORKER] ⚠️ Database not connected. Skipping heartbeat scan loop iteration.');
    return;
  }

  try {
    let config = await AttendanceConfig.findOne();
    const timeoutMinutes = config ? config.heartbeatTimeoutMinutes : 5;
    const thresholdTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const timedOutUsers = await User.find({
      isOnline: true,
      lastHeartbeat: { $lt: thresholdTime }
    }).populate('role');

    for (const user of timedOutUsers) {
      console.log(`[HEARTBEAT WORKER] ⚠️ User ${user.email} (Last Heartbeat: ${user.lastHeartbeat}) timed out (>${timeoutMinutes}m). Triggering auto clock-out.`);

      user.isOnline = false;
      await user.save();

      const clockOutTime = user.lastHeartbeat || new Date();

      const attendanceLog = new Attendance({
        user: user._id,
        deviceId: user.registeredDeviceId || 'SYSTEM_AUTO',
        mode: 'OFFICE_AUTO',
        type: 'CLOCK_OUT',
        time: clockOutTime,
        source: 'HEARTBEAT_TIMEOUT',
        syncStatus: 'Completed',
        autoClosed: true
      });
      await attendanceLog.save();

      const RoleModel = getRoleModel(user.role?.name);
      if (RoleModel) {
        await RoleModel.updateOne(
          { user: user._id },
          { clockOut: clockOutTime }
        );
      }
    }
  } catch (error) {
    console.error('[HEARTBEAT WORKER] ❌ Error in heartbeat scanner loop:', error.message || error);
  }
};

const startHeartbeatChecker = () => {
  console.log('⏰ Heartbeat Checker background worker daemon is active (running every 60s).');
  checkHeartbeats();
  setInterval(checkHeartbeats, 60 * 1000);
};

module.exports = startHeartbeatChecker;
