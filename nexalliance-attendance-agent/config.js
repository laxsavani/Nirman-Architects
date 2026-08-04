const path = require('path');
const os = require('os');

const USER_DATA_PATH = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const STORAGE_DIR = path.join(USER_DATA_PATH, 'NexAllianceAttendanceAgent');

module.exports = {
  APP_NAME: 'NexAlliance Attendance Agent',
  APP_VERSION: '1.0.0',
  FRONTEND_URL: 'https://nirman-architects.vercel.app/',
  API_BASE_URL: process.env.API_URL || 'https://nirman-architects.onrender.com/api/',
  HEARTBEAT_INTERVAL_MS: 30 * 1000, // 30 seconds per PRD
  SYNC_INTERVAL_MS: 60 * 1000,      // 60 seconds offline queue check
  IDLE_THRESHOLD_SECONDS: 300,       // 5 minutes idle check
  STORAGE_DIR,
  LOGS_DIR: path.join(STORAGE_DIR, 'logs'),
  LOG_FILE_PATH: path.join(STORAGE_DIR, 'logs', 'agent.log'),
  TOKEN_FILE_PATH: path.join(STORAGE_DIR, 'token.json'),
  QUEUE_FILE_PATH: path.join(STORAGE_DIR, 'queue.json'),
  CONFIG_FILE_PATH: path.join(STORAGE_DIR, 'agent_config.json')
};
