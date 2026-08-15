const path = require('path');
const fs = require('fs');

const GeneratedReport = require('../models/GeneratedReport');
const ScheduledReport = require('../models/ScheduledReport');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Client = require('../models/Client');
const DocumentAccessLog = require('../models/DocumentAccessLog');
const RoleMaster = require('../models/RoleMaster');

const { getReportPath, safeResolvePath } = require('../utils/storagePathResolver');
const { generateReportPDF } = require('../utils/reportPdfGenerator');
const { generateReportExcel } = require('../utils/reportExcelGenerator');
const { generateReportCSV } = require('../utils/reportCsvGenerator');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get caller role code
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
 * Validate role-based permissions for report request & download
 */
async function validateReportPermissions(user, reportType, scope) {
  const roleCode = await getUserRoleCode(user);
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(roleCode);
  const isHR = ['HR', 'HR_MANAGER'].includes(roleCode);

  // Company-wide scope restricted to Admin / Super Admin
  if (scope && scope.companyWide && !isAdmin) {
    return { allowed: false, reason: 'Company-wide reports require Admin or Super Admin privileges.' };
  }

  // Attendance, Productivity, Employee, Customer reports
  if (['ATTENDANCE', 'PRODUCTIVITY', 'EMPLOYEE'].includes(reportType)) {
    if (!isAdmin && !isHR) {
      // Allow single-employee report if employee requests their own data
      if (scope && scope.employeeId && scope.employeeId.toString() === (user._id || user.id).toString()) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'HR or Admin privileges required for this report type.' };
    }
  }

  // Project-scoped reports (Project, Task, Drawing, Approval, Site, Daily, Monthly)
  if (scope && scope.projectId && !isAdmin) {
    const project = await Project.findById(scope.projectId);
    if (!project) return { allowed: false, reason: 'Target project not found.' };

    const uId = (user._id || user.id).toString();
    const isPM = project.createdBy && project.createdBy.toString() === uId;
    const isTeam = Array.isArray(project.teamAssignments) && project.teamAssignments.some(t => t.userId && t.userId.toString() === uId);

    if (!isPM && !isTeam && roleCode !== 'PROJECT_MANAGER') {
      return { allowed: false, reason: 'Access denied. You are not assigned to this project.' };
    }
  }

  return { allowed: true };
}

/**
 * Helper to determine if report scope warrants a background job
 */
function isBackgroundScope(scope) {
  if (!scope) return false;
  if (scope.companyWide === true) return true;
  if (Array.isArray(scope.projectIds) && scope.projectIds.length > 5) return true;

  if (scope.dateFrom && scope.dateTo) {
    const diffMs = Math.abs(new Date(scope.dateTo) - new Date(scope.dateFrom));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 90) return true;
  }

  return false;
}

/**
 * Build structured dataset for a specific report type
 */
async function buildReportDataset(reportType, scope) {
  let title = `${reportType} REPORT`;
  let scopeInfo = { ...scope };
  let summaryCards = [];
  let headers = [];
  let rows = [];

  switch (reportType) {
    case 'ATTENDANCE': {
      title = 'Attendance Report';
      const filter = {};
      if (scope.employeeId) filter.userId = scope.employeeId;
      if (scope.dateFrom || scope.dateTo) {
        filter.clockInTime = {};
        if (scope.dateFrom) filter.clockInTime.$gte = new Date(scope.dateFrom);
        if (scope.dateTo) filter.clockInTime.$lte = new Date(scope.dateTo);
      }

      const records = await Attendance.find(filter).populate('userId', 'name email designation').sort({ clockInTime: -1 });
      headers = ['Date', 'Employee', 'Designation', 'Mode', 'Clock In', 'Clock Out', 'Status', 'Hours'];

      let totalPresent = 0;
      let totalOffice = 0;
      let totalSite = 0;

      rows = records.map(r => {
        if (r.status === 'PRESENT') totalPresent++;
        if (r.mode === 'OFFICE_AUTO') totalOffice++;
        if (r.mode === 'SITE_MOBILE') totalSite++;

        return [
          r.clockInTime ? r.clockInTime.toISOString().split('T')[0] : '-',
          r.userId ? r.userId.name : 'Unknown',
          r.userId ? (r.userId.designation || 'Staff') : '-',
          r.mode || 'OFFICE_AUTO',
          r.clockInTime ? r.clockInTime.toLocaleTimeString() : '-',
          r.clockOutTime ? r.clockOutTime.toLocaleTimeString() : '-',
          r.status || 'PRESENT',
          r.workingHours ? r.workingHours.toFixed(1) : '0.0'
        ];
      });

      summaryCards = [
        { label: 'Total Attendance Records', value: records.length },
        { label: 'Total Present Days', value: totalPresent },
        { label: 'Office Auto Days', value: totalOffice },
        { label: 'Site Mobile Days', value: totalSite }
      ];
      break;
    }

    case 'PRODUCTIVITY': {
      title = 'Productivity Report';
      const filter = { status: 'Completed', isActive: true };
      if (scope.projectId) filter.projectId = scope.projectId;
      if (scope.employeeId) filter.assignedEmployee = scope.employeeId;

      const tasks = await Task.find(filter)
        .populate('assignedEmployee', 'name email designation')
        .populate('projectId', 'projectName');

      headers = ['Task Name', 'Project', 'Assigned Employee', 'Working Time (Mins)', 'Productivity Score', 'Priority'];

      const scores = tasks.map(t => t.productivityScore).filter(s => s !== null && s !== undefined);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      rows = tasks.map(t => [
        t.taskName,
        t.projectId ? (t.projectId.projectName || t.projectId.name) : '-',
        t.assignedEmployee ? t.assignedEmployee.name : 'Unassigned',
        t.totalWorkingTimeMinutes || 0,
        t.productivityScore !== null && t.productivityScore !== undefined ? `${t.productivityScore}%` : 'N/A',
        t.priority || 'Medium'
      ]);

      summaryCards = [
        { label: 'Completed Tasks Analyzed', value: tasks.length },
        { label: 'Average Productivity Score', value: `${avgScore}%` }
      ];
      break;
    }

    case 'PROJECT': {
      title = 'Project Report';
      let projects = [];
      if (scope.projectId) {
        const p = await Project.findById(scope.projectId).populate('createdBy', 'name email');
        if (p) projects.push(p);
      } else {
        projects = await Project.find({ isActive: true }).populate('createdBy', 'name email');
      }

      headers = ['Project Name', 'Status', 'Progress %', 'Delayed?', 'Budget (INR)', 'Created By'];
      rows = projects.map(p => [
        p.projectName || p.name,
        p.status || 'New',
        `${p.progressPercentage || 0}%`,
        p.isDelayed ? 'YES' : 'NO',
        `₹${(p.budget || 0).toLocaleString()}`,
        p.createdBy ? p.createdBy.name : 'System'
      ]);

      summaryCards = [
        { label: 'Total Projects', value: projects.length },
        { label: 'Average Progress', value: `${projects.length > 0 ? Math.round(projects.reduce((a, b) => a + (b.progressPercentage || 0), 0) / projects.length) : 0}%` },
        { label: 'Delayed Projects Count', value: projects.filter(p => p.isDelayed).length }
      ];
      break;
    }

    case 'EMPLOYEE': {
      title = 'Employee Performance Report';
      const users = await User.find({ isActive: true }).populate('department', 'name').select('name email designation department');
      headers = ['Employee Name', 'Email', 'Designation', 'Department'];

      rows = users.map(u => [
        u.name,
        u.email,
        u.designation || 'Staff',
        u.department ? (typeof u.department === 'object' ? u.department.name : u.department) : 'General'
      ]);

      summaryCards = [
        { label: 'Active Employees Count', value: users.length }
      ];
      break;
    }

    case 'DRAWING': {
      title = 'Drawing Management Report';
      const filter = { isActive: true };
      if (scope.projectId) filter.projectId = scope.projectId;

      const drawings = await Drawing.find(filter).populate('projectId', 'projectName').populate('categoryId', 'name');
      headers = ['Drawing Name', 'Project', 'Category', 'Status', 'Version'];

      rows = drawings.map(d => [
        d.drawingName || d.name,
        d.projectId ? (d.projectId.projectName || d.projectId.name) : '-',
        d.categoryId ? d.categoryId.name : 'General',
        d.status || 'DESIGNER_UPLOADED',
        `v${d.currentVersionNumber || 1}`
      ]);

      const approvedCount = drawings.filter(d => d.status === 'APPROVED').length;

      summaryCards = [
        { label: 'Total Drawings', value: drawings.length },
        { label: 'Approved Drawings', value: approvedCount },
        { label: 'Approval Rate', value: `${drawings.length > 0 ? Math.round((approvedCount / drawings.length) * 100) : 0}%` }
      ];
      break;
    }

    case 'SITE': {
      title = 'Site Activity & Geo-Fence Report';
      const filter = { mode: 'SITE_MOBILE' };
      const records = await Attendance.find(filter).populate('userId', 'name designation').sort({ clockInTime: -1 });

      headers = ['Date', 'Site Engineer', 'Designation', 'Clock In', 'Status'];
      rows = records.map(r => [
        r.clockInTime ? r.clockInTime.toISOString().split('T')[0] : '-',
        r.userId ? r.userId.name : 'Site Staff',
        r.userId ? (r.userId.designation || 'Engineer') : '-',
        r.clockInTime ? r.clockInTime.toLocaleTimeString() : '-',
        r.status || 'PRESENT'
      ]);

      summaryCards = [
        { label: 'Total Site Check-Ins', value: records.length }
      ];
      break;
    }

    case 'DAILY_PROGRESS':
    case 'MONTHLY_PROGRESS': {
      title = `${reportType === 'DAILY_PROGRESS' ? 'Daily' : 'Monthly'} Progress Snapshot Report`;
      const filter = { isActive: true };
      if (scope.projectId) filter.projectId = scope.projectId;

      const tasks = await Task.find(filter).populate('projectId', 'projectName');
      headers = ['Task Name', 'Project', 'Status', 'Is Delayed', 'Deadline'];

      rows = tasks.map(t => [
        t.taskName,
        t.projectId ? (t.projectId.projectName || t.projectId.name) : '-',
        t.status,
        t.isDelayed ? 'YES' : 'NO',
        t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : '-'
      ]);

      summaryCards = [
        { label: 'Total Snapshot Tasks', value: tasks.length },
        { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'Completed').length },
        { label: 'Delayed Tasks', value: tasks.filter(t => t.isDelayed).length }
      ];
      break;
    }

    case 'CUSTOMER': {
      title = 'Customer & Client Engagement Report';
      const clients = await Client.find({ isActive: true });
      headers = ['Company Name', 'Contact Person', 'Email', 'Phone', 'Status'];

      rows = clients.map(c => [
        c.companyName || c.name || 'Client',
        c.contactPerson || '-',
        c.email || '-',
        c.phone || '-',
        c.isActive ? 'Active' : 'Inactive'
      ]);

      summaryCards = [
        { label: 'Total Active Clients', value: clients.length }
      ];
      break;
    }

    case 'TASK': {
      title = 'Task Management Analysis Report';
      const filter = { isActive: true };
      if (scope.projectId) filter.projectId = scope.projectId;
      if (scope.employeeId) filter.assignedEmployee = scope.employeeId;

      const tasks = await Task.find(filter)
        .populate('assignedEmployee', 'name')
        .populate('projectId', 'projectName');

      headers = ['Task Name', 'Project', 'Assigned To', 'Status', 'Priority', 'Working Mins', 'Delayed?'];
      rows = tasks.map(t => [
        t.taskName,
        t.projectId ? (t.projectId.projectName || t.projectId.name) : '-',
        t.assignedEmployee ? t.assignedEmployee.name : 'Unassigned',
        t.status,
        t.priority || 'Medium',
        t.totalWorkingTimeMinutes || 0,
        t.isDelayed ? 'YES' : 'NO'
      ]);

      summaryCards = [
        { label: 'Total Tasks Analyzed', value: tasks.length },
        { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'Completed').length },
        { label: 'Overdue / Delayed Tasks', value: tasks.filter(t => t.isDelayed).length }
      ];
      break;
    }

    case 'APPROVAL': {
      title = 'Drawing & Design Approval Audit Report';
      const filter = { isActive: true };
      if (scope.projectId) filter.projectId = scope.projectId;

      const drawings = await Drawing.find(filter).populate('projectId', 'projectName');
      headers = ['Drawing Name', 'Project', 'Approval Stage / Status', 'Version'];

      rows = drawings.map(d => [
        d.drawingName || d.name,
        d.projectId ? (d.projectId.projectName || d.projectId.name) : '-',
        d.status || 'DESIGNER_UPLOADED',
        `v${d.currentVersionNumber || 1}`
      ]);

      summaryCards = [
        { label: 'Total Drawing Approval Records', value: drawings.length },
        { label: 'Fully Approved', value: drawings.filter(d => d.status === 'APPROVED').length },
        { label: 'Pending PM / Admin Review', value: drawings.filter(d => ['DESIGNER_UPLOADED', 'PM_APPROVED'].includes(d.status)).length }
      ];
      break;
    }

    default: {
      headers = ['Field', 'Value'];
      rows = [['Message', 'Generic report execution']];
      summaryCards = [{ label: 'Total Items', value: 1 }];
    }
  }

  return { title, scopeInfo, summaryCards, headers, rows };
}

/**
 * Dispatch rendering to appropriate format helper
 */
async function renderReportFile(reportType, format, title, scopeInfo, summaryCards, headers, rows, targetFilePath) {
  const upperFmt = String(format).toUpperCase();
  if (upperFmt === 'EXCEL') {
    return generateReportExcel(title, scopeInfo, summaryCards, headers, rows, targetFilePath);
  }
  if (upperFmt === 'CSV') {
    return generateReportCSV(title, scopeInfo, summaryCards, headers, rows, targetFilePath);
  }
  // Default to PDF
  return generateReportPDF(title, scopeInfo, summaryCards, headers, rows, targetFilePath);
}

/**
 * POST /api/reports/generate
 * Main report generation endpoint (handles sync vs background job threshold)
 */
exports.generateReport = async (req, res) => {
  try {
    const { reportType, format = 'PDF', scope = {} } = req.body;
    const requesterUser = req.user;

    if (!reportType) {
      return sendError(res, 400, 'reportType is required.');
    }

    // Permission check
    const perm = await validateReportPermissions(requesterUser, reportType.toUpperCase(), scope);
    if (!perm.allowed) {
      return sendError(res, 403, perm.reason || 'Access denied for report generation.');
    }

    const uppercaseType = reportType.toUpperCase();
    const uppercaseFormat = format.toUpperCase();
    const scopeName = scope.projectId ? `Proj_${scope.projectId}` : (scope.employeeId ? `Emp_${scope.employeeId}` : 'Company');

    const pathInfo = getReportPath(uppercaseType, uppercaseFormat, Date.now(), scopeName);

    // Create tracking record
    const reportRecord = await GeneratedReport.create({
      reportType: uppercaseType,
      format: uppercaseFormat,
      scope,
      requestedBy: requesterUser._id || requesterUser.id,
      status: 'PENDING'
    });

    const isBg = isBackgroundScope(scope);

    if (isBg) {
      // Async Background Job path
      reportRecord.status = 'GENERATING';
      await reportRecord.save();

      // Trigger background worker
      setTimeout(async () => {
        try {
          const dataset = await buildReportDataset(uppercaseType, scope);
          await renderReportFile(uppercaseType, uppercaseFormat, dataset.title, dataset.scopeInfo, dataset.summaryCards, dataset.headers, dataset.rows, pathInfo.fullPath);

          reportRecord.status = 'READY';
          reportRecord.filePath = pathInfo.relativePath;
          reportRecord.completedAt = new Date();
          await reportRecord.save();
        } catch (bgErr) {
          console.error(`Background report generation failed for ID ${reportRecord._id}:`, bgErr);
          reportRecord.status = 'FAILED';
          reportRecord.errorMessage = bgErr.message || 'Background job execution failed';
          await reportRecord.save();
        }
      }, 50);

      return sendSuccess(res, 202, 'Report generation queued as background job.', {
        reportId: reportRecord._id,
        status: 'GENERATING',
        message: 'Report is generating in background. Use status polling endpoint to check completion.'
      });
    }

    // Synchronous execution path
    const dataset = await buildReportDataset(uppercaseType, scope);
    await renderReportFile(uppercaseType, uppercaseFormat, dataset.title, dataset.scopeInfo, dataset.summaryCards, dataset.headers, dataset.rows, pathInfo.fullPath);

    reportRecord.status = 'READY';
    reportRecord.filePath = pathInfo.relativePath;
    reportRecord.completedAt = new Date();
    await reportRecord.save();

    return sendSuccess(res, 200, 'Report generated successfully.', {
      reportId: reportRecord._id,
      status: 'READY',
      filePath: pathInfo.relativePath,
      downloadUrl: `/api/reports/${reportRecord._id}/download`
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return sendError(res, 500, error.message || 'Failed to generate report.');
  }
};

/**
 * GET /api/reports/:id/status
 * Poll background report generation status
 */
exports.getReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await GeneratedReport.findById(id);

    if (!report) {
      return sendError(res, 404, 'Report record not found.');
    }

    return sendSuccess(res, 200, 'Report status retrieved successfully.', {
      reportId: report._id,
      reportType: report.reportType,
      format: report.format,
      status: report.status,
      filePath: report.status === 'READY' ? report.filePath : null,
      errorMessage: report.errorMessage,
      requestedAt: report.requestedAt,
      completedAt: report.completedAt
    });
  } catch (error) {
    console.error('Error fetching report status:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve report status.');
  }
};

/**
 * GET /api/reports/:id/download
 * Download generated report file (re-verifies permissions at download time)
 */
exports.downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await GeneratedReport.findById(id);

    if (!report || report.status !== 'READY' || !report.filePath) {
      return sendError(res, 404, 'Report file is not ready or not found.');
    }

    // Re-verify caller permissions at download time
    const perm = await validateReportPermissions(req.user, report.reportType, report.scope);
    if (!perm.allowed) {
      return sendError(res, 403, perm.reason || 'Access denied for downloading this report.');
    }

    const absolutePath = safeResolvePath(report.filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return sendError(res, 404, 'Physical report file missing from storage.');
    }

    return res.download(absolutePath, path.basename(absolutePath));
  } catch (error) {
    console.error('Error downloading report:', error);
    return sendError(res, 500, error.message || 'Failed to download report.');
  }
};

/**
 * GET /api/reports/my
 * Get list of reports requested by calling user
 */
exports.getMyReports = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { reportType, status } = req.query;

    const filter = { requestedBy: userId };
    if (reportType) filter.reportType = reportType.toUpperCase();
    if (status) filter.status = status.toUpperCase();

    const reports = await GeneratedReport.find(filter).sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'User generated reports retrieved successfully.', {
      reports,
      totalCount: reports.length
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve reports list.');
  }
};

/**
 * Convenience Endpoints mapping specific report requests
 */
exports.generateAttendanceReport = async (req, res) => {
  req.body.reportType = 'ATTENDANCE';
  req.body.scope = {
    employeeId: req.body.employeeId,
    departmentId: req.body.departmentId,
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo,
    companyWide: req.body.companyWide
  };
  return exports.generateReport(req, res);
};

exports.generateProductivityReport = async (req, res) => {
  req.body.reportType = 'PRODUCTIVITY';
  req.body.scope = {
    employeeId: req.body.employeeId,
    projectId: req.body.projectId,
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo
  };
  return exports.generateReport(req, res);
};

exports.generateProjectReport = async (req, res) => {
  req.body.reportType = 'PROJECT';
  req.body.scope = {
    projectId: req.body.projectId,
    companyWide: !req.body.projectId
  };
  return exports.generateReport(req, res);
};

exports.generateEmployeeReport = async (req, res) => {
  req.body.reportType = 'EMPLOYEE';
  req.body.scope = {
    employeeId: req.body.employeeId,
    departmentId: req.body.departmentId,
    companyWide: !req.body.employeeId
  };
  return exports.generateReport(req, res);
};

exports.generateDrawingReport = async (req, res) => {
  req.body.reportType = 'DRAWING';
  req.body.scope = {
    projectId: req.body.projectId,
    categoryId: req.body.categoryId
  };
  return exports.generateReport(req, res);
};

exports.generateSiteReport = async (req, res) => {
  req.body.reportType = 'SITE';
  req.body.scope = {
    projectId: req.body.projectId,
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo
  };
  return exports.generateReport(req, res);
};

exports.generateDailyProgressReport = async (req, res) => {
  req.body.reportType = 'DAILY_PROGRESS';
  req.body.scope = {
    projectId: req.body.projectId,
    date: req.body.date
  };
  return exports.generateReport(req, res);
};

exports.generateMonthlyProgressReport = async (req, res) => {
  req.body.reportType = 'MONTHLY_PROGRESS';
  req.body.scope = {
    projectId: req.body.projectId,
    month: req.body.month,
    year: req.body.year
  };
  return exports.generateReport(req, res);
};

exports.generateCustomerReport = async (req, res) => {
  req.body.reportType = 'CUSTOMER';
  req.body.scope = {
    clientId: req.body.clientId,
    companyWide: !req.body.clientId
  };
  return exports.generateReport(req, res);
};

exports.generateTaskReport = async (req, res) => {
  req.body.reportType = 'TASK';
  req.body.scope = {
    projectId: req.body.projectId,
    employeeId: req.body.employeeId,
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo
  };
  return exports.generateReport(req, res);
};

exports.generateApprovalReport = async (req, res) => {
  req.body.reportType = 'APPROVAL';
  req.body.scope = {
    projectId: req.body.projectId,
    dateFrom: req.body.dateFrom,
    dateTo: req.body.dateTo
  };
  return exports.generateReport(req, res);
};

/**
 * Scheduled Report Management CRUD
 */
exports.createScheduledReport = async (req, res) => {
  try {
    const { reportType, format = 'PDF', scope = {}, frequency = 'MONTHLY' } = req.body;
    const userId = req.user._id || req.user.id;

    if (!reportType) {
      return sendError(res, 400, 'reportType is required.');
    }

    const nextRun = new Date();
    if (frequency === 'DAILY') nextRun.setDate(nextRun.getDate() + 1);
    else if (frequency === 'WEEKLY') nextRun.setDate(nextRun.getDate() + 7);
    else nextRun.setMonth(nextRun.getMonth() + 1);

    const scheduled = await ScheduledReport.create({
      reportType: reportType.toUpperCase(),
      format: format.toUpperCase(),
      scope,
      frequency: frequency.toUpperCase(),
      recipientUserId: userId,
      nextRunAt: nextRun
    });

    return sendSuccess(res, 201, 'Scheduled report configuration created successfully.', { scheduled });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    return sendError(res, 500, error.message || 'Failed to create scheduled report.');
  }
};

exports.getMyScheduledReports = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const schedules = await ScheduledReport.find({ recipientUserId: userId, isActive: true });

    return sendSuccess(res, 200, 'User scheduled reports retrieved successfully.', { schedules });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve scheduled reports.');
  }
};

exports.deleteScheduledReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const scheduled = await ScheduledReport.findOneAndDelete({ _id: id, recipientUserId: userId });
    if (!scheduled) {
      return sendError(res, 404, 'Scheduled report not found.');
    }

    return sendSuccess(res, 200, 'Scheduled report configuration removed successfully.');
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return sendError(res, 500, error.message || 'Failed to delete scheduled report.');
  }
};
