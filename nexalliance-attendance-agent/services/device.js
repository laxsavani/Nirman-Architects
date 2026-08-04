const { machineIdSync } = require('node-machine-id');
const { execSync } = require('child_process');
const os = require('os');
const si = require('systeminformation');
const { createApiClient, getStoredToken } = require('./api');

let cachedDeviceId = null;

/**
 * Gets unique hardware MachineGuid identifier (raw Windows GUID format).
 */
function getDeviceId() {
  if (!cachedDeviceId) {
    try {
      // original: true retrieves the raw unhashed Windows MachineGuid
      const rawId = machineIdSync({ original: true });
      if (rawId) {
        cachedDeviceId = rawId.trim().toUpperCase();
      }
    } catch (err) {
      console.warn('[Device] machineIdSync failed, querying Windows Registry directly:', err.message);
    }

    if (!cachedDeviceId) {
      try {
        const stdout = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
          encoding: 'utf8'
        });
        const match = stdout.match(/MachineGuid\s+REG_SZ\s+([A-Fa-f0-9-]+)/);
        if (match && match[1]) {
          cachedDeviceId = match[1].trim().toUpperCase();
        }
      } catch (regErr) {
        console.error('[Device] Registry query failed:', regErr.message);
      }
    }

    if (!cachedDeviceId) {
      cachedDeviceId = `MACHINE-${os.hostname()}-${os.arch()}`.toUpperCase();
    }
  }
  return cachedDeviceId;
}

/**
 * Ensures the current hardware device ID is registered with the backend.
 */
async function ensureDeviceRegistered() {
  const token = getStoredToken();
  if (!token) return { success: false, message: 'unauthenticated' };

  const deviceId = getDeviceId();
  try {
    const client = createApiClient(token);
    const response = await client.post('/device/register', { deviceId });
    console.log('[Device] Device registration status:', response.data?.data?.status || 'APPROVED');
    return { success: true, data: response.data };
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.warn('[Device] Device registration failed: Stored token is invalid or expired (HTTP 401).');
      return { success: false, message: 'unauthorized' };
    }
    console.warn('[Device] Device registration call warning:', err.response?.data?.message || err.message);
    return { success: false, message: err.response?.data?.message || err.message };
  }
}

/**
 * Gets local IPv4 address
 */
function getIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Gets MAC address of primary network interface
 */
async function getMacAddress() {
  try {
    const netInterfaces = await si.networkInterfaceDefault();
    const interfaces = await si.networkInterfaces();
    const primary = interfaces.find(item => item.iface === netInterfaces);
    if (primary && primary.mac) {
      return primary.mac;
    }
    const interfacesList = os.networkInterfaces();
    for (const key in interfacesList) {
      for (const details of interfacesList[key]) {
        if (details.mac && details.mac !== '00:00:00:00:00:00' && !details.internal) {
          return details.mac;
        }
      }
    }
  } catch (err) {
    console.warn('[Device] Error retrieving MAC address:', err.message);
  }
  return '00:00:00:00:00:00';
}

/**
 * Collects complete device telemetry
 */
async function getDeviceDetails() {
  const mac = await getMacAddress();
  return {
    deviceId: getDeviceId(),
    computerName: os.hostname(),
    winUsername: os.userInfo().username,
    osPlatform: os.platform(),
    osRelease: os.release(),
    ip: getIpAddress(),
    macAddress: mac
  };
}

module.exports = {
  getDeviceId,
  ensureDeviceRegistered,
  getIpAddress,
  getMacAddress,
  getDeviceDetails
};
