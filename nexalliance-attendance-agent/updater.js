const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

function initAutoUpdater() {
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';

  autoUpdater.on('checking-for-update', () => {
    log.info('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[Updater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] Up to date.');
  });

  autoUpdater.on('error', (err) => {
    log.info('[Updater] Auto-updater notice:', err.message || err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[Updater] Update downloaded. Will install on quit.');
    autoUpdater.quitAndInstall();
  });

  // Only check for updates if app is packaged and app-update.yml configuration exists
  const appUpdateConfigPath = path.join(process.resourcesPath || '', 'app-update.yml');
  if (app.isPackaged && fs.existsSync(appUpdateConfigPath)) {
    try {
      autoUpdater.checkForUpdatesAndNotify().catch(err => {
        log.info('[Updater] Auto-update skipped:', err.message);
      });
    } catch (err) {
      log.info('[Updater] Check for updates skipped:', err.message);
    }
  } else {
    log.info('[Updater] Skipping auto-updater: dev mode or app-update.yml not present.');
  }
}

module.exports = {
  initAutoUpdater
};
