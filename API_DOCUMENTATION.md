# Nirman Architects HRM & Auto Attendance System
## Comprehensive Single-File API Documentation for Frontend Integration

**Base API URLs**:
- **Development**: `http://localhost:5000/api`
- **Production (Render)**: `https://nirman-architects.onrender.com/api`

**Interactive Swagger UI**:
- `https://nirman-architects.onrender.com/api-docs`

---

## Global Request Headers

For all authenticated requests, pass the JWT Token in the Authorization header:

```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

---

## Standard API Response Structures

### Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "message": "Operation description message.",
  "data": { ... }
}
```

### Error Response (`400 Bad Request` / `401 Unauthorized` / `403 Forbidden` / `404 Not Found` / `500 Server Error`)
```json
{
  "success": false,
  "message": "Error description message."
}
```

---

# Detailed Endpoint Specifications

---

## 1. AUTHENTICATION MODULE

### 1.1 User Login
- **HTTP Method**: `POST`
- **URL Path**: `/auth/login`
- **Access Level**: Public
- **Description**: Authenticates user via email and password, returning JWT token and user profile.
- **Request Body**:
```json
{
  "email": "employee@nirman.com",
  "password": "<USER_PASSWORD>"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "<JWT_BEARER_TOKEN>",
  "user": {
    "id": "64bd9f0296e625a5857e4e10",
    "name": "Employee User",
    "email": "employee@nirman.com",
    "phone": "9999000044",
    "roleId": "64bd9f0296e625a5857e4e01",
    "roleCode": "EMPLOYEE",
    "department": "Engineering",
    "designation": "Staff Engineer",
    "baseSalary": 45000,
    "deviceId": "DESKTOP-F89AB124C9812",
    "deviceStatus": "APPROVED"
  }
}
```
- **Error Response (`400 Bad Request`)**:
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

---

### 1.2 User Registration
- **HTTP Method**: `POST`
- **URL Path**: `/auth/register`
- **Access Level**: Public / Admin
- **Description**: Creates a new user account.
- **Request Body**:
```json
{
  "name": "John Doe",
  "email": "john.doe@nirman.com",
  "password": "<USER_PASSWORD>",
  "phone": "9876543210",
  "role": "EMPLOYEE",
  "department": "Architecture",
  "designation": "Junior Architect",
  "baseSalary": 50000,
  "deviceId": "DESKTOP-AB12345"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1...",
  "user": { ... }
}
```

---

## 2. ROLE MASTER MODULE

### 2.1 Get All System Roles
- **HTTP Method**: `GET`
- **URL Path**: `/role-master/all` or `/roles`
- **Access Level**: Public / Authenticated
- **Description**: Fetches all configured system roles.
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "All roles retrieved successfully.",
  "data": [
    { "_id": "64bd9f0296e625a5857e4e01", "roleName": "Super Admin", "roleCode": "SUPER_ADMIN" },
    { "_id": "64bd9f0296e625a5857e4e02", "roleName": "HR", "roleCode": "HR" },
    { "_id": "64bd9f0296e625a5857e4e03", "roleName": "Project Manager", "roleCode": "PROJECT_MANAGER" },
    { "_id": "64bd9f0296e625a5857e4e04", "roleName": "Architect", "roleCode": "ARCHITECT" },
    { "_id": "64bd9f0296e625a5857e4e05", "roleName": "Site Engineer", "roleCode": "SITE_ENGINEER" },
    { "_id": "64bd9f0296e625a5857e4e06", "roleName": "Employee", "roleCode": "EMPLOYEE" }
  ]
}
```

---

### 2.2 Create Dynamic Role (Super Admin)
- **HTTP Method**: `POST`
- **URL Path**: `/role-master/create`
- **Access Level**: `SUPER_ADMIN`
- **Request Body**:
```json
{
  "roleName": "Quality Inspector",
  "roleCode": "QUALITY_INSPECTOR",
  "description": "Performs site quality checks"
}
```

---

## 3. USER MANAGEMENT MODULE

### 3.1 Get All Users (Admin / HR)
- **HTTP Method**: `GET`
- **URL Path**: `/users`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Query Parameters**:
  - `department` (optional): Filter by department name
  - `role` (optional): Filter by roleCode
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Users retrieved successfully.",
  "users": [
    {
      "id": "64bd9f0296e625a5857e4e10",
      "name": "John Doe",
      "email": "john.doe@nirman.com",
      "phone": "9876543210",
      "role": { "roleName": "Employee", "roleCode": "EMPLOYEE" },
      "department": "Architecture",
      "designation": "Junior Architect",
      "baseSalary": 50000,
      "deviceId": "DESKTOP-AB12345",
      "deviceStatus": "APPROVED",
      "isActive": true
    }
  ]
}
```

---

### 3.2 Create New User (Admin / HR)
- **HTTP Method**: `POST`
- **URL Path**: `/users/create`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Request Body**:
```json
{
  "name": "Sarah Connor",
  "email": "sarah@nirman.com",
  "password": "Password123!",
  "role": "ARCHITECT",
  "department": "Architecture",
  "designation": "Senior Architect",
  "baseSalary": 75000
}
```

---

### 3.3 Get Single User Details
- **HTTP Method**: `GET`
- **URL Path**: `/users/:id`
- **Access Level**: Authenticated

---

### 3.4 Update User Details (Admin / HR)
- **HTTP Method**: `PUT`
- **URL Path**: `/users/:id`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Request Body**:
```json
{
  "name": "Sarah Connor",
  "department": "Design",
  "designation": "Lead Architect",
  "baseSalary": 85000,
  "isActive": true
}
```

---

## 4. ATTENDANCE & AUTOMATIC TRACKING MODULE

### 4.1 Automated PC Boot Clock-In
- **HTTP Method**: `POST`
- **URL Path**: `/attendance/clock-in`
- **Access Level**: Authenticated / Desktop Agent
- **Request Body**:
```json
{
  "employeeId": "64bd9f0296e625a5857e4e10",
  "deviceId": "DESKTOP-F89AB124C9812",
  "loginTime": "2026-07-25T09:00:00.000Z",
  "deviceName": "DESKTOP-PC-01",
  "ipAddress": "192.168.1.50"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Automatic Clock-In recorded successfully.",
  "data": {
    "_id": "64bd9f0296e625a5857e4f01",
    "userId": "64bd9f0296e625a5857e4e10",
    "clockInTime": "2026-07-25T09:00:00.000Z",
    "clockOutTime": null,
    "status": "ONLINE",
    "deviceId": "DESKTOP-F89AB124C9812",
    "deviceName": "DESKTOP-PC-01",
    "ipAddress": "192.168.1.50",
    "workingHours": 0.05,
    "lastHeartbeat": "2026-07-25T09:03:00.000Z"
  }
}
```

---

### 4.2 Automated OS Shutdown Clock-Out
- **HTTP Method**: `POST`
- **URL Path**: `/attendance/clock-out`
- **Access Level**: Authenticated / Desktop Agent
- **Request Body**:
```json
{
  "employeeId": "64bd9f0296e625a5857e4e10",
  "deviceId": "DESKTOP-F89AB124C9812",
  "logoutTime": "2026-07-25T18:00:00.000Z"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Automatic Clock-Out recorded successfully.",
  "data": {
    "_id": "64bd9f0296e625a5857e4f01",
    "userId": "64bd9f0296e625a5857e4e10",
    "clockInTime": "2026-07-25T09:00:00.000Z",
    "clockOutTime": "2026-07-25T18:00:00.000Z",
    "status": "SHUTDOWN",
    "workingHours": 9.0
  }
}
```

---

### 4.3 Send 30-Second Heartbeat Ping
- **HTTP Method**: `POST`
- **URL Path**: `/attendance/heartbeat` or `/device/heartbeat`
- **Access Level**: Authenticated / Desktop Agent
- **Request Body**:
```json
{
  "employeeId": "64bd9f0296e625a5857e4e10",
  "deviceId": "DESKTOP-F89AB124C9812",
  "status": "ONLINE"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Heartbeat recorded.",
  "lastHeartbeat": "2026-07-25T10:30:00.000Z",
  "status": "ONLINE"
}
```

---

### 4.4 Get Today's Attendance Status
- **HTTP Method**: `GET`
- **URL Path**: `/attendance/today`
- **Access Level**: Authenticated
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Today's attendance status retrieved.",
  "data": {
    "_id": "64bd9f0296e625a5857e4f01",
    "clockInTime": "2026-07-25T09:00:00.000Z",
    "clockOutTime": null,
    "status": "ONLINE",
    "workingHours": 1.5,
    "lastHeartbeat": "2026-07-25T10:30:00.000Z"
  }
}
```

---

### 4.5 Realtime Active Employee Tracking (Admin / HR Dashboard)
- **HTTP Method**: `GET`
- **URL Path**: `/admin/live-users` or `/attendance/live-users`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Live active users retrieved successfully.",
  "count": 5,
  "liveUsers": [
    {
      "attendanceId": "64bd9f0296e625a5857e4f01",
      "user": {
        "_id": "64bd9f0296e625a5857e4e10",
        "name": "John Doe",
        "email": "john.doe@nirman.com",
        "department": "Architecture",
        "designation": "Junior Architect"
      },
      "clockInTime": "2026-07-25T09:00:00.000Z",
      "lastHeartbeat": "2026-07-25T10:30:00.000Z",
      "status": "ONLINE",
      "workingHours": 1.5,
      "deviceId": "DESKTOP-F89AB124C9812",
      "ipAddress": "192.168.1.50"
    }
  ]
}
```

---

### 4.6 Sync Offline Log Queue
- **HTTP Method**: `POST`
- **URL Path**: `/attendance/sync`
- **Access Level**: Authenticated / Desktop Agent
- **Request Body**:
```json
{
  "deviceId": "DESKTOP-F89AB124C9812",
  "logs": [
    { "type": "CLOCK_IN", "time": "2026-07-25T09:00:00.000Z" },
    { "type": "CLOCK_OUT", "time": "2026-07-25T18:00:00.000Z" }
  ]
}
```

---

### 4.7 Request Attendance Correction
- **HTTP Method**: `POST`
- **URL Path**: `/attendance/correction/request`
- **Access Level**: Authenticated
- **Request Body**:
```json
{
  "attendanceId": "64bd9f0296e625a5857e4f01",
  "requestedClockIn": "2026-07-25T08:30:00.000Z",
  "requestedClockOut": "2026-07-25T18:30:00.000Z",
  "reason": "Forgot to clock in due to morning meeting"
}
```

---

## 5. DEVICE MANAGEMENT & BINDING MODULE

### 5.1 Register / Bind Hardware Device ID
- **HTTP Method**: `POST`
- **URL Path**: `/device/register`
- **Access Level**: Public / Authenticated
- **Request Body**:
```json
{
  "userId": "64bd9f0296e625a5857e4e10",
  "deviceId": "DESKTOP-F89AB124C9812"
}
```
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Device registered as primary device.",
  "status": "APPROVED",
  "deviceId": "DESKTOP-F89AB124C9812"
}
```

---

### 5.2 Get Device Status & Pending Requests
- **HTTP Method**: `GET`
- **URL Path**: `/device/status`
- **Access Level**: Authenticated

---

### 5.3 Get Pending Device Requests (Admin / HR)
- **HTTP Method**: `GET`
- **URL Path**: `/device/pending`
- **Access Level**: `SUPER_ADMIN`, `HR`

---

### 5.4 Approve / Reject Device Change Request (Admin / HR)
- **HTTP Method**: `POST`
- **URL Path**: `/device/approve`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Request Body**:
```json
{
  "requestId": "64bd9f0296e625a5857e4e99",
  "action": "APPROVE"
}
```

---

## 6. LEAVE MASTER MODULE

### 6.1 Get Active Leave Types (Dropdown Source)
- **HTTP Method**: `GET`
- **URL Path**: `/leave-master/active` or `/leave-type/active`
- **Access Level**: Public / Authenticated
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "Active leave types retrieved successfully.",
  "leaveTypes": [
    { "_id": "64bd9f0296e625a5857e4c01", "name": "Casual Leave", "code": "CL", "isPaid": true, "defaultQuotaPerYear": 12 },
    { "_id": "64bd9f0296e625a5857e4c02", "name": "Sick Leave", "code": "SL", "isPaid": true, "defaultQuotaPerYear": 8 },
    { "_id": "64bd9f0296e625a5857e4c03", "name": "Unpaid Leave", "code": "UL", "isPaid": false, "defaultQuotaPerYear": 0 }
  ]
}
```

---

### 6.2 Create Dynamic Leave Type (Super Admin)
- **HTTP Method**: `POST`
- **URL Path**: `/leave-master/create` or `/leave-type/create`
- **Access Level**: `SUPER_ADMIN`
- **Request Body**:
```json
{
  "name": "Maternity Leave",
  "code": "ML",
  "isPaid": true,
  "defaultQuotaPerYear": 90
}
```

---

## 7. LEAVE MANAGEMENT & BALANCES MODULE

### 7.1 Apply for Leave
- **HTTP Method**: `POST`
- **URL Path**: `/leave/apply`
- **Access Level**: Authenticated
- **Request Body**:
```json
{
  "leaveTypeId": "64bd9f0296e625a5857e4c01",
  "fromDate": "2026-08-01",
  "toDate": "2026-08-03",
  "reason": "Personal work"
}
```
- **Success Response (`201 Created`)**:
```json
{
  "success": true,
  "message": "Leave application submitted successfully.",
  "data": {
    "_id": "64bd9f0296e625a5857e4d50",
    "userId": "64bd9f0296e625a5857e4e10",
    "leaveTypeId": "64bd9f0296e625a5857e4c01",
    "fromDate": "2026-08-01T00:00:00.000Z",
    "toDate": "2026-08-03T00:00:00.000Z",
    "totalDays": 3,
    "status": "PENDING"
  }
}
```

---

### 7.2 Get Own Leave History & Balances
- **HTTP Method**: `GET`
- **URL Path**: `/leave/my` or `/leave-balance/my`
- **Access Level**: Authenticated
- **Query Parameters**: `?year=2026`
- **Success Response (`200 OK`)**:
```json
{
  "success": true,
  "message": "My leave history and balances retrieved.",
  "data": {
    "year": 2026,
    "balances": [
      {
        "leaveTypeId": "64bd9f0296e625a5857e4c01",
        "leaveTypeName": "Casual Leave",
        "code": "CL",
        "isPaid": true,
        "allocatedDays": 12,
        "usedDays": 3,
        "remainingDays": 9
      }
    ],
    "requests": [ ... ]
  }
}
```

---

### 7.3 Approve Leave Request (Super Admin)
- **HTTP Method**: `POST`
- **URL Path**: `/leave/approve`
- **Access Level**: `SUPER_ADMIN`
- **Request Body**:
```json
{
  "leaveRequestId": "64bd9f0296e625a5857e4d50"
}
```

---

### 7.4 Reject Leave Request (Super Admin)
- **HTTP Method**: `POST`
- **URL Path**: `/leave/reject`
- **Access Level**: `SUPER_ADMIN`
- **Request Body**:
```json
{
  "leaveRequestId": "64bd9f0296e625a5857e4d50",
  "rejectionReason": "Project deadline conflict"
}
```

---

### 7.5 Manual Leave Balance Adjustment (Admin / HR)
- **HTTP Method**: `POST`
- **URL Path**: `/leave/balance/adjust`
- **Access Level**: `SUPER_ADMIN`, `HR`
- **Request Body**:
```json
{
  "targetUserId": "64bd9f0296e625a5857e4e10",
  "leaveTypeId": "64bd9f0296e625a5857e4c01",
  "newValue": 15,
  "reason": "Special annual quota adjustment"
}
```

---

## 8. PAYROLL MANAGEMENT MODULE

### 8.1 Get Own Monthly Payslips
- **HTTP Method**: `GET`
- **URL Path**: `/payroll/my`
- **Access Level**: Authenticated
- **Query Parameters**: `?month=7&year=2026`

---

### 8.2 Download Own Payslip PDF
- **HTTP Method**: `GET`
- **URL Path**: `/payroll/my/download`
- **Access Level**: Authenticated
- **Query Parameters**: `?month=7&year=2026`
- **Response**: Binary PDF file download stream (`application/pdf`)

---

### 8.3 Generate Monthly Payroll (Super Admin)
- **HTTP Method**: `POST`
- **URL Path**: `/payroll/generate`
- **Access Level**: `SUPER_ADMIN`
- **Request Body**:
```json
{
  "month": 7,
  "year": 2026
}
```

---

## 9. OFFER LETTERS MODULE

### 9.1 Get Offer Letter Details
- **HTTP Method**: `GET`
- **URL Path**: `/offer-letter/:userId`
- **Access Level**: Authenticated

---

### 9.2 Download Offer Letter PDF
- **HTTP Method**: `GET`
- **URL Path**: `/offer-letter/:userId/download`
- **Access Level**: Authenticated
- **Response**: Binary PDF file download stream

---

## 10. SITE LOCATIONS & GEO-FENCING MODULE

### 10.1 Configure Project Site Geo-Fence Location
- **HTTP Method**: `POST`
- **URL Path**: `/site-locations`
- **Access Level**: Authenticated (PM / HR)
- **Request Body**:
```json
{
  "projectName": "Nirman Commercial Tower",
  "lat": 23.0225,
  "lng": 72.5714,
  "radiusMeters": 100
}
```

---

### 10.2 Get All Configured Geo-Fences
- **HTTP Method**: `GET`
- **URL Path**: `/site-locations`
- **Access Level**: Authenticated

---

## 11. NOTIFICATIONS MODULE

### 11.1 Get My Notifications
- **HTTP Method**: `GET`
- **URL Path**: `/notifications/my` or `/notifications`
- **Access Level**: Authenticated

---

### 11.2 Mark Notification as Read
- **HTTP Method**: `PUT`
- **URL Path**: `/notifications/:id/read`
- **Access Level**: Authenticated
