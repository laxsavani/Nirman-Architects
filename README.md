# Nirman Architects - Attendance HRM Module

Production-ready, automated, tamper-resistant, and offline-capable Attendance Management module for Nirman Architects.

---

## Architecture & Features

### 1. Dual Attendance Modes
- **`OFFICE_AUTO`** (HR, Project Manager, Architect/Designer, Employee):
  - PC Boot + OS login => Automatic Clock-In
  - PC Shutdown / Logout => Automatic Clock-Out
  - Heartbeat ping every 2 minutes with monotonic tick tamper checks
  - Hardware device bound (`Windows MachineGuid`)
- **`SITE_MOBILE`** (Site Engineer):
  - Mobile App GPS Check-In / Check-Out
  - Real-time Geo-Fencing calculation (Haversine formula against `SiteLocation` radius)
  - Rejects/flags out-of-bounds attempts with security audit logging

### 2. Core Security & Audit Features
- **Server Time Authority**: All final `clock_in_time` and `clock_out_time` timestamps use server time strictly. Client time is stored only for reference/tamper detection.
- **Hardware Device Binding**: Lock users to registered device IDs. Unauthorized device attempts trigger HTTP 403, audit trail logging in `unauthorized_attempts`, and real-time security alerts to HR.
- **Offline-First Queueing**: Local queue caching for offline events (`offline_queue.json` / SQLite), auto-flushing to server when network reconnects (`is_offline_entry = true`).
- **Heartbeat & Abrupt Shutdown Net**: Server-side background worker auto clock-outs timed-out sessions (`auto_closed = true`) with sleep/hibernate grace buffer support.
- **HR & PM Role Controls**:
  - HR: Company-wide view, correction request approvals/rejection, report exports (PDF, Excel, CSV), heartbeat timeout and shift configuration.
  - PM: Scoped view for assigned project team members ("Working on Site" vs "Working from Office" breakdown).

---

## Local Setup & Quick Start

### 1. Backend Server Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables in .env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/nirman_hrm
JWT_SECRET=your_jwt_secret_key

# 3. Seed initial database roles
node scripts/seed.js

# 4. Start backend server
npm start
```
> **Swagger API Docs**: Open [http://localhost:5000/api-docs](http://localhost:5000/api-docs) in your browser.

---

### 2. Desktop Agent Setup (OFFICE_AUTO)

```bash
# Navigate to desktop-agent directory
cd desktop-agent

# Install dependencies
npm install

# Configure credentials in desktop-agent/.env
API_URL=http://localhost:5000/api
EMPLOYEE_EMAIL=staff@nirman.com
EMPLOYEE_PASSWORD=Password123!

# Start Desktop Agent
node agent.js
```

---

### 3. Running Verification Test Suites

```bash
# Run Role-Wise Attendance Verification Suite
node scripts/test_role_attendance.js

# Run Full Master Attendance HRM Verification Suite
node scripts/test_master_attendance.js
```

---

## Main API Contract Overview

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Device** | `POST` | `/api/device/register` | Register primary hardware device GUID |
| | `POST` | `/api/device/approve` | HR/Admin approve device change request |
| | `GET` | `/api/device/status` | Get device binding status |
| **Office Attendance** | `POST` | `/api/attendance/office/event` | Clock-In / Clock-Out / Heartbeat ping |
| | `POST` | `/api/attendance/office/sync` | Bulk offline queue sync (`isOffline = true`) |
| **Site Attendance** | `POST` | `/api/attendance/site/checkin` | GPS check-in with geo-fence validation |
| | `POST` | `/api/attendance/site/checkout` | GPS check-out |
| **HR Management** | `GET` | `/api/attendance/all` | Company-wide attendance view |
| | `POST` | `/api/attendance/correction/approve` | Approve manual correction request |
| | `POST` | `/api/attendance/correction/reject` | Reject manual correction request |
| | `POST` | `/api/attendance/config/heartbeat-timeout` | Configure timeout & sleep buffer |
| | `GET` | `/api/attendance/report` | Export dataset report (PDF, Excel, CSV) |
| **PM Scoped** | `GET` | `/api/attendance/project/:projectId` | Team attendance & Site vs Office split |
| | `POST` | `/api/site-locations` | Configure project site geo-fence lat, lng & radius |
| **Notifications** | `GET` | `/api/notifications` | Get system alerts & notifications |
| | `PUT` | `/api/notifications/:id/read` | Mark notification as read |
