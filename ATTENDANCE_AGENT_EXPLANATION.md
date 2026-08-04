# Nirman Architects - Automatic Attendance Desktop Agent
### Comprehensive Operational Architecture & Complete Reference Guide

---

## 1. System Overview

The **NexAlliance Automatic Attendance Desktop Agent** is an Electron-based Windows application installed on office computers (HR, Project Manager, Architect/Designer, Employee, Super Admin). It operates silently in the background system tray to handle attendance tracking automatically without requiring manual employee clock-in/out clicks.

```
+-------------------------------------------------------------------------------+
|                           Office Desktop PC (Windows)                         |
|                                                                               |
|   ┌───────────────────────────────────────────────────────────────────────┐   |
|   │               Electron Desktop Agent (Background Tray)                │   |
|   │                                                                       │   |
|   │  • Auto-Start with Windows           • 30-Second Heartbeat Loop        │   |
|   │  • Hardware Machine ID Verification  • System Idle & Lock Detection   │   |
|   │  • Automatic Boot Clock-In           • Intercept Windows Shutdown     │   |
|   │  • Offline JSON Queue (queue.json)   • Encrypted Token Persistence    │   |
|   └───────────────────────────────────┬───────────────────────────────────┘   |
+---------------------------------------┼---------------------------------------+
                                        │
                                 HTTPS REST API
                                        │
                                        ▼
+-------------------------------------------------------------------------------+
|                           Node.js + Express Backend                           |
|                                                                               |
|   • Authentication & Device Binding (`/api/device/register`)                  |
|   • Attendance Event Handling (`/api/attendance/clock-in`, `/clock-out`)     |
|   • 30-Second Heartbeat Ping Processing (`/api/device/heartbeat`)             |
|   • 120-Second Heartbeat Timeout Cron (`heartbeatTimeoutCron.js`)             |
+---------------------------------------┬---------------------------------------+
                                        │
                                        ▼
                            MongoDB Database Cluster
```

---

## 2. Complete Core Workflows

### 🌅 Workflow 1: Automatic Clock-In (PC Turn ON)

```text
Turn ON PC ──► Windows Boots ──► Agent Launches Silently ──► Authoritative Clock-In Recorded
```

1. **Windows Boot**: As soon as the PC starts, Windows automatically launches the desktop agent into the system tray.
2. **Token Authentication**: The agent reads the local session token stored at `%APPDATA%\NexAllianceAttendanceAgent\token.json`.
3. **Hardware Telemetry Collection**: The agent gathers the raw Windows MachineGuid (`node-machine-id`), Computer Name, OS username, IP address, and MAC address.
4. **Device Registration & Verification**: The agent calls `POST /api/device/register` to auto-approve and bind the hardware Machine ID.
5. **Clock-In Execution**: The agent calls `POST /api/attendance/clock-in`. The backend creates a new attendance session with:
   - `status: "PRESENT"`
   - `clockInTime: new Date()` (Authoritative server timestamp)
   - `lastHeartbeat: new Date()`

---

### 💓 Workflow 2: 30-Second Heartbeat Loop (While Working)

```text
User Working on PC ──► Every 30 Seconds ──► POST /api/device/heartbeat ──► Status: ONLINE
```

1. While the employee works, an internal timer fires every **30 seconds**.
2. The agent sends `POST /api/device/heartbeat` with `{ deviceId, currentTime }`.
3. The server updates `lastHeartbeat` on the active session and marks the device as **ONLINE**.

---

### 🌇 Workflow 3: Automatic Clock-Out (Normal Windows Shutdown / Sleep)

```text
Click Shutdown ──► PowerMonitor Signal ──► POST /api/attendance/clock-out ──► Session Closed
```

1. **Shutdown Detection**: When the user clicks **Shutdown**, **Restart**, or puts the PC to **Sleep**, Electron's `powerMonitor` module intercepts the OS signal before power is cut.
2. **Clock-Out Execution**: The agent fires a synchronous request to `POST /api/attendance/clock-out` with `reason: "Windows Shutdown"`.
3. **Working Hours Calculation**: The backend records `clockOutTime = new Date()` and calculates the total `workingHours` for the shift.

---

### ⚡ Workflow 4: Power Failure / Forced Shutdown (Backend Timeout Cron)

```text
Power Outage / Unplug ──► Heartbeats Stop ──► 120s Timeout Cron ──► Auto Clock-Out ("Power Failure")
```

If electricity goes off or the PC is forcibly turned off without firing an OS shutdown event:

1. Heartbeat pings stop arriving at the backend.
2. A server cron job (`cron/heartbeatTimeoutCron.js`) runs every **1 minute**.
3. **Cutoff Threshold**: The cron calculates `CurrentTime - lastHeartbeat`. If missing for **> 120 seconds (2 minutes)**:
   - Sets `clockOutTime = lastHeartbeat`.
   - Sets `autoClosed = true`.
   - Sets `status = "AUTO_CLOSED"`.
   - Sets `reason = "Unexpected Shutdown / Power Failure"`.

---

### 🌐 Workflow 5: Offline Network Queue & Auto Resync

```text
Internet Connection Lost ──► Enqueue to queue.json ──► Network Restored ──► Auto Sync to Server
```

1. If network connectivity drops while working, attendance events and heartbeats fail.
2. The agent enqueues failed payloads into `%APPDATA%\NexAllianceAttendanceAgent\queue.json`.
3. An offline worker loop checks network connectivity every **60 seconds**.
4. When internet restores, the agent flushes the queue via `POST /api/attendance/sync` and clears processed queue entries.

---

## 3. Quick Command Reference

### Run Agent in Development Mode
```powershell
cd nexalliance-attendance-agent
npm install
npm start
```

### Reset Stored Login Token Cache
```powershell
Remove-Item "$env:APPDATA\NexAllianceAttendanceAgent\token.json" -ErrorAction SilentlyContinue
```

### Build Executable Installer (`Setup.exe`)
```powershell
cd nexalliance-attendance-agent
npm run dist
```
*Installer Output*: `nexalliance-attendance-agent\dist\Setup.exe`

### Assign Hardware Device ID to User Account in MongoDB
```powershell
node scripts/assignDevice.js YOUR_EMAIL@domain.com YOUR_HARDWARE_MACHINE_ID
```

---

## 4. End-User Installation & Deployment Steps

1. Copy `Setup.exe` to an office computer.
2. Run `Setup.exe` to install.
3. Employee logs in **once** with their work credentials.
4. The agent automatically configures Windows Auto-Launch and runs silently in the background on every boot!
