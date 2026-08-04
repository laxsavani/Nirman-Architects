const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalanceAdjustment = require('../models/LeaveBalanceAdjustment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');

const calculateTotalDays = (fromDate, toDate) => {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Apply for Leave
 */
exports.applyLeave = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id)) || req.body.userId;
    const { leaveTypeId, fromDate, toDate, reason } = req.body;

    if (!leaveTypeId || !fromDate || !toDate) {
      return sendError(res, 400, 'leaveTypeId, fromDate, and toDate are required.');
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendError(res, 400, 'Invalid date format.');
    }

    if (start > end) {
      return sendError(res, 400, 'fromDate cannot be after toDate.');
    }

    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType || !leaveType.isActive) {
      return sendError(res, 400, 'Invalid or inactive leave type.');
    }

    // Overlapping date check
    const overlappingRequest = await LeaveRequest.findOne({
      userId,
      status: { $in: ['PENDING', 'APPROVED'] },
      fromDate: { $lte: end },
      toDate: { $gte: start }
    });

    if (overlappingRequest) {
      return sendError(res, 400, 'You already have an active or pending leave request for the specified dates.');
    }

    const totalDays = calculateTotalDays(start, end);
    const reqYear = start.getFullYear();

    // Balance check for paid leaves
    if (leaveType.isPaid) {
      let balance = await LeaveBalance.findOne({
        userId,
        leaveTypeId: leaveType._id,
        year: reqYear
      });

      if (!balance) {
        balance = await LeaveBalance.create({
          userId,
          leaveTypeId: leaveType._id,
          year: reqYear,
          allocatedDays: leaveType.defaultQuotaPerYear || 0,
          usedDays: 0
        });
      }

      const remaining = balance.allocatedDays - balance.usedDays;
      if (remaining < totalDays) {
        return sendError(res, 400, `Insufficient leave balance for ${leaveType.name}. Remaining: ${remaining}, Requested: ${totalDays}`);
      }
    }

    const leaveRequest = new LeaveRequest({
      userId,
      leaveTypeId: leaveType._id,
      fromDate: start,
      toDate: end,
      totalDays,
      reason: reason ? reason.trim() : '',
      status: 'PENDING'
    });

    await leaveRequest.save();

    return sendSuccess(res, 201, 'Leave application submitted successfully.', leaveRequest);
  } catch (error) {
    next(error);
  }
};

/**
 * Get own leave history and current balances
 */
exports.getMyLeaves = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const year = Number(req.query.year) || new Date().getFullYear();

    const requests = await LeaveRequest.find({
      $or: [{ userId }, { user: userId }]
    }).populate('leaveTypeId').sort({ createdAt: -1 });

    const activeLeaveTypes = await LeaveType.find({ isActive: true });
    const balances = [];

    for (const lt of activeLeaveTypes) {
      let b = await LeaveBalance.findOne({
        $or: [{ userId }, { user: userId }],
        $or: [{ leaveTypeId: lt._id }, { leaveType: lt._id }],
        year
      });

      if (!b) {
        b = await LeaveBalance.create({
          userId,
          leaveTypeId: lt._id,
          year,
          allocatedDays: lt.defaultQuotaPerYear || 0,
          usedDays: 0
        });
      }

      balances.push({
        leaveTypeId: lt._id,
        leaveTypeName: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        remainingDays: Math.max(0, b.allocatedDays - b.usedDays)
      });
    }

    return sendSuccess(res, 200, 'My leave history and balances retrieved.', {
      year,
      balances,
      requests
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave balances by User ID (HR / SuperAdmin)
 */
exports.getUserBalances = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const year = Number(req.query.year) || new Date().getFullYear();

    const activeLeaveTypes = await LeaveType.find({ isActive: true });
    const balances = [];

    for (const lt of activeLeaveTypes) {
      let b = await LeaveBalance.findOne({
        $or: [{ userId }, { user: userId }],
        $or: [{ leaveTypeId: lt._id }, { leaveType: lt._id }],
        year
      });

      if (!b) {
        b = await LeaveBalance.create({
          userId,
          leaveTypeId: lt._id,
          year,
          allocatedDays: lt.defaultQuotaPerYear || 0,
          usedDays: 0
        });
      }

      balances.push({
        leaveTypeId: lt._id,
        leaveTypeName: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        remainingDays: Math.max(0, b.allocatedDays - b.usedDays)
      });
    }

    return sendSuccess(res, 200, 'User leave balances retrieved.', { userId, year, balances });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel own pending leave request
 */
exports.cancelLeave = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { leaveRequestId } = req.body;

    const request = await LeaveRequest.findById(leaveRequestId);
    if (!request) {
      return sendError(res, 404, 'Leave request not found.');
    }

    const reqUserId = (request.userId || request.user).toString();
    if (reqUserId !== userId.toString()) {
      return sendError(res, 403, 'Cannot cancel another user request.');
    }

    if (request.status !== 'PENDING') {
      return sendError(res, 400, `Cannot cancel request with status: ${request.status}`);
    }

    request.status = 'CANCELLED';
    await request.save();

    return sendSuccess(res, 200, 'Leave request cancelled.', request);
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending leave requests queue (Super Admin)
 */
exports.getPendingRequests = async (req, res, next) => {
  try {
    const requests = await LeaveRequest.find({ status: 'PENDING' })
      .populate('userId', 'name email department designation')
      .populate('leaveTypeId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Pending leave requests queue retrieved.', requests);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve Leave Request (Super Admin)
 */
exports.approveLeave = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { leaveRequestId } = req.body;

    const request = await LeaveRequest.findById(leaveRequestId).populate('leaveTypeId');
    if (!request) {
      return sendError(res, 404, 'Leave request not found.');
    }

    if (request.status !== 'PENDING') {
      return sendError(res, 400, `Request already processed with status: ${request.status}`);
    }

    const isPaid = request.leaveTypeId ? request.leaveTypeId.isPaid : true;

    // Snapshot isPaid status at approval time
    request.status = 'APPROVED';
    request.isPaidSnapshot = isPaid;
    request.approvedBy = adminUserId;
    request.approvedAt = new Date();
    await request.save();

    // Increment usedDays for paid leaves
    if (isPaid) {
      const year = request.fromDate.getFullYear();
      const targetUserId = request.userId._id || request.userId || request.user;
      const ltId = request.leaveTypeId._id || request.leaveTypeId;

      let balance = await LeaveBalance.findOne({
        userId: targetUserId,
        leaveTypeId: ltId,
        year
      });

      if (!balance) {
        balance = new LeaveBalance({
          userId: targetUserId,
          leaveTypeId: ltId,
          year,
          allocatedDays: request.leaveTypeId ? request.leaveTypeId.defaultQuotaPerYear || 0 : 0,
          usedDays: 0
        });
      }

      balance.usedDays += request.totalDays;
      await balance.save();
    }

    // Send notification
    const targetUserId = request.userId._id || request.userId || request.user;
    await Notification.create({
      userId: targetUserId,
      type: 'LEAVE_APPROVED',
      message: `Your leave request for ${request.totalDays} day(s) from ${new Date(request.fromDate).toLocaleDateString()} has been approved.`
    });

    return sendSuccess(res, 200, 'Leave request approved successfully.', { request, leaveRequest: request });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject Leave Request (Super Admin)
 */
exports.rejectLeave = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { leaveRequestId, rejectionReason } = req.body;

    const request = await LeaveRequest.findById(leaveRequestId);
    if (!request) {
      return sendError(res, 404, 'Leave request not found.');
    }

    if (request.status !== 'PENDING') {
      return sendError(res, 400, `Request already processed with status: ${request.status}`);
    }

    request.status = 'REJECTED';
    request.approvedBy = adminUserId;
    request.approvedAt = new Date();
    request.rejectionReason = rejectionReason ? rejectionReason.trim() : 'Rejected by admin';
    await request.save();

    const targetUserId = request.userId || request.user;
    await Notification.create({
      userId: targetUserId,
      type: 'LEAVE_REJECTED',
      message: `Your leave request from ${new Date(request.fromDate).toLocaleDateString()} was rejected. Reason: ${request.rejectionReason}`
    });

    return sendSuccess(res, 200, 'Leave request rejected.', request);
  } catch (error) {
    next(error);
  }
};

/**
 * Manual Balance Adjustment (HR / SuperAdmin)
 */
exports.adjustBalance = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { userId, targetUserId, leaveTypeId, newValue, reason } = req.body;

    const tUserId = targetUserId || userId;
    if (!tUserId || !leaveTypeId || newValue === undefined || !reason) {
      return sendError(res, 400, 'userId, leaveTypeId, newValue, and reason are required.');
    }

    const year = new Date().getFullYear();
    let balance = await LeaveBalance.findOne({
      $or: [{ userId: tUserId }, { user: tUserId }],
      $or: [{ leaveTypeId }, { leaveType: leaveTypeId }],
      year
    });

    const oldValue = balance ? balance.allocatedDays : 0;

    if (!balance) {
      balance = new LeaveBalance({
        userId: tUserId,
        leaveTypeId,
        year,
        allocatedDays: Number(newValue),
        usedDays: 0
      });
    } else {
      balance.allocatedDays = Number(newValue);
    }
    await balance.save();

    // Log adjustment audit
    await LeaveBalanceAdjustment.create({
      userId: tUserId,
      leaveTypeId,
      adjustedBy: adminUserId,
      oldValue,
      newValue: Number(newValue),
      reason: reason.trim()
    });

    return sendSuccess(res, 200, 'Leave balance adjusted successfully.', balance);
  } catch (error) {
    next(error);
  }
};

/**
 * Get company-wide leave requests (HR)
 */
exports.getCompanyLeaves = async (req, res, next) => {
  try {
    const { department, status } = req.query;
    const filter = {};
    if (status) filter.status = status.toUpperCase();

    const requests = await LeaveRequest.find(filter)
      .populate('userId', 'name email department designation')
      .populate('leaveTypeId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Company leave requests retrieved.', requests);
  } catch (error) {
    next(error);
  }
};
