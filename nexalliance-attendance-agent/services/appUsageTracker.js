const activeWin = require('active-win');
const { isMonitoringApplicable } = require('./roleGate');
const { createApiClient, getStoredToken } = require('./api');

let usageTally = {};
let pollTimer = null;
let syncTimer = null;

/**
 * Polls current foreground active window and increments running seconds tally
 */
async function pollActiveWindow(pollIntervalSeconds = 5) {
  try {
    const result = await activeWin();
    let appName = 'IDLE';

    if (result && result.owner && result.owner.name) {
      appName = result.owner.name;
    } else if (result && result.title) {
      appName = result.title;
    }

    usageTally[appName] = (usageTally[appName] || 0) + pollIntervalSeconds;
  } catch (err) {
    // Fail silently for a single poll tick to avoid crashing tracker loop
  }
}

/**
 * Flushes accumulated usage tally to backend server
 */
async function flushUsageToServer(userId, attendanceId, isOfflineSync = false) {
  if (Object.keys(usageTally).length === 0) return;

  const currentBatch = { ...usageTally };
  const appUsage = Object.entries(currentBatch).map(([appName, secondsActive]) => ({
    appName,
    secondsActive
  }));

  try {
    const token = getStoredToken();
    if (!token) return;

    const client = createApiClient(token);
    const response = await client.post('/app-usage/sync', {
      userId,
      attendanceId,
      appUsage,
      isOfflineSync
    });

    if (response.data && response.data.success) {
      console.log(`[AppUsage Tracker] Flushed ${appUsage.length} app entries to server.`);
      // Reset only after confirmed server receipt
      for (const [appName, seconds] of Object.entries(currentBatch)) {
        if (usageTally[appName]) {
          usageTally[appName] -= seconds;
          if (usageTally[appName] <= 0) delete usageTally[appName];
        }
      }
    }
  } catch (error) {
    console.warn('[AppUsage Tracker] Sync failed (retaining tally for next flush):', error.message);
  }
}

/**
 * Starts application usage tracking loop
 */
function startAppUsageTracking(currentUser, attendanceId, config = {}) {
  if (!isMonitoringApplicable(currentUser)) {
    console.log('[AppUsage Tracker] Super Admin detected. App usage tracking disabled.');
    return;
  }

  if (config.isEnabled === false) {
    console.log('[AppUsage Tracker] Tracking is globally disabled by Admin.');
    return;
  }

  stopAppUsageTracking(currentUser, attendanceId);

  const pollIntervalSeconds = config.pollIntervalSeconds || 5;
  const syncIntervalMinutes = config.syncIntervalMinutes || 5;

  console.log(`[AppUsage Tracker] Starting tracker for ${currentUser.name} (Poll: ${pollIntervalSeconds}s, Sync: ${syncIntervalMinutes}m).`);

  pollTimer = setInterval(
    () => pollActiveWindow(pollIntervalSeconds),
    pollIntervalSeconds * 1000
  );

  syncTimer = setInterval(
    () => flushUsageToServer(currentUser.id || currentUser.userId || currentUser._id, attendanceId),
    syncIntervalMinutes * 60 * 1000
  );
}

/**
 * Stops application usage tracking loop and flushes remaining partial data
 */
async function stopAppUsageTracking(currentUser, attendanceId) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }

  if (currentUser && attendanceId && isMonitoringApplicable(currentUser)) {
    await flushUsageToServer(currentUser.id || currentUser.userId || currentUser._id, attendanceId);
  }
  usageTally = {};
  console.log('[AppUsage Tracker] Tracker stopped.');
}

module.exports = {
  startAppUsageTracking,
  stopAppUsageTracking,
  flushUsageToServer
};
