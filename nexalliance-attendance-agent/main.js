const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
require('./utils/logger');
const { isAuthenticated, login, logout } = require('./services/auth');
const { getDeviceId, getDeviceDetails, ensureDeviceRegistered } = require('./services/device');
const { clockIn, clockOut, getActiveAttendance, syncOfflineQueue } = require('./services/attendance');
const { startHeartbeatLoop, stopHeartbeatLoop } = require('./services/heartbeat');
const { onClockInSuccess, onClockOut, startOfflineScreenshotRetryWorker } = require('./services/screenshot');
const { isMonitoringApplicable } = require('./services/roleGate');
const { startAppUsageTracking, stopAppUsageTracking } = require('./services/appUsageTracker');
const { getStoredTokenData, setOnUnauthorizedHandler } = require('./services/api');
const { enableAutoLaunch } = require('./system/startup');
const { initShutdownHandler } = require('./system/shutdown');
const { startIdleMonitoring } = require('./system/idle');
const { initTray, updateTrayMenu } = require('./tray');
const { initAutoUpdater } = require('./updater');

// Enforce single app instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Main] Another instance of NexAlliance Attendance Agent is already running. Exiting.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let syncTimer = null;

function createLoginWindow() {
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const hasLogo = fs.existsSync(logoPath);
  const windowIconPath = fs.existsSync(icoPath) ? icoPath : (hasLogo ? logoPath : undefined);
  
  let logoContent = `
    <svg viewBox="0 0 24 24">
      <path d="M3 21h18M3 7v14M21 7v14M6 21V11m4 10V11m4 10V11m4 10V11M12 3l9 4H3l9-4z" />
    </svg>
  `;
  if (hasLogo) {
    try {
      const logoBase64 = fs.readFileSync(logoPath).toString('base64');
      logoContent = `<img src="data:image/png;base64,${logoBase64}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 10px;" />`;
    } catch (e) {
      console.error('[Main] Failed to read assets/logo.png:', e);
    }
  }

  mainWindow = new BrowserWindow({
    width: 460,
    height: 600,
    resizable: false,
    show: false,
    title: config.APP_NAME,
    icon: windowIconPath,
    autoHideMenuBar: true,
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const loginHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.APP_NAME} - Login</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
      
      body {
        min-height: 100vh;
        background: #090d16;
        color: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow: hidden;
        position: relative;
      }

      /* Ambient 3D Glowing Mesh Background */
      .bg-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(90px);
        opacity: 0.4;
        pointer-events: none;
      }
      .bg-glow-1 {
        width: 300px;
        height: 300px;
        background: #0284c7;
        top: -80px;
        left: -60px;
      }
      .bg-glow-2 {
        width: 280px;
        height: 280px;
        background: #6366f1;
        bottom: -70px;
        right: -50px;
      }

      /* Premium Dark Glass Card */
      .glass-card {
        width: 100%;
        max-width: 380px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        padding: 34px 28px 28px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        position: relative;
        z-index: 10;
        text-align: center;
      }

      /* Header Logo & Branding */
      .brand-header {
        margin-bottom: 24px;
      }

      .logo-icon-wrapper {
        width: 56px;
        height: 56px;
        margin: 0 auto 12px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%);
        border: 1px solid rgba(56, 189, 248, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 20px rgba(2, 132, 199, 0.3);
      }

      .logo-icon-wrapper svg {
        width: 30px;
        height: 30px;
        fill: none;
        stroke: #38bdf8;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .brand-name {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 4px;
      }

      .brand-sub {
        font-size: 12px;
        font-weight: 500;
        color: #94a3b8;
      }

      /* Input Form Controls */
      .form-group {
        margin-bottom: 18px;
        text-align: left;
      }

      .form-group label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #cbd5e1;
        margin-bottom: 6px;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-wrapper .field-icon {
        position: absolute;
        left: 14px;
        width: 18px;
        height: 18px;
        stroke: #64748b;
        fill: none;
        stroke-width: 2;
        transition: stroke 0.2s;
      }

      .input-wrapper input {
        width: 100%;
        height: 44px;
        padding: 0 40px 0 42px;
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(51, 65, 85, 0.8);
        border-radius: 12px;
        color: #f8fafc;
        font-size: 13.5px;
        font-weight: 500;
        outline: none;
        transition: all 0.2s ease;
      }

      .input-wrapper input::placeholder {
        color: #64748b;
      }

      .input-wrapper input:focus {
        border-color: #38bdf8;
        background: rgba(15, 23, 42, 0.9);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
      }

      .input-wrapper input:focus + .field-icon {
        stroke: #38bdf8;
      }

      /* Eye Password Toggle Button */
      .pwd-toggle-btn {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        transition: color 0.2s;
      }

      .pwd-toggle-btn:hover {
        color: #38bdf8;
      }

      .pwd-toggle-btn svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
      }

      /* Submit Button */
      .btn-submit {
        width: 100%;
        height: 46px;
        margin-top: 8px;
        background: linear-gradient(135deg, #0284c7 0%, #3b82f6 50%, #6366f1 100%);
        border: none;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 8px 22px -4px rgba(2, 132, 199, 0.45);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .btn-submit:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 28px -4px rgba(2, 132, 199, 0.6);
      }

      .btn-submit:active {
        transform: translateY(0);
      }

      .btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      /* Alert Error Message */
      .alert-error {
        display: none;
        margin-top: 14px;
        padding: 10px 12px;
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 10px;
        color: #fca5a5;
        font-size: 12px;
        text-align: left;
      }

      /* Device ID Footer Badge */
      .hw-badge {
        margin-top: 22px;
        padding: 10px 12px;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .hw-left {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
      }

      .hw-badge svg {
        width: 16px;
        height: 16px;
        stroke: #38bdf8;
        fill: none;
        stroke-width: 2;
        flex-shrink: 0;
      }

      .hw-text {
        font-size: 11px;
        font-family: monospace;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .copy-btn {
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: color 0.2s;
        display: flex;
        align-items: center;
      }

      .copy-btn:hover {
        color: #38bdf8;
      }

      .copy-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
      }
    </style>
  </head>
  <body>
    <div class="bg-glow bg-glow-1"></div>
    <div class="bg-glow bg-glow-2"></div>

    <div class="glass-card">
      <div class="brand-header">
        <div class="logo-icon-wrapper">
          ${logoContent}
        </div>
        <h1 class="brand-name">NIRMAN ARCHITECTS</h1>
        <p class="brand-sub">Attendance & Workstation Sync Agent</p>
      </div>

      <form id="loginForm" onsubmit="return false;">
        <div class="form-group">
          <label for="email">Employee Email</label>
          <div class="input-wrapper">
            <input type="email" id="email" placeholder="name@nirman.com" autocomplete="username" required />
            <svg class="field-icon" viewBox="0 0 24 24">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <path d="M22 6l-10 7L2 6"/>
            </svg>
          </div>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <div class="input-wrapper">
            <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" required />
            <svg class="field-icon" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <button type="button" id="togglePasswordBtn" class="pwd-toggle-btn" title="Toggle Password Visibility">
              <svg id="eyeIcon" viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit" id="loginBtn" class="btn-submit">
          <span>Sign In & Connect PC</span>
          <svg style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;" viewBox="0 0 24 24">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </form>

      <div id="errorMsg" class="alert-error"></div>

      <div class="hw-badge">
        <div class="hw-left">
          <svg viewBox="0 0 24 24">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <span id="devId" class="hw-text">Detecting...</span>
        </div>
        <button type="button" id="copyDevBtn" class="copy-btn" title="Copy Machine ID">
          <svg viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>

    <script>
      let currentDevId = '';
      window.agentAPI.getStatus().then(res => {
        currentDevId = res.deviceId || 'Detecting...';
        document.getElementById('devId').innerText = currentDevId;
      });

      document.getElementById('copyDevBtn').addEventListener('click', () => {
        if (currentDevId) {
          navigator.clipboard.writeText(currentDevId);
          alert('Hardware Machine ID copied to clipboard!');
        }
      });

      const pwdInput = document.getElementById('password');
      const toggleBtn = document.getElementById('togglePasswordBtn');
      const eyeIcon = document.getElementById('eyeIcon');

      let isShowing = false;
      toggleBtn.addEventListener('click', () => {
        isShowing = !isShowing;
        pwdInput.type = isShowing ? 'text' : 'password';
        eyeIcon.innerHTML = isShowing 
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      });

      document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value.trim();
        const errDiv = document.getElementById('errorMsg');
        const loginBtn = document.getElementById('loginBtn');
        errDiv.style.display = 'none';

        if (!email || !password) {
          errDiv.innerText = 'Please enter both email and password.';
          errDiv.style.display = 'block';
          return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>Connecting to Live Server...</span>';

        try {
          const res = await window.agentAPI.login({ email, password });
          if (res.success) {
            alert('Login successful! Agent is active in background system tray.');
          } else {
            errDiv.innerHTML = '<div>' + (res.message || 'Login failed. Please check credentials.') + '</div><div style="margin-top:6px; font-size:11px; opacity:0.85;"><a href="#" onclick="window.agentAPI.openLogs(); return false;" style="color:#38bdf8; text-decoration:underline;">📄 View Error Log (agent.log)</a></div>';
            errDiv.style.display = 'block';
          }
        } catch (e) {
          errDiv.innerHTML = '<div>Connection error: Could not reach backend server.</div><div style="margin-top:6px; font-size:11px; opacity:0.85;"><a href="#" onclick="window.agentAPI.openLogs(); return false;" style="color:#38bdf8; text-decoration:underline;">📄 View Error Log (agent.log)</a></div>';
          errDiv.style.display = 'block';
        } finally {
          loginBtn.disabled = false;
          loginBtn.innerHTML = '<span>Sign In & Connect PC</span><svg style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2;" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
      });
    </script>
  </body>
  </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loginHtml)}`);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

/**
 * Helper to extract attendance ID from clock-in response or fallback
 */
async function extractAttendanceId(res) {
  if (res && res.data) {
    const d = res.data.data || res.data;
    if (d && d._id) return String(d._id);
    if (d && d.attendance && d.attendance._id) return String(d.attendance._id);
  }
  // Fallback: Query active attendance session from server
  const activeAtt = await getActiveAttendance();
  if (activeAtt && activeAtt._id) {
    return String(activeAtt._id);
  }
  return null;
}

/**
 * Initializes and starts agent background loops
 */
async function startAgentServices() {
  console.log('===========================================================');
  console.log(`🚀 ${config.APP_NAME} v${config.APP_VERSION} starting...`);
  console.log(`🖥️ Hardware Machine ID: ${getDeviceId()}`);
  console.log('===========================================================');

  // 1. Enable Windows Auto-Launch
  await enableAutoLaunch();

  // 2. Register Shutdown / Power event listeners
  initShutdownHandler();

  // 3. Register Idle monitor
  startIdleMonitoring((isIdle, idleSeconds) => {
    console.log(`[Main] Idle status updated: idle=${isIdle} (${idleSeconds}s)`);
  });

  // 4. Register Device & Perform Clock-In if authenticated
  if (isAuthenticated()) {
    console.log('[Main] Stored token found. Registering hardware device ID...');
    const regRes = await ensureDeviceRegistered();
    if (regRes.data && regRes.data.data && regRes.data.data.status === 'PENDING') {
      console.warn(`[Main] Device ${getDeviceId()} is pending Admin approval.`);
    }

    const tokenData = getStoredTokenData();
    const currentUser = (tokenData && tokenData.user) ? tokenData.user : {};

    if (!isMonitoringApplicable(currentUser)) {
      console.log('[Main] Super Admin detected — ALL tracking modules disabled.');
      return;
    }

    console.log('[Main] Performing boot Clock-In...');
    const res = await clockIn();
    if (res.error === 'device_mismatch') {
      dialog.showErrorBox(
        'Device Authorization Error',
        `This machine (ID: ${getDeviceId()}) is not authorized for this account.\n\nIf you recently switched PCs or changed hardware, please ask HR/Admin to approve your pending device request or re-assign your Device ID.`
      );
    }

    const attendanceId = await extractAttendanceId(res);
    if (attendanceId) {
      console.log(`[Main] Active attendance session resolved: ${attendanceId}. Triggering screenshot & app usage tracking lifecycle.`);
      onClockInSuccess(attendanceId);
      startAppUsageTracking(currentUser, attendanceId);
    } else {
      console.warn('[Main] Warning: Could not resolve active attendance ID for screenshot/app-usage service.');
    }

    // 5. Start 30-second heartbeat loop
    startHeartbeatLoop((isOnline) => {
      updateTrayMenu(isOnline ? 'Online' : 'Offline / Syncing', mainWindow);
    });

    // 6. Start offline queue sync worker loop
    syncTimer = setInterval(async () => {
      await syncOfflineQueue();
    }, config.SYNC_INTERVAL_MS);

  } else {
    console.log('[Main] No stored token found. Direct showing login window...');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // 7. Check for auto updates
  initAutoUpdater();
}

/**
 * Helper to halt background loops and active tracking
 */
function stopAgentServices() {
  console.log('[Main] Stopping all tracking services & background loops...');
  stopHeartbeatLoop();
  onClockOut();
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
  try {
    const tokenData = getStoredTokenData();
    if (tokenData && tokenData.user) stopAppUsageTracking(tokenData.user, null);
  } catch (e) {}
}

// App lifecycle hooks
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nexalliance.attendanceagent');
  }

  createLoginWindow();

  // Handle unauthorized (401) signal globally
  setOnUnauthorizedHandler(() => {
    console.warn('[Main] Session expired (HTTP 401). Invalidating stored token & showing login screen.');
    stopAgentServices();
    updateTrayMenu('Logged Out', mainWindow, () => stopAgentServices());
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  initTray(mainWindow, () => {
    stopAgentServices();
  });
  
  // Start background offline screenshot upload worker
  startOfflineScreenshotRetryWorker();

  startAgentServices();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // Keep app running in system tray
});

// IPC Handlers
ipcMain.handle('agent:login', async (event, { email, password }) => {
  const result = await login(email, password);
  if (result.success) {
    if (mainWindow) mainWindow.hide();
    await ensureDeviceRegistered();
    const clockInRes = await clockIn();
    
    const tokenData = getStoredTokenData();
    const currentUser = (tokenData && tokenData.user) ? tokenData.user : {};

    if (!isMonitoringApplicable(currentUser)) {
      console.log('[Main Login] Super Admin detected — ALL tracking modules disabled.');
      return { success: true };
    }

    const attendanceId = await extractAttendanceId(clockInRes);
    if (attendanceId) {
      console.log(`[Main IPC Login] Active attendance session resolved: ${attendanceId}. Triggering screenshot & app usage lifecycle.`);
      onClockInSuccess(attendanceId);
      startAppUsageTracking(currentUser, attendanceId);
    }

    startHeartbeatLoop((isOnline) => {
      updateTrayMenu(isOnline ? 'Online' : 'Offline', mainWindow);
    });
  }
  return result;
});

ipcMain.handle('agent:getStatus', async () => {
  const details = await getDeviceDetails();
  return {
    ...details,
    authenticated: isAuthenticated()
  };
});

ipcMain.handle('agent:syncQueue', async () => {
  await syncOfflineQueue();
  return { success: true };
});

ipcMain.handle('agent:openLogs', async () => {
  const fs = require('fs');
  const logFile = config.LOG_FILE_PATH;
  if (fs.existsSync(logFile)) {
    shell.openPath(logFile);
  } else {
    const localLog = path.join(__dirname, 'logs', 'agent.log');
    if (fs.existsSync(localLog)) {
      shell.openPath(localLog);
    } else {
      shell.openPath(config.LOGS_DIR);
    }
  }
  return { success: true };
});

ipcMain.on('agent:quit', async () => {
  try {
    await clockOut('Agent Quit by Employee');
  } catch (e) {}
  onClockOut();
  app.isQuitting = true;
  app.quit();
});
