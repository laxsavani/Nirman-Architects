const User = require('../models/User');
const LeaveBalance = require('../models/LeaveBalance');

/**
 * Automatically creates LeaveBalance records for all active employees when a new LeaveType is added.
 */
async function seedBalancesForNewLeaveType(leaveType, targetYear = new Date().getFullYear()) {
  try {
    const activeUsers = await User.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    });
    if (!activeUsers || activeUsers.length === 0) return;

    const quota = leaveType.defaultQuotaPerYear !== undefined 
      ? leaveType.defaultQuotaPerYear 
      : (leaveType.defaultQuota || 0);

    const bulkOps = activeUsers.map(user => ({
      updateOne: {
        filter: { userId: user._id, leaveTypeId: leaveType._id, year: targetYear },
        update: {
          $setOnInsert: {
            userId: user._id,
            leaveTypeId: leaveType._id,
            year: targetYear,
            allocatedDays: quota,
            usedDays: 0
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await LeaveBalance.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error('Error in seedBalancesForNewLeaveType:', error);
    throw error;
  }
}

module.exports = { seedBalancesForNewLeaveType };
