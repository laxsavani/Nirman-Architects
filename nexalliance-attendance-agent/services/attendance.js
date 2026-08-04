const { createApiClient, getStoredToken } = require('./api');
const { getDeviceDetails } = require('./device');
const queue = require('../storage/queue');

/**
 * Triggers Clock-In API call
 */
async function clockIn() {
  const token = getStoredToken();
  if (!token) {
    console.warn('[Attendance] Cannot clock in: User is not authenticated.');
    return { success: false, reason: 'unauthenticated' };
  }

  const deviceDetails = await getDeviceDetails();
  const payload = {
    type: 'clock_in',
    clientTime: new Date().toISOString(),
    ...deviceDetails
  };

  try {
    const client = createApiClient(token);
    let response;
    try {
      response = await client.post('/attendance/clock-in', payload);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        response = await client.post('/attendance/event', payload);
      } else {
        throw e;
      }
    }

    console.log('[Attendance] Clock-In recorded on server successfully.');
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn('[Attendance] Clock-In rejected: Invalid or expired token (HTTP 401).');
      return { success: false, error: 'unauthorized', message: 'Token expired or invalid.' };
    }
    if (error.response && error.response.status === 403) {
      console.error('[Attendance] Clock-in rejected: Device mismatch or unauthorized.');
      return { success: false, error: 'device_mismatch', message: error.response.data?.message };
    }

    console.warn('[Attendance] Network error on Clock-In. Enqueueing offline event.');
    queue.enqueue(payload);
    return { success: false, offline: true, message: 'Queued offline.' };
  }
}

/**
 * Triggers Clock-Out API call
 */
async function clockOut(reason = 'Normal Shutdown') {
  const token = getStoredToken();
  if (!token) {
    console.warn('[Attendance] Cannot clock out: User is not authenticated.');
    return { success: false, reason: 'unauthenticated' };
  }

  const deviceDetails = await getDeviceDetails();
  const payload = {
    type: 'clock_out',
    logoutTime: new Date().toISOString(),
    clientTime: new Date().toISOString(),
    reason,
    ...deviceDetails
  };

  try {
    const client = createApiClient(token);
    let response;
    try {
      response = await client.post('/attendance/clock-out', payload);
    } catch (e) {
      if (e.response && e.response.status === 404) {
        response = await client.post('/attendance/event', payload);
      } else {
        throw e;
      }
    }

    console.log('[Attendance] Clock-Out recorded on server successfully.');
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.warn('[Attendance] Clock-Out rejected: Invalid or expired token (HTTP 401).');
      return { success: false, error: 'unauthorized', message: 'Token expired or invalid.' };
    }
    if (error.response && error.response.status === 403) {
      console.error('[Attendance] Clock-Out rejected: Device mismatch or unauthorized.');
      return { success: false, error: 'unauthorized', message: error.response.data?.message };
    }

    console.warn('[Attendance] Network error on Clock-Out. Enqueueing offline event.');
    queue.enqueue(payload);
    return { success: false, offline: true, message: 'Queued offline.' };
  }
}

/**
 * Fetches today's active attendance session for the logged-in user
 */
async function getActiveAttendance() {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const client = createApiClient(token);
    const response = await client.get('/attendance/today');
    if (response.data) {
      const d = response.data.data || response.data.attendance || response.data;
      if (d && d._id && !d.clockOutTime) {
        return d;
      }
    }
  } catch (err) {
    console.warn('[Attendance] Error fetching today active attendance:', err.message);
  }
  return null;
}

/**
 * Syncs any pending offline queued events to the backend
 */
async function syncOfflineQueue() {
  const token = getStoredToken();
  if (!token) return;

  const queuedItems = queue.getQueue();
  if (queuedItems.length === 0) return;

  console.log(`[Sync] Found ${queuedItems.length} queued offline attendance events. Attempting sync...`);
  const client = createApiClient(token);
  const syncedIds = [];

  for (const item of queuedItems) {
    try {
      await client.post('/attendance/sync', item.payload);
      syncedIds.push(item.id);
      console.log(`[Sync] Successfully synced offline item ${item.id}`);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.warn('[Sync] Stopping sync: Stored token is invalid or expired (HTTP 401).');
        break;
      }
      console.warn(`[Sync] Failed to sync offline item ${item.id}:`, err.message);
      break; // Stop loop if server connection fails again
    }
  }

  if (syncedIds.length > 0) {
    queue.removeFromQueue(syncedIds);
  }
}

module.exports = {
  clockIn,
  clockOut,
  getActiveAttendance,
  syncOfflineQueue
};
