const fs = require('fs');
const path = require('path');

// Define logs directory and file path
const logsDir = path.join(__dirname, '../logs');
const logFilePath = path.join(logsDir, 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Appends a log line to logs/app.log
 * @param {string} level - Log severity (INFO, WARN, ERROR)
 * @param {string} message - The logged message
 */
const writeToFile = (level, message) => {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (error) {
    // Fail-safe fall back to standard error if file operations fail
    process.stderr.write(`⚠️ Logging to file failed: ${error.message}\n`);
  }
};

// Capture original console operations
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Helper to format arguments into a single string
const formatArgs = (args) => {
  return args.map(arg => {
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }
    return typeof arg === 'object' ? JSON.stringify(arg) : arg;
  }).join(' ');
};

// Override console methods to write to logs/app.log as well
console.log = (...args) => {
  originalLog.apply(console, args);
  writeToFile('INFO', formatArgs(args));
};

console.error = (...args) => {
  originalError.apply(console, args);
  writeToFile('ERROR', formatArgs(args));
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  writeToFile('WARN', formatArgs(args));
};

console.log("📝 Console logger mirroring output to logs/app.log");

module.exports = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
  warn: (message) => console.warn(message)
};
