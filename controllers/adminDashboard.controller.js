const Project = require('../models/Project');
const Task = require('../models/Task');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const InternalNotification = require('../models/InternalNotification');
const RoleMaster = require('../models/RoleMaster');
const ProjectHealthConfig = require('../models/ProjectHealthConfig');
const CompanyDashboardSnapshot = require('../models/CompanyDashboardSnapshot');
const { calculateProjectHealth, calculateCompanyAverageHealth, getHealthConfig } = require('../utils/projectHealthCalculator');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to get user role code
 */
async function getUserRoleCode(user) {
  if (!user) return '';
  if (user.roleId && typeof user.roleId === 'object' && user.roleId.roleCode) {
    return user.roleId.roleCode;
  }
  if (user.roleId) {
    const role = await RoleMaster.findById(user.roleId);
    return role ? role.roleCode : '';
  }
  return '';
}

/**
 * Helper: Exclude Super Admin users from employee lists per HRM specs
 */
async function getSuperAdminUserIds() {
  const superAdminRole = await RoleMaster.findOne({ roleCode: 'SUPER_ADMIN' });
  if (!superAdminRole) return [];
  const superAdmins = await User.find({ roleId: superAdminRole._id }).select('_id');
  return superAdmins.map(u => u._id);
}

/**
 * GET /api/admin-dashboard
 * Master Aggregated Admin Dashboard Endpoint (Covering all 18 PRD Section 6 Tiles)
 */
exports.getAdminDashboard = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin or Super Admin privileges required.');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const superAdminIds = await getSuperAdminUserIds();

    // 1-4. Project Metrics
    const totalProjects = await Project.countDocuments({ isActive: true });
    const activeProjects = await Project.countDocuments({ isActive: true, status: { $nin: ['Completed', 'Archived'] } });
    const completedProjects = await Project.countDocuments({ isActive: true, status: 'Completed' });
    const delayedProjects = await Project.countDocuments({ isActive: true, isDelayed: true });

    // 5. Pending Approvals (Drawing Versions)
    const pendingApprovals = await DrawingVersion.countDocuments({
      status: { $in: ['DESIGNER_UPLOADED', 'PM_APPROVED', 'PENDING_CLIENT_APPROVAL'] }
    });

    // 6. Today's Attendance Split
    const todayAttendances = await Attendance.find({
      userId: { $nin: superAdminIds },
      $or: [
        { clockInTime: { $gte: todayStart, $lte: todayEnd } },
        { createdAt: { $gte: todayStart, $lte: todayEnd } }
      ]
    });
    const presentCount = todayAttendances.filter(a => a.status === 'PRESENT' || a.clockInTime).length;
    const absentCount = todayAttendances.filter(a => a.status === 'ABSENT').length;
    const leaveCount = todayAttendances.filter(a => a.status === 'LEAVE').length;

    // 7. Employee Productivity (Company Average excluding nulls)
    const completedTasksWithScore = await Task.find({
      isActive: true,
      status: 'Completed',
      productivityScore: { $ne: null }
    }).select('productivityScore');
    let avgProductivityScore = 80;
    if (completedTasksWithScore.length > 0) {
      const sum = completedTasksWithScore.reduce((acc, t) => acc + (t.productivityScore || 0), 0);
      avgProductivityScore = Math.round(sum / completedTasksWithScore.length);
    }

    // 8-10. Online, Site & Office Employee Splits (Excluding Super Admin)
    const activeClockedIn = await Attendance.find({
      userId: { $nin: superAdminIds },
      clockInTime: { $ne: null },
      clockOutTime: null
    }).populate('userId', 'name email designation department');

    const onlineEmployeesCount = activeClockedIn.length;
    const siteEmployeesCount = activeClockedIn.filter(a => a.mode === 'SITE_MOBILE').length;
    const officeEmployeesCount = activeClockedIn.filter(a => a.mode === 'OFFICE_AUTO' || !a.mode).length;

    // 11. Recent Activities Feed (Company-Wide)
    const recentActivities = await InternalNotification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'name email designation');

    // 12. Caller's Personal Unread Notifications
    const callerUserId = req.user._id || req.user.id;
    const myUnreadNotifications = await InternalNotification.find({ userId: callerUserId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(10);

    // 13. Upcoming Deadlines (Next 14 Days)
    const fourteenDaysAhead = new Date(Date.now() + 14 * 86400000);
    const upcomingTaskDeadlines = await Task.find({
      isActive: true,
      status: { $ne: 'Completed' },
      deadline: { $gte: new Date(), $lte: fourteenDaysAhead }
    }).populate('projectId', 'projectName name').populate('assignedEmployee', 'name').sort({ deadline: 1 }).limit(10);

    // 14. Company Average Project Progress %
    const allActiveProjects = await Project.find({ isActive: true });
    let avgProjectProgress = 0;
    if (allActiveProjects.length > 0) {
      const progressSum = allActiveProjects.reduce((acc, p) => acc + (p.progressPercentage || 0), 0);
      avgProjectProgress = Math.round(progressSum / allActiveProjects.length);
    }

    // 15. Revenue Dashboard (Honest Scoping: Budgeted Values)
    const budgetedTotal = allActiveProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
    const revenueSummary = {
      budgetedTotalValue: budgetedTotal,
      metricLabel: 'Budgeted Project Value',
      disclaimer: 'Reflects total estimated budget across active projects. Tracking actual collected revenue requires the future Billing/Invoicing module.'
    };

    // 16. Task Summary Breakdown
    const pendingTasks = await Task.countDocuments({ isActive: true, status: 'Pending' });
    const inProgressTasks = await Task.countDocuments({ isActive: true, status: 'In Progress' });
    const reviewTasks = await Task.countDocuments({ isActive: true, status: 'Review' });
    const finishedTasks = await Task.countDocuments({ isActive: true, status: 'Completed' });
    const overdueTasksCount = await Task.countDocuments({ isActive: true, status: { $ne: 'Completed' }, isDelayed: true });

    const taskSummary = {
      pending: pendingTasks,
      inProgress: inProgressTasks,
      review: reviewTasks,
      completed: finishedTasks,
      overdue: overdueTasksCount,
      total: pendingTasks + inProgressTasks + reviewTasks + finishedTasks
    };

    // 17. Drawing Status Breakdown
    const drawingVersions = await DrawingVersion.find();
    const drawingSummary = {
      totalVersions: drawingVersions.length,
      designerUploaded: drawingVersions.filter(v => v.status === 'DESIGNER_UPLOADED').length,
      pmApproved: drawingVersions.filter(v => v.status === 'PM_APPROVED').length,
      pmRejected: drawingVersions.filter(v => v.status === 'PM_REJECTED').length,
      pendingClientApproval: drawingVersions.filter(v => v.status === 'PENDING_CLIENT_APPROVAL').length,
      approvedByClient: drawingVersions.filter(v => v.status === 'APPROVED_BY_CLIENT').length,
      clientChangesRequested: drawingVersions.filter(v => v.status === 'CLIENT_CHANGES_REQUESTED').length,
      gfcReleased: drawingVersions.filter(v => v.status === 'GFC_RELEASED').length
    };

    // 18. Composite Project Health Score
    const companyHealth = await calculateCompanyAverageHealth();

    return sendSuccess(res, 200, 'Admin Dashboard metrics compiled successfully.', {
      dashboard: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
          delayed: delayedProjects,
          avgProgressPercentage: avgProjectProgress
        },
        pendingApprovalsCount: pendingApprovals,
        attendanceToday: {
          present: presentCount,
          absent: absentCount,
          leave: leaveCount
        },
        employeeProductivityAvg: avgProductivityScore,
        onlineEmployees: {
          totalOnline: onlineEmployeesCount,
          workingOnSite: siteEmployeesCount,
          workingFromOffice: officeEmployeesCount,
          activeList: activeClockedIn
        },
        recentActivities,
        myUnreadNotifications,
        upcomingDeadlines: upcomingTaskDeadlines,
        revenueSummary,
        taskSummary,
        drawingSummary,
        projectHealthSummary: companyHealth
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve Admin Dashboard.');
  }
};

/**
 * GET /api/admin-dashboard/online-employees
 * Real-time active clock-ins split by site vs office (excluding Super Admin)
 */
exports.getOnlineEmployees = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const superAdminIds = await getSuperAdminUserIds();
    const activeClockedIn = await Attendance.find({
      userId: { $nin: superAdminIds },
      clockInTime: { $ne: null },
      clockOutTime: null
    }).populate('userId', 'name email designation department phone');

    const siteEmployees = activeClockedIn.filter(a => a.mode === 'SITE_MOBILE');
    const officeEmployees = activeClockedIn.filter(a => a.mode === 'OFFICE_AUTO' || !a.mode);

    return sendSuccess(res, 200, 'Online employees status retrieved successfully.', {
      totalOnline: activeClockedIn.length,
      siteCount: siteEmployees.length,
      officeCount: officeEmployees.length,
      siteEmployees,
      officeEmployees
    });
  } catch (error) {
    console.error('Error fetching online employees:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve online employees.');
  }
};

/**
 * GET /api/admin-dashboard/recent-activities
 * Company-wide activity log
 */
exports.getRecentActivities = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const { limit = 20 } = req.query;
    const activities = await InternalNotification.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email designation');

    return sendSuccess(res, 200, 'Recent activities retrieved successfully.', { activities });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve recent activities.');
  }
};

/**
 * GET /api/admin-dashboard/upcoming-deadlines
 */
exports.getUpcomingDeadlines = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const { daysAhead = 14 } = req.query;
    const futureDate = new Date(Date.now() + Number(daysAhead) * 86400000);

    const tasks = await Task.find({
      isActive: true,
      status: { $ne: 'Completed' },
      deadline: { $gte: new Date(), $lte: futureDate }
    }).populate('projectId', 'projectName name').populate('assignedEmployee', 'name').sort({ deadline: 1 });

    return sendSuccess(res, 200, 'Upcoming deadlines retrieved successfully.', { tasks, count: tasks.length });
  } catch (error) {
    console.error('Error fetching upcoming deadlines:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve upcoming deadlines.');
  }
};

/**
 * GET /api/admin-dashboard/revenue-summary
 * Honest-scoped revenue summary (Budgeted project value)
 */
exports.getRevenueSummary = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const projects = await Project.find({ isActive: true }).select('projectName name budget status progressPercentage');
    const budgetedTotal = projects.reduce((acc, p) => acc + (p.budget || 0), 0);

    return sendSuccess(res, 200, 'Revenue summary retrieved successfully.', {
      metricLabel: 'Budgeted Project Value',
      budgetedTotalValue: budgetedTotal,
      projectCount: projects.length,
      projects,
      disclaimer: 'Reflects total estimated budget across active projects. Tracking actual collected revenue requires the future Billing/Invoicing module.'
    });
  } catch (error) {
    console.error('Error fetching revenue summary:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve revenue summary.');
  }
};

/**
 * GET /api/admin-dashboard/project-health/:projectId
 */
exports.getProjectHealthScore = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const { projectId } = req.params;
    const health = await calculateProjectHealth(projectId);
    return sendSuccess(res, 200, 'Project health score calculated successfully.', { health });
  } catch (error) {
    console.error('Error calculating project health score:', error);
    return sendError(res, 500, error.message || 'Failed to calculate project health score.');
  }
};

/**
 * GET /api/admin-dashboard/project-health/company-average
 */
exports.getCompanyAverageHealthScore = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const health = await calculateCompanyAverageHealth();
    return sendSuccess(res, 200, 'Company average health score calculated successfully.', { health });
  } catch (error) {
    console.error('Error calculating company average health score:', error);
    return sendError(res, 500, error.message || 'Failed to calculate company average health score.');
  }
};

/**
 * GET /api/project-health-config
 */
exports.getHealthConfig = async (req, res) => {
  try {
    const config = await getHealthConfig();
    return sendSuccess(res, 200, 'Project health configuration retrieved successfully.', { config });
  } catch (error) {
    console.error('Error fetching health config:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve health config.');
  }
};

/**
 * PUT /api/project-health-config
 * Super Admin only
 */
exports.updateHealthConfig = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (roleCode !== 'SUPER_ADMIN') {
      return sendError(res, 403, 'Access denied. Super Admin privileges required to modify health weights.');
    }

    const { timelineWeight, drawingVelocityWeight, productivityWeight, clientEngagementWeight } = req.body;
    const userId = req.user._id || req.user.id;

    const updateFields = { updatedBy: userId };
    if (timelineWeight !== undefined) updateFields.timelineWeight = Number(timelineWeight);
    if (drawingVelocityWeight !== undefined) updateFields.drawingVelocityWeight = Number(drawingVelocityWeight);
    if (productivityWeight !== undefined) updateFields.productivityWeight = Number(productivityWeight);
    if (clientEngagementWeight !== undefined) updateFields.clientEngagementWeight = Number(clientEngagementWeight);

    let config = await ProjectHealthConfig.findOne();
    if (!config) {
      config = await ProjectHealthConfig.create(updateFields);
    } else {
      config = await ProjectHealthConfig.findOneAndUpdate({}, updateFields, { new: true });
    }

    return sendSuccess(res, 200, 'Project health configuration updated successfully.', { config });
  } catch (error) {
    console.error('Error updating health config:', error);
    return sendError(res, 500, error.message || 'Failed to update health config.');
  }
};

/**
 * POST /api/admin-dashboard/refresh-snapshot
 */
exports.refreshSnapshot = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const totalProjects = await Project.countDocuments({ isActive: true });
    const activeProjects = await Project.countDocuments({ isActive: true, status: { $nin: ['Completed', 'Archived'] } });
    const completedProjects = await Project.countDocuments({ isActive: true, status: 'Completed' });
    const delayedProjects = await Project.countDocuments({ isActive: true, isDelayed: true });
    const pendingApprovals = await DrawingVersion.countDocuments({
      status: { $in: ['DESIGNER_UPLOADED', 'PM_APPROVED', 'PENDING_CLIENT_APPROVAL'] }
    });

    const companyHealth = await calculateCompanyAverageHealth();

    const snapshot = await CompanyDashboardSnapshot.create({
      totalProjects,
      activeProjects,
      completedProjects,
      delayedProjects,
      pendingApprovals,
      avgProjectProgress: companyHealth.averageScore,
      avgProjectHealthScore: companyHealth.averageScore,
      taskSummary: {},
      drawingSummary: {},
      lastComputedAt: new Date()
    });

    return sendSuccess(res, 200, 'Company dashboard snapshot refreshed successfully.', { snapshot });
  } catch (error) {
    console.error('Error refreshing dashboard snapshot:', error);
    return sendError(res, 500, error.message || 'Failed to refresh dashboard snapshot.');
  }
};
