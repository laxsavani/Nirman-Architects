const LeaveType = require('../models/LeaveType');
const { seedBalancesForNewLeaveType } = require('../utils/dynamicLeaveBalanceSeeder');
const { sendSuccess, sendError } = require('../utils/response');

// Seed default system leave types if empty
const DEFAULT_LEAVE_TYPES = [
  { name: 'Casual Leave', code: 'CL', isPaid: true, defaultQuotaPerYear: 12, isActive: true },
  { name: 'Sick Leave', code: 'SL', isPaid: true, defaultQuotaPerYear: 8, isActive: true },
  { name: 'Unpaid Leave', code: 'UL', isPaid: false, defaultQuotaPerYear: 0, isActive: true }
];

async function seedDefaultLeaveTypes() {
  try {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      const doc = await LeaveType.findOneAndUpdate(
        { code: lt.code },
        { $setOnInsert: lt },
        { upsert: true, returnDocument: 'after' }
      );
      await seedBalancesForNewLeaveType(doc);
    }
  } catch (err) {
    console.error('Failed to seed default leave types:', err);
  }
}

/**
 * Super Admin Endpoint: Create a new dynamic Leave Type in Leave Master.
 */
exports.createLeaveType = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { name, code, isPaid, defaultQuotaPerYear, defaultQuota } = req.body;

    if (!name || !code) {
      return sendError(res, 400, 'name and code are required.');
    }

    const normalizedCode = code.trim().toUpperCase();
    const existingType = await LeaveType.findOne({ code: normalizedCode });
    if (existingType) {
      return sendError(res, 400, `Leave type with code '${normalizedCode}' already exists.`);
    }

    const quota = defaultQuotaPerYear !== undefined ? Number(defaultQuotaPerYear) : (defaultQuota !== undefined ? Number(defaultQuota) : 0);

    const newLeaveType = new LeaveType({
      name: name.trim(),
      code: normalizedCode,
      isPaid: isPaid !== undefined ? Boolean(isPaid) : true,
      defaultQuotaPerYear: quota,
      isActive: true,
      createdBy: adminUserId
    });
    await newLeaveType.save();

    // Dynamically auto-seed LeaveBalance rows for all active users
    await seedBalancesForNewLeaveType(newLeaveType);

    return sendSuccess(res, 201, `Leave type '${newLeaveType.name}' created successfully.`, newLeaveType);
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Endpoint: Update an existing Leave Type.
 */
exports.updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, isPaid, defaultQuotaPerYear, defaultQuota, isActive } = req.body;

    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      return sendError(res, 404, 'Leave type not found.');
    }

    if (name) leaveType.name = name.trim();
    if (isPaid !== undefined) leaveType.isPaid = Boolean(isPaid);
    if (defaultQuotaPerYear !== undefined) leaveType.defaultQuotaPerYear = Number(defaultQuotaPerYear);
    else if (defaultQuota !== undefined) leaveType.defaultQuotaPerYear = Number(defaultQuota);
    if (isActive !== undefined) leaveType.isActive = Boolean(isActive);

    await leaveType.save();
    return sendSuccess(res, 200, 'Leave type updated successfully.', leaveType);
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Endpoint: Deactivate a Leave Type (Soft Delete).
 */
exports.deactivateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leaveType = await LeaveType.findById(id);
    if (!leaveType) {
      return sendError(res, 404, 'Leave type not found.');
    }

    leaveType.isActive = false;
    await leaveType.save();

    return sendSuccess(res, 200, `Leave type '${leaveType.name}' deactivated successfully.`, leaveType);
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Endpoint: Get all Leave Types (Active and Inactive).
 */
exports.getAllLeaveTypes = async (req, res, next) => {
  try {
    await seedDefaultLeaveTypes();
    const leaveTypes = await LeaveType.find().sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'All leave types retrieved successfully.', { leaveTypes, data: leaveTypes });
  } catch (error) {
    next(error);
  }
};

/**
 * Active Leave Types Endpoint: Dropdown source for leave applications.
 */
exports.getActiveLeaveTypes = async (req, res, next) => {
  try {
    await seedDefaultLeaveTypes();
    const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Active leave types retrieved successfully.', { leaveTypes, data: leaveTypes });
  } catch (error) {
    next(error);
  }
};

exports.seedDefaultLeaveTypes = seedDefaultLeaveTypes;
