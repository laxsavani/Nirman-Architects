const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const config = require('./config');
const { isAuthenticated, logout } = require('./services/auth');
const { syncOfflineQueue, clockIn, clockOut } = require('./services/attendance');

const fs = require('fs');

let trayInstance = null;

/**
 * Creates default 16x16 tray icon image in native format using assets/logo.png
 */
function createDefaultIcon() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'logo.png');
  try {
    if (fs.existsSync(icoPath)) {
      const img = nativeImage.createFromPath(icoPath);
      if (!img.isEmpty()) return img;
    }
    if (fs.existsSync(pngPath)) {
      const img = nativeImage.createFromPath(pngPath);
      if (!img.isEmpty()) return img;
    }
  } catch (e) {
    console.error('[Tray] Failed to load logo icon:', e);
  }
  return nativeImage.createEmpty();
}

/**
 * Initializes System Tray
 */
function initTray(appWindow, onLogoutCallback) {
  const icon = createDefaultIcon();
  trayInstance = new Tray(icon);
  trayInstance.setToolTip(config.APP_NAME);

  updateTrayMenu('Online', appWindow, onLogoutCallback);
  console.log('[Tray] System tray initialized.');
  return trayInstance;
}

/**
 * Updates tray context menu
 */
function updateTrayMenu(statusText = 'Online', appWindow = null, onLogoutCallback = null) {
  if (!trayInstance) return;

  const authed = isAuthenticated();

  const contextMenu = Menu.buildFromTemplate([
    { label: `${config.APP_NAME} v${config.APP_VERSION}`, enabled: false },
    { label: `Status: ${statusText}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Manual Sync Offline Logs',
      click: async () => {
        console.log('[Tray] Manual Sync requested by user.');
        await syncOfflineQueue();
      }
    },
    {
      label: 'Force Clock-In',
      click: async () => {
        console.log('[Tray] Manual Clock-In requested by user.');
        await clockIn();
      }
    },
    {
      label: 'Force Clock-Out',
      click: async () => {
        console.log('[Tray] Manual Clock-Out requested by user.');
        await clockOut('Manual Tray Trigger');
      }
    },
    { type: 'separator' },
    authed ? {
      label: 'Logout Agent',
      click: () => {
        try {
          const { stopAppUsageTracking } = require('./services/appUsageTracker');
          const { getStoredTokenData } = require('./services/api');
          const tokenData = getStoredTokenData();
          if (tokenData && tokenData.user) stopAppUsageTracking(tokenData.user, null);
        } catch (e) {}
        logout();
        if (onLogoutCallback) onLogoutCallback();
        updateTrayMenu('Logged Out', appWindow, onLogoutCallback);
      }
    } : {
      label: 'Login Agent',
      click: () => {
        if (appWindow) {
          appWindow.show();
          appWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Agent',
      click: async () => {
        console.log('[Tray] Quit Agent clicked by user. Sending clock-out & admin alert...');
        try {
          const { stopAppUsageTracking } = require('./services/appUsageTracker');
          const { getStoredTokenData } = require('./services/api');
          const tokenData = getStoredTokenData();
          if (tokenData && tokenData.user) await stopAppUsageTracking(tokenData.user, null);
          await clockOut('Agent Quit from System Tray');
        } catch (e) {
          // ignore error on quit
        }
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  trayInstance.setContextMenu(contextMenu);
}

module.exports = {
  initTray,
  updateTrayMenu
};
