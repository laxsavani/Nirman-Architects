const { powerMonitor } = require('electron');
const config = require('../config');

let idleTimer = null;

/**
 * Checks system idle time every 10 seconds
 */
function startIdleMonitoring(onIdleStateChange) {
  stopIdleMonitoring();

  let isCurrentlyIdle = false;

  idleTimer = setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    if (idleSeconds >= config.IDLE_THRESHOLD_SECONDS && !isCurrentlyIdle) {
      isCurrentlyIdle = true;
      console.log(`[Idle] User idle detected (${idleSeconds}s >= ${config.IDLE_THRESHOLD_SECONDS}s).`);
      if (onIdleStateChange) onIdleStateChange(true, idleSeconds);
    } else if (idleSeconds < config.IDLE_THRESHOLD_SECONDS && isCurrentlyIdle) {
      isCurrentlyIdle = false;
      console.log(`[Idle] User active again (${idleSeconds}s).`);
      if (onIdleStateChange) onIdleStateChange(false, idleSeconds);
    }
  }, 10000);

  console.log('[Idle] System idle monitoring started.');
}

function stopIdleMonitoring() {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}

module.exports = {
  startIdleMonitoring,
  stopIdleMonitoring
};
