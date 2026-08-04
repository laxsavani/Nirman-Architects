# NIRMAN ARCHITECTS - COMPLETE PROJECT API MASTER DIRECTORY & WORKING SPECIFICATION

This document provides a comprehensive, production-grade API reference and working specification for **every single API endpoint** in the **Nirman Architects** codebase (covering HRM, Core Identity, Attendance, Leave, Payroll, Offer Letters, Device Binding, Screenshots, App Usage, Notifications, and CRM Modules 1, 2, and 3).

---

## TABLE OF CONTENTS
1. [Authentication & User Management APIs](#1-authentication--user-management-apis)
2. [Dynamic Role Master APIs](#2-dynamic-role-master-apis)
3. [Device Binding & Heartbeat APIs](#3-device-binding--heartbeat-apis)
4. [Attendance Module APIs](#4-attendance-module-apis)
5. [Site Location Geo-Fencing APIs](#5-site-location-geo-fencing-apis)
6. [Dynamic Leave Master & Balance APIs](#6-dynamic-leave-master--balance-apis)
7. [Payroll & PDF Payslip APIs](#7-payroll--pdf-payslip-apis)
8. [Offer Letter APIs](#8-offer-letter-apis)
9. [Screenshot Activity Tracking APIs](#9-screenshot-activity-tracking-apis)
10. [Desktop Application Usage Tracking APIs](#10-desktop-application-usage-tracking-apis)
11. [Notification APIs](#11-notification-apis)
12. [CRM Module 1 - Lead Management APIs](#12-crm-module-1---lead-management-apis)
13. [CRM Module 2 - Client Master & ClientContact APIs](#13-crm-module-2---client-master--clientcontact-apis)
14. [CRM Module 2 - Client Portal Authentication APIs](#14-crm-module-2---client-portal-authentication-apis)
15. [CRM Module 3 - Client-Project Linkage APIs](#15-crm-module-3---client-project-linkage-apis)
16. [Health & System APIs](#16-health--system-apis)

---

## AUTHENTICATION & JWT TOKEN SCOPES

The application uses two distinct, non-interchangeable JWT token types:

1. **Employee JWT (`JWT_SECRET`)**:
   - Header: `Authorization: Bearer <EMPLOYEE_JWT_TOKEN>`
   - Payload: `{ id/userId, email, role/roleCode, roleId }`
   - Used for internal employee routes (HRM, PM, Admin, Super Admin).

2. **Client Portal JWT (`CLIENT_JWT_SECRET`)**:
   - Header: `Authorization: Bearer <CLIENT_PORTAL_JWT_TOKEN>`
   - Payload: `{ contactId, clientId, permissionLevel, isClientPortal: true }`
   - Used specifically for client portal routes under `/api/client-auth` and `/api/client/projects`.

---

## 1. AUTHENTICATION & USER MANAGEMENT APIs

### 1.1 `POST /api/auth/register` (or `POST /api/register`)
- **Description**: Public or Admin user registration endpoint. Creates `User` document and matching role-profile document (`SuperAdmin`, `HR`, `ProjectManager`, `Architect`, `SiteEngineer`, or `Employee`).
- **Auth**: Public / Unrestricted.
- **Request Body**:
  ```json
  {
    "name": "Rohan Sharma",
    "email": "rohan.sharma@nirman.com",
    "password": "SecretPassword123!",
    "phone": "9876543210",
    "roleId": "64bd9f0296e625a5857e4e01",
    "department": "Architecture",
    "designation": "Senior Architect",
    "baseSalary": 25000,
    "joiningDate": "2026-08-01",
    "deviceId": "DESKTOP-GUID-12345"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": { "_id": "...", "name": "Rohan Sharma", "email": "rohan.sharma@nirman.com" }
  }
  ```

### 1.2 `POST /api/auth/login` (or `POST /api/login`)
- **Description**: Authenticates employee credentials and returns an Employee JWT token. Rate limited to 10 attempts per 15 minutes.
- **Auth**: Public / Unrestricted.
- **Request Body**:
  ```json
  {
    "email": "admin@nirman.com",
    "password": "AdminPassword123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": { "id": "...", "name": "Admin", "email": "admin@nirman.com", "role": "SUPER_ADMIN" }
  }
  ```

### 1.3 `GET /api/roles`
- **Description**: Retrieves active roles list for user creation dropdowns.
- **Auth**: Public / Unrestricted.
- **Response** (`200 OK`): Array of dynamic roles from `RoleMaster`.

### 1.4 `POST /api/users/create`
- **Description**: Registers a new employee AND automatically generates their Offer Letter PDF under `/storage/offer_letters/<userId>/`.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR` role required).
- **Request Body**:
  ```json
  {
    "name": "Anjali Sharma",
    "email": "anjali.sharma@nirman.com",
    "password": "Password@123",
    "phone": "9876500011",
    "roleId": "64bd9f0296e625a5857e4e01",
    "department": "Architecture",
    "designation": "Junior Architect",
    "baseSalary": 25000,
    "joiningDate": "2026-08-01"
  }
  ```
- **Response** (`201 Created`): Returns created user and generated `offerLetter` metadata with PDF file path.

### 1.5 `GET /api/users`
- **Description**: Retrieves paginated list of users with optional filtering by `role`, `department`, or `search`.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Query Params**: `role`, `department`, `search`, `page`, `limit`.

### 1.6 `GET /api/users/:id`
- **Description**: Gets full user profile by MongoDB `_id`.
- **Auth**: Internal Employee (Authenticated).

### 1.7 `PUT /api/users/:id`
- **Description**: Updates profile fields for a user.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ name, phone, department, designation, baseSalary, joiningDate, deviceId, deviceStatus, isActive, roleId }`.

### 1.8 `DELETE /api/users/:id` (or `DELETE /api/user/:id`)
- **Description**: Cascade deletes user and ALL associated data across attendance, screenshots, app usage, leaves, payrolls, offer letters, notifications, and physical storage files.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).

### 1.9 `PUT /api/users/:id/change-password` (Aliases: `PATCH`, `POST`, `PUT /users/change-password/:id`)
- **Description**: Admin endpoint to directly update an employee's password.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "newPassword": "NewSecretPassword123!" }`.

---

## 2. DYNAMIC ROLE MASTER APIs

### 2.1 `GET /api/role-master/all`
- **Description**: Retrieves all configured dynamic roles in the system.
- **Auth**: Public or Authenticated.

### 2.2 `POST /api/role-master/create`
- **Description**: Creates a new dynamic role code and role name (e.g. `INTERN`, `SENIOR_ARCHITECT`).
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "roleName": "Senior Architect", "roleCode": "SENIOR_ARCHITECT", "description": "Team lead architect" }`.

---

## 3. DEVICE BINDING & HEARTBEAT APIs

### 3.1 `POST /api/device/register`
- **Description**: Binds a machine GUID/Device ID to a user account. Automatically approves first device; creates a `PENDING` request for secondary devices.
- **Auth**: Internal Employee.
- **Request Body**: `{ "userId": "...", "deviceId": "DESKTOP-GUID-12345" }`.

### 3.2 `POST /api/device/heartbeat`
- **Description**: 30-Second Desktop Agent heartbeat ping updating `lastHeartbeat` timestamp on active attendance session.
- **Auth**: Internal Employee.
- **Request Body**: `{ "deviceId": "DESKTOP-GUID-12345", "currentTime": "2026-08-04T10:00:00Z" }`.

### 3.3 `GET /api/device/status`
- **Description**: Gets logged-in user device binding status & pending change requests.
- **Auth**: Internal Employee.

### 3.4 `GET /api/device/pending`
- **Description**: Lists all pending device change requests across the company.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).

### 3.5 `POST /api/device/approve`
- **Description**: Approves or rejects a device change request.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "requestId": "...", "action": "APPROVE" }`.

### 3.6 `POST /api/device/assign`
- **Description**: Directly assigns a Device ID to an employee.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "targetUserId": "...", "deviceId": "GUID-999" }`.

---

## 4. ATTENDANCE MODULE APIs

### 4.1 `POST /api/attendance/clock-in`
- **Description**: Clocks in official attendance session for logged-in user. Validates server-time authority and device binding.
- **Auth**: Internal Employee.
- **Request Body**: `{ "clientTime": "...", "deviceId": "GUID-123", "ip": "192.168.1.100" }`.

### 4.2 `POST /api/attendance/clock-out`
- **Description**: Clocks out active attendance session for logged-in user.
- **Auth**: Internal Employee.

### 4.3 `GET /api/attendance/today`
- **Description**: Retrieves current day's attendance status and active session info.
- **Auth**: Internal Employee.

### 4.4 `POST /api/attendance/event` (Aliases: `/heartbeat`, `/clock`)
- **Description**: Universal event handler for Desktop Agent (clock-in, clock-out, heartbeat).
- **Auth**: Internal Employee.

### 4.5 `POST /api/attendance/sync`
- **Description**: Flushes offline attendance events from Desktop Agent's local buffer into the central Attendance collection (`isOfflineEntry: true`).
- **Auth**: Internal Employee.

### 4.6 `GET /api/attendance/my`
- **Description**: Gets monthly attendance logs for the logged-in user.
- **Auth**: Internal Employee.
- **Query Params**: `month`, `year`.

### 4.7 `GET /api/attendance/all`
- **Description**: Retrieves attendance logs for all employees.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Query Params**: `month`, `year`, `userId`.

### 4.8 `POST /api/attendance/correction/request`
- **Description**: Raises an attendance correction request for a specific date/session.
- **Auth**: Internal Employee.
- **Request Body**: `{ "attendanceId": "...", "requestedClockIn": "...", "requestedClockOut": "...", "reason": "System force shut down" }`.

### 4.9 `POST /api/attendance/correction/approve`
- **Description**: Approves an attendance correction request.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "requestId": "..." }`.

### 4.10 `POST /api/attendance/correction/reject`
- **Description**: Rejects an attendance correction request.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "requestId": "...", "reason": "Insufficient proof" }`.

### 4.11 `GET /api/attendance/config`
- **Description**: Gets attendance config parameters (heartbeat interval, timeout threshold, shift timing).
- **Auth**: Internal Employee.

### 4.12 `PUT /api/attendance/config`
- **Description**: Updates attendance configuration.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

---

## 5. SITE LOCATION GEO-FENCING APIs

### 5.1 `POST /api/site-locations`
- **Description**: Configures GPS coordinates and allowed radius in meters for a project site geo-fence.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**: `{ "projectId": "...", "projectName": "Nirman Tower", "lat": 23.0225, "lng": 72.5714, "radiusMeters": 100 }`.

### 5.2 `GET /api/site-locations`
- **Description**: Retrieves all configured project site geo-fences.
- **Auth**: Internal Employee.

---

## 6. DYNAMIC LEAVE MASTER & BALANCE APIs

### 6.1 `GET /api/leave-type/active`
- **Description**: Retrieves active leave types for application dropdowns.
- **Auth**: Public or Authenticated.

### 6.2 `GET /api/leave-type/all`
- **Description**: Retrieves all leave types including inactive ones.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 6.3 `POST /api/leave-type/create`
- **Description**: Creates a new dynamic leave type (e.g. "Paternity Leave"). **Auto-seeds LeaveBalance rows for all active employees synchronously**.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "name": "Paternity Leave", "code": "PL", "isPaid": true, "defaultQuotaPerYear": 5 }`.

### 6.4 `PUT /api/leave-type/:id/update`
- **Description**: Updates leave type configuration.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 6.5 `PUT /api/leave-type/:id/deactivate`
- **Description**: Deactivates a leave type (`isActive: false`).
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 6.6 `POST /api/leave/apply`
- **Description**: Employee applies for leave.
- **Auth**: Internal Employee.
- **Request Body**: `{ "leaveTypeId": "...", "fromDate": "2026-08-10", "toDate": "2026-08-12", "reason": "Family function" }`.

### 6.7 `GET /api/leave/my`
- **Description**: Retrieves logged-in user's leave requests history.
- **Auth**: Internal Employee.

### 6.8 `POST /api/leave/cancel`
- **Description**: Cancels a pending leave request.
- **Auth**: Internal Employee.
- **Request Body**: `{ "leaveRequestId": "..." }`.

### 6.9 `GET /api/leave/pending`
- **Description**: Gets all pending leave requests requiring approval.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 6.10 `POST /api/leave/approve`
- **Description**: Approves a leave request, snapshots `isPaidSnapshot`, and updates leave balance.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "leaveRequestId": "..." }`.

### 6.11 `POST /api/leave/reject`
- **Description**: Rejects a leave request with a rejection reason.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "leaveRequestId": "...", "rejectionReason": "Overlapping project deadline" }`.

### 6.12 `GET /api/leave/all`
- **Description**: Retrieves all leave requests across the company.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).

### 6.13 `GET /api/leave-balance/my` (or `/api/leave/balance/my`)
- **Description**: Gets logged-in user's leave balances for current year.
- **Auth**: Internal Employee.

### 6.14 `GET /api/leave-balance/:userId` (or `/api/leave/balance/:userId`)
- **Description**: Gets leave balances for a specific user.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).

### 6.15 `POST /api/leave-balance/adjust` (or `/api/leave/balance/adjust`)
- **Description**: Manually adjusts an employee's leave balance and logs entry in `LeaveBalanceAdjustment`.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Request Body**: `{ "userId": "...", "leaveTypeId": "...", "newValue": 15, "reason": "Bonus performance leave allocation" }`.

---

## 7. PAYROLL & PDF PAYSLIP APIs

### 7.1 `GET /api/payroll/my`
- **Description**: Retrieves logged-in user's monthly payroll history.
- **Auth**: Internal Employee.

### 7.2 `GET /api/payroll/my/download`
- **Description**: Self-service download of own PDF payslip.
- **Auth**: Internal Employee.
- **Query Params**: `month`, `year`.

### 7.3 `GET /api/payroll/all`
- **Description**: Retrieves company-wide payroll calculations for a specific month/year.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).
- **Query Params**: `month`, `year`.

### 7.4 `POST /api/payroll/generate`
- **Description**: Calculates monthly payroll for all active employees using formula: `perDaySalary = round2(baseSalary / daysInMonth)`, `totalDeduction = round2(perDaySalary * (unpaidLeaveDays + absentDays))`, `netSalary = round2(baseSalary - totalDeduction)`. Renders PDF payslips under `/storage/salary/<userId>/<year>/`.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "month": 8, "year": 2026 }`.

### 7.5 `POST /api/payroll/generate/:userId`
- **Description**: Generates/re-calculates monthly payroll for a single user.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Request Body**: `{ "month": 8, "year": 2026 }`.

### 7.6 `GET /api/payroll/download-all`
- **Description**: Bulk downloads all employee payslips for a month as a ZIP archive.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Query Params**: `month`, `year`.

### 7.7 `GET /api/payroll/download/:userId`
- **Description**: Admin download of a specific employee's PDF payslip.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Query Params**: `month`, `year`.

---

## 8. OFFER LETTER APIs

### 8.1 `GET /api/offer-letter/:userId`
- **Description**: Gets Offer Letter metadata for an employee.
- **Auth**: Internal Employee (Self or `SUPER_ADMIN`/`HR`).

### 8.2 `GET /api/offer-letter/:userId/download`
- **Description**: Downloads Offer Letter PDF from `/storage/offer_letters/<userId>/`.
- **Auth**: Internal Employee (Self or `SUPER_ADMIN`/`HR`).

### 8.3 `POST /api/offer-letter/:userId/regenerate`
- **Description**: Regenerates a new Offer Letter PDF version while preserving snapshot audit parameters.
- **Auth**: Internal Employee (`SUPER_ADMIN` or `HR`).

---

## 9. SCREENSHOT ACTIVITY TRACKING APIs

### 9.1 `GET /api/screenshot/config`
- **Description**: Retrieves screenshot capture intervals and active tracking hours for Desktop Agent.
- **Auth**: Public or Agent Authenticated.

### 9.2 `POST /api/screenshot/upload`
- **Description**: Multipart upload for workstation screenshots captured by Desktop Agent. Saves image file to disk.
- **Auth**: Internal Employee (Multer parse + JWT Auth).

### 9.3 `POST /api/screenshot/sync`
- **Description**: Syncs offline captured screenshots buffer from Desktop Agent.
- **Auth**: Internal Employee.

### 9.4 `PUT /api/screenshot/config`
- **Description**: Updates screenshot capture configuration settings.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 9.5 `GET /api/screenshot/employee/:userId`
- **Description**: Retrieves screenshot records for an employee for a date range.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 9.6 `GET /api/screenshot/employee/:userId/download-all`
- **Description**: Downloads all screenshots for an employee as a ZIP file.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

---

## 10. DESKTOP APPLICATION USAGE TRACKING APIs

### 10.1 `POST /api/app-usage/sync`
- **Description**: Flushes 5-minute batch of desktop application usage metrics (appName, secondsActive, windowTitle) from Desktop Agent. Blocked for SuperAdmin tracking.
- **Auth**: Internal Employee (`authMiddleware` + `blockSuperAdminTracking`).

### 10.2 `GET /api/app-usage/config`
- **Description**: Gets application tracking configuration parameters.
- **Auth**: Internal Employee.

### 10.3 `PUT /api/app-usage/config`
- **Description**: Updates application usage tracking parameters.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 10.4 `GET /api/app-usage/employee/:userId`
- **Description**: Gets employee application usage breakdown and daily summaries.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).

### 10.5 `GET /api/app-usage/employee/:userId/export`
- **Description**: Exports employee application usage data as CSV or JSON format.
- **Auth**: Internal Employee (`SUPER_ADMIN` ONLY).
- **Query Params**: `format` (`csv` or `json`).

---

## 11. NOTIFICATION APIs

### 11.1 `GET /api/notifications/my` (or `GET /api/notifications`)
- **Description**: Gets notifications for the logged-in user.
- **Auth**: Internal Employee.

### 11.2 `PUT /api/notifications/:id/read`
- **Description**: Marks a notification as read (`isRead: true`).
- **Auth**: Internal Employee.

---

## 12. CRM MODULE 1 - LEAD MANAGEMENT APIs

### 12.1 `POST /api/leads/create` (or `POST /api/leads`)
- **Description**: Creates a new sales Lead. Evaluates active phone duplicates (`duplicateWarning: true`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**:
  ```json
  {
    "name": "Mr. Hirak Patel",
    "phone": "9876543210",
    "email": "hirak@patel.com",
    "source": "Referral",
    "requirementNotes": "Luxury 4BHK Villa interior design in Satellite",
    "assignedTo": "64bd9f0296e625a5857e4e10",
    "nextFollowUpDate": "2026-08-10T10:00:00Z"
  }
  ```

### 12.2 `GET /api/leads`
- **Description**: Retrieves paginated, searchable, role-scoped leads list or full Kanban pipeline view (`pipelineView=true`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Query Params**: `status`, `assignedTo`, `search`, `page`, `limit`, `pipelineView`.

### 12.3 `GET /api/leads/followups/due`
- **Description**: Gets active leads with follow-ups due on or before specified date (excludes WON and LOST leads).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Query Params**: `date`.

### 12.4 `GET /api/leads/:id`
- **Description**: Gets full lead details and computed contact metrics (`interactionCount`, `daysSinceLastContact`, `daysSinceCreation`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 12.5 `PUT /api/leads/:id/update` (or `PUT /api/leads/:id`)
- **Description**: Updates lead general fields (excluding status). Reassignment of `assignedTo` is restricted to Admins.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 12.6 `PUT /api/leads/:id/update-status`
- **Description**: Updates lead lifecycle status (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL_SENT`, `NEGOTIATION`, `WON`, `LOST`). **Mandatory `lostReason` required if `newStatus === 'LOST'`**. Logs audit entry to `LeadStatusHistory`.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**: `{ "newStatus": "LOST", "lostReason": "Client selected competitor due to budget" }`.

### 12.7 `POST /api/leads/:id/log-interaction`
- **Description**: Logs an interaction touchpoint (`Call`, `Meeting`, `Email`, `Note`) for a lead.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**: `{ "type": "Call", "notes": "Discussed preliminary budget and floor plans" }`.

### 12.8 `GET /api/leads/:id/interactions`
- **Description**: Gets chronological interaction timeline for a lead.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 12.9 `GET /api/leads/:id/status-history`
- **Description**: Gets chronological status-change audit trail for a lead.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 12.10 `POST /api/leads/:id/convert-to-client`
- **Description**: Converts a WON Lead into a formal `Client` account and primary `ClientContact` (`OWNER` level with temporary password). Updates `Lead.status = 'WON'` and `Lead.convertedToClientId = Client._id`. Requires `primaryContactEmail` if lead has no email.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

---

## 13. CRM MODULE 2 - CLIENT MASTER & CLIENTCONTACT APIs

### 13.1 `POST /api/clients/create` (or `POST /api/clients`)
- **Description**: Directly creates a `Client` account and primary `ClientContact` (`OWNER` level) without a prior lead (`sourceLeadId: null`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**:
  ```json
  {
    "name": "Shah Enterprises",
    "companyName": "Shah Group",
    "phone": "9876543210",
    "email": "info@shah.com",
    "billingAddress": "202 Corporate Park, SG Highway",
    "siteAddresses": ["Site A, Bopal", "Site B, Satellite"],
    "primaryContactName": "Anand Shah",
    "primaryContactEmail": "anand@shah.com",
    "primaryContactPhone": "9876543210"
  }
  ```

### 13.2 `GET /api/clients`
- **Description**: Retrieves paginated and searchable list of Client accounts with primary contact info, originating Lead link, and active project counts.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Query Params**: `search`, `isActive`, `page`, `limit`.

### 13.3 `GET /api/clients/:id`
- **Description**: Retrieves Client account details including list of all associated `ClientContacts` (excluding password hashes) and source Lead info.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 13.4 `PUT /api/clients/:id`
- **Description**: Updates account-level Client fields (`name`, `companyName`, `phone`, `email`, `billingAddress`, `siteAddresses`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 13.5 `PUT /api/clients/:id/deactivate`
- **Description**: Soft-deactivates Client account (`isActive: false`). Enforces active project safeguard (blocks if active projects exist unless `force=true`).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 13.6 `POST /api/clients/:clientId/contacts/add`
- **Description**: Adds an additional `ClientContact` to a Client account with a temporary password (`mustChangePassword: true`).
- **Auth**: Internal Employee (PM/Admin) OR Client Contact with `permissionLevel === 'OWNER'`.
- **Request Body**: `{ "name": "Vikram Site Engineer", "email": "vikram.site@enterprises.com", "phone": "9876500001", "permissionLevel": "MEMBER" }`.

### 13.7 `GET /api/clients/:clientId/contacts`
- **Description**: Lists all contacts for a Client account.
- **Auth**: Internal Employee OR any authenticated ClientContact belonging to that `clientId`.

### 13.8 `PUT /api/clients/:clientId/contacts/:contactId/permission`
- **Description**: Updates permission level (`OWNER`, `MEMBER`, `VIEW_ONLY`). Enforces minimum 1 active OWNER constraint. Logs audit entry to `ClientContactActionLog`.
- **Auth**: Internal Employee (PM/Admin) OR Client Contact with `permissionLevel === 'OWNER'`.
- **Request Body**: `{ "newPermissionLevel": "VIEW_ONLY" }`.

### 13.9 `PUT /api/clients/:clientId/contacts/:contactId/deactivate`
- **Description**: Soft-deactivates a contact (`isActive: false`). Enforces minimum 1 active OWNER constraint. Logs audit entry to `ClientContactActionLog`.
- **Auth**: Internal Employee (PM/Admin) OR Client Contact with `permissionLevel === 'OWNER'`.

### 13.10 `POST /api/clients/:clientId/contacts/:contactId/reset-temp-password`
- **Description**: Admin helper to regenerate and output a new temporary password for a contact.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

---

## 14. CRM MODULE 2 - CLIENT PORTAL AUTHENTICATION APIs

### 14.1 `POST /api/client-auth/login`
- **Description**: Authenticates ClientContact credentials (email + password), verifies active state of contact and parent Client account, generates Client-scoped JWT token, and logs `LOGIN`.
- **Auth**: Public / Unrestricted.
- **Request Body**: `{ "email": "shah.owner@enterprises.com", "password": "TempPass@123" }`.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Client Portal login successful.",
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "contact": { "id": "...", "name": "Anand Shah", "permissionLevel": "OWNER", "mustChangePassword": true }
  }
  ```

### 14.2 `POST /api/client-auth/change-password`
- **Description**: Changes password for logged-in ClientContact, validates password complexity (8-15 chars, uppercase, lowercase, number, special char), updates password, and sets `mustChangePassword: false`.
- **Auth**: Client Contact (`clientAuthMiddleware`).
- **Request Body**: `{ "currentPassword": "TempPass@123", "newPassword": "NewPass@1234" }`.

### 14.3 `POST /api/client-auth/forgot-password`
- **Description**: Generates password reset token for a ClientContact email.
- **Auth**: Public / Unrestricted.
- **Request Body**: `{ "email": "shah.owner@enterprises.com" }`.

### 14.4 `POST /api/client-auth/reset-password`
- **Description**: Resets ClientContact password using valid reset token and sets `mustChangePassword: false`.
- **Auth**: Public / Unrestricted.
- **Request Body**: `{ "resetToken": "...", "newPassword": "ResetPass@999" }`.

### 14.5 `GET /api/client-auth/me`
- **Description**: Retrieves current logged-in ClientContact profile and parent Client account info.
- **Auth**: Client Contact (`clientAuthMiddleware`).

---

## 15. CRM MODULE 3 - CLIENT-PROJECT LINKAGE APIs

### 15.1 `POST /api/client-project-links/create` (or `POST /api/client-project-links`)
- **Description**: Links an active Project to a Client account. Validates active status of Client, prevents duplicate active links for the same pair, and logs `LINKED` audit history.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**: `{ "clientId": "64bd9f0296e625a5857e4f10", "projectId": "64bd9f0296e625a5857e4f80", "visibleToClient": true }`.

### 15.2 `GET /api/client-project-links/by-client/:clientId`
- **Description**: Gets all active project links for a specific Client account.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 15.3 `GET /api/client-project-links/by-project/:projectId`
- **Description**: Gets all active client links for a specific Project.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).

### 15.4 `PUT /api/client-project-links/:id/visibility`
- **Description**: Toggles `visibleToClient` boolean without unlinking the project. Logs `VISIBILITY_CHANGED` audit history.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`).
- **Request Body**: `{ "visibleToClient": false }`.

### 15.5 `DELETE /api/client-project-links/:id`
- **Description**: Soft-deletes (unlinks) a project from a Client account (`isActive: false`, `unlinkedBy`, `unlinkedAt`). Logs `UNLINKED` audit history.
- **Auth**: Internal Employee (`ADMIN` or `SUPER_ADMIN` ONLY — PM role gets HTTP 403!).

### 15.6 `GET /api/client/projects/my`
- **Description**: Client Portal discovery endpoint. Returns all active linked projects where `visibleToClient === true` strictly scoped to the calling ClientContact's own `clientId` derived from JWT.
- **Auth**: Client Contact (`clientAuthMiddleware`).

---

## 16. HEALTH & SYSTEM APIs

### 16.1 `GET /api/health`
- **Description**: Checks service health status and returns current server timestamp.
- **Auth**: Public / Unrestricted.
- **Response** (`200 OK`):
  ```json
  {
    "status": "ok",
    "service": "Nirman Architects API",
    "serverTime": "2026-08-04T14:20:00.000Z"
  }
  ```

---

## SUMMARY OF ALL 107 API ENDPOINTS BY MODULE

| # | Endpoint Method & Path | Auth Scope | Module |
| :--- | :--- | :--- | :--- |
| 1 | `GET /api/health` | Public | System Health |
| 2 | `POST /api/auth/register` | Public / Admin | Auth & Users |
| 3 | `POST /api/register` | Public / Admin | Auth & Users |
| 4 | `POST /api/auth/login` | Public | Auth & Users |
| 5 | `POST /api/login` | Public | Auth & Users |
| 6 | `GET /api/roles` | Public | User Roles |
| 7 | `POST /api/users/create` | Super Admin / HR | User Management |
| 8 | `GET /api/users` | Super Admin / HR | User Management |
| 9 | `GET /api/users/:id` | Authenticated | User Management |
| 10 | `PUT /api/users/:id` | Super Admin / HR | User Management |
| 11 | `DELETE /api/users/:id` | Super Admin / HR | User Management |
| 12 | `DELETE /api/user/:id` | Super Admin / HR | User Management |
| 13 | `PUT /api/users/:id/change-password` | Super Admin / HR | Password Admin |
| 14 | `PATCH /api/users/:id/change-password` | Super Admin / HR | Password Admin |
| 15 | `POST /api/users/:id/change-password` | Super Admin / HR | Password Admin |
| 16 | `PUT /api/users/change-password/:id` | Super Admin / HR | Password Admin |
| 17 | `GET /api/role-master/all` | Public / Auth | Dynamic Roles |
| 18 | `POST /api/role-master/create` | Super Admin | Dynamic Roles |
| 19 | `POST /api/device/register` | Employee | Device Binding |
| 20 | `POST /api/device/heartbeat` | Employee | Device Binding |
| 21 | `GET /api/device/status` | Employee | Device Binding |
| 22 | `GET /api/device/pending` | Super Admin / HR | Device Binding |
| 23 | `POST /api/device/approve` | Super Admin / HR | Device Binding |
| 24 | `POST /api/device/assign` | Super Admin / HR | Device Binding |
| 25 | `POST /api/attendance/clock-in` | Employee | Attendance |
| 26 | `POST /api/attendance/clock-out` | Employee | Attendance |
| 27 | `GET /api/attendance/today` | Employee | Attendance |
| 28 | `POST /api/attendance/event` | Employee | Desktop Agent Event |
| 29 | `POST /api/attendance/sync` | Employee | Offline Sync |
| 30 | `POST /api/attendance/heartbeat` | Employee | Event Alias |
| 31 | `POST /api/attendance/clock` | Employee | Event Alias |
| 32 | `GET /api/attendance/my` | Employee | Attendance History |
| 33 | `GET /api/attendance/all` | Super Admin / HR | Attendance Admin |
| 34 | `POST /api/attendance/correction/request` | Employee | Attendance Correction |
| 35 | `POST /api/attendance/correction/approve` | Super Admin / HR | Attendance Correction |
| 36 | `POST /api/attendance/correction/reject` | Super Admin / HR | Attendance Correction |
| 37 | `GET /api/attendance/config` | Employee | Attendance Config |
| 38 | `PUT /api/attendance/config` | Super Admin | Attendance Config |
| 39 | `POST /api/site-locations` | PM / Admin / HR | Site Geo-Fence |
| 40 | `GET /api/site-locations` | Employee | Site Geo-Fence |
| 41 | `GET /api/leave-type/active` | Public / Auth | Dynamic Leave Types |
| 42 | `GET /api/leave-type/all` | Super Admin | Dynamic Leave Types |
| 43 | `POST /api/leave-type/create` | Super Admin | Dynamic Leave Types |
| 44 | `PUT /api/leave-type/:id/update` | Super Admin | Dynamic Leave Types |
| 45 | `PUT /api/leave-type/:id/deactivate` | Super Admin | Dynamic Leave Types |
| 46 | `POST /api/leave/apply` | Employee | Leave Application |
| 47 | `GET /api/leave/my` | Employee | Leave History |
| 48 | `POST /api/leave/cancel` | Employee | Leave Cancellation |
| 49 | `GET /api/leave/pending` | Super Admin | Leave Approvals |
| 50 | `POST /api/leave/approve` | Super Admin | Leave Approvals |
| 51 | `POST /api/leave/reject` | Super Admin | Leave Approvals |
| 52 | `GET /api/leave/all` | Super Admin / HR | Leave Overview |
| 53 | `GET /api/leave-balance/my` | Employee | Leave Balance |
| 54 | `GET /api/leave/balance/my` | Employee | Leave Balance Alias |
| 55 | `GET /api/leave-balance/:userId` | Super Admin / HR | Leave Balance Admin |
| 56 | `GET /api/leave/balance/:userId` | Super Admin / HR | Leave Balance Alias |
| 57 | `POST /api/leave-balance/adjust` | Super Admin / HR | Balance Adjustment |
| 58 | `POST /api/leave/balance/adjust` | Super Admin / HR | Balance Adjustment Alias |
| 59 | `GET /api/payroll/my` | Employee | Payroll History |
| 60 | `GET /api/payroll/my/download` | Employee | Self Payslip PDF |
| 61 | `GET /api/payroll/all` | Super Admin / HR | Payroll Admin |
| 62 | `POST /api/payroll/generate` | Super Admin | Bulk Payroll Calc |
| 63 | `POST /api/payroll/generate/:userId` | Super Admin | Single User Payroll Calc |
| 64 | `GET /api/payroll/download-all` | Super Admin | Bulk Payslips ZIP |
| 65 | `GET /api/payroll/download/:userId` | Super Admin | Employee Payslip PDF |
| 66 | `GET /api/offer-letter/:userId` | Self / Admin | Offer Letter Info |
| 67 | `GET /api/offer-letter/:userId/download` | Self / Admin | Download Offer Letter |
| 68 | `POST /api/offer-letter/:userId/regenerate` | Super Admin / HR | Offer Letter Re-gen |
| 69 | `GET /api/screenshot/config` | Public / Agent | Screenshot Settings |
| 70 | `POST /api/screenshot/upload` | Agent / Auth | Workstation Screenshot |
| 71 | `POST /api/screenshot/sync` | Agent / Auth | Offline Screenshots Sync |
| 72 | `PUT /api/screenshot/config` | Super Admin | Screenshot Config |
| 73 | `GET /api/screenshot/employee/:userId` | Super Admin | Screenshot Viewer |
| 74 | `GET /api/screenshot/employee/:userId/download-all` | Super Admin | Screenshot Bulk ZIP |
| 75 | `POST /api/app-usage/sync` | Agent / Auth | App Usage Metrics Sync |
| 76 | `GET /api/app-usage/config` | Employee | App Usage Config |
| 77 | `PUT /api/app-usage/config` | Super Admin | App Usage Config |
| 78 | `GET /api/app-usage/employee/:userId` | Super Admin | App Usage Report |
| 79 | `GET /api/app-usage/employee/:userId/export` | Super Admin | App Usage CSV/JSON |
| 80 | `GET /api/notifications/my` | Employee | User Notifications |
| 81 | `GET /api/notifications` | Employee | Notifications Alias |
| 82 | `PUT /api/notifications/:id/read` | Employee | Notification Mark Read |
| 83 | `POST /api/leads/create` | Internal PM/Admin | CRM 1 - Create Lead |
| 84 | `POST /api/leads` | Internal PM/Admin | CRM 1 - Create Lead |
| 85 | `GET /api/leads` | Internal PM/Admin | CRM 1 - List Leads |
| 86 | `GET /api/leads/followups/due` | Internal PM/Admin | CRM 1 - Follow-ups Due |
| 87 | `GET /api/leads/:id` | Internal PM/Admin | CRM 1 - Lead Detail |
| 88 | `PUT /api/leads/:id/update` | Internal PM/Admin | CRM 1 - Update Lead |
| 89 | `PUT /api/leads/:id` | Internal PM/Admin | CRM 1 - Update Lead |
| 90 | `PUT /api/leads/:id/update-status` | Internal PM/Admin | CRM 1 - Status Update |
| 91 | `POST /api/leads/:id/log-interaction` | Internal PM/Admin | CRM 1 - Log Interaction |
| 92 | `GET /api/leads/:id/interactions` | Internal PM/Admin | CRM 1 - Interactions Timeline |
| 93 | `GET /api/leads/:id/status-history` | Internal PM/Admin | CRM 1 - Status Audit Trail |
| 94 | `POST /api/leads/:id/convert-to-client` | Internal PM/Admin | CRM 1 & 2 - Convert Lead |
| 95 | `POST /api/clients/create` | Internal PM/Admin | CRM 2 - Direct Client |
| 96 | `POST /api/clients` | Internal PM/Admin | CRM 2 - Direct Client |
| 97 | `GET /api/clients` | Internal PM/Admin | CRM 2 - Client List |
| 98 | `GET /api/clients/:id` | Internal PM/Admin | CRM 2 - Client Detail |
| 99 | `PUT /api/clients/:id` | Internal PM/Admin | CRM 2 - Update Client |
| 100 | `PUT /api/clients/:id/deactivate` | Internal PM/Admin | CRM 2 - Deactivate Client |
| 101 | `POST /api/clients/:clientId/contacts/add` | Internal / Client OWNER | CRM 2 - Add Contact |
| 102 | `GET /api/clients/:clientId/contacts` | Internal / Client Contact | CRM 2 - List Contacts |
| 103 | `PUT /api/clients/:clientId/contacts/:contactId/permission` | Internal / Client OWNER | CRM 2 - Contact Permission |
| 104 | `PUT /api/clients/:clientId/contacts/:contactId/deactivate` | Internal / Client OWNER | CRM 2 - Deactivate Contact |
| 105 | `POST /api/clients/:clientId/contacts/:contactId/reset-temp-password` | Internal PM/Admin | CRM 2 - Temp Password |
| 106 | `POST /api/client-auth/login` | Public | CRM 2 - Portal Login |
| 107 | `POST /api/client-auth/change-password` | Client Contact | CRM 2 - Change Password |
| 108 | `POST /api/client-auth/forgot-password` | Public | CRM 2 - Forgot Password |
| 109 | `POST /api/client-auth/reset-password` | Public | CRM 2 - Reset Password |
| 110 | `GET /api/client-auth/me` | Client Contact | CRM 2 - Profile Info |
| 111 | `POST /api/client-project-links/create` | Internal PM/Admin | CRM 3 - Link Project |
| 112 | `POST /api/client-project-links` | Internal PM/Admin | CRM 3 - Link Project |
| 113 | `GET /api/client-project-links/by-client/:clientId` | Internal PM/Admin | CRM 3 - Links by Client |
| 114 | `GET /api/client-project-links/by-project/:projectId` | Internal PM/Admin | CRM 3 - Links by Project |
| 115 | `PUT /api/client-project-links/:id/visibility` | Internal PM/Admin | CRM 3 - Toggle Visibility |
| 116 | `DELETE /api/client-project-links/:id` | Admin / Super Admin ONLY | CRM 3 - Unlink Project |
| 117 | `GET /api/client/projects/my` | Client Contact | CRM 3 - Portal Projects |
| 118 | `GET /api/client/dashboard` | Client Contact | CRM 4 - Aggregated Dashboard |
| 119 | `GET /api/client/projects/:projectId` | Client Contact | CRM 4 - Project Detail (Secured) |
| 120 | `GET /api/client/projects/:projectId/milestones` | Client Contact | CRM 4 - Project Milestones |
| 121 | `GET /api/client/projects/:projectId/timeline` | Client Contact | CRM 4 - Formatted Timeline |
| 122 | `PUT /api/client-auth/profile` | Client Contact | CRM 4 - Profile Update (Name/Phone) |
| 123 | `POST /api/client/session/log-login` | Client Contact | CRM 4 - Log Portal Session |
| 124 | `POST /api/client/session/heartbeat` | Client Contact | CRM 4 - Session Heartbeat Ping |