# NIRMAN ARCHITECTS - COMPLETE PROJECT API MASTER DIRECTORY & WORKING SPECIFICATION

This document provides a comprehensive, production-grade API reference and working specification for **every single API endpoint** in the **Nirman Architects** codebase (covering HRM, Core Identity, Attendance, Leave, Payroll, Offer Letters, Device Binding, Screenshots, App Usage, Notifications, and CRM Modules 1 through 9).

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
16. [CRM Module 4 - Client Portal Core APIs](#16-crm-module-4---client-portal-core-apis)
17. [CRM Module 5 - Drawing Approval Workflow APIs](#17-crm-module-5---drawing-approval-workflow-apis)
18. [CRM Module 6 - Client Document Access APIs](#18-crm-module-6---client-document-access-apis)
19. [CRM Module 7 - Client Chat System APIs](#19-crm-module-7---client-chat-system-apis)
20. [CRM Module 8 - Client Ticketing (Query/Support) APIs](#20-crm-module-8---client-ticketing-querysupport-apis)
21. [CRM Module 9 - Client Feedback & Satisfaction APIs](#21-crm-module-9---client-feedback--satisfaction-apis)
22. [Health & System APIs](#22-health--system-apis)
23. [Summary Table of All 165 API Endpoints](#summary-of-all-165-api-endpoints-by-module)

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

---

## 16. CRM MODULE 4 - CLIENT PORTAL CORE APIs

### 16.1 `GET /api/client/dashboard`
- **Description**: Aggregated dashboard endpoint for client portal (Web & Mobile). Returns active projects (with next milestone info), completed past projects, and user permission level.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.2 `GET /api/client/projects/:projectId`
- **Description**: Returns detailed project information (populated with PM and site location) with strict security linkage verification (`ClientProjectLink`).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.3 `GET /api/client/projects/:projectId/milestones`
- **Description**: Returns project milestone progress for client portal view.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.4 `GET /api/client/projects/:projectId/timeline`
- **Description**: Returns aggregated timeline events (start, milestones, schedule adjustments, estimated completion).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.5 `PUT /api/client-auth/profile`
- **Description**: Updates profile details (name and phone number) for logged-in ClientContact.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.6 `POST /api/client/session/log-login`
- **Description**: Logs portal session login (platform: `WEB`, `ANDROID`, `IOS`).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 16.7 `POST /api/client/session/heartbeat`
- **Description**: Session heartbeat ping updating `lastActiveAt` timestamp.
- **Auth**: Client Contact (`clientAuthMiddleware`).

---

## 17. CRM MODULE 5 - DRAWING APPROVAL WORKFLOW APIs

### 17.1 `GET /api/client/projects/:projectId/drawings`
- **Description**: Returns all project drawings visible to client (`visibleToClient: true`), grouped into `pendingApproval`, `approved`, and `changesRequested`. Enforces mandatory project linkage security check.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 17.2 `GET /api/client/drawings/:drawingId`
- **Description**: Returns full drawing detail and version history for a specific drawing.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 17.3 `GET /api/client/drawings/:drawingId/versions`
- **Description**: Returns version history list for a drawing, allowing independent viewing/downloading of historical revisions.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 17.4 `GET /api/client/drawings/:drawingId/compare`
- **Description**: Side-by-side version comparison data endpoint. Query params `versionA` and `versionB`.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 17.5 `POST /api/client/drawings/:drawingId/approve`
- **Description**: Client approves a drawing in `PENDING_CLIENT_APPROVAL` state. Updates status to `APPROVED`, creates audit entry in `ClientApprovalLog`, and notifies internal team. Restricted to `OWNER` or `MEMBER` permission levels (`VIEW_ONLY` blocked with HTTP 403). Handles double-approval race conditions (HTTP 409).
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).
- **Request Body**: `{ "comments": "Looks great, please proceed." }`

### 17.6 `POST /api/client/drawings/:drawingId/request-changes`
- **Description**: Client requests changes on a drawing. Updates status to `CHANGES_REQUESTED`, creates audit entry in `ClientApprovalLog`, and notifies Designer & PM. Mandatory non-empty `comments` required. Restricted to `OWNER` or `MEMBER` permission levels. Approved drawings are locked.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).
- **Request Body**: `{ "comments": "Please adjust pillar C3 axis by 150mm towards west wall." }`

### 17.7 `POST /api/client/drawings/:drawingId/comments`
- **Description**: Posts a comment or image-pinned annotation (`annotationCoords`) on a drawing. Supports private draft notes (`isDraft: true`) or shared comments (`isDraft: false`).
- **Auth**: Client Contact (`clientAuthMiddleware`).
- **Request Body**: `{ "commentText": "Verify beam joinery clearance", "annotationCoords": { "x": 100, "y": 250 }, "isDraft": false }`

### 17.8 `GET /api/client/drawings/:drawingId/comments`
- **Description**: Retrieves all shared comments for a drawing PLUS the calling contact's own draft notes (hides other contacts' drafts).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 17.9 `GET /api/drawings/:drawingId/client-approval-log`
- **Description**: Internal team view of full client approval audit trail for a drawing (who approved/rejected, when, comments).
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`, `ARCHITECT`).

---

## 18. CRM MODULE 6 - CLIENT DOCUMENT ACCESS APIs

### 18.1 `GET /api/client/projects/:projectId/documents`
- **Description**: Returns all client-visible documents (`visibleToClient: true`, default opt-in) for a project, grouped by folder/category (`Contracts`, `Approved Drawings PDFs`, `Photos`, `Invoices`, `Other Shared Documents`). Supports query parameters `folder` and `search`.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 18.2 `GET /api/client/documents/:documentId/preview`
- **Description**: Serves preview data/stream for inline PDF/image rendering. Performs dual security cascade check (verifies BOTH `Document.visibleToClient === true` AND parent project link is active/visible). Logs `VIEW` action to `ClientDocumentAccessLog`.
- **Auth**: Client Contact (`clientAuthMiddleware` - All permission levels: OWNER, MEMBER, VIEW_ONLY).

### 18.3 `GET /api/client/documents/:documentId/download`
- **Description**: Streams file for download. Performs dual security cascade check. Gracefully handles soft-deleted files (`isDeleted: true`) returning HTTP 410. Logs `DOWNLOAD` action to `ClientDocumentAccessLog`.
- **Auth**: Client Contact (`clientAuthMiddleware` - All permission levels: OWNER, MEMBER, VIEW_ONLY).

### 18.4 `GET /api/documents/:documentId/client-access-log`
- **Description**: Internal PM/Admin view listing all client contacts who have viewed or downloaded a specific document with timestamps.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`, `ARCHITECT`).

### 18.5 `GET /api/documents/client-engagement/:clientId`
- **Description**: Internal PM/Admin engagement summary for a client: counts total shared documents, total engaged documents (viewed/downloaded), and lists un-opened shared documents for follow-up prioritization.
- **Auth**: Internal Employee (`PROJECT_MANAGER`, `ADMIN`, `SUPER_ADMIN`, `HR`, `ARCHITECT`).

---

## 19. CRM MODULE 7 - CLIENT CHAT SYSTEM APIs

### 19.1 `GET /api/client/chat/unread-counts`
- **Description**: Returns unread message count per linked project for the calling ClientContact.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 19.2 `GET /api/client/chat/:projectId?since=`
- **Description**: Returns chronological chat history for a project (interleaved employee and client contact messages populated with specific contact details like `"Rajesh Patel (OWNER)"`). Supports `since` query parameter for reconnect gap filling. Enforces mandatory project linkage check.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 19.3 `POST /api/client/chat/:projectId/message`
- **Description**: Client posts a chat message into project thread. Persists message, triggers real-time Socket.io broadcast to `project_<projectId>` room. Restricted to `OWNER` or `MEMBER` permission levels (`VIEW_ONLY` blocked with HTTP 403).
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).
- **Request Body**: `{ "messageText": "Verified pillar layout", "mentionedIds": ["64bd..."], "replyToMessageId": "64bd..." }`

### 19.4 `POST /api/client/chat/:projectId/sync`
- **Description**: Batch sync endpoint for offline-composed messages. Accepts an array of messages composed while offline, persisting each with `isOfflineSync: true` and preserving `localComposedAt` chronological ordering.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).
- **Request Body**: `{ "messages": [{ "messageText": "Offline note 1", "localComposedAt": "2026-08-05T10:00:00Z" }] }`

### 19.5 `PUT /api/client/chat/:projectId/mark-read`
- **Description**: Updates `ClientChatReadStatus.lastReadMessageAt` for calling contact and project, resetting unread count.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 19.6 `GET /api/chat/:projectId`
- **Description**: Internal team view fetching full unified project chat history.
- **Auth**: Internal Employee (`authMiddleware`).

### 19.7 `POST /api/chat/:projectId/message`
- **Description**: Internal employee posts message into project chat workspace and broadcasts via Socket.io.
- **Auth**: Internal Employee (`authMiddleware`).

---

## 20. CRM MODULE 8 - CLIENT TICKETING (QUERY/SUPPORT) APIs

### 20.1 `POST /api/client/tickets/create`
- **Description**: Raises a new client support ticket. Auto-assigns responsible user to the project's PM (`projectManager`). Enforces linkage check. `OWNER` / `MEMBER` allowed; `VIEW_ONLY` blocked with HTTP 403. Supports file attachments.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).
- **Request Body**: `{ "projectId": "64bd...", "subject": "Drawing discrepancy", "description": "Column dimensions on page 2 need review.", "priority": "High" }`

### 20.2 `GET /api/client/tickets/my`
- **Description**: Lists all support tickets belonging to the client organization (shared visibility across all contacts of the client). Supports `status` and `projectId` filters.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 20.3 `GET /api/client/tickets/:id`
- **Description**: Returns full ticket detail along with complete chronological response thread (formatted with role names). Enforces cross-client security boundary.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 20.4 `POST /api/client/tickets/:id/respond`
- **Description**: Adds a client response to a ticket thread (`OWNER` / `MEMBER` only). Supports file attachments.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).

### 20.5 `POST /api/client/tickets/:id/reopen`
- **Description**: Reopens a `CLOSED` ticket within a 14-day server-validated grace period. Resets status to `OPEN`, increments `reopenedCount`, and notifies assigned PM.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).

### 20.6 `POST /api/client/tickets/:id/cancel`
- **Description**: Cancels an `OPEN` or `IN_PROGRESS` ticket.
- **Auth**: Client Contact (`clientAuthMiddleware` - `OWNER` / `MEMBER` only).

### 20.7 `GET /api/tickets/all`
- **Description**: Internal team view listing all client tickets across projects with status, priority, assignedTo, and project filters.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

### 20.8 `POST /api/tickets/:id/respond`
- **Description**: Internal staff member responds to client ticket thread. Auto-transitions status from `OPEN` to `IN_PROGRESS` on first reply.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

### 20.9 `PUT /api/tickets/:id/status`
- **Description**: Updates ticket status (`IN_PROGRESS`, `RESOLVED`, `CLOSED`, etc.). Sets `resolvedAt` and `closedAt` timestamps.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

### 20.10 `PUT /api/tickets/:id/reassign`
- **Description**: Reassigns ticket to another internal employee and creates an audit record in `ClientTicketAssignmentLog`.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

---

## 21. CRM MODULE 9 - CLIENT FEEDBACK & SATISFACTION APIs

### 21.1 `GET /api/feedback-category/active`
- **Description**: Retrieves active feedback rating categories for rendering client portal feedback forms.
- **Auth**: Public / Client / Employee.

### 21.2 `POST /api/feedback-category/create`
- **Description**: Creates a new dynamic feedback rating category (e.g., "Value for Money", "Communication").
- **Auth**: Internal Employee (`authMiddleware` - Super Admin / Admin).

### 21.3 `PUT /api/feedback-category/:id/deactivate`
- **Description**: Toggles active state of a feedback category.
- **Auth**: Internal Employee (`authMiddleware` - Super Admin / Admin).

### 21.4 `GET /api/client/feedback/pending-prompts`
- **Description**: Retrieves all `PENDING` feedback prompts for the calling client contact.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 21.5 `POST /api/client/feedback/:promptId/submit`
- **Description**: Submits client satisfaction feedback (1-5 stars overall rating, category ratings, comments). Updates prompt status to `SUBMITTED`. Explicit Exception: Allowed for ALL permission levels (`OWNER`, `MEMBER`, and `VIEW_ONLY`).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 21.6 `POST /api/client/feedback/:promptId/skip`
- **Description**: Permanently skips a pending feedback prompt for a trigger event. Updates prompt status to `SKIPPED`.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 21.7 `GET /api/client/feedback/my`
- **Description**: Retrieves calling contact's personal submitted feedback history.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 21.8 `GET /api/client/feedback/project/:projectId`
- **Description**: Retrieves all feedback submitted for a project by any contact under the client account.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 21.9 `GET /api/feedback/all`
- **Description**: Internal team view listing all submitted client feedback with rating range, project, client, and date filters.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

### 21.10 `GET /api/feedback/aggregate-summary`
- **Description**: Computes company-wide or project-specific satisfaction metrics (average overall rating, star rating distribution, category rating averages).
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

---

## 22. CRM MODULE 10 - CLIENT NOTIFICATIONS APIs

### 22.1 `GET /api/client/notifications/my`
- **Description**: Retrieves paginated notifications list for calling ClientContact with optional `isRead` filter.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.2 `GET /api/client/notifications/unread-count`
- **Description**: Returns unread notification count for rendering bell icon badge.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.3 `PUT /api/client/notifications/:id/read`
- **Description**: Marks a single notification as read.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.4 `PUT /api/client/notifications/mark-all-read`
- **Description**: Bulk marks all notifications as read for calling contact.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.5 `GET /api/client/notifications/preferences`
- **Description**: Retrieves calling contact's channel delivery preferences (`pushEnabled`, `emailEnabled`, `whatsappEnabled`).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.6 `PUT /api/client/notifications/preferences`
- **Description**: Updates contact's notification channel delivery preferences.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.7 `POST /api/client/notifications/register-device`
- **Description**: Registers mobile push notification device token (`ANDROID` / `IOS`).
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.8 `DELETE /api/client/notifications/unregister-device`
- **Description**: Deactivates push device token on logout.
- **Auth**: Client Contact (`clientAuthMiddleware`).

### 22.9 `GET /api/notifications/:notificationId/delivery-log`
- **Description**: Internal audit view listing exact channel delivery attempts and statuses for a notification ID.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / HR / Architect).

### 22.10 `POST /api/notifications/whatsapp-config` & `GET /api/notifications/whatsapp-config/status`
- **Description**: Super Admin configures WhatsApp Business API credentials & checks configuration status.
- **Auth**: Internal Employee (`authMiddleware` - Super Admin / Admin).

---

## 23. ERP MODULE 1 - PROJECT MANAGEMENT APIs

### 23.1 `POST /api/projects/create`
- **Description**: Creates a new project in initial status `New`. Captures `projectName`, `clientInformation` text reference label, `address`, `budget`, `priority`, `projectCategoryId`, `startDate`, and `estimatedCompletion`.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.2 `GET /api/projects`
- **Description**: Paginated, filterable projects list (`status`, `priority`, `categoryId`, `search`). Enforces role-scoped visibility: Architects/Designers/Employees see ONLY projects they are assigned to on the team; Admins/PMs see all.
- **Auth**: Internal Employee (`authMiddleware`).

### 23.3 `GET /api/projects/:id`
- **Description**: Full project detail including populated team members, milestones, and RACI responsibility matrix.
- **Auth**: Internal Employee (`authMiddleware`).

### 23.4 `PUT /api/projects/:id`
- **Description**: General project fields update (projectName, address, budget, priority, category, timeline dates). Automatically recalculates `isDelayed` flag.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.5 `PUT /api/projects/:id/update-status`
- **Description**: Updates project status (`New`, `Planning`, `In Progress`, `On Hold`, `Approval Pending`, `Site Work`, `Completed`, `Archived`). Creates an audit record in `ProjectStatusHistory`.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.6 `GET /api/projects/:id/status-history`
- **Description**: Retrieves full audit log of project status transitions.
- **Auth**: Internal Employee (`authMiddleware`).

### 23.7 `POST /api/projects/:id/milestones/add`
- **Description**: Adds a named milestone checkpoint with target date to project timeline.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.8 `PUT /api/projects/:id/milestones/:milestoneId/complete`
- **Description**: Completes a milestone (`isCompleted: true`, `completedDate: now`). Triggers auto-recalculation of `progressPercentage` if not manually overridden.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin / Architect / Designer).

### 23.9 `PUT /api/projects/:id/progress`
- **Description**: Allows PM to manually override project progress percentage (`progressIsManualOverride: true`).
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.10 `POST /api/projects/:id/team/assign`
- **Description**: Assigns an HRM employee to the project team with custom projectRole (e.g. "Lead Designer") and departmentId.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.11 `DELETE /api/projects/:id/team/:userId/remove`
- **Description**: Removes an employee from project active team while preserving past task/drawing historical attribution.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.12 `POST /api/projects/:id/responsibility-matrix/add`
- **Description**: Adds an area entry to RACI responsibility matrix mapping Responsible, Accountable, Consulted, and Informed team members.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 23.13 `GET /api/projects/:id/progress-breakdown`
- **Description**: Returns overall project progress percentage along with placeholder breakdown objects ready for upcoming Task and Drawing modules.
- **Auth**: Internal Employee (`authMiddleware`).

### 23.14 `POST /api/project-category/create` & `GET /api/project-category/active`
- **Description**: Dynamic master endpoints to create and list project categories (e.g. "Residential Villa", "Commercial Complex").
- **Auth**: Internal Employee (`authMiddleware`).

### 23.15 `POST /api/department/create` & `GET /api/department/active`
- **Description**: Dynamic master endpoints to create and list internal company departments.
- **Auth**: Internal Employee (`authMiddleware`).

---

## 24. ERP MODULE 2 - TASK MANAGEMENT SYSTEM APIs

### 24.1 `POST /api/tasks/create`
- **Description**: Creates a new task in initial status `Pending`. Captures `projectId`, `taskName`, `description`, `priority`, `departmentId`, `assignedEmployee`, `estimatedTime`, `deadline`, and `dependsOn`. Validates dependencies belong to the same project.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 24.2 `GET /api/tasks`
- **Description**: Paginated, filterable tasks list (`projectId`, `status`, `assignedEmployee`, `priority`). Role-scoped: Employees see tasks for projects they are assigned to or assigned to them; PMs/Admins see all.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.3 `GET /api/tasks/:id`
- **Description**: Full task details populated with project, assigned employee, department, and dependencies.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.4 `PUT /api/tasks/:id`
- **Description**: Updates general task details (taskName, description, priority, department, estimatedTime, deadline).
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 24.5 `PUT /api/tasks/:id/accept` & `PUT /api/tasks/:id/reject`
- **Description**: Assigned employee accepts (`Pending` -> `Accepted`) or rejects (`Pending` -> `Rejected` with reason) a task. Rejection routes to PM/Admin for reassignment.
- **Auth**: Internal Employee (`authMiddleware` - Assigned Employee only).

### 24.6 `PUT /api/tasks/:id/start`
- **Description**: Assigned employee starts task work (`Accepted` -> `In Progress`). Stamps `actualStartTime = server now`. Hard-blocked if any dependent task in `dependsOn` is not `Completed`.
- **Auth**: Internal Employee (`authMiddleware` - Assigned Employee only).

### 24.7 `PUT /api/tasks/:id/submit-for-review` & `PUT /api/tasks/:id/approve`
- **Description**: Assigned employee submits for review (`In Progress` -> `Review`), and PM/Admin approves (`Review` -> `Approved`).
- **Auth**: Assigned Employee for submit / PM & Admin for approve.

### 24.8 `PUT /api/tasks/:id/complete`
- **Description**: Marks task completed (`Approved` -> `Completed`). Stamps `completionTime = server now`, calculates `totalWorkingTimeMinutes`, and queries HRM's `AppUsageDailySummary` to correlate `idleTimeMinutes` and `productivityScore`.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.9 `GET /api/tasks/:id/status-history`
- **Description**: Audit log of workflow status transitions for a task.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.10 `PUT /api/tasks/:id/reassign`
- **Description**: PM/Admin reassigns task to a new employee. Creates an audit record in `TaskReassignmentLog` and resets status to `Pending`.
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 24.11 `POST /api/tasks/:id/checklist/add`, `PUT /toggle`, `DELETE /:itemId`
- **Description**: Add, toggle completion, or delete sub-checklist items on a task.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.12 `POST /api/tasks/:id/comments/add` & `GET /api/tasks/:id/comments`
- **Description**: Post and view discussion comments on a task. Available to all team members assigned to the parent project.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.13 `GET /api/tasks/:id/time-analysis`
- **Description**: Retrieves live/final time analysis metrics (`actualStartTime`, `completionTime`, `totalWorkingTimeMinutes`, `isDelayed`, `idleTimeMinutes`, `productivityScore`) correlated from HRM's `AppUsageDailySummary`.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.14 `GET /api/tasks/overdue` & `GET /api/tasks/pending-review-too-long`
- **Description**: Lists overdue tasks (past deadline) and tasks stuck in Review status beyond configurable threshold.
- **Auth**: Internal Employee (`authMiddleware`).

### 24.15 `GET /api/projects/:projectId/tasks/breakdown`
- **Description**: Returns project tasks breakdown statistics (`totalTasks`, `completedTasks`, `delayedTasks`, `byEmployee`), populating ERP Module 1's progress breakdown.
- **Auth**: Internal Employee (`authMiddleware`).

---

## 25. ERP MODULE 3 - DRAWING MANAGEMENT SYSTEM APIs

### 25.1 `POST /api/drawings/create`
- **Description**: Creates a parent drawing record (`projectId`, `drawingName`, `categoryId`, `drawingNumber`).
- **Auth**: Internal Employee (`authMiddleware` - Architect / Designer / PM / Admin / SuperAdmin).

### 25.2 `POST /api/drawings/:drawingId/versions/upload`
- **Description**: Uploads a new drawing version (`filePath`, `fileType`, `changeLog`). Auto-increments version number (v1, v2, v3...), enforces the "never permanently replaced" rule, and updates parent `currentVersionId`. Blocked if drawing is GFC locked.
- **Auth**: Internal Employee (`authMiddleware` - Architect / Designer / PM / Admin / SuperAdmin).

### 25.3 `GET /api/drawings` & `GET /api/drawings/:id`
- **Description**: Paginated drawings list and drawing detail view populated with category, current version, and full version history list.
- **Auth**: Internal Employee (`authMiddleware`).

### 25.4 `GET /api/drawings/:id/versions` & `GET /api/drawings/:id/compare`
- **Description**: Retrieves all historical versions for a drawing and side-by-side comparison data between two specified version numbers.
- **Auth**: Internal Employee (`authMiddleware`).

### 25.5 `PUT /api/drawing-versions/:versionId/pm-review`
- **Description**: PM review gate (`APPROVE` -> `PM_APPROVED`, `REJECT` -> `PM_REJECTED` with mandatory comments).
- **Auth**: Internal Employee (`authMiddleware` - PM / Admin / SuperAdmin).

### 25.6 `PUT /api/drawing-versions/:versionId/admin-review`
- **Description**: Admin review gate (`APPROVE` -> `PENDING_CLIENT_APPROVAL`, `visibleToClient: true` — THE HANDOFF POINT TO CRM MODULE 5; `REJECT` -> `ADMIN_REJECTED` with mandatory comments).
- **Auth**: Internal Employee (`authMiddleware` - Admin / SuperAdmin).

### 25.7 `PUT /api/drawings/:id/promote-to-gfc` & `PUT /api/drawings/:id/unlock-gfc`
- **Description**: Promotes drawing to GFC locked version (`isGFCLocked: true`, blocking further version uploads), and unlocks GFC drawing (Super Admin only with logged reason).
- **Auth**: Admin/SuperAdmin for promote / SuperAdmin for unlock.

### 25.8 `PUT /api/drawing-versions/:versionId/edit-in-place`
- **Description**: Performs in-place file edit for Process DWG category drawings without creating a new version number.
- **Auth**: Internal Employee (`authMiddleware` - Admin / SuperAdmin only).

### 25.9 `GET /api/drawing-versions/:versionId/client-approval-log`
- **Description**: Internal team view of CRM Module 5 client approval audit log.
- **Auth**: Internal Employee (`authMiddleware`).

### 25.10 `POST /api/drawing-category/create` & `GET /api/drawing-category/active`
- **Description**: Dynamic master endpoints to create and list drawing categories (seeds master categories: Concept, Working, Process DWG, GFC, Site, Interior).
- **Auth**: Internal Employee (`authMiddleware`).

### 25.11 `GET /api/projects/:projectId/drawings/breakdown`
- **Description**: Returns project drawings breakdown statistics (`totalDrawings`, `approvedCount`, `pendingReviewCount`, `pendingClientApprovalCount`, `changesRequestedCount`), populating ERP Module 1's progress breakdown.
- **Auth**: Internal Employee (`authMiddleware`).

---

## 26. ERP MODULE 4 - JPEG/3D DRAWING REVIEW APIs

### 26.1 `GET /api/drawing-versions/:versionId/review-data`
- **Description**: Returns aggregated review data payload (`drawingVersion`, `drawing`, `comments`, `markings`) for instant initialization of the shared interactive viewer component.
- **Auth**: Internal Employee (`authMiddleware`).

### 26.2 `POST /api/drawing-versions/:versionId/comments` & `GET /api/drawing-versions/:versionId/comments`
- **Description**: Internal employee posts general Comment (`annotationCoords` null) or pinned Note (`annotationCoords` present with image coordinates), and retrieves shared ERP + CRM comments and notes for a version.
- **Auth**: Internal Employee (`authMiddleware`).

### 26.3 `POST /api/drawing-versions/:versionId/markings` & `GET /api/drawing-versions/:versionId/markings`
- **Description**: Creates freehand or shape marking annotations (`FREEHAND`, `RECTANGLE`, `CIRCLE`, `ARROW`, `HIGHLIGHT_AREA`), and retrieves version markings list.
- **Auth**: Internal Employee (`authMiddleware`).

### 26.4 `DELETE /api/drawing-versions/:versionId/markings/:markingId`
- **Description**: Deletes a marking annotation (restricted to author or Admin/SuperAdmin override).
- **Auth**: Internal Employee (`authMiddleware`).

---

## 27. ERP MODULE 5 - INTERNAL PROJECT CHAT APIs

### 27.1 `GET /api/projects/:projectId/chat` & `GET /api/chat/:projectId`
- **Description**: Team-scoped (or Admin company-wide oversight) internal project chat history retrieval, seamlessly interleaving EMPLOYEE and CLIENT_CONTACT messages, resolving `linkedTaskId` and `linkedDrawingVersionId` into display summary metadata.
- **Auth**: Internal Employee (`authMiddleware` - Team Assigned / Admin / SuperAdmin).

### 27.2 `POST /api/projects/:projectId/chat/message` & `POST /api/chat/:projectId/message`
- **Description**: Posts internal chat message with optional contextual cross-linking (`linkedTaskId`, `linkedDrawingVersionId`) validated to belong to the same project. Broadcasts `new_message` event via Socket.io to project room.
- **Auth**: Internal Employee (`authMiddleware` - Team Assigned / Admin / SuperAdmin).

### 27.3 `POST /api/projects/:projectId/chat/sync` & `POST /api/chat/:projectId/sync`
- **Description**: Processes offline batch synced messages (`isOfflineSync: true`) composed while disconnected.
- **Auth**: Internal Employee (`authMiddleware` - Team Assigned / Admin / SuperAdmin).

### 27.4 `PUT /api/projects/:projectId/chat/mark-read` & `PUT /api/chat/:projectId/mark-read`
- **Description**: Updates `EmployeeChatReadStatus.lastReadMessageAt` for the calling employee.
- **Auth**: Internal Employee (`authMiddleware` - Team Assigned / Admin / SuperAdmin).

### 27.5 `GET /api/chat/unread-counts`
- **Description**: Returns unread chat message counts across all projects accessible to the employee.
- **Auth**: Internal Employee (`authMiddleware`).

---

## 28. ERP MODULE 6 - DOCUMENT MANAGEMENT APIs

### 28.1 `POST /api/projects/:projectId/document-folders/create` & `GET /api/projects/:projectId/document-folders`
- **Description**: Creates a new project document folder and lists active project folders.
- **Auth**: Internal Employee (`authMiddleware`).

### 28.2 `POST /api/documents/upload` & `POST /api/documents/:id/versions/upload`
- **Description**: Uploads a new document with initial v1 (`visibleToClient: false` default) or uploads a new `DocumentVersion` (auto-increments version number and automatically RESETS `visibleToClient` to `false`). Validates file types against `['PDF', 'DWG', 'JPEG', 'PNG', 'DOCX', 'XLSX', 'ZIP']`.
- **Auth**: Internal Employee (`authMiddleware`).

### 28.3 `PUT /api/documents/:id/visibility`
- **Description**: PM/Admin toggle control for `visibleToClient` boolean flag. This is the literal handoff action that makes a document appear or disappear in CRM Module 6's client portal.
- **Auth**: PM / Admin / Super Admin (`authMiddleware`).

### 28.4 `GET /api/documents/:id/preview` & `GET /api/documents/:id/download`
- **Description**: Authorizes preview or download of document files, enforcing `restrictedToRoles` checks and automatically logging `VIEW` or `DOWNLOAD` actions into `DocumentAccessLog`.
- **Auth**: Internal Employee (`authMiddleware`).

### 28.5 `GET /api/documents/:id/access-log` & `GET /api/documents/client/:clientId/engagement-summary`
- **Description**: Retrieves internal and client view/download audit logs for a document, and computes client document engagement statistics (engaged vs never opened).
- **Auth**: PM / Admin / Super Admin (`authMiddleware`).

---

## 29. ERP MODULE 7 - PROJECT ANALYSIS & DASHBOARDS APIs

### 29.1 `GET /api/projects/:id/dashboard`
- **Description**: Returns aggregated project dashboard metrics (overall progress %, completion %, delay status `isDelayed`, overdue task count, pending tasks count, employee performance summary, drawing status summary, budget, timeline data).
- **Auth**: Project Team Member / Admin / Super Admin (`authMiddleware`).

### 29.2 `GET /api/projects/:id/analysis/employee-wise` & `GET /api/projects/:id/analysis/employee-wise/:userId`
- **Description**: Computes per-employee performance metrics per project (assigned tasks, completed tasks, delayed tasks, average completion minutes, average productivity score excluding nulls, total working minutes, and HRM Attendance cross-referencing office vs site days). Detailed team comparison restricted to PM/Admin; regular employees receive personal breakdown.
- **Auth**: PM / Admin / Super Admin for full team; Project Team Member for personal view (`authMiddleware`).

### 29.3 `GET /api/projects/:id/analysis/task-wise`
- **Description**: Formatted, filterable task analysis reporting view (supports filtering by `status`, `priority`, `assignedEmployee`, converting working minutes to actual hours).
- **Auth**: Project Team Member / Admin / Super Admin (`authMiddleware`).

### 29.4 `GET /api/projects/:id/analysis/drawing-wise` & `GET /api/projects/:id/analysis/department-wise`
- **Description**: Computes drawing-wise progress (version status and category breakdown with approval rates) and department-wise progress (task completion rates grouped by internal Department master).
- **Auth**: Project Team Member / Admin / Super Admin (`authMiddleware`).

### 29.5 `GET /api/analytics/company-wide-summary`
- **Description**: Aggregates company-wide analytics across all active projects for the Admin Dashboard (total projects by status, average progress %, delayed projects list).
- **Auth**: Admin / Super Admin (`authMiddleware`).

### 29.6 `POST /api/analytics/refresh-snapshot/:projectId` & `GET /api/analytics/snapshot/:projectId`
- **Description**: Refreshes and retrieves cached project analytics snapshot from `ProjectAnalyticsSnapshot`.
- **Auth**: Admin / Super Admin (`authMiddleware`).

---

## 30. HEALTH & SYSTEM APIs

### 30.1 `GET /api/health`
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

## SUMMARY OF ALL 268 API ENDPOINTS BY MODULE

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
| 125 | `GET /api/client/projects/:projectId/drawings` | Client Contact | CRM 5 - Grouped Drawings List |
| 126 | `GET /api/client/drawings/:drawingId` | Client Contact | CRM 5 - Drawing Detail & Versions |
| 127 | `GET /api/client/drawings/:drawingId/versions` | Client Contact | CRM 5 - Drawing Version History |
| 128 | `GET /api/client/drawings/:drawingId/compare` | Client Contact | CRM 5 - Side-by-Side Version Compare |
| 129 | `POST /api/client/drawings/:drawingId/approve` | Client OWNER / MEMBER | CRM 5 - Approve Drawing |
| 130 | `POST /api/client/drawings/:drawingId/request-changes` | Client OWNER / MEMBER | CRM 5 - Request Changes (Comments Req) |
| 131 | `POST /api/client/drawings/:drawingId/comments` | Client Contact | CRM 5 - Post Drawing Annotation/Comment |
| 132 | `GET /api/client/drawings/:drawingId/comments` | Client Contact | CRM 5 - List Comments & Draft Notes |
| 133 | `GET /api/drawings/:drawingId/client-approval-log` | PM / Admin / Architect | CRM 5 - Client Approval Audit Log |
| 134 | `GET /api/client/projects/:projectId/documents` | Client Contact | CRM 6 - Grouped Documents List |
| 135 | `GET /api/client/documents/:documentId/preview` | Client Contact | CRM 6 - Preview Document (Logs VIEW) |
| 136 | `GET /api/client/documents/:documentId/download` | Client Contact | CRM 6 - Download Document (Logs DOWNLOAD) |
| 137 | `GET /api/documents/:documentId/client-access-log` | PM / Admin / Architect | CRM 6 - Document Access Audit Log |
| 138 | `GET /api/documents/client-engagement/:clientId` | PM / Admin / Architect | CRM 6 - Client Engagement Summary |
| 139 | `GET /api/client/chat/unread-counts` | Client Contact | CRM 7 - Unread Chat Message Counts |
| 140 | `GET /api/client/chat/:projectId` | Client Contact | CRM 7 - Project Chat History Timeline |
| 141 | `POST /api/client/chat/:projectId/message` | Client OWNER / MEMBER | CRM 7 - Send Chat Message (Socket.io Broadcast) |
| 142 | `POST /api/client/chat/:projectId/sync` | Client OWNER / MEMBER | CRM 7 - Sync Offline Messages Batch |
| 143 | `PUT /api/client/chat/:projectId/mark-read` | Client Contact | CRM 7 - Mark Chat Read Timestamp |
| 144 | `GET /api/chat/:projectId` | Internal Employee | CRM 7 - Internal Project Chat History |
| 145 | `POST /api/chat/:projectId/message` | Internal Employee | CRM 7 - Internal Team Send Message |
| 146 | `POST /api/client/tickets/create` | Client OWNER / MEMBER | CRM 8 - Raise Support Ticket |
| 147 | `GET /api/client/tickets/my` | Client Contact | CRM 8 - List Client Tickets |
| 148 | `GET /api/client/tickets/:id` | Client Contact | CRM 8 - Ticket Detail & Response Thread |
| 149 | `POST /api/client/tickets/:id/respond` | Client OWNER / MEMBER | CRM 8 - Add Client Response |
| 150 | `POST /api/client/tickets/:id/reopen` | Client OWNER / MEMBER | CRM 8 - Reopen Closed Ticket (14-day grace) |
| 151 | `POST /api/client/tickets/:id/cancel` | Client OWNER / MEMBER | CRM 8 - Cancel Ticket |
| 152 | `GET /api/tickets/all` | PM / Admin / Architect | CRM 8 - Internal Team Tickets List |
| 153 | `POST /api/tickets/:id/respond` | PM / Admin / Architect | CRM 8 - Internal Staff Response |
| 154 | `PUT /api/tickets/:id/status` | PM / Admin / Architect | CRM 8 - Update Ticket Status |
| 155 | `PUT /api/tickets/:id/reassign` | PM / Admin / Architect | CRM 8 - Reassign Ticket Employee |
| 156 | `GET /api/feedback-category/active` | Public / Client / Staff | CRM 9 - Active Feedback Categories |
| 157 | `POST /api/feedback-category/create` | Super Admin / Admin | CRM 9 - Create Category Master |
| 158 | `PUT /api/feedback-category/:id/deactivate` | Super Admin / Admin | CRM 9 - Deactivate Category |
| 159 | `GET /api/client/feedback/pending-prompts` | Client Contact | CRM 9 - Pending Feedback Prompts |
| 160 | `POST /api/client/feedback/:promptId/submit` | Client Contact (All Roles) | CRM 9 - Submit Feedback |
| 161 | `POST /api/client/feedback/:promptId/skip` | Client Contact | CRM 9 - Skip Feedback Prompt |
| 162 | `GET /api/client/feedback/my` | Client Contact | CRM 9 - Personal Feedback History |
| 163 | `GET /api/client/feedback/project/:projectId` | Client Contact | CRM 9 - Shared Project Feedback |
| 164 | `GET /api/feedback/all` | PM / Admin / Super Admin | CRM 9 - Internal List Feedback |
| 165 | `GET /api/feedback/aggregate-summary` | PM / Admin / Super Admin | CRM 9 - Satisfaction Analytics Summary |
| 166 | `GET /api/client/notifications/my` | Client Contact | CRM 10 - Client Notifications List |
| 167 | `GET /api/client/notifications/unread-count` | Client Contact | CRM 10 - Unread Notification Badge Count |
| 168 | `PUT /api/client/notifications/:id/read` | Client Contact | CRM 10 - Mark Single Notification Read |
| 169 | `PUT /api/client/notifications/mark-all-read` | Client Contact | CRM 10 - Bulk Mark All Notifications Read |
| 170 | `GET /api/client/notifications/preferences` | Client Contact | CRM 10 - Notification Channel Preferences |
| 171 | `PUT /api/client/notifications/preferences` | Client Contact | CRM 10 - Update Channel Preferences |
| 172 | `POST /api/client/notifications/register-device` | Client Contact | CRM 10 - Register Push Device Token |
| 173 | `DELETE /api/client/notifications/unregister-device` | Client Contact | CRM 10 - Unregister Push Device Token |
| 174 | `GET /api/notifications/:notificationId/delivery-log` | PM / Admin / Architect | CRM 10 - Internal Delivery Audit Log |
| 175 | `POST /api/notifications/whatsapp-config` | Super Admin | CRM 10 - WhatsApp Business API Config |
| 176 | `POST /api/projects/create` | PM / Admin / Super Admin | ERP 1 - Create Project |
| 177 | `GET /api/projects` | Employee / Auth | ERP 1 - Paginated Role-Scoped Projects List |
| 178 | `GET /api/projects/:id` | Employee / Auth | ERP 1 - Project Detail & RACI Matrix |
| 179 | `PUT /api/projects/:id` | PM / Admin / Super Admin | ERP 1 - Update Project General Details |
| 180 | `PUT /api/projects/:id/update-status` | PM / Admin / Super Admin | ERP 1 - Update Status & Audit Log |
| 181 | `GET /api/projects/:id/status-history` | Employee / Auth | ERP 1 - Project Status Transition History |
| 182 | `POST /api/projects/:id/milestones/add` | PM / Admin / Super Admin | ERP 1 - Add Project Milestone |
| 183 | `PUT /api/projects/:id/milestones/:milestoneId/complete` | PM / Admin / Arch / Des | ERP 1 - Complete Milestone (Auto-Progress) |
| 184 | `PUT /api/projects/:id/milestones/:milestoneId` | PM / Admin / Super Admin | ERP 1 - Update Milestone Details |
| 185 | `DELETE /api/projects/:id/milestones/:milestoneId` | PM / Admin / Super Admin | ERP 1 - Delete Milestone |
| 186 | `PUT /api/projects/:id/progress` | PM / Admin / Super Admin | ERP 1 - PM Manual Progress Override |
| 187 | `POST /api/projects/:id/team/assign` | PM / Admin / Super Admin | ERP 1 - Assign Team Member & Role |
| 188 | `DELETE /api/projects/:id/team/:userId/remove` | PM / Admin / Super Admin | ERP 1 - Remove Team Member |
| 189 | `PUT /api/projects/:id/team/:userId/role` | PM / Admin / Super Admin | ERP 1 - Update Team Member Project Role |
| 190 | `GET /api/projects/:id/team` | Employee / Auth | ERP 1 - List Project Team Members |
| 191 | `POST /api/projects/:id/responsibility-matrix/add` | PM / Admin / Super Admin | ERP 1 - Add RACI Matrix Entry |
| 192 | `GET /api/projects/:id/responsibility-matrix` | Employee / Auth | ERP 1 - Get RACI Responsibility Matrix |
| 193 | `GET /api/projects/:id/progress-breakdown` | Employee / Auth | ERP 1 - Progress Breakdown Placeholder |
| 194 | `POST /api/project-category/create` | Super Admin / Admin | ERP 1 - Create Category Master |
| 195 | `GET /api/project-category/active` | Employee / Auth | ERP 1 - Active Project Categories List |
| 196 | `PUT /api/project-category/:id/deactivate` | Super Admin / Admin | ERP 1 - Deactivate Category Master |
| 197 | `POST /api/department/create` | Super Admin / Admin | ERP 1 - Create Department Master |
| 198 | `GET /api/department/active` | Employee / Auth | ERP 1 - Active Departments List |
| 199 | `POST /api/tasks/create` | PM / Admin / Super Admin | ERP 2 - Create Task (With Same-Project Dep Check) |
| 200 | `GET /api/tasks` | Employee / Auth | ERP 2 - Paginated & Role-Scoped Tasks List |
| 201 | `GET /api/tasks/:id` | Employee / Auth | ERP 2 - Task Detail |
| 202 | `PUT /api/tasks/:id` | PM / Admin / Super Admin | ERP 2 - Update Task General Details |
| 203 | `PUT /api/tasks/:id/accept` | Assigned Employee Only | ERP 2 - Accept Task (Pending -> Accepted) |
| 204 | `PUT /api/tasks/:id/reject` | Assigned Employee Only | ERP 2 - Reject Task (Pending -> Rejected) |
| 205 | `PUT /api/tasks/:id/start` | Assigned Employee Only | ERP 2 - Start Task (Stamps actualStartTime) |
| 206 | `PUT /api/tasks/:id/submit-for-review` | Assigned Employee Only | ERP 2 - Submit for Review (In Progress -> Review) |
| 207 | `PUT /api/tasks/:id/approve` | PM / Admin / Super Admin | ERP 2 - Reviewer Approve Task (Review -> Approved) |
| 208 | `PUT /api/tasks/:id/complete` | Employee / Auth | ERP 2 - Complete Task (HRM App-Usage Metrics) |
| 209 | `GET /api/tasks/:id/status-history` | Employee / Auth | ERP 2 - Task Status Transition History Log |
| 210 | `PUT /api/tasks/:id/reassign` | PM / Admin / Super Admin | ERP 2 - Reassign Task Employee & Reassignment Log |
| 211 | `POST /api/tasks/:id/checklist/add` | Employee / Auth | ERP 2 - Add Task Checklist Item |
| 212 | `PUT /api/tasks/:id/checklist/:itemId/toggle` | Employee / Auth | ERP 2 - Toggle Checklist Item Completion |
| 213 | `DELETE /api/tasks/:id/checklist/:itemId` | Employee / Auth | ERP 2 - Delete Checklist Item |
| 214 | `POST /api/tasks/:id/comments/add` | Project Team Member | ERP 2 - Add Discussion Comment |
| 215 | `GET /api/tasks/:id/comments` | Project Team Member | ERP 2 - List Task Discussion Comments |
| 216 | `GET /api/tasks/:id/time-analysis` | Employee / Auth | ERP 2 - Task Time Analysis (HRM Correlation) |
| 217 | `GET /api/tasks/overdue` | Employee / Auth | ERP 2 - Overdue Tasks List |
| 218 | `GET /api/tasks/pending-review-too-long` | Employee / Auth | ERP 2 - Stuck Review Tasks List |
| 219 | `GET /api/projects/:projectId/tasks/breakdown` | Employee / Auth | ERP 2 - Project Tasks Breakdown Statistics |
| 220 | `POST /api/drawings/create` | Arch / Des / PM / Admin | ERP 3 - Create Parent Drawing Record |
| 221 | `POST /api/drawings/:drawingId/versions/upload` | Arch / Des / PM / Admin | ERP 3 - Upload Drawing Version (Never Replaced Rule) |
| 222 | `GET /api/drawings` | Employee / Auth | ERP 3 - Paginated & Filterable Drawings List |
| 223 | `GET /api/drawings/:id` | Employee / Auth | ERP 3 - Drawing Detail & Version History |
| 224 | `GET /api/drawings/:id/versions` | Employee / Auth | ERP 3 - All Historical Drawing Versions List |
| 225 | `GET /api/drawings/:id/compare` | Employee / Auth | ERP 3 - Side-by-Side Version Compare Data |
| 226 | `PUT /api/drawing-versions/:versionId/pm-review` | PM / Admin / Super Admin | ERP 3 - PM Review Gate (Approve / Reject) |
| 227 | `PUT /api/drawing-versions/:versionId/admin-review` | Admin / Super Admin | ERP 3 - Admin Review Gate (Handoff to CRM 5) |
| 228 | `PUT /api/drawings/:id/promote-to-gfc` | Admin / Super Admin | ERP 3 - Promote Drawing to GFC Locked Version |
| 229 | `PUT /api/drawings/:id/unlock-gfc` | Super Admin Only | ERP 3 - Unlock GFC Drawing (Logged Reason) |
| 230 | `PUT /api/drawing-versions/:versionId/edit-in-place` | Admin / Super Admin | ERP 3 - In-Place Edit (Process DWG Category Only) |
| 231 | `GET /api/drawing-versions/:versionId/client-approval-log` | Employee / Auth | ERP 3 - Internal View Client Approval Log |
| 232 | `POST /api/drawing-category/create` | Super Admin / Admin | ERP 3 - Create Category Master |
| 233 | `GET /api/drawing-category/active` | Employee / Auth | ERP 3 - Active Drawing Categories List |
| 234 | `PUT /api/drawing-category/:id/deactivate` | Super Admin / Admin | ERP 3 - Deactivate Category Master |
| 235 | `GET /api/projects/:projectId/drawings/breakdown` | Employee / Auth | ERP 3 - Project Drawings Breakdown Statistics |
| 236 | `GET /api/drawing-versions/:versionId/review-data` | Employee / Auth | ERP 4 - Aggregated Viewer Payload (Version+Comments+Markings) |
| 237 | `POST /api/drawing-versions/:versionId/comments` | Employee / Auth | ERP 4 - Post General Comment or Image-Pinned Note |
| 238 | `GET /api/drawing-versions/:versionId/comments` | Employee / Auth | ERP 4 - Get Version Comments and Notes List |
| 239 | `POST /api/drawing-versions/:versionId/markings` | Employee / Auth | ERP 4 - Create Freehand/Shape Marking Annotation |
| 240 | `GET /api/drawing-versions/:versionId/markings` | Employee / Auth | ERP 4 - Get Version Markings List |
| 241 | `DELETE /api/drawing-versions/:versionId/markings/:markingId` | Author / Admin / Super Admin | ERP 4 - Delete Marking Annotation |
| 242 | `GET /api/projects/:projectId/chat` | Team / Admin | ERP 5 - Team-Scoped Project Chat History |
| 243 | `POST /api/projects/:projectId/chat/message` | Team / Admin | ERP 5 - Post Message (Contextual Task & Drawing Links) |
| 244 | `POST /api/projects/:projectId/chat/sync` | Team / Admin | ERP 5 - Batch Sync Offline Composed Messages |
| 245 | `PUT /api/projects/:projectId/chat/mark-read` | Team / Admin | ERP 5 - Mark Project Chat Read Timestamp |
| 246 | `GET /api/chat/unread-counts` | Employee / Auth | ERP 5 - Employee Chat Unread Counts Across Projects |
| 247 | `POST /api/projects/:projectId/document-folders/create` | Project Team | ERP 6 - Create Document Folder |
| 248 | `GET /api/projects/:projectId/document-folders` | Project Team | ERP 6 - List Active Document Folders |
| 249 | `PUT /api/document-folders/:id` | Project Team | ERP 6 - Rename Document Folder |
| 250 | `DELETE /api/document-folders/:id` | Project Team / Admin | ERP 6 - Soft-Delete Document Folder |
| 251 | `POST /api/documents/upload` | Project Team | ERP 6 - Upload Document & v1 (FileType Validated) |
| 252 | `POST /api/documents/:id/versions/upload` | Project Team | ERP 6 - Upload Document Version (Resets Client Visibility) |
| 253 | `GET /api/projects/:projectId/documents` | Project Team | ERP 6 - Internal Projects Document List (Role Filtered) |
| 254 | `GET /api/documents/:id` | Project Team | ERP 6 - Document Detail & Version History |
| 255 | `PUT /api/documents/:id` | Project Team | ERP 6 - Update Document Metadata & Folder |
| 256 | `DELETE /api/documents/:id` | PM / Admin / Super Admin | ERP 6 - Soft-Delete Document |
| 257 | `PUT /api/documents/:id/visibility` | PM / Admin / Super Admin | ERP 6 - Toggle Client Visibility (CRM 6 Handoff) |
| 258 | `GET /api/documents/:id/preview` | Project Team | ERP 6 - Preview Document File & Log VIEW Action |
| 259 | `GET /api/documents/:id/download` | Project Team | ERP 6 - Download Document File & Log DOWNLOAD Action |
| 260 | `GET /api/documents/:id/access-log` | PM / Admin / Super Admin | ERP 6 - View Internal & Client Document Access Audit Log |
| 261 | `GET /api/projects/:id/dashboard` | Project Team | ERP 7 - Aggregated Project Dashboard Metrics |
| 262 | `GET /api/projects/:id/analysis/employee-wise` | PM / Admin / Super Admin | ERP 7 - Employee-Wise Performance Analysis (HRM Attendance) |
| 263 | `GET /api/projects/:id/analysis/employee-wise/:userId` | PM / Admin / Super Admin | ERP 7 - Single Employee Project Deep-Dive |
| 264 | `GET /api/projects/:id/analysis/task-wise` | Project Team | ERP 7 - Task-Wise Analysis Reporting View |
| 265 | `GET /api/projects/:id/analysis/drawing-wise` | Project Team | ERP 7 - Drawing-Wise Progress & Approval Analysis |
| 266 | `GET /api/projects/:id/analysis/department-wise` | Project Team | ERP 7 - Department-Wise Progress Breakdown |
| 267 | `GET /api/analytics/company-wide-summary` | Admin / Super Admin | ERP 7 - Company-Wide Summary (Admin Dashboard Source) |
| 268 | `POST /api/analytics/refresh-snapshot/:projectId` | Admin / Super Admin | ERP 7 - Refresh Cached Project Analytics Snapshot |