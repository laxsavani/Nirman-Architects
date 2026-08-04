const fs = require('fs');
const path = require('path');

/**
 * Checks if backend is running on Render cloud environment.
 */
function isRenderEnvironment() {
  return process.env.RENDER === 'true' || process.env.IS_RENDER === 'true';
}

/**
 * Ensures directory exists, creating parent and child folders if missing.
 */
function ensureDirectoryExists(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (err) {
    console.warn(`[Storage] Directory creation warning for ${dirPath}:`, err.message);
  }
  return dirPath;
}

/**
 * Returns path to storage/salary/ directory, creating it automatically if missing.
 */
function getSalaryStorageDir() {
  const dirPath = path.join(__dirname, '..', 'storage', 'salary');
  return ensureDirectoryExists(dirPath);
}

/**
 * Returns path to storage/letter/ directory, creating it automatically if missing.
 */
function getLetterStorageDir() {
  const dirPath = path.join(__dirname, '..', 'storage', 'letter');
  return ensureDirectoryExists(dirPath);
}

module.exports = {
  isRenderEnvironment,
  ensureDirectoryExists,
  getSalaryStorageDir,
  getLetterStorageDir
};
