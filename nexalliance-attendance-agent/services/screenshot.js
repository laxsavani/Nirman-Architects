const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const screenshot = require('screenshot-desktop');
const FormData = require('form-data');
const { createApiClient, getStoredToken, getStoredTokenData } = require('./api');
const config = require('../config');

// Helper to sanitize user name into URL/folder-safe slug e.g. "Lax Savani" -> "Lax-Savani"
function sanitizeNameForPath(name, fallbackId) {
  if (!name || typeof name !== 'string') return String(fallbackId || 'User');
  const clean = name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
  return clean || String(fallbackId || 'User');
}

// Temporary local pending storage directory (for offline upload queue)
function getPendingDir() {
  const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '..', 'storage_pending');
  const pendingDir = path.join(userDataPath, 'screenshots_pending');
  if (!fs.existsSync(pendingDir)) {
    fs.mkdirSync(pendingDir, { recursive: true });
  }
  return pendingDir;
}

// Direct project storage directory on local disk: storage/screenshots/<Formatted-User-Name>/<month>/<day>/
function getLocalArchiveDir() {
  let projectStoragePath;
  try {
    projectStoragePath = path.resolve(__dirname, '..', '..', 'storage', 'screenshots');
  } catch (e) {
    projectStoragePath = path.join(process.cwd(), 'storage', 'screenshots');
  }

  // Get user name from saved auth token
  const tokenData = getStoredTokenData();
  const rawName = (tokenData && tokenData.user) ? (tokenData.user.name || tokenData.user.email) : 'User';
  const folderName = sanitizeNameForPath(rawName, 'User');

  const now = new Date();
  const monthStr = String(now.getMonth() + 1); // 1-indexed month e.g., 7 for July
  const dayStr = String(now.getDate());        // day of month e.g., 27

  const archiveDir = path.join(projectStoragePath, folderName, monthStr, dayStr);
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  return archiveDir;
}

let screenshotTimer = null;
let currentAttendanceId = null;

/**
 * Capture entire desktop screen and save locally to both pending queue and project local disk archive
 */
async function captureAndQueue(attendanceId, isFirstOfSession = false) {
  try {
    const pendingDir = getPendingDir();
    const localArchiveDir = getLocalArchiveDir();
    const filename = `${attendanceId}_${isFirstOfSession ? '0min_' : ''}${Date.now()}.jpg`;
    
    const pendingFilePath = path.join(pendingDir, filename);
    const archiveFilePath = path.join(localArchiveDir, filename);

    console.log(`[Screenshot Service] Capturing screen for attendance session ${attendanceId}...`);
    const imgBuffer = await screenshot({ format: 'jpg' });

    // 1. Save to temporary pending upload queue
    fs.writeFileSync(pendingFilePath, imgBuffer);
    
    // 2. Save directly to project storage folder on local disk (storage/screenshots/<User-Name>/<Month>/<Day>/)
    try {
      fs.writeFileSync(archiveFilePath, imgBuffer);
      console.log(`[Screenshot Service] Successfully saved to local project storage: ${archiveFilePath}`);
    } catch (e) {
      console.warn(`[Screenshot Service] Project storage write warning:`, e.message);
    }

    console.log(`[Screenshot Service] Saved locally: ${filename}`);
    return { filePath: pendingFilePath, isFirstOfSession };
  } catch (error) {
    console.error('[Screenshot Service] Error capturing screenshot:', error.message);
    return null;
  }
}

/**
 * Upload screenshot file to server (Render or Local); delete pending temp copy on HTTP success
 */
async function tryUploadOrQueue(filePath, attendanceId, isFirstOfSession = false, isOfflineSync = false) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  try {
    const token = getStoredToken();
    const api = createApiClient(token);
    const form = new FormData();
    form.append('image', fs.createReadStream(filePath));
    form.append('attendanceId', String(attendanceId));
    form.append('isFirstOfSession', isFirstOfSession ? 'true' : 'false');
    form.append('isOfflineSync', isOfflineSync ? 'true' : 'false');

    console.log(`[Screenshot Service] Uploading screenshot to server...`);
    const endpoint = isOfflineSync ? '/screenshot/sync' : '/screenshot/upload';
    
    const response = await api.post(endpoint, form, {
      headers: {
        ...form.getHeaders(),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (response.data && response.data.success) {
      console.log(`[Screenshot Service] Upload succeeded (${response.data.screenshotId}). Cleaning pending queue file.`);
      fs.unlinkSync(filePath);
      return true;
    } else {
      console.warn(`[Screenshot Service] Server response indicated failure:`, response.data);
      return false;
    }
  } catch (error) {
    console.warn(`[Screenshot Service] Upload failed (offline/error): ${error.message}. Retaining pending queue file.`);
    return false;
  }
}

/**
 * Fetch remote screenshot configuration (interval, enabled status)
 */
async function fetchConfig() {
  try {
    const token = getStoredToken();
    const api = createApiClient(token);
    const response = await api.get('/screenshot/config');
    if (response.data && response.data.config) {
      return response.data.config;
    }
  } catch (error) {
    console.warn('[Screenshot Service] Fetch config error, using defaults:', error.message);
  }
  return {
    intervalMinutes: 30,
    captureOnClockIn: true,
    isEnabled: true
  };
}

/**
 * Triggered on successful clock-in:
 * 1. Takes immediate 0th-minute screenshot #1
 * 2. Starts 30-minute repeating timer for screenshots #2, #3, #4...
 */
async function onClockInSuccess(attendanceId) {
  onClockOut(); // Clear any pre-existing timer
  currentAttendanceId = attendanceId;

  const ssConfig = await fetchConfig();
  if (!ssConfig.isEnabled) {
    console.log('[Screenshot Service] Screenshot monitoring is globally disabled by Admin.');
    return;
  }

  // 1. Immediate Capture (0th minute - First of Session)
  if (ssConfig.captureOnClockIn) {
    console.log('[Screenshot Service] Clock-in triggered: Taking immediate 0th-minute screenshot #1...');
    const result = await captureAndQueue(attendanceId, true);
    if (result) {
      await tryUploadOrQueue(result.filePath, attendanceId, true, false);
    }
  }

  // 2. Start repeating 30-minute interval timer for subsequent captures
  const intervalMs = (ssConfig.intervalMinutes || 30) * 60 * 1000;
  console.log(`[Screenshot Service] Starting repeating timer: Every ${ssConfig.intervalMinutes || 30} minutes.`);

  screenshotTimer = setInterval(async () => {
    if (!currentAttendanceId) return;
    const result = await captureAndQueue(currentAttendanceId, false);
    if (result) {
      await tryUploadOrQueue(result.filePath, currentAttendanceId, false, false);
    }
  }, intervalMs);
}

/**
 * Triggered on Clock-Out or Shutdown
 */
function onClockOut() {
  if (screenshotTimer) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
  currentAttendanceId = null;
  console.log('[Screenshot Service] Screenshot capture timer stopped.');
}

/**
 * Background retry worker loop for offline-queued screenshots (runs every 1 minute)
 */
function startOfflineScreenshotRetryWorker() {
  setInterval(async () => {
    try {
      const pendingDir = getPendingDir();
      if (!fs.existsSync(pendingDir)) return;

      const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
      if (files.length === 0) return;

      console.log(`[Screenshot Service Worker] Found ${files.length} pending local screenshot(s). Retrying sync...`);

      for (const file of files) {
        const filePath = path.join(pendingDir, file);
        const attendanceId = file.split('_')[0];
        const isFirst = file.includes('0min');

        const success = await tryUploadOrQueue(filePath, attendanceId, isFirst, true);
        if (!success) {
          break; // Stop loop if network is still offline to avoid spamming
        }
      }
    } catch (err) {
      console.error('[Screenshot Service Worker] Retry loop error:', err.message);
    }
  }, 60 * 1000); // 1 minute retry interval
}

module.exports = {
  onClockInSuccess,
  onClockOut,
  captureAndQueue,
  startOfflineScreenshotRetryWorker
};
