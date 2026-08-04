const { powerMonitor } = require('electron');
const { clockOut } = require('../services/attendance');
const { stopHeartbeatLoop, startHeartbeatLoop } = require('../services/heartbeat');

/**
 * Registers OS shutdown and state listeners
 */
function initShutdownHandler(onStatusUpdate = null) {
  // 1. Windows Shutdown Event
  powerMonitor.on('shutdown', async () => {
    console.log('[System] Windows shutdown signal detected!');
    stopHeartbeatLoop();
    await clockOut('Windows Shutdown');
  });

  // 2. Lock Screen Event
  powerMonitor.on('lock-screen', () => {
    console.log('[System] Workstation screen locked.');
    if (onStatusUpdate) onStatusUpdate('locked');
  });

  // 3. Unlock Screen Event
  powerMonitor.on('unlock-screen', () => {
    console.log('[System] Workstation screen unlocked.');
    if (onStatusUpdate) onStatusUpdate('unlocked');
  });

  // 4. System Suspend / Sleep Event
  powerMonitor.on('suspend', async () => {
    console.log('[System] System going to sleep/suspend.');
    stopHeartbeatLoop();
    await clockOut('System Sleep / Suspend');
  });

  // 5. System Resume Event
  powerMonitor.on('resume', async () => {
    console.log('[System] System resumed from sleep/suspend.');
    const { clockIn } = require('../services/attendance');
    await clockIn();
    startHeartbeatLoop();
  });

  console.log('[System] Power and Shutdown event listeners initialized.');
}

module.exports = {
  initShutdownHandler
};
