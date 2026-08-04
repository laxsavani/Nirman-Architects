const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AttendanceConfig = require('../models/AttendanceConfig');
const AttendanceCorrectionRequest = require('../models/AttendanceCorrectionRequest');
const UnauthorizedAttempt = require('../models/UnauthorizedAttempt');
const HeartbeatLog = require('../models/HeartbeatLog');
const { sendSuccess, sendError } = require('../utils/response');
const notifyAdmins = require('../utils/notifyAdmins');

/**
 * Direct Clock-In Controller
 * POST /api/attendance/clock-in
 */
exports.clockIn = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.employeeId || req.body.userId;
    const { deviceId, clientTime, computerName, ip, macAddress } = req.body;

    if (!userId) {
      return sendError(res, 400, 'Employee/User ID is required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const cleanDeviceId = deviceId ? deviceId.trim() : null;

    // Auto-bind & approve device for authenticated user
    if (cleanDeviceId && (!user.deviceId || user.deviceId !== cleanDeviceId)) {
      user.deviceId = cleanDeviceId;
      user.deviceStatus = 'APPROVED';
      await user.save();
    }

    const serverNow = new Date();

    // Check if there is already an open clock-in session today
    let attendance = await Attendance.findOne({
      userId: user._id,
      clockOutTime: null
    }).sort({ createdAt: -1 });

    if (attendance) {
      attendance.lastHeartbeat = serverNow;
      if (cleanDeviceId) attendance.deviceId = cleanDeviceId;
      await attendance.save();
      return sendSuccess(res, 200, 'Clock-in session already active.', attendance);
    }

    // Create new Attendance document with authoritative server clockInTime
    attendance = new Attendance({
      userId: user._id,
      clockInTime: serverNow,
      clientClockIn: clientTime ? new Date(clientTime) : null,
      deviceId: cleanDeviceId || user.deviceId,
      isOfflineEntry: false,
      lastHeartbeat: serverNow,
      status: 'PRESENT'
    });

    await attendance.save();
    return sendSuccess(res, 201, 'Clock-in recorded successfully.', attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * Direct Clock-Out Controller
 * POST /api/attendance/clock-out
 */
exports.clockOut = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.employeeId || req.body.userId;
    const { deviceId, clientTime, reason } = req.body;

    if (!userId) {
      return sendError(res, 400, 'Employee/User ID is required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const cleanDeviceId = deviceId ? deviceId.trim() : null;

    if (cleanDeviceId && (!user.deviceId || user.deviceId !== cleanDeviceId)) {
      user.deviceId = cleanDeviceId;
      user.deviceStatus = 'APPROVED';
      await user.save();
    }

    const serverNow = new Date();

    let openAttendance = await Attendance.findOne({
      userId: user._id,
      clockOutTime: null
    }).sort({ createdAt: -1 });

    if (!openAttendance) {
      // If no open session found, create closed record with clockInTime = clockOutTime
      openAttendance = new Attendance({
        userId: user._id,
        clockInTime: serverNow,
        deviceId: cleanDeviceId || user.deviceId
      });
    }

    openAttendance.clockOutTime = serverNow;
    openAttendance.clientClockOut = clientTime ? new Date(clientTime) : null;
    openAttendance.lastHeartbeat = serverNow;
    if (reason) openAttendance.reason = reason;

    // Compute working hours
    if (openAttendance.clockInTime) {
      const diffMs = serverNow - new Date(openAttendance.clockInTime);
      openAttendance.workingHours = Math.max(0, +(diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    await openAttendance.save();

    // Trigger Admin Notification when Agent is closed/quit by employee
    const quitReason = reason || 'Agent Closed';
    notifyAdmins(
      'AGENT_CLOSED',
      `⚠️ ALERT: Employee ${user.name} (${user.email}) closed/quit the Desktop Agent app. Reason: "${quitReason}".`
    );

    return sendSuccess(res, 200, 'Clock-out recorded successfully.', openAttendance);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Today's Attendance Status
 * GET /api/attendance/today
 */
exports.getToday = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaySession = await Attendance.findOne({
      userId,
      clockInTime: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Today attendance record retrieved.', {
      clockedIn: !!todaySession,
      session: todaySession
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle unified Attendance Events (clock_in, clock_out, heartbeat)
 */
exports.handleEvent = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.employeeId || req.body.userId;
    const { deviceId, type, clientTime } = req.body;

    if (!userId || !type) {
      return sendError(res, 400, 'userId and type (clock_in, clock_out, heartbeat) are required.');
    }

    const eventType = type.toLowerCase();
    if (eventType === 'clock_in') return exports.clockIn(req, res, next);
    if (eventType === 'clock_out') return exports.clockOut(req, res, next);

    if (eventType === 'heartbeat') {
      const user = await User.findById(userId);
      if (!user) return sendError(res, 404, 'User not found.');

      const cleanDeviceId = deviceId ? deviceId.trim() : null;
      if (cleanDeviceId && (!user.deviceId || user.deviceId !== cleanDeviceId)) {
        user.deviceId = cleanDeviceId;
        user.deviceStatus = 'APPROVED';
        await user.save();
      }

      const serverNow = new Date();
      const openAttendance = await Attendance.findOne({
        userId: user._id,
        clockOutTime: null
      }).sort({ createdAt: -1 });

      if (openAttendance) {
        openAttendance.lastHeartbeat = serverNow;
        await openAttendance.save();
      }

      await HeartbeatLog.create({
        userId: user._id,
        receivedAt: serverNow,
        clientTime: clientTime ? new Date(clientTime) : null
      });

      return sendSuccess(res, 200, 'Heartbeat recorded.', { lastHeartbeat: serverNow });
    }

    return sendError(res, 400, 'Invalid event type.');
  } catch (error) {
    next(error);
  }
};

/**
 * Handle Offline Attendance Sync (from client local JSON queue)
 */
exports.handleSync = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.employeeId || req.body.userId;
    const { deviceId, type, localTime, clientTime, reason } = req.body;

    if (!userId || !type) {
      return sendError(res, 400, 'userId and type are required for sync.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const serverNow = new Date();
    const eventTime = localTime ? new Date(localTime) : (clientTime ? new Date(clientTime) : serverNow);

    const attendance = new Attendance({
      userId: user._id,
      clockInTime: eventTime,
      clockOutTime: type.toLowerCase() === 'clock_out' ? serverNow : null,
      clientClockIn: eventTime,
      clientClockOut: type.toLowerCase() === 'clock_out' ? eventTime : null,
      deviceId: deviceId || user.deviceId,
      isOfflineEntry: true,
      reason: reason || 'Offline Sync Entry',
      lastHeartbeat: serverNow
    });

    await attendance.save();
    return sendSuccess(res, 201, 'Offline attendance record synced into Attendance collection.', attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * Get own attendance history
 */
exports.getMyAttendance = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { month, year } = req.query;

    const query = { userId };
    if (month && year) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));
      query.clockInTime = { $gte: startDate, $lte: endDate };
    }

    const logs = await Attendance.find(query).sort({ clockInTime: -1 });
    return sendSuccess(res, 200, 'My attendance records retrieved.', logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all attendance records (HR / SuperAdmin)
 */
exports.getAllAttendance = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;
    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (month && year) {
      const daysInMonth = new Date(year, month, 0).getDate();
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));
      query.clockInTime = { $gte: startDate, $lte: endDate };
    }

    const logs = await Attendance.find(query).populate('userId', 'name email department designation').sort({ clockInTime: -1 });
    return sendSuccess(res, 200, 'Company attendance records retrieved.', logs);
  } catch (error) {
    next(error);
  }
};

/**
 * Attendance Correction Requests
 */
exports.requestCorrection = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { attendanceId, requestedClockIn, requestedClockOut, reason } = req.body;

    if (!attendanceId || !reason) {
      return sendError(res, 400, 'attendanceId and reason are required.');
    }

    const correction = new AttendanceCorrectionRequest({
      userId,
      attendanceId,
      requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : undefined,
      requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : undefined,
      reason: reason.trim(),
      status: 'Pending'
    });

    await correction.save();
    return sendSuccess(res, 201, 'Attendance correction request submitted.', correction);
  } catch (error) {
    next(error);
  }
};

exports.approveCorrection = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { requestId } = req.body;

    if (!requestId) {
      return sendError(res, 400, 'requestId is required.');
    }

    const request = await AttendanceCorrectionRequest.findById(requestId);
    if (!request) {
      return sendError(res, 404, 'Correction request not found.');
    }

    request.status = 'Approved';
    request.reviewedBy = adminUserId;
    request.reviewedAt = new Date();
    await request.save();

    // Update the linked Attendance document
    const attendance = await Attendance.findById(request.attendanceId);
    if (attendance) {
      if (request.requestedClockIn) attendance.clockInTime = request.requestedClockIn;
      if (request.requestedClockOut) attendance.clockOutTime = request.requestedClockOut;
      await attendance.save();
    }

    return sendSuccess(res, 200, 'Correction request approved.', request);
  } catch (error) {
    next(error);
  }
};

exports.rejectCorrection = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { requestId, reason } = req.body;

    if (!requestId) {
      return sendError(res, 400, 'requestId is required.');
    }

    const request = await AttendanceCorrectionRequest.findById(requestId);
    if (!request) {
      return sendError(res, 404, 'Correction request not found.');
    }

    request.status = 'Rejected';
    request.reviewedBy = adminUserId;
    request.reviewedAt = new Date();
    if (reason) request.reason += ` (Rejection reason: ${reason})`;
    await request.save();

    return sendSuccess(res, 200, 'Correction request rejected.', request);
  } catch (error) {
    next(error);
  }
};

/**
 * Config Management
 */
exports.getConfig = async (req, res, next) => {
  try {
    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = await AttendanceConfig.create({});
    }
    return sendSuccess(res, 200, 'Attendance configuration retrieved.', config);
  } catch (error) {
    next(error);
  }
};

exports.updateConfig = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { heartbeatIntervalSeconds, heartbeatTimeoutMinutes, shiftStartTime, shiftEndTime } = req.body;

    let config = await AttendanceConfig.findOne();
    if (!config) {
      config = new AttendanceConfig();
    }

    if (heartbeatIntervalSeconds !== undefined) config.heartbeatIntervalSeconds = Number(heartbeatIntervalSeconds);
    if (heartbeatTimeoutMinutes !== undefined) config.heartbeatTimeoutMinutes = Number(heartbeatTimeoutMinutes);
    if (shiftStartTime !== undefined) config.shiftStartTime = shiftStartTime;
    if (shiftEndTime !== undefined) config.shiftEndTime = shiftEndTime;
    config.updatedBy = adminUserId;

    await config.save();
    return sendSuccess(res, 200, 'Attendance config updated successfully.', config);
  } catch (error) {
    next(error);
  }
};
