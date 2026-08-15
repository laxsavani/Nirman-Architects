const Attendance = require('../models/Attendance');

/**
 * Returns the currently active attendance session for a user (where clockOutTime is null).
 * @param {string|mongoose.Types.ObjectId} userId 
 */
async function getActiveSession(userId) {
  if (!userId) return null;
  return await Attendance.findOne({
    userId,
    clockOutTime: null
  }).sort({ createdAt: -1 });
}

/**
 * Handles clock-in request for both AGENT_AUTO and MANUAL sources.
 * Guarantees EXACTLY ONE active session row per work session.
 * 
 * - If active row exists:
 *   - MANUAL: Throws 409 Conflict error (prevents duplicate active row creation).
 *   - AGENT_AUTO: Adopts the existing active row (attaches deviceId, updates lastHeartbeat).
 * - If no active row exists:
 *   - Creates exactly ONE new Attendance document with authoritative server time.
 * 
 * @param {string|mongoose.Types.ObjectId} userId 
 * @param {'AGENT_AUTO'|'MANUAL'} source 
 * @param {string|null} deviceId 
 * @param {object} extraData 
 * @returns {Promise<{ attendance: object, adopted: boolean }>}
 */
async function handleClockIn(userId, source = 'AGENT_AUTO', deviceId = null, extraData = {}) {
  const serverNow = new Date();
  const existing = await getActiveSession(userId);
  const cleanDeviceId = deviceId ? String(deviceId).trim() : null;

  if (existing) {
    if (source === 'MANUAL') {
      const err = new Error(`Already clocked in since ${existing.clockInTime.toISOString()}. Please clock out first.`);
      err.statusCode = 409;
      err.activeSession = existing;
      throw err;
    }

    if (source === 'AGENT_AUTO') {
      // Agent trying to clock in while active row exists -> ADOPT existing row instead of duplicating
      if (cleanDeviceId && (!existing.deviceId || existing.deviceId !== cleanDeviceId)) {
        existing.deviceId = cleanDeviceId;
      }
      existing.lastHeartbeat = serverNow;
      await existing.save();
      return { attendance: existing, adopted: true };
    }
  }

  // No active row exists - safe to insert exactly ONE new row
  const attendance = new Attendance({
    userId,
    clockInTime: serverNow,
    clientClockIn: extraData.clientTime ? new Date(extraData.clientTime) : null,
    clockInSource: source,
    clockOutSource: null,
    deviceId: cleanDeviceId,
    isOfflineEntry: extraData.isOfflineEntry || false,
    lastHeartbeat: serverNow,
    status: 'PRESENT'
  });

  await attendance.save();
  return { attendance, adopted: false };
}

/**
 * Handles clock-out request for both AGENT_AUTO and MANUAL sources.
 * Always UPDATES the active session row (never inserts a new document).
 * 
 * @param {string|mongoose.Types.ObjectId} userId 
 * @param {'AGENT_AUTO'|'MANUAL'|'HEARTBEAT_TIMEOUT'} source 
 * @param {object} extraData 
 * @returns {Promise<object>}
 */
async function handleClockOut(userId, source = 'AGENT_AUTO', extraData = {}) {
  const serverNow = new Date();
  let existing = await getActiveSession(userId);

  if (!existing) {
    if (source === 'MANUAL') {
      const err = new Error('No active clock-in session to close.');
      err.statusCode = 400;
      throw err;
    }

    // Fallback for agent clock-out when no active session was found
    const cleanDeviceId = extraData.deviceId ? String(extraData.deviceId).trim() : null;
    existing = new Attendance({
      userId,
      clockInTime: serverNow,
      clockInSource: source,
      deviceId: cleanDeviceId
    });
  }

  existing.clockOutTime = serverNow;
  existing.clockOutSource = source;
  if (extraData.clientTime) {
    existing.clientClockOut = new Date(extraData.clientTime);
  }
  existing.lastHeartbeat = serverNow;
  if (extraData.reason) {
    existing.reason = extraData.reason;
  }

  // Calculate working hours
  if (existing.clockInTime) {
    const diffMs = serverNow - new Date(existing.clockInTime);
    existing.workingHours = Math.max(0, +(diffMs / (1000 * 60 * 60)).toFixed(2));
  }

  await existing.save();
  return existing;
}

module.exports = {
  getActiveSession,
  handleClockIn,
  handleClockOut
};
