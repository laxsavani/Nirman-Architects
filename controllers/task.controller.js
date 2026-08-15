const Task = require('../models/Task');
const TaskStatusHistory = require('../models/TaskStatusHistory');
const TaskReassignmentLog = require('../models/TaskReassignmentLog');
const TaskComment = require('../models/TaskComment');
const Project = require('../models/Project');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const AppUsageDailySummary = require('../models/AppUsageDailySummary');
const InternalNotificationDispatcher = require('../utils/internalNotificationDispatcher');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to compute idleTimeMinutes & productivityScore from HRM's AppUsageDailySummary
 */
async function computeTaskHrmAppUsageMetrics(task) {
  if (!task.actualStartTime) {
    return { idleTimeMinutes: null, productivityScore: null };
  }

  const endTime = task.completionTime || new Date();
  const userId = task.assignedEmployee;

  // Check if employee worked on multiple concurrent tasks in the same date range
  const dateStart = new Date(task.actualStartTime);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(endTime);
  dateEnd.setHours(23, 59, 59, 999);

  const concurrentTasksCount = await Task.countDocuments({
    assignedEmployee: userId,
    _id: { $ne: task._id },
    status: { $in: ['In Progress', 'Review', 'Approved', 'Completed'] },
    actualStartTime: { $lte: endTime },
    $or: [
      { completionTime: { $gte: task.actualStartTime } },
      { completionTime: null }
    ]
  });

  // Edge case: If employee had multiple concurrent tasks, mark as unattributable (null)
  if (concurrentTasksCount > 0) {
    return { idleTimeMinutes: null, productivityScore: null, isAttributable: false };
  }

  // Generate date strings YYYY-MM-DD
  const dateStrings = [];
  let curr = new Date(dateStart);
  while (curr <= dateEnd) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dateStrings.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }

  const summaries = await AppUsageDailySummary.find({
    userId,
    date: { $in: dateStrings }
  });

  if (!summaries || summaries.length === 0) {
    return { idleTimeMinutes: null, productivityScore: null, isAttributable: true };
  }

  let totalIdleSeconds = 0;
  let totalTrackedSeconds = 0;

  for (const sum of summaries) {
    totalIdleSeconds += sum.idleSeconds || 0;
    totalTrackedSeconds += sum.totalTrackedSeconds || 0;
  }

  const idleTimeMinutes = Math.round(totalIdleSeconds / 60);
  let productivityScore = null;

  if (totalTrackedSeconds > 0) {
    const activeSeconds = Math.max(0, totalTrackedSeconds - totalIdleSeconds);
    productivityScore = Math.round((activeSeconds / totalTrackedSeconds) * 100);
  }

  return { idleTimeMinutes, productivityScore, isAttributable: true };
}

/**
 * Helper to check role authorization
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
 * POST /api/tasks/create
 */
exports.createTask = async (req, res) => {
  try {
    const {
      projectId,
      taskName,
      description,
      priority,
      departmentId,
      assignedEmployee,
      estimatedTime,
      startDate,
      endDate,
      deadline,
      dependsOn
    } = req.body;

    if (!projectId || !taskName || !taskName.trim() || !assignedEmployee) {
      return sendError(res, 400, 'projectId, taskName, and assignedEmployee are required.');
    }

    let parsedStartDate = startDate ? new Date(startDate) : null;
    let parsedEndDate = endDate ? new Date(endDate) : null;
    let computedTotalDays = null;

    if (parsedStartDate && parsedEndDate) {
      if (parsedEndDate < parsedStartDate) {
        return sendError(res, 400, 'endDate must be greater than or equal to startDate.');
      }
      const diffTime = Math.abs(parsedEndDate - parsedStartDate);
      computedTotalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const employee = await User.findById(assignedEmployee);
    if (!employee) {
      return sendError(res, 404, 'Assigned employee not found in HRM database.');
    }

    // Validate dependencies belong to the same project
    let validatedDependsOn = [];
    if (Array.isArray(dependsOn) && dependsOn.length > 0) {
      const depTasks = await Task.find({ _id: { $in: dependsOn } });
      for (const dt of depTasks) {
        if (dt.projectId.toString() !== projectId.toString()) {
          return sendError(res, 400, `Dependency task "${dt.taskName}" belongs to a different project.`);
        }
      }
      validatedDependsOn = depTasks.map(t => t._id);
    }

    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.create({
      projectId,
      taskName: taskName.trim(),
      description: description ? description.trim() : null,
      priority: priority || 'Medium',
      departmentId: departmentId || null,
      assignedEmployee,
      estimatedTime: estimatedTime ? Number(estimatedTime) : null,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      totalDays: computedTotalDays,
      deadline: deadline ? new Date(deadline) : null,
      dependsOn: validatedDependsOn,
      status: 'Pending',
      createdBy: userId
    });

    if (userId) {
      await TaskStatusHistory.create({
        taskId: task._id,
        fromStatus: null,
        toStatus: 'Pending',
        changedBy: userId
      });
    }

    const populated = await Task.findById(task._id)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation department')
      .populate('departmentId', 'name')
      .populate('dependsOn', 'taskName status');

    // Dispatch internal notification for new task assignment
    const empIdStr = (task.assignedEmployee._id || task.assignedEmployee).toString();
    InternalNotificationDispatcher.dispatch({
      userIds: [empIdStr],
      projectId: task.projectId.toString(),
      type: 'NEW_TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${task.taskName}`,
      deepLink: `project/${task.projectId}/tasks/${task._id}`,
      refId: task._id
    }).catch(err => console.error('Notification dispatch error:', err));

    return sendSuccess(res, 201, 'Task created successfully.', { task: populated });
  } catch (error) {
    console.error('Error creating task:', error);
    return sendError(res, 500, error.message || 'Failed to create task.');
  }
};

/**
 * GET /api/tasks
 */
exports.getTasks = async (req, res) => {
  try {
    const { projectId, status, assignedEmployee, priority, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter = { isActive: true };

    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;
    if (assignedEmployee) filter.assignedEmployee = assignedEmployee;
    if (priority) filter.priority = priority;

    // Role Scoped Access
    if (req.user) {
      const roleCode = await getUserRoleCode(req.user);
      if (!['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode)) {
        const uId = req.user._id || req.user.id;
        filter.$or = [
          { assignedEmployee: uId },
          { createdBy: uId }
        ];
      }
    }

    const totalCount = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation department')
      .populate('departmentId', 'name')
      .populate('dependsOn', 'taskName status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return sendSuccess(res, 200, 'Tasks retrieved successfully.', {
      tasks,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve tasks.');
  }
};

/**
 * GET /api/tasks/:id
 */
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation department phone')
      .populate('departmentId', 'name')
      .populate('createdBy', 'name email designation')
      .populate('dependsOn', 'taskName status assignedEmployee deadline');

    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    return sendSuccess(res, 200, 'Task details retrieved successfully.', { task });
  } catch (error) {
    console.error('Error fetching task detail:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve task details.');
  }
};

/**
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { taskName, description, priority, departmentId, estimatedTime, startDate, endDate, deadline } = req.body;

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (taskName) task.taskName = taskName.trim();
    if (description !== undefined) task.description = description ? description.trim() : null;
    if (priority) task.priority = priority;
    if (departmentId !== undefined) task.departmentId = departmentId || null;
    if (estimatedTime !== undefined) task.estimatedTime = estimatedTime ? Number(estimatedTime) : null;
    
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) task.endDate = endDate ? new Date(endDate) : null;

    if (task.startDate && task.endDate) {
      if (task.endDate < task.startDate) {
        return sendError(res, 400, 'endDate must be greater than or equal to startDate.');
      }
      const diffTime = Math.abs(task.endDate - task.startDate);
      task.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else if (!task.startDate || !task.endDate) {
      task.totalDays = null;
    }

    if (deadline !== undefined) task.deadline = deadline ? new Date(deadline) : null;

    if (task.deadline && task.status !== 'Completed') {
      task.isDelayed = new Date() > new Date(task.deadline);
    }

    await task.save();

    const updated = await Task.findById(id)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation')
      .populate('departmentId', 'name');

    return sendSuccess(res, 200, 'Task updated successfully.', { task: updated });
  } catch (error) {
    console.error('Error updating task:', error);
    return sendError(res, 500, error.message || 'Failed to update task.');
  }
};

/**
 * PUT /api/tasks/:id/accept
 */
exports.acceptTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (task.assignedEmployee.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only the assigned employee can accept this task.');
    }

    if (task.status !== 'Pending') {
      return sendError(res, 400, `Task cannot be accepted from status "${task.status}". Must be Pending.`);
    }

    const fromStatus = task.status;
    task.status = 'Accepted';
    await task.save();

    await TaskStatusHistory.create({
      taskId: task._id,
      fromStatus,
      toStatus: 'Accepted',
      changedBy: userId
    });

    return sendSuccess(res, 200, 'Task accepted successfully.', { taskId: task._id, status: task.status });
  } catch (error) {
    console.error('Error accepting task:', error);
    return sendError(res, 500, error.message || 'Failed to accept task.');
  }
};

/**
 * PUT /api/tasks/:id/reject
 */
exports.rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (task.assignedEmployee.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only the assigned employee can reject this task.');
    }

    if (task.status !== 'Pending') {
      return sendError(res, 400, `Task cannot be rejected from status "${task.status}". Must be Pending.`);
    }

    const fromStatus = task.status;
    task.status = 'Rejected';
    await task.save();

    await TaskStatusHistory.create({
      taskId: task._id,
      fromStatus,
      toStatus: 'Rejected',
      changedBy: userId
    });

    return sendSuccess(res, 200, 'Task rejected successfully. PM/Admin notified for reassignment.', {
      taskId: task._id,
      status: task.status,
      reason: reason || null
    });
  } catch (error) {
    console.error('Error rejecting task:', error);
    return sendError(res, 500, error.message || 'Failed to reject task.');
  }
};

/**
 * PUT /api/tasks/:id/start
 */
exports.startTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.findById(id).populate('dependsOn', 'taskName status');
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (task.assignedEmployee.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only the assigned employee can start work on this task.');
    }

    if (!['Accepted', 'Pending'].includes(task.status)) {
      return sendError(res, 400, `Task cannot be started from status "${task.status}".`);
    }

    // Hard dependency check
    if (task.dependsOn && task.dependsOn.length > 0) {
      const incompleteDep = task.dependsOn.find(dep => dep.status !== 'Completed');
      if (incompleteDep) {
        return sendError(res, 400, `Cannot start task. Dependent task "${incompleteDep.taskName}" is not completed.`);
      }
    }

    const fromStatus = task.status;
    task.status = 'In Progress';
    task.actualStartTime = new Date();
    await task.save();

    await TaskStatusHistory.create({
      taskId: task._id,
      fromStatus,
      toStatus: 'In Progress',
      changedBy: userId
    });

    return sendSuccess(res, 200, 'Task started. Actual start time recorded.', {
      taskId: task._id,
      status: task.status,
      actualStartTime: task.actualStartTime
    });
  } catch (error) {
    console.error('Error starting task:', error);
    return sendError(res, 500, error.message || 'Failed to start task.');
  }
};

/**
 * PUT /api/tasks/:id/submit-for-review
 */
exports.submitForReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (task.assignedEmployee.toString() !== userId.toString()) {
      return sendError(res, 403, 'Only the assigned employee can submit this task for review.');
    }

    if (task.status !== 'In Progress') {
      return sendError(res, 400, `Task must be In Progress to submit for review.`);
    }

    const fromStatus = task.status;
    task.status = 'Review';
    await task.save();

    await TaskStatusHistory.create({
      taskId: task._id,
      fromStatus,
      toStatus: 'Review',
      changedBy: userId
    });

    return sendSuccess(res, 200, 'Task submitted for review.', { taskId: task._id, status: task.status });
  } catch (error) {
    console.error('Error submitting task for review:', error);
    return sendError(res, 500, error.message || 'Failed to submit task for review.');
  }
};

/**
 * PUT /api/tasks/:id/approve
 */
exports.approveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only PM or Admin can approve tasks.');
    }

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (task.status !== 'Review') {
      return sendError(res, 400, `Task must be in Review status to be approved.`);
    }

    const fromStatus = task.status;
    task.status = 'Approved';
    await task.save();

    if (userId) {
      await TaskStatusHistory.create({
        taskId: task._id,
        fromStatus,
        toStatus: 'Approved',
        changedBy: userId
      });
    }

    return sendSuccess(res, 200, 'Task approved by reviewer.', { taskId: task._id, status: task.status });
  } catch (error) {
    console.error('Error approving task:', error);
    return sendError(res, 500, error.message || 'Failed to approve task.');
  }
};

/**
 * PUT /api/tasks/:id/complete
 */
exports.completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    if (!['Approved', 'In Progress', 'Review'].includes(task.status)) {
      return sendError(res, 400, `Task cannot be marked completed from status "${task.status}".`);
    }

    const fromStatus = task.status;
    task.status = 'Completed';
    task.completionTime = new Date();

    if (task.actualStartTime) {
      task.totalWorkingTimeMinutes = Math.round((task.completionTime - task.actualStartTime) / 60000);
    }

    if (task.deadline) {
      task.isDelayed = task.completionTime > new Date(task.deadline);
    }

    // Compute HRM AppUsageDailySummary metrics (Idle time & Productivity score)
    const metrics = await computeTaskHrmAppUsageMetrics(task);
    task.idleTimeMinutes = metrics.idleTimeMinutes;
    task.productivityScore = metrics.productivityScore;

    await task.save();

    if (userId) {
      await TaskStatusHistory.create({
        taskId: task._id,
        fromStatus,
        toStatus: 'Completed',
        changedBy: userId
      });
    }

    return sendSuccess(res, 200, 'Task completed successfully. Time analysis metrics calculated.', {
      taskId: task._id,
      status: task.status,
      completionTime: task.completionTime,
      totalWorkingTimeMinutes: task.totalWorkingTimeMinutes,
      isDelayed: task.isDelayed,
      idleTimeMinutes: task.idleTimeMinutes,
      productivityScore: task.productivityScore
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return sendError(res, 500, error.message || 'Failed to complete task.');
  }
};

/**
 * GET /api/tasks/:id/status-history
 */
exports.getStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await TaskStatusHistory.find({ taskId: id })
      .populate('changedBy', 'name email designation')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Task status history retrieved successfully.', { history });
  } catch (error) {
    console.error('Error fetching task status history:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve task status history.');
  }
};

/**
 * PUT /api/tasks/:id/reassign
 */
exports.reassignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAssignedEmployee, reason } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only PM or Admin can reassign tasks.');
    }

    if (!newAssignedEmployee) {
      return sendError(res, 400, 'newAssignedEmployee is required.');
    }

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    const targetUser = await User.findById(newAssignedEmployee);
    if (!targetUser) {
      return sendError(res, 404, 'New assigned employee not found in HRM database.');
    }

    const fromEmployee = task.assignedEmployee;
    task.assignedEmployee = newAssignedEmployee;
    task.status = 'Pending';
    await task.save();

    if (userId) {
      await TaskReassignmentLog.create({
        taskId: task._id,
        fromEmployee,
        toEmployee: newAssignedEmployee,
        reassignedBy: userId,
        reason: reason ? reason.trim() : null
      });

      await TaskStatusHistory.create({
        taskId: task._id,
        fromStatus: task.status,
        toStatus: 'Pending',
        changedBy: userId
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignedEmployee', 'name email designation department');

    return sendSuccess(res, 200, 'Task reassigned successfully.', { task: populated });
  } catch (error) {
    console.error('Error reassigning task:', error);
    return sendError(res, 500, error.message || 'Failed to reassign task.');
  }
};

/**
 * POST /api/tasks/:id/checklist/add
 */
exports.addChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return sendError(res, 400, 'Checklist item text is required.');
    }

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    task.checklist.push({ text: text.trim(), isCompleted: false });
    await task.save();

    return sendSuccess(res, 201, 'Checklist item added successfully.', { checklist: task.checklist });
  } catch (error) {
    console.error('Error adding checklist item:', error);
    return sendError(res, 500, error.message || 'Failed to add checklist item.');
  }
};

/**
 * PUT /api/tasks/:id/checklist/:itemId/toggle
 */
exports.toggleChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    const item = task.checklist.id(itemId);
    if (!item) {
      return sendError(res, 404, 'Checklist item not found.');
    }

    item.isCompleted = !item.isCompleted;
    await task.save();

    return sendSuccess(res, 200, 'Checklist item toggled successfully.', { item, checklist: task.checklist });
  } catch (error) {
    console.error('Error toggling checklist item:', error);
    return sendError(res, 500, error.message || 'Failed to toggle checklist item.');
  }
};

/**
 * DELETE /api/tasks/:id/checklist/:itemId
 */
exports.deleteChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    task.checklist.pull(itemId);
    await task.save();

    return sendSuccess(res, 200, 'Checklist item deleted successfully.', { checklist: task.checklist });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return sendError(res, 500, error.message || 'Failed to delete checklist item.');
  }
};

/**
 * POST /api/tasks/:id/comments/add
 */
exports.addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!commentText || !commentText.trim()) {
      return sendError(res, 400, 'Comment text is required.');
    }

    const task = await Task.findById(id);
    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    const comment = await TaskComment.create({
      taskId: id,
      authorId: userId,
      commentText: commentText.trim()
    });

    const populated = await TaskComment.findById(comment._id).populate('authorId', 'name email designation');

    return sendSuccess(res, 201, 'Comment added successfully.', { comment: populated });
  } catch (error) {
    console.error('Error adding task comment:', error);
    return sendError(res, 500, error.message || 'Failed to add comment.');
  }
};

/**
 * GET /api/tasks/:id/comments
 */
exports.getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await TaskComment.find({ taskId: id })
      .populate('authorId', 'name email designation')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Task comments retrieved successfully.', { comments });
  } catch (error) {
    console.error('Error fetching task comments:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve comments.');
  }
};

/**
 * GET /api/tasks/:id/time-analysis
 */
exports.getTimeAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id).populate('assignedEmployee', 'name email designation');

    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    // Live or final metrics calculation
    const metrics = await computeTaskHrmAppUsageMetrics(task);

    return sendSuccess(res, 200, 'Time analysis retrieved successfully.', {
      taskId: task._id,
      taskName: task.taskName,
      status: task.status,
      assignedEmployee: task.assignedEmployee,
      actualStartTime: task.actualStartTime,
      completionTime: task.completionTime,
      totalWorkingTimeMinutes: task.totalWorkingTimeMinutes,
      estimatedTime: task.estimatedTime,
      isDelayed: task.isDelayed,
      idleTimeMinutes: metrics.idleTimeMinutes,
      productivityScore: metrics.productivityScore,
      isAttributable: metrics.isAttributable
    });
  } catch (error) {
    console.error('Error fetching time analysis:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve time analysis.');
  }
};

/**
 * GET /api/tasks/overdue
 */
exports.getOverdueTasks = async (req, res) => {
  try {
    const { projectId, assignedEmployee } = req.query;
    const filter = {
      isActive: true,
      deadline: { $lt: new Date() },
      status: { $ne: 'Completed' }
    };

    if (projectId) filter.projectId = projectId;
    if (assignedEmployee) filter.assignedEmployee = assignedEmployee;

    const overdueTasks = await Task.find(filter)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation')
      .sort({ deadline: 1 });

    // Dispatch three-way TASK_OVERDUE notifications (employee + PM + Admin)
    for (const t of overdueTasks) {
      if (t.assignedEmployee) {
        InternalNotificationDispatcher.dispatch({
          userIds: [t.assignedEmployee._id.toString()],
          broadcastToRoles: ['PROJECT_MANAGER', 'SUPER_ADMIN'],
          projectId: t.projectId ? t.projectId._id.toString() : null,
          type: 'TASK_OVERDUE',
          title: 'Task Overdue Warning',
          message: `Task "${t.taskName}" is overdue! Deadline was ${new Date(t.deadline).toLocaleDateString()}.`,
          deepLink: `project/${t.projectId ? t.projectId._id : ''}/tasks/${t._id}`,
          refId: t._id
        }).catch(err => console.error('Overdue notification dispatch error:', err));
      }
    }

    return sendSuccess(res, 200, 'Overdue tasks retrieved successfully.', { overdueTasks, count: overdueTasks.length });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve overdue tasks.');
  }
};

/**
 * GET /api/tasks/pending-review-too-long
 */
exports.getPendingReviewTooLong = async (req, res) => {
  try {
    const { thresholdDays = 2 } = req.query;
    const thresholdDate = new Date(Date.now() - Number(thresholdDays) * 86400000);

    const filter = {
      isActive: true,
      status: 'Review',
      updatedAt: { $lt: thresholdDate }
    };

    const reviewStuckTasks = await Task.find(filter)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation')
      .sort({ updatedAt: 1 });

    return sendSuccess(res, 200, 'Stuck review tasks retrieved successfully.', { reviewStuckTasks, count: reviewStuckTasks.length });
  } catch (error) {
    console.error('Error fetching stuck review tasks:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve stuck review tasks.');
  }
};

/**
 * GET /api/projects/:projectId/tasks/breakdown
 */
exports.getProjectTasksBreakdown = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const tasks = await Task.find({ projectId, isActive: true }).populate('assignedEmployee', 'name email designation');

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const delayedTasks = tasks.filter(t => t.isDelayed).length;

    const employeeMap = {};
    for (const t of tasks) {
      if (!t.assignedEmployee) continue;
      const empId = t.assignedEmployee._id.toString();
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employeeId: empId,
          employeeName: t.assignedEmployee.name,
          designation: t.assignedEmployee.designation,
          totalAssigned: 0,
          completed: 0
        };
      }
      employeeMap[empId].totalAssigned++;
      if (t.status === 'Completed') employeeMap[empId].completed++;
    }

    return sendSuccess(res, 200, 'Project tasks breakdown retrieved successfully.', {
      projectId,
      totalTasks,
      completedTasks,
      delayedTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      byEmployee: Object.values(employeeMap)
    });
  } catch (error) {
    console.error('Error fetching project tasks breakdown:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve tasks breakdown.');
  }
};

/**
 * GET /api/tasks/:id/schedule-comparison
 * Compare planned schedule vs actual execution timeline
 */
exports.getTaskScheduleComparison = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id)
      .populate('projectId', 'projectName name')
      .populate('assignedEmployee', 'name email designation');

    if (!task || !task.isActive) {
      return sendError(res, 404, 'Task not found.');
    }

    const plannedStartDate = task.startDate;
    const plannedEndDate = task.endDate;
    const plannedTotalDays = task.totalDays;

    const actualStartTime = task.actualStartTime;
    const actualCompletionTime = task.completionTime;

    let actualTotalDays = null;
    if (actualStartTime) {
      const end = actualCompletionTime || new Date();
      const diffTime = Math.abs(end - actualStartTime);
      actualTotalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    let varianceInDays = null;
    if (plannedTotalDays !== null && actualTotalDays !== null) {
      varianceInDays = actualTotalDays - plannedTotalDays;
    }

    return sendSuccess(res, 200, 'Task schedule comparison retrieved successfully.', {
      taskId: task._id,
      taskName: task.taskName,
      status: task.status,
      plannedSchedule: {
        startDate: plannedStartDate,
        endDate: plannedEndDate,
        totalDays: plannedTotalDays
      },
      actualExecution: {
        startTime: actualStartTime,
        completionTime: actualCompletionTime,
        totalDays: actualTotalDays
      },
      varianceInDays,
      isDelayed: task.isDelayed
    });
  } catch (error) {
    console.error('Error fetching schedule comparison:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve schedule comparison.');
  }
};
