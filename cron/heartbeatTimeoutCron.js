const cron = require('node-cron');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const notifyAdmins = require('../utils/notifyAdmins');

/**
 * Heartbeat Timeout Auto Clock-Out Cron Job
 * Runs every minute to auto-close attendance records where lastHeartbeat is older than 120 seconds (2 minutes per Step 10 spec).
 */
function initHeartbeatTimeoutCron() {
  cron.schedule('* * * * *', async () => {
    try {
      const timeoutMs = 120 * 1000; // 120 seconds threshold
      const cutoffTime = new Date(Date.now() - timeoutMs);

      // Find open attendance sessions where lastHeartbeat is older than cutoffTime
      const openSessions = await Attendance.find({
        clockOutTime: null,
        lastHeartbeat: { $lt: cutoffTime }
      });

      for (const session of openSessions) {
        const logoutTime = session.lastHeartbeat || session.clockInTime;
        session.clockOutTime = logoutTime;
        session.autoClosed = true;
        session.status = 'AUTO_CLOSED';
        session.reason = 'Unexpected Shutdown / Power Failure';
        
        // Calculate working hours in hours
        if (session.clockInTime && logoutTime) {
          const diffMs = new Date(logoutTime) - new Date(session.clockInTime);
          session.workingHours = Math.max(0, +(diffMs / (1000 * 60 * 60)).toFixed(2));
        }

        await session.save();
        console.log(`[Cron] Auto-closed power-failure attendance session for user ${session.userId} at ${session.clockOutTime}. Reason: Unexpected Shutdown / Power Failure`);

        // Notify Admins about forced kill / unexpected shutdown / heartbeat timeout
        try {
          const emp = await User.findById(session.userId);
          const empInfo = emp ? `${emp.name} (${emp.email})` : `User ${session.userId}`;
          await notifyAdmins(
            'AGENT_TERMINATED',
            `🚨 ALERT: Employee ${empInfo} Desktop Agent was terminated or killed unexpectedly (Heartbeat Timeout).`
          );
        } catch (e) {
          console.warn('[Cron] Failed to send admin notification for heartbeat timeout:', e.message);
        }
      }
    } catch (err) {
      console.error('[Cron] Error in heartbeatTimeoutCron:', err);
    }
  });
}

module.exports = initHeartbeatTimeoutCron;
