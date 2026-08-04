const fs = require('fs');
const path = require('path');
const config = require('../config');

// Ensure log directories exist
const logsDir = config.LOGS_DIR || path.join(config.STORAGE_DIR, 'logs');
const localLogsDir = path.join(__dirname, '..', 'logs');

[logsDir, localLogsDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // ignore directory creation error
  }
});

const logFilePath = config.LOG_FILE_PATH || path.join(logsDir, 'agent.log');
const localLogFilePath = path.join(localLogsDir, 'agent.log');

/**
 * Appends formatted log entry to log file(s)
 */
function writeToFile(level, message) {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;

    [logFilePath, localLogFilePath].forEach(fp => {
      try {
        fs.appendFileSync(fp, logLine, 'utf8');
      } catch (e) {
        // Fallback
      }
    });
  } catch (error) {
    process.stderr.write(`[Logger Error] Failed to write log: ${error.message}\n`);
  }
}

// Override console methods to mirror all outputs to log files
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function formatArgs(args) {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack || ''}`;
    }
    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
  }).join(' ');
}

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

// Global unhandled error handlers
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

console.log(`📝 Agent logger initialized. Logs writing to: ${logFilePath}`);

module.exports = {
  logFilePath,
  localLogFilePath,
  writeToFile
};
