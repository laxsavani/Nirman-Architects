const User = require('../models/User');
const Attendance = require('../models/Attendance');
const HeartbeatLog = require('../models/HeartbeatLog');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Handle 30-Second Device Heartbeat Ping
 * POST /api/device/heartbeat
 */
exports.heartbeat = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.employeeId || req.body.userId;
    const { deviceId, clientTime } = req.body;

    if (!userId) {
      return sendError(res, 400, 'Employee/User ID is required for heartbeat.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const cleanDeviceId = deviceId ? deviceId.trim() : null;

    // Auto-bind device if user does not have deviceId set or matching
    if (cleanDeviceId && (!user.deviceId || user.deviceId !== cleanDeviceId)) {
      user.deviceId = cleanDeviceId;
      user.deviceStatus = 'APPROVED';
      await user.save();
    }

    const serverNow = new Date();

    // Update active open attendance session lastHeartbeat timestamp
    const openAttendance = await Attendance.findOne({
      userId: user._id,
      clockOutTime: null
    }).sort({ createdAt: -1 });

    if (openAttendance) {
      openAttendance.lastHeartbeat = serverNow;
      await openAttendance.save();
    }

    // Record heartbeat log entry
    await HeartbeatLog.create({
      userId: user._id,
      receivedAt: serverNow,
      clientTime: clientTime ? new Date(clientTime) : null
    });

    return sendSuccess(res, 200, 'Heartbeat received.', {
      lastSeen: serverNow,
      status: 'ONLINE',
      online: true
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register or update device ID for a user.
 */
exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, userId: bodyUserId } = req.body;
    const userId = (req.user && (req.user.userId || req.user.id)) || bodyUserId;

    if (!userId) {
      return sendError(res, 400, 'User ID is required.');
    }

    if (!deviceId) {
      return sendError(res, 400, 'Device ID is required.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const cleanDeviceId = deviceId.trim();

    // Set & approve device ID for logged-in user
    user.deviceId = cleanDeviceId;
    user.deviceStatus = 'APPROVED';
    await user.save();

    return sendSuccess(res, 200, 'Device registered and approved successfully.', {
      status: 'APPROVED',
      deviceId: user.deviceId
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Admin/HR Endpoint: Approve or reject a device change request.
 */
exports.approveDevice = async (req, res, next) => {
  try {
    const adminUserId = req.user ? (req.user.userId || req.user.id) : null;
    const { requestId, action } = req.body;
    if (!requestId || !action) {
      return sendError(res, 400, 'requestId and action (APPROVE or REJECT) are required.');
    }

    const upperAction = action.toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(upperAction)) {
      return sendError(res, 400, 'Action must be either APPROVE or REJECT.');
    }

    const request = await DeviceChangeRequest.findById(requestId);
    if (!request) {
      return sendError(res, 404, 'Device change request not found.');
    }

    if (request.status !== 'PENDING') {
      return sendError(res, 400, `Request has already been processed with status: ${request.status}`);
    }

    const targetUserId = request.userId || request.user;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return sendError(res, 404, 'Target user for device request not found.');
    }

    if (upperAction === 'APPROVE') {
      request.status = 'APPROVED';
      request.reviewedBy = adminUserId;
      request.reviewedAt = new Date();
      await request.save();

      targetUser.deviceId = request.newDeviceId;
      targetUser.deviceStatus = 'APPROVED';
      await targetUser.save();

      return sendSuccess(res, 200, 'Device change request approved successfully.', {
        requestId: request._id,
        user: targetUser.email,
        newDeviceId: targetUser.deviceId,
        status: 'APPROVED'
      });
    } else {
      request.status = 'REJECTED';
      request.reviewedBy = adminUserId;
      request.reviewedAt = new Date();
      await request.save();

      return sendSuccess(res, 200, 'Device change request rejected.', {
        requestId: request._id,
        user: targetUser.email,
        status: 'REJECTED'
      });
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve device status for a user.
 */
exports.getDeviceStatus = async (req, res, next) => {
  try {
    const targetUserId = req.query.userId || (req.user && (req.user.userId || req.user.id));
    if (!targetUserId) {
      return sendError(res, 400, 'userId is required.');
    }

    const user = await User.findById(targetUserId).select('email deviceId deviceStatus');
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const pendingRequests = await DeviceChangeRequest.find({
      $or: [{ userId: user._id }, { user: user._id }],
      status: 'PENDING'
    }).sort({ createdAt: -1 });

    const openSession = await Attendance.findOne({
      userId: user._id,
      clockOutTime: null
    }).sort({ createdAt: -1 });

    const isOnline = openSession ? (Date.now() - new Date(openSession.lastHeartbeat).getTime() <= 120000) : false;

    return sendSuccess(res, 200, 'Device status retrieved successfully.', {
      userId: user._id,
      email: user.email,
      deviceId: user.deviceId,
      deviceStatus: user.deviceStatus,
      online: isOnline,
      lastSeen: openSession ? openSession.lastHeartbeat : null,
      pendingRequests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin/HR Endpoint: Get all pending device change requests.
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const requests = await DeviceChangeRequest.find({ status: 'PENDING' })
      .populate('userId', 'name email deviceId deviceStatus')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Pending device requests retrieved successfully.', { requests });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin/HR Endpoint: Direct assignment of a device ID to a target employee.
 */
exports.assignDevice = async (req, res, next) => {
  try {
    const { targetUserId, deviceId } = req.body;
    if (!targetUserId || !deviceId) {
      return sendError(res, 400, 'targetUserId and deviceId are required.');
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    user.deviceId = deviceId.trim();
    user.deviceStatus = 'APPROVED';
    await user.save();

    return sendSuccess(res, 200, `Device ID ${deviceId} assigned to user ${user.email}.`, {
      userId: user._id,
      email: user.email,
      deviceId: user.deviceId,
      deviceStatus: user.deviceStatus
    });
  } catch (error) {
    next(error);
  }
};
