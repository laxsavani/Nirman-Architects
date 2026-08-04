const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');

/**
 * Round a number to 2 decimal places using standard rounding.
 */
function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Get number of days in a given month (month is 1-indexed, e.g. 1=Jan, 2=Feb).
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate salary for a user for a given month & year.
 */
async function calculateMonthlySalary(user, month, year) {
  const baseSalary = user.baseSalary || 0;
  const daysInMonth = getDaysInMonth(year, month);

  // Month start and end dates
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999));

  // 1. Fetch attendance records for this month
  const attendances = await Attendance.find({
    $or: [{ userId: user._id }, { user: user._id }],
    clockInTime: { $gte: startDate, $lte: endDate }
  });

  // Count distinct present days (based on YYYY-MM-DD string)
  const presentDaysSet = new Set();
  attendances.forEach(att => {
    if (att.clockInTime) {
      const dayStr = att.clockInTime.toISOString().split('T')[0];
      presentDaysSet.add(dayStr);
    }
  });
  const presentDays = presentDaysSet.size;

  // 2. Fetch approved leave requests overlapping with this month
  const approvedLeaves = await LeaveRequest.find({
    $or: [{ userId: user._id }, { user: user._id }],
    status: 'APPROVED',
    fromDate: { $lte: endDate },
    toDate: { $gte: startDate }
  }).populate('leaveTypeId');

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;

  for (const leave of approvedLeaves) {
    // Determine overlap with current month
    const leaveStart = new Date(Math.max(new Date(leave.fromDate).getTime(), startDate.getTime()));
    const leaveEnd = new Date(Math.min(new Date(leave.toDate).getTime(), endDate.getTime()));

    let current = new Date(leaveStart);
    let overlapCount = 0;
    while (current <= leaveEnd) {
      overlapCount++;
      current.setDate(current.getDate() + 1);
    }

    // Determine whether paid or unpaid (use isPaidSnapshot if set, else leaveTypeId.isPaid)
    const isPaid = leave.isPaidSnapshot !== undefined 
      ? leave.isPaidSnapshot 
      : (leave.leaveTypeId ? leave.leaveTypeId.isPaid : true);

    if (isPaid) {
      paidLeaveDays += overlapCount;
    } else {
      unpaidLeaveDays += overlapCount;
    }
  }

  // 3. Absent days calculation
  const absentDays = Math.max(0, daysInMonth - presentDays - paidLeaveDays - unpaidLeaveDays);

  // 4. Per day salary calculation
  const perDaySalary = round2(baseSalary / daysInMonth);

  // 5. Total deduction calculation (unpaid leaves + absent days)
  const totalDeduction = round2(perDaySalary * (unpaidLeaveDays + absentDays));

  // 6. Net salary calculation
  const netSalary = round2(baseSalary - totalDeduction);

  return {
    userId: user._id,
    month,
    year,
    baseSalary,
    daysInMonth,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    perDaySalary,
    totalDeduction,
    netSalary
  };
}

module.exports = {
  round2,
  getDaysInMonth,
  calculateMonthlySalary
};
