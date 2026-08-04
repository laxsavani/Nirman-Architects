const AutoLaunch = require('auto-launch');
const config = require('../config');

const agentAutoLauncher = new AutoLaunch({
  name: config.APP_NAME,
  path: process.execPath,
  isHidden: true
});

/**
 * Enables auto-launch on Windows startup
 */
async function enableAutoLaunch() {
  try {
    const isEnabled = await agentAutoLauncher.isEnabled();
    if (!isEnabled) {
      await agentAutoLauncher.enable();
      console.log('[Startup] Auto-launch enabled on Windows startup.');
    } else {
      console.log('[Startup] Auto-launch is already enabled.');
    }
  } catch (err) {
    console.error('[Startup] Failed to enable auto-launch:', err.message);
  }
}

/**
 * Disables auto-launch
 */
async function disableAutoLaunch() {
  try {
    const isEnabled = await agentAutoLauncher.isEnabled();
    if (isEnabled) {
      await agentAutoLauncher.disable();
      console.log('[Startup] Auto-launch disabled.');
    }
  } catch (err) {
    console.error('[Startup] Failed to disable auto-launch:', err.message);
  }
}

module.exports = {
  enableAutoLaunch,
  disableAutoLaunch
};
