const fs = require('fs');
const path = require('path');

/**
 * Returns top-level storage root directory from environment or default.
 */
function getStorageRoot() {
  const root = process.env.STORAGE_ROOT || path.join(__dirname, '..', 'storage');
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

/**
 * Safely resolves a relative or absolute file path against the top-level storage root.
 * Prevents Path Traversal / File Inclusion attacks by verifying the target path stays strictly inside /storage.
 */
function safeResolvePath(userPath) {
  if (!userPath || typeof userPath !== 'string') return null;

  const root = path.resolve(getStorageRoot());
  const resolved = path.isAbsolute(userPath)
    ? path.resolve(userPath)
    : path.resolve(path.join(__dirname, '..', userPath));

  const normalizedRoot = root.toLowerCase();
  const normalizedResolved = resolved.toLowerCase();

  if (normalizedResolved.startsWith(normalizedRoot)) {
    return resolved;
  }

  console.warn(`[Security Alert] Blocked potential path traversal attempt: ${userPath}`);
  return null;
}

/**
 * Helper to sanitize user name into URL/folder-safe slug e.g. "Lax Savani" -> "Lax-Savani"
 */
function sanitizeNameForPath(name, fallbackId) {
  if (!name || typeof name !== 'string') return String(fallbackId || 'User');
  const clean = name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
  return clean || String(fallbackId || 'User');
}

/**
 * Resolves + creates /storage/offer_letters/<userId>/ if needed.
 * Returns full file path: offer_letter_<userId>_<timestamp>.pdf
 */
function getOfferLetterPath(userId, timestamp = Date.now()) {
  const root = getStorageRoot();
  const safeUserId = String(userId || 'User').replace(/[^a-zA-Z0-9_-]/g, '');
  const userOfferDir = path.join(root, 'offer_letters', safeUserId);
  if (!fs.existsSync(userOfferDir)) {
    fs.mkdirSync(userOfferDir, { recursive: true });
  }
  const fileName = `offer_letter_${safeUserId}_${timestamp}.pdf`;
  return {
    dirPath: userOfferDir,
    fileName,
    fullPath: path.join(userOfferDir, fileName),
    relativePath: path.join('storage', 'offer_letters', safeUserId, fileName).replace(/\\/g, '/')
  };
}

/**
 * Resolves + creates /storage/salary/<userId>/<year>/ if needed.
 * Returns full file path: payslip_<userId>_<month>_<year>.pdf
 */
function getSalarySlipPath(userId, month, year) {
  const root = getStorageRoot();
  const safeUserId = String(userId || 'User').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeYear = String(year || '2026').replace(/[^0-9]/g, '');
  const safeMonth = String(month || '1').replace(/[^0-9]/g, '');

  const userSalaryDir = path.join(root, 'salary', safeUserId, safeYear);
  if (!fs.existsSync(userSalaryDir)) {
    fs.mkdirSync(userSalaryDir, { recursive: true });
  }
  const fileName = `payslip_${safeUserId}_${safeMonth}_${safeYear}.pdf`;
  return {
    dirPath: userSalaryDir,
    fileName,
    fullPath: path.join(userSalaryDir, fileName),
    relativePath: path.join('storage', 'salary', safeUserId, safeYear, fileName).replace(/\\/g, '/')
  };
}

/**
 * Resolves + creates /storage/screenshots/<Formatted-User-Name>/<MM>/<DD>/ if needed.
 * Example: screenshots/Bhakti-Kadam/07/28/12:00.png
 */
function getScreenshotPath(userId, userName, dateObj = new Date(), customTimeStr = null, ext = 'png') {
  const root = getStorageRoot();
  const folderName = sanitizeNameForPath(userName, userId);

  const d = dateObj instanceof Date && !isNaN(dateObj.getTime()) ? dateObj : new Date();
  const timeZone = 'Asia/Kolkata';

  const monthStr = new Intl.DateTimeFormat('en-GB', { timeZone, month: '2-digit' }).format(d);
  const dayStr = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit' }).format(d);

  // 12-Hour format with AM/PM e.g. "12:32-PM"
  const raw12HrTime = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);

  const formatted12HrTime = raw12HrTime.replace(/\s+/g, '-').toUpperCase();
  const timeName = customTimeStr || formatted12HrTime;
  const fileSafeTimeName = timeName.replace(/:/g, '-');

  const screenshotDir = path.join(root, 'screenshots', folderName, monthStr, dayStr);
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const fileName = `${fileSafeTimeName}.${ext}`;
  const relativePath = path.join('storage', 'screenshots', folderName, monthStr, dayStr, fileName).replace(/\\/g, '/');
  const cloudinaryFolder = `Nirmane-Architects/screenshots/${folderName}/${monthStr}/${dayStr}`;
  const cloudinaryPublicId = `${cloudinaryFolder}/${timeName}`;

  return {
    dirPath: screenshotDir,
    fileName,
    fullPath: path.join(screenshotDir, fileName),
    relativePath,
    cloudinaryFolder,
    cloudinaryPublicId,
    folderName,
    monthStr,
    dayStr,
    timeName
  };
}

/**
 * Resolves + creates /storage/reports/<reportType>/ if needed.
 * Returns full file path: <reportType>_<scope>_<timestamp>.<ext>
 */
function getReportPath(reportType = 'GENERAL', format = 'PDF', timestamp = Date.now(), scopeName = 'Report') {
  const root = getStorageRoot();
  const safeType = String(reportType).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const safeScope = String(scopeName).replace(/[^a-zA-Z0-9_-]/g, '');
  let ext = 'pdf';
  if (String(format).toUpperCase() === 'EXCEL') ext = 'xlsx';
  if (String(format).toUpperCase() === 'CSV') ext = 'csv';

  const reportDir = path.join(root, 'reports', safeType);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const fileName = `${safeType}_${safeScope}_${timestamp}.${ext}`;
  const relativePath = path.join('storage', 'reports', safeType, fileName).replace(/\\/g, '/');

  return {
    dirPath: reportDir,
    fileName,
    fullPath: path.join(reportDir, fileName),
    relativePath
  };
}

module.exports = {
  getStorageRoot,
  getOfferLetterPath,
  getSalarySlipPath,
  getScreenshotPath,
  getReportPath,
  sanitizeNameForPath,
  safeResolvePath
};
