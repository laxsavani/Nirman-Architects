const { createApiClient, getStoredToken } = require('./api');
const { getDeviceId } = require('./device');
const config = require('../config');

let heartbeatTimer = null;

/**
 * Sends a single 30-second heartbeat ping to backend
 */
async function sendHeartbeatPing() {
  const token = getStoredToken();
  if (!token) return { success: false, reason: 'unauthenticated' };

  const deviceId = getDeviceId();
  const payload = {
    type: 'heartbeat',
    deviceId,
    currentTime: new Date().toISOString(),
    clientTime: new Date().toISOString()
  };

  try {
    const client = createApiClient(token);
    let response;
    try {
      response = await client.post('/device/heartbeat', payload);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        response = await client.post('/attendance/event', payload);
      } else {
        throw e;
      }
    }

    return { success: true, data: response.data };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn('[Heartbeat] Stored token invalid/expired (HTTP 401). Halting heartbeat loop.');
      stopHeartbeatLoop();
      return { success: false, error: 'unauthorized' };
    }
    if (error.response && error.response.status === 403) {
      console.error('[Heartbeat] Device mismatch or unauthorized. Halting heartbeat loop.');
      stopHeartbeatLoop();
      return { success: false, error: 'unauthorized_device' };
    }
    console.warn('[Heartbeat] Failed pinging backend:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Starts 30-second heartbeat loop
 */
function startHeartbeatLoop(onStatusChange = null) {
  stopHeartbeatLoop();
  
  // Initial immediate ping
  sendHeartbeatPing().then(res => {
    if (onStatusChange) onStatusChange(res.success);
  });

  heartbeatTimer = setInterval(async () => {
    const res = await sendHeartbeatPing();
    if (onStatusChange) onStatusChange(res.success);
  }, config.HEARTBEAT_INTERVAL_MS);

  console.log(`[Heartbeat] Heartbeat loop started (every ${config.HEARTBEAT_INTERVAL_MS / 1000}s).`);
}

/**
 * Stops heartbeat loop
 */
function stopHeartbeatLoop() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[Heartbeat] Heartbeat loop stopped.');
  }
}

module.exports = {
  sendHeartbeatPing,
  startHeartbeatLoop,
  stopHeartbeatLoop
};
