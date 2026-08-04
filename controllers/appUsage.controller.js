const AppUsageLog = require('../models/AppUsageLog');
const AppUsageDailySummary = require('../models/AppUsageDailySummary');
const AppUsageConfig = require('../models/AppUsageConfig');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Sync App Usage 5-Minute Batch from Desktop Agent
 * POST /api/app-usage/sync
 */
exports.syncAppUsage = async (req, res, next) => {
  try {
    const userId = (req.user && (req.user.userId || req.user.id || req.user._id)) || req.body.userId;
    const { attendanceId, appUsage, isOfflineSync } = req.body;

    if (!userId || !attendanceId) {
      return sendError(res, 400, 'userId and attendanceId are required.');
    }

    if (!Array.isArray(appUsage) || appUsage.length === 0) {
      return sendError(res, 400, 'appUsage array cannot be empty.');
    }

    // Verify user & attendance
    const user = await User.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) return sendError(res, 404, 'Attendance session not found.');

    // 1. Save raw batch audit log
    const logBatch = await AppUsageLog.create({
      userId,
      attendanceId,
      batchReceivedAt: new Date(),
      appUsage,
      isOfflineSync: !!isOfflineSync
    });

    // 2. Format YYYY-MM-DD date in Asia/Kolkata timezone
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

    // 3. Find or create daily summary document
    let summary = await AppUsageDailySummary.findOne({ userId, date: dateStr });
    if (!summary) {
      summary = new AppUsageDailySummary({
        userId,
        date: dateStr,
        appTotals: [],
        idleSeconds: 0,
        totalTrackedSeconds: 0
      });
    }

    let batchTotalTracked = 0;
    let batchIdle = 0;

    for (const item of appUsage) {
      const appName = item.appName || 'Unknown';
      const secondsActive = Number(item.secondsActive) || 0;
      if (secondsActive <= 0) continue;

      batchTotalTracked += secondsActive;
      if (appName.toUpperCase() === 'IDLE') {
        batchIdle += secondsActive;
      }

      // Upsert into summary.appTotals array
      const existingApp = summary.appTotals.find(a => a.appName.toLowerCase() === appName.toLowerCase());
      if (existingApp) {
        existingApp.totalSeconds += secondsActive;
      } else {
        summary.appTotals.push({ appName, totalSeconds: secondsActive });
      }
    }

    summary.idleSeconds += batchIdle;
    summary.totalTrackedSeconds += batchTotalTracked;

    await summary.save();

    console.log(`[AppUsage Controller] Synced ${appUsage.length} app items for user ${user.name} (${dateStr}). Total Tracked: ${summary.totalTrackedSeconds}s.`);

    return sendSuccess(res, 201, 'App usage batch synced successfully.', {
      logId: logBatch._id,
      date: summary.date,
      totalTrackedSeconds: summary.totalTrackedSeconds
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get App Usage Configuration
 * GET /api/app-usage/config
 */
exports.getConfig = async (req, res, next) => {
  try {
    let config = await AppUsageConfig.findOne();
    if (!config) {
      config = await AppUsageConfig.create({
        pollIntervalSeconds: 5,
        syncIntervalMinutes: 5,
        captureWindowTitle: false,
        isEnabled: true
      });
    }
    return sendSuccess(res, 200, 'App usage config retrieved successfully.', config);
  } catch (error) {
    next(error);
  }
};

/**
 * Update App Usage Configuration (Super Admin Only)
 * PUT /api/app-usage/config
 */
exports.updateConfig = async (req, res, next) => {
  try {
    const { pollIntervalSeconds, syncIntervalMinutes, captureWindowTitle, isEnabled } = req.body;

    let config = await AppUsageConfig.findOne();
    if (!config) config = new AppUsageConfig();

    if (pollIntervalSeconds !== undefined) config.pollIntervalSeconds = pollIntervalSeconds;
    if (syncIntervalMinutes !== undefined) config.syncIntervalMinutes = syncIntervalMinutes;
    if (captureWindowTitle !== undefined) config.captureWindowTitle = captureWindowTitle;
    if (isEnabled !== undefined) config.isEnabled = isEnabled;
    config.updatedBy = req.user ? (req.user.userId || req.user.id || req.user._id) : undefined;

    await config.save();
    return sendSuccess(res, 200, 'App usage config updated successfully.', config);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Employee App Usage Breakdown (SUPER ADMIN ONLY)
 * GET /api/app-usage/employee/:userId?date=YYYY-MM-DD&fromDate=&toDate=
 */
exports.getEmployeeAppUsage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { date, fromDate, toDate } = req.query;

    const user = await User.findById(userId).select('name email role employeeId designation department');
    if (!user) return sendError(res, 404, 'Employee not found.');

    const query = { userId };

    if (date) {
      query.date = date;
    } else if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    } else {
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
      query.date = todayStr;
    }

    const summaries = await AppUsageDailySummary.find(query).sort({ date: -1 });

    // Consolidate overall app totals across the date range
    const grandTotals = {};
    let totalTrackedSeconds = 0;
    let totalIdleSeconds = 0;

    for (const s of summaries) {
      totalTrackedSeconds += s.totalTrackedSeconds || 0;
      totalIdleSeconds += s.idleSeconds || 0;
      for (const app of s.appTotals) {
        grandTotals[app.appName] = (grandTotals[app.appName] || 0) + app.totalSeconds;
      }
    }

    const appBreakdown = Object.entries(grandTotals).map(([appName, totalSeconds]) => ({
      appName,
      totalSeconds,
      hoursFormatted: `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s`
    })).sort((a, b) => b.totalSeconds - a.totalSeconds);

    return sendSuccess(res, 200, 'Employee app usage breakdown retrieved.', {
      user,
      queryDate: date || { fromDate, toDate },
      totalTrackedSeconds,
      totalIdleSeconds,
      totalTrackedFormatted: `${Math.floor(totalTrackedSeconds / 3600)}h ${Math.floor((totalTrackedSeconds % 3600) / 60)}m`,
      appBreakdown,
      dailySummaries: summaries
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export Employee App Usage Data (SUPER ADMIN ONLY)
 * GET /api/app-usage/employee/:userId/export?format=csv|json&fromDate=&toDate=
 */
exports.exportEmployeeAppUsage = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { format = 'json', fromDate, toDate } = req.query;

    const user = await User.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const query = { userId };
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = fromDate;
      if (toDate) query.date.$lte = toDate;
    }

    const summaries = await AppUsageDailySummary.find(query).sort({ date: -1 });

    if (format === 'csv') {
      let csv = 'Date,Employee Name,Employee Email,Application Name,Active Seconds,Formatted Duration\n';
      for (const s of summaries) {
        for (const app of s.appTotals) {
          const hrs = `${Math.floor(app.totalSeconds / 3600)}h ${Math.floor((app.totalSeconds % 3600) / 60)}m`;
          csv += `"${s.date}","${user.name}","${user.email}","${app.appName}",${app.totalSeconds},"${hrs}"\n`;
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="app_usage_${user.name.replace(/\s+/g, '_')}.csv"`);
      return res.status(200).send(csv);
    }

    return sendSuccess(res, 200, 'Export data retrieved.', { user, summaries });
  } catch (error) {
    next(error);
  }
};
