const Project = require('../models/Project');
const Task = require('../models/Task');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const User = require('../models/User');
const Department = require('../models/Department');
const Attendance = require('../models/Attendance');
const RoleMaster = require('../models/RoleMaster');
const ProjectAnalyticsSnapshot = require('../models/ProjectAnalyticsSnapshot');
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
 * Helper to calculate employee-wise analytics for a project
 */
async function computeEmployeeWiseAnalytics(projectId) {
  const project = await Project.findById(projectId);
  if (!project) return [];

  const tasks = await Task.find({ projectId, isActive: true }).populate('assignedEmployee', 'name email designation department');

  // Collect all relevant user IDs (assigned employees + teamAssignments)
  const userMap = {};
  if (Array.isArray(project.teamAssignments)) {
    project.teamAssignments.forEach(t => {
      if (t.userId) {
        userMap[t.userId.toString()] = { userId: t.userId.toString(), projectRole: t.projectRole };
      }
    });
  }

  for (const t of tasks) {
    if (t.assignedEmployee) {
      const uId = t.assignedEmployee._id.toString();
      if (!userMap[uId]) {
        userMap[uId] = { userId: uId, projectRole: t.assignedEmployee.designation || 'Staff' };
      }
    }
  }

  const result = [];

  for (const uId of Object.keys(userMap)) {
    const userDoc = await User.findById(uId).select('name email designation department');
    if (!userDoc) continue;

    const userTasks = tasks.filter(t => t.assignedEmployee && t.assignedEmployee._id.toString() === uId);
    const assignedTasks = userTasks.length;
    const completedTasks = userTasks.filter(t => t.status === 'Completed');
    const delayedTasks = userTasks.filter(t => t.isDelayed);

    // Compute average completion minutes
    let totalWorkingMinutes = 0;
    completedTasks.forEach(t => {
      totalWorkingMinutes += (t.totalWorkingTimeMinutes || 0);
    });
    const avgCompletionMinutes = completedTasks.length > 0 ? Math.round(totalWorkingMinutes / completedTasks.length) : 0;

    // Compute average productivity score (EXCLUDING null values!)
    const productivityScores = completedTasks
      .map(t => t.productivityScore)
      .filter(score => score !== null && score !== undefined);

    let avgProductivityScore = 0;
    if (productivityScores.length > 0) {
      const sum = productivityScores.reduce((acc, val) => acc + val, 0);
      avgProductivityScore = Math.round(sum / productivityScores.length);
    }

    // Cross-reference HRM Attendance for this employee
    const attendanceRecords = await Attendance.find({ userId: uId });
    const totalPresentDays = attendanceRecords.filter(a => a.status === 'PRESENT' || a.clockInTime).length;
    const officeDays = attendanceRecords.filter(a => a.mode === 'OFFICE_AUTO').length;
    const siteDays = attendanceRecords.filter(a => a.mode === 'SITE_MOBILE').length;

    result.push({
      userId: userDoc._id,
      employeeName: userDoc.name,
      email: userDoc.email,
      designation: userDoc.designation,
      projectRole: userMap[uId].projectRole,
      assignedTasks,
      completedTasksCount: completedTasks.length,
      delayedTasksCount: delayedTasks.length,
      avgCompletionMinutes,
      avgProductivityScore,
      totalWorkingTimeMinutes: totalWorkingMinutes,
      attendanceSummary: {
        totalPresentDays,
        officeDays,
        siteDays
      }
    });
  }

  return result;
}

/**
 * GET /api/projects/:id/dashboard
 * Aggregated Project Dashboard metrics
 */
exports.getProjectDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).populate('createdBy', 'name email');

    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const tasks = await Task.find({ projectId: id, isActive: true });
    const pendingTasksCount = tasks.filter(t => t.status !== 'Completed').length;
    const overdueTaskCount = tasks.filter(t => t.isDelayed && t.status !== 'Completed').length;
    const completedTasksCount = tasks.filter(t => t.status === 'Completed').length;

    const drawings = await Drawing.find({ projectId: id, isActive: true });
    const approvedDrawingsCount = drawings.filter(d => d.status === 'APPROVED').length;
    const pendingReviewDrawingsCount = drawings.filter(d => ['DESIGNER_UPLOADED', 'PM_APPROVED'].includes(d.status)).length;

    const employeePerformanceSummary = await computeEmployeeWiseAnalytics(id);

    const drawingStatusSummary = {
      totalDrawings: drawings.length,
      approvedDrawingsCount,
      pendingReviewDrawingsCount,
      pendingClientApprovalCount: drawings.filter(d => d.status === 'PENDING_CLIENT_APPROVAL').length,
      changesRequestedCount: drawings.filter(d => ['CHANGES_REQUESTED', 'PM_REJECTED', 'ADMIN_REJECTED'].includes(d.status)).length,
      approvalRate: drawings.length > 0 ? Math.round((approvedDrawingsCount / drawings.length) * 100) : 0
    };

    const isDelayed = Boolean(project.isDelayed || (project.estimatedCompletion && new Date(project.estimatedCompletion) < new Date() && project.status !== 'Completed'));

    const timelineData = {
      startDate: project.startDate || project.createdAt,
      estimatedCompletion: project.estimatedCompletion || null,
      actualCompletion: project.actualCompletion || null,
      milestonesCount: project.milestones ? project.milestones.length : 0,
      completedMilestonesCount: project.milestones ? project.milestones.filter(m => m.isCompleted).length : 0,
      isDelayed
    };

    return sendSuccess(res, 200, 'Project dashboard metrics retrieved successfully.', {
      projectId: project._id,
      projectName: project.projectName || project.name,
      progressPercentage: project.progressPercentage || 0,
      completionPercent: project.progressPercentage || 0,
      isDelayed,
      overdueTaskCount,
      pendingTasksCount,
      completedTasksCount,
      totalTasksCount: tasks.length,
      employeePerformanceSummary,
      drawingStatusSummary,
      budget: project.budget || 0,
      timelineData
    });
  } catch (error) {
    console.error('Error fetching project dashboard:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project dashboard.');
  }
};

/**
 * GET /api/projects/:id/analysis/employee-wise
 * Employee-wise performance analysis per project (Restricted detailed view to PM/Admin)
 */
exports.getEmployeeWiseAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;
    const roleCode = await getUserRoleCode(req.user);

    const project = await Project.findById(id);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const employeeAnalytics = await computeEmployeeWiseAnalytics(id);

    // Permission check: Detailed colleague comparison restricted to PM, ADMIN, SUPER_ADMIN
    const isPM = project.createdBy && project.createdBy.toString() === userId.toString();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode);

    if (!isAdmin && !isPM) {
      // Return only caller's own employee breakdown if regular employee
      const ownBreakdown = employeeAnalytics.filter(e => e.userId.toString() === userId.toString());
      return sendSuccess(res, 200, 'Personal project performance analysis retrieved.', {
        projectId: id,
        employeeAnalytics: ownBreakdown,
        isRestrictedView: true
      });
    }

    return sendSuccess(res, 200, 'Employee-wise performance analysis retrieved successfully.', {
      projectId: id,
      employeeAnalytics,
      totalEmployees: employeeAnalytics.length
    });
  } catch (error) {
    console.error('Error fetching employee-wise analysis:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve employee-wise analysis.');
  }
};

/**
 * GET /api/projects/:id/analysis/employee-wise/:userId
 * Single employee project deep-dive
 */
exports.getSingleEmployeeAnalysis = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const employeeAnalytics = await computeEmployeeWiseAnalytics(id);
    const targetBreakdown = employeeAnalytics.find(e => e.userId.toString() === userId.toString());

    if (!targetBreakdown) {
      return sendError(res, 404, 'Employee performance record not found for this project.');
    }

    const tasks = await Task.find({ projectId: id, assignedEmployee: userId, isActive: true })
      .populate('dependsOn', 'taskName status')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Single employee project deep-dive retrieved successfully.', {
      projectId: id,
      employeeSummary: targetBreakdown,
      tasks
    });
  } catch (error) {
    console.error('Error fetching single employee analysis:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve employee deep-dive.');
  }
};

/**
 * GET /api/projects/:id/analysis/task-wise
 * Task-wise analysis & reporting view
 */
exports.getTaskWiseAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedEmployee } = req.query;

    const filter = { projectId: id, isActive: true };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedEmployee) filter.assignedEmployee = assignedEmployee;

    const tasks = await Task.find(filter)
      .populate('assignedEmployee', 'name email designation department')
      .sort({ createdAt: -1 });

    const formattedTasks = tasks.map(t => {
      const tObj = t.toObject();
      tObj.actualHours = t.totalWorkingTimeMinutes ? (t.totalWorkingTimeMinutes / 60).toFixed(1) : 0;
      tObj.estimatedHours = t.estimatedTime ? (t.estimatedTime / 60).toFixed(1) : 0;
      tObj.employeeResponsible = t.assignedEmployee ? t.assignedEmployee.name : 'Unassigned';
      return tObj;
    });

    return sendSuccess(res, 200, 'Task-wise analysis retrieved successfully.', {
      projectId: id,
      tasks: formattedTasks,
      totalCount: formattedTasks.length
    });
  } catch (error) {
    console.error('Error fetching task-wise analysis:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve task-wise analysis.');
  }
};

/**
 * GET /api/projects/:id/analysis/drawing-wise
 * Drawing-wise progress analysis
 */
exports.getDrawingWiseProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const drawings = await Drawing.find({ projectId: id, isActive: true })
      .populate('categoryId', 'name')
      .populate('currentVersionId');

    const totalDrawings = drawings.length;
    const statusCounts = {
      DESIGNER_UPLOADED: 0,
      PM_APPROVED: 0,
      PM_REJECTED: 0,
      PENDING_CLIENT_APPROVAL: 0,
      APPROVED: 0,
      CHANGES_REQUESTED: 0
    };

    const categoryMap = {};

    drawings.forEach(d => {
      const st = d.status || 'DESIGNER_UPLOADED';
      if (statusCounts[st] !== undefined) statusCounts[st]++;

      const catName = d.categoryId ? d.categoryId.name : 'General';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { categoryName: catName, total: 0, approved: 0 };
      }
      categoryMap[catName].total++;
      if (st === 'APPROVED') categoryMap[catName].approved++;
    });

    const categoryBreakdown = Object.values(categoryMap).map(c => ({
      ...c,
      completionRate: c.total > 0 ? Math.round((c.approved / c.total) * 100) : 0
    }));

    return sendSuccess(res, 200, 'Drawing-wise progress analysis retrieved successfully.', {
      projectId: id,
      totalDrawings,
      statusCounts,
      categoryBreakdown,
      approvalRate: totalDrawings > 0 ? Math.round((statusCounts.APPROVED / totalDrawings) * 100) : 0
    });
  } catch (error) {
    console.error('Error fetching drawing-wise progress:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing-wise progress.');
  }
};

/**
 * GET /api/projects/:id/analysis/department-wise
 * Department-wise progress breakdown
 */
exports.getDepartmentWiseProgress = async (req, res) => {
  try {
    const { id } = req.params;

    const tasks = await Task.find({ projectId: id, isActive: true })
      .populate({
        path: 'assignedEmployee',
        populate: { path: 'department' }
      });

    const deptMap = {};

    for (const t of tasks) {
      let deptName = 'Unassigned Department';
      if (t.departmentId) {
        const dDoc = await Department.findById(t.departmentId);
        if (dDoc) deptName = dDoc.name;
      } else if (t.assignedEmployee && t.assignedEmployee.department) {
        deptName = typeof t.assignedEmployee.department === 'object' ? t.assignedEmployee.department.name : t.assignedEmployee.department;
      }

      if (!deptMap[deptName]) {
        deptMap[deptName] = { departmentName: deptName, totalTasks: 0, completedTasks: 0, delayedTasks: 0 };
      }

      deptMap[deptName].totalTasks++;
      if (t.status === 'Completed') deptMap[deptName].completedTasks++;
      if (t.isDelayed) deptMap[deptName].delayedTasks++;
    }

    const departmentProgress = Object.values(deptMap).map(d => ({
      ...d,
      completionRate: d.totalTasks > 0 ? Math.round((d.completedTasks / d.totalTasks) * 100) : 0
    }));

    return sendSuccess(res, 200, 'Department-wise progress breakdown retrieved successfully.', {
      projectId: id,
      departmentProgress,
      totalDepartments: departmentProgress.length
    });
  } catch (error) {
    console.error('Error fetching department-wise progress:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve department-wise progress.');
  }
};

/**
 * GET /api/analytics/company-wide-summary
 * Company-wide summary across all active projects (Admin Dashboard source)
 */
exports.getCompanyWideSummary = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only Admins can access company-wide summary.');
    }

    const projects = await Project.find({ isActive: true });
    const totalProjects = projects.length;

    const statusCounts = {
      New: 0,
      Planning: 0,
      'In Progress': 0,
      'On Hold': 0,
      Completed: 0
    };

    let totalProgress = 0;
    const delayedProjects = [];

    projects.forEach(p => {
      const st = p.status || 'New';
      if (statusCounts[st] !== undefined) statusCounts[st]++;
      totalProgress += (p.progressPercentage || 0);

      if (p.isDelayed && p.status !== 'Completed') {
        delayedProjects.push({
          projectId: p._id,
          projectName: p.projectName || p.name,
          progressPercentage: p.progressPercentage || 0,
          estimatedCompletion: p.estimatedCompletion
        });
      }
    });

    const averageProgress = totalProjects > 0 ? Math.round(totalProgress / totalProjects) : 0;

    return sendSuccess(res, 200, 'Company-wide summary retrieved successfully.', {
      totalProjects,
      statusCounts,
      averageProgress,
      delayedProjectsCount: delayedProjects.length,
      delayedProjects
    });
  } catch (error) {
    console.error('Error fetching company-wide summary:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve company-wide summary.');
  }
};

/**
 * POST /api/analytics/refresh-snapshot/:projectId
 * Refresh cached analytics snapshot for a project
 */
exports.refreshProjectSnapshot = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const tasks = await Task.find({ projectId, isActive: true });
    const drawings = await Drawing.find({ projectId, isActive: true });
    const employeeAnalytics = await computeEmployeeWiseAnalytics(projectId);

    const snapshotData = {
      projectId,
      progressPercentage: project.progressPercentage || 0,
      pendingTasksCount: tasks.filter(t => t.status !== 'Completed').length,
      delayedTasksCount: tasks.filter(t => t.isDelayed && t.status !== 'Completed').length,
      totalDrawings: drawings.length,
      approvedDrawingsCount: drawings.filter(d => d.status === 'APPROVED').length,
      employeeBreakdown: employeeAnalytics.map(e => ({
        userId: e.userId,
        assignedTasks: e.assignedTasks,
        completedTasks: e.completedTasksCount,
        avgCompletionMinutes: e.avgCompletionMinutes,
        avgProductivityScore: e.avgProductivityScore
      })),
      lastComputedAt: new Date()
    };

    const snapshot = await ProjectAnalyticsSnapshot.findOneAndUpdate(
      { projectId },
      snapshotData,
      { upsert: true, returnDocument: 'after' }
    );

    return sendSuccess(res, 200, 'Project analytics snapshot refreshed successfully.', { snapshot });
  } catch (error) {
    console.error('Error refreshing project snapshot:', error);
    return sendError(res, 500, error.message || 'Failed to refresh project analytics snapshot.');
  }
};

/**
 * GET /api/analytics/snapshot/:projectId
 * Retrieve cached analytics snapshot for a project
 */
exports.getCachedSnapshot = async (req, res) => {
  try {
    const { projectId } = req.params;

    const snapshot = await ProjectAnalyticsSnapshot.findOne({ projectId })
      .populate('employeeBreakdown.userId', 'name email designation');

    if (!snapshot) {
      return sendError(res, 404, 'Snapshot not found for this project.');
    }

    return sendSuccess(res, 200, 'Cached project analytics snapshot retrieved successfully.', { snapshot });
  } catch (error) {
    console.error('Error fetching cached snapshot:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve cached snapshot.');
  }
};
