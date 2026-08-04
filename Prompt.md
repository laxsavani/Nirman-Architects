================================================================================
 NIRMAN ARCHITECTS - HRM MODULE
 MASTER CONSOLIDATED DOCUMENTATION (ALL-IN-ONE)
 For: Antigravity Implementation Reference
 Client: Hirak bhai | Delivered by: Nexalliance - Your Trusted IT Partner
 Stack: Node.js + Express + MongoDB (Mongoose)
================================================================================

--------------------------------------------------------------------------------
 MASTER TABLE OF CONTENTS
--------------------------------------------------------------------------------
PART 1  — Product Context, Scope & Standards
PART 2  — Identity Layer (RoleMaster + User + Role Profiles)
PART 3  — Attendance Module (Auto Clock-in/out)
PART 4  — Leave Management Module (Dynamic Leave Master + Deduction)
PART 5  — Payroll Module (Auto Calculation + PDF)
PART 6  — Offer Letter + Structured Storage Add-on
PART 7  — Full Mongoose Schemas (ALL models, consolidated)
PART 8  — Full API Contract (ALL endpoints, consolidated)
PART 9  — Node.js Folder Structure (final, consolidated)
PART 10 — Master Step-by-Step Implementation Plan (build order)
PART 11 — Formulas & Worked Examples
PART 12 — Edge Cases & Guidance (all modules)
PART 13 — Security, Audit & Data-Integrity Rules
PART 14 — Product-Level Standards (Testing, Deployment, Backup, Handoff)
PART 15 — Definition of Done / Sign-off Criteria

================================================================================
PART 1 — PRODUCT CONTEXT, SCOPE & STANDARDS
================================================================================

1.1 Product Identity
  - Product: Nirman Architects HRM Module
  - Modules: Identity/Roles | Attendance | Leave Management | Payroll |
    Offer Letter Generation
  - This is a CLIENT-FACING PRODUCT running real payroll/attendance —
    treat with production-grade rigor (correctness + auditability over
    speed).

1.2 In Scope
  - RoleMaster + User + role-specific profile collections (SuperAdmin,
    HR, ProjectManager, Architect, SiteEngineer, Employee)
  - Attendance: auto clock-in/out (PC on/off), heartbeat safety net,
    offline sync, device binding, manual correction workflow
  - Leave Management: dynamic Leave Master, per-employee balances,
    apply/approve workflow, formula-driven salary deduction
  - Payroll: auto monthly calculation, PDF payslip generation, admin
    bulk download, employee self-download
  - Offer Letter: auto-generated PDF on employee registration, stored
    in a structured file system alongside salary slips

1.3 Out of Scope (requires separate Change Request)
  - Customer Portal, Project/Task/Drawing Management
  - Productivity monitoring/screenshots/PC activity tracking
  - AI/BI/future-enhancement items from the original master PRD
  - Super Admin full system settings UI beyond what's specified here

1.4 Non-Functional Requirements
  - Reliability: no silent data loss across online/offline/cron paths
  - Performance: attendance events <500ms; bulk payroll for 200
    employees completes in minutes via background job; all list APIs
    paginated
  - Availability: target 99.5% uptime during business hours; cron
    jobs monitored (Part 14)
  - Auditability: every state-changing action traceable to WHO + WHEN

1.5 Engineering Standards
  - Node.js LTS + Express + MongoDB/Mongoose
  - Folder structure per Part 9 — no deviation without discussion
  - All secrets/config via .env, never hardcoded, never committed
  - Consistent error shape: { success: false, message, code }
  - Input validation on every endpoint (joi/express-validator)
  - Mandatory comments on safety-critical logic (server-time authority,
    salary formula, heartbeat cron, dynamic leave propagation)
  - Git feature-branch workflow + PR review + ESLint/Prettier enforced

================================================================================
PART 2 — IDENTITY LAYER (ROLEMASTER + USER + ROLE PROFILES)
================================================================================

2.1 Core Strategy
  - ONE "RoleMaster" collection = dynamic, admin-managed role list
    (not hardcoded enum). Admin can add new roles later without code
    deployment.
  - ONE "User" collection = every person, all roles, COMMON fields only:
    name, email, passwordHash, phone, roleId (FK), department,
    designation, joiningDate, baseSalary, deviceId, deviceStatus, isActive.
  - Role-SPECIFIC extra data lives in SEPARATE collections (SuperAdmin,
    HR, ProjectManager, Architect, SiteEngineer, Employee), each with a
    `userId` FK back to User.

2.2 Why This Structure
  - Keeps User lean/fast for auth, payroll, attendance, leave — the 4
    things every role needs — without dozens of nullable role-specific
    columns.
  - Each role profile evolves independently without touching others.
  - On user creation: system reads roleId -> resolves role code via
    RoleMaster -> auto-creates the matching profile document, keeping
    both always in sync.

2.3 Seed Data (RoleMaster)
  SUPER_ADMIN, HR, PROJECT_MANAGER, ARCHITECT, SITE_ENGINEER, EMPLOYEE,
  CUSTOMER (flagged inactive-for-HRM, out of scope for this module)

================================================================================
PART 3 — ATTENDANCE MODULE (AUTO CLOCK-IN/OUT)
================================================================================

3.1 Trigger Behavior
  - Laptop ON + OS login -> Desktop Agent auto-fires CLOCK-IN
  - Laptop OFF/shutdown -> Desktop Agent auto-fires CLOCK-OUT
  - No manual punch button for office staff

3.2 Single Database, Single JSON Rule (explicit client requirement)
  - SERVER: exactly ONE collection "Attendance" stores every clock-in/
    out/heartbeat event, live or offline-synced — no second table.
  - CLIENT (employee's own PC only): exactly ONE local JSON file
    (`offline_queue.json`) buffers events when there's no internet.
    NOT a database — flushed into the SAME Attendance collection once
    online, flagged `isOfflineEntry: true`.

3.3 Server-Time Authority
  - `clockInTime`/`clockOutTime` ALWAYS set from server's `Date.now()`
    at request-processing time — never from client-submitted time
    (stored separately as reference only, for tamper-detection).

3.4 Heartbeat Safety Net
  - Agent pings every 2 minutes while active.
  - `node-cron` runs every 1 minute: any Attendance doc with
    `clockOutTime: null` and `lastHeartbeat` older than 5 minutes gets
    auto-closed (`clockOutTime = lastHeartbeat`, `autoClosed: true`).
    Covers crashes, force shutdown, power cuts.

3.5 Device Binding
  - `User.deviceId` = Machine GUID captured on first agent run.
  - Every event validated against it; mismatches rejected + logged to
    UnauthorizedAttempt.
  - Device changes go through DeviceChangeRequest (PENDING until HR/
    Super Admin approves; old device stays active meanwhile).

3.6 Manual Corrections
  - AttendanceCorrectionRequest lets an employee flag a wrong record;
    HR/Super Admin reviews and approves/rejects.

3.7 Config
  - AttendanceConfig stores heartbeat interval, timeout threshold,
    shift times — editable by Super Admin, no code change needed.

================================================================================
PART 4 — LEAVE MANAGEMENT MODULE (DYNAMIC MASTER + DEDUCTION)
================================================================================

4.1 Dynamic Leave Master (core client requirement)
  - "LeaveType" collection is fully admin-managed data, NEVER a
    hardcoded list in code.
  - Example: system starts with Casual Leave + Sick Leave (2 types).
    Super Admin adds "Test Leave" -> system now shows 3 types
    EVERYWHERE (apply dropdown, approval screen, payroll engine)
    immediately, with zero code change or deployment.

4.2 Leave Balance
  - One row per (user, leaveType, year): allocatedDays, usedDays,
    remainingDays (computed = allocated - used, never stored directly).
  - CRITICAL: when a NEW LeaveType is added mid-year, the system must
    auto-generate a LeaveBalance row for EVERY active employee for that
    new type IMMEDIATELY (synchronous step at creation time) — this is
    the core of the "dynamic" behavior the client explicitly tested for.

4.3 Leave Request & Approval Flow
  - Any role applies -> selects leaveTypeId (dynamic dropdown) + dates
    + reason -> status = PENDING.
  - Goes to SUPER ADMIN's approval queue (final approval authority per
    client requirement — not HR).
  - Nothing deducted from balance/salary until APPROVED.
  - On approval: snapshot `isPaidSnapshot = leaveType.isPaid` onto the
    LeaveRequest (protects historical accuracy if the LeaveType's
    isPaid flag changes later).

4.4 Salary Deduction Formula (EXACT client specification)
  If leave is unpaid (isPaid=false or exceeds paid quota):
      daysInMonth      = calendar days in that payroll month
      perDaySalary     = baseSalary / daysInMonth
      deductionAmount  = perDaySalary * numberOfUnpaidLeaveDays

  Client's exact worked example:
      baseSalary = 20000, daysInMonth = 30
      perDaySalary = 20000 / 30 = 666.666... -> rounded 666.67
      1 unpaid day -> deduction = 666.67 -> netSalary = 19,333.33

  If leave is paid (within quota): NO deduction; day counted "On
  Leave" in attendance, full salary applies.

4.5 Manual Balance Adjustments
  - LeaveBalanceAdjustment logs every manual edit: old value, new
    value, reason, adjustedBy, adjustedAt — full audit trail.

================================================================================
PART 5 — PAYROLL MODULE (AUTO CALCULATION + PDF)
================================================================================

5.1 Monthly Auto-Calculation (per User, per month/year)
  1. baseSalary = User.baseSalary
  2. daysInMonth = actual calendar days (28/29/30/31)
  3. presentDays = count from Attendance for that month
  4. paidLeaveDays / unpaidLeaveDays = split from APPROVED
     LeaveRequests that month, by isPaidSnapshot
  5. absentDays = daysInMonth - presentDays - paidLeaveDays -
     unpaidLeaveDays (floor at 0)
  6. perDaySalary = round2(baseSalary / daysInMonth)
  7. totalDeduction = round2(perDaySalary * (unpaidLeaveDays + absentDays))
  8. netSalary = round2(baseSalary - totalDeduction)
  9. Upsert ONE Payroll doc per (userId, month, year) with all numbers
     stored for payslip transparency

5.2 Automation
  - `node-cron` auto-runs on the 1st of each month for the PREVIOUS
    month, for ALL active users.
  - Admin can manually trigger/regenerate for any month/user (e.g.,
    after a late attendance correction is approved).

5.3 PDF Payslips
  - Admin: bulk-download ALL employees' payslips for a month (zipped),
    or download one specific employee's.
  - Employee: self-download ONLY their own payslip (userId enforced
    from JWT, never a client-supplied param).
  - PDF content: name, month/year, baseSalary, daysInMonth,
    presentDays, paidLeaveDays, unpaidLeaveDays, absentDays,
    perDaySalary, totalDeduction, netSalary.

================================================================================
PART 6 — OFFER LETTER + STRUCTURED STORAGE ADD-ON
================================================================================

6.1 Requirement
  - Whenever a new user is REGISTERED (POST /api/users/create), the
    system must AUTOMATICALLY generate an Offer Letter PDF.
  - Offer Letter PDFs saved under: /storage/offer_letters/
  - Salary slip PDFs (from Payroll module) reorganized under:
    /storage/salary/
  - Both live under one common /storage root.

6.2 Storage Folder Structure
  /storage
    /offer_letters
      /<userId>
        offer_letter_<userId>_<timestamp>.pdf
    /salary
      /<userId>
        /<year>
          payslip_<userId>_<month>_<year>.pdf

  Rationale: single root simplifies backups; per-user subfolders keep
  documents isolated/auditable; per-year subfolder under salary
  prevents flat-folder overload as the company operates across years;
  self-descriptive filenames survive being moved.

6.3 Offer Letter Generation Flow
  Admin/HR registers employee
    -> User + role-profile created (Part 2)
    -> Offer Letter auto-generation triggered SAME request (synchronous)
    -> PDF rendered via offerLetterPdfGenerator.js
    -> Saved to /storage/offer_letters/<userId>/...
    -> OfferLetter document created in MongoDB (filePath, snapshots,
       generatedBy, status)
    -> Notification sent to new employee
    -> Response includes downloadable reference

6.4 Offer Letter Content (minimum)
  Company letterhead, date of issue, employee name/email, position/
  designation, department, date of joining, compensation (base
  salary), employment terms (client-approved boilerplate — Nexalliance
  does NOT invent legal clauses independently), signature block,
  footer contact info.

6.5 Snapshot Rule (critical)
  - OfferLetter stores SNAPSHOT values (designation, department,
    baseSalary, joiningDate) at generation time. If User's salary/role
    changes later, the ORIGINAL offer letter must NOT silently change
    — it's a historical/legal document. Corrections go through a
    `/regenerate` endpoint creating a NEW record; old one stays intact.

6.6 Salary Slip Path Update
  - Payroll module's existing PDF generator updated to save to the new
    structured path: /storage/salary/<userId>/<year>/payslip_....pdf
  - Payroll.pdfPath field updated to store this new path — no change
    to calculation logic, purely a storage-location update.

================================================================================
PART 7 — FULL MONGOOSE SCHEMAS (ALL MODELS, CONSOLIDATED)
================================================================================

// ============================================================
// models/RoleMaster.js
// ============================================================
const mongoose = require('mongoose');

const roleMasterSchema = new mongoose.Schema({
  roleName:    { type: String, required: true, unique: true },
  roleCode:    { type: String, required: true, unique: true },
  description: { type: String },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('RoleMaster', roleMasterSchema);


// ============================================================
// models/User.js
// ============================================================
const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  phone:        { type: String },
  roleId:       { type: mongoose.Schema.Types.ObjectId, ref: 'RoleMaster', required: true },
  department:   { type: String },
  designation:  { type: String },
  joiningDate:  { type: Date },
  baseSalary:   { type: Number, required: true, default: 0 },
  deviceId:     { type: String, default: null },
  deviceStatus: { type: String, enum: ['APPROVED','PENDING','BLOCKED'], default: 'PENDING' },
  isActive:     { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);


// ============================================================
// models/SuperAdmin.js | HR.js | ProjectManager.js | Architect.js |
// models/SiteEngineer.js | Employee.js   (role profile pattern)
// ============================================================
// SuperAdmin.js
const superAdminSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  permissions: [{ type: String }]
}, { timestamps: true });
module.exports = mongoose.model('SuperAdmin', superAdminSchema);

// HR.js
const hrSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  hrPermissions: [{ type: String }]
}, { timestamps: true });
module.exports = mongoose.model('HR', hrSchema);

// ProjectManager.js
const projectManagerSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });
module.exports = mongoose.model('ProjectManager', projectManagerSchema);

// Architect.js
const architectSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: String },
  portfolioLinks: [{ type: String }]
}, { timestamps: true });
module.exports = mongoose.model('Architect', architectSchema);

// SiteEngineer.js
const siteEngineerSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedSites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });
module.exports = mongoose.model('SiteEngineer', siteEngineerSchema);

// Employee.js
const employeeSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  teamId:           { type: String },
  reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
module.exports = mongoose.model('Employee', employeeSchema);


// ============================================================
// models/Attendance.js
// ============================================================
const attendanceSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clockInTime:    { type: Date, required: true },     // server time, authoritative
  clockOutTime:   { type: Date, default: null },       // server time, authoritative
  clientClockIn:  { type: Date, default: null },       // reference only
  clientClockOut: { type: Date, default: null },       // reference only
  deviceId:       { type: String },
  isOfflineEntry: { type: Boolean, default: false },
  autoClosed:     { type: Boolean, default: false },
  lastHeartbeat:  { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);


// ============================================================
// models/AttendanceConfig.js
// ============================================================
const attendanceConfigSchema = new mongoose.Schema({
  heartbeatIntervalSeconds: { type: Number, default: 120 },
  heartbeatTimeoutMinutes:  { type: Number, default: 5 },
  shiftStartTime:           { type: String, default: '09:30' },
  shiftEndTime:             { type: String, default: '18:30' },
  updatedBy:                { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);


// ============================================================
// models/AttendanceCorrectionRequest.js
// ============================================================
const correctionRequestSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
  requestedClockIn:  { type: Date },
  requestedClockOut: { type: Date },
  reason:            { type: String, required: true },
  status:            { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending' },
  reviewedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:        { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceCorrectionRequest', correctionRequestSchema);


// ============================================================
// models/DeviceChangeRequest.js
// ============================================================
const deviceChangeRequestSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oldDeviceId: { type: String },
  newDeviceId: { type: String, required: true },
  status:      { type: String, enum: ['PENDING','APPROVED','REJECTED'], default: 'PENDING' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:  { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('DeviceChangeRequest', deviceChangeRequestSchema);


// ============================================================
// models/UnauthorizedAttempt.js
// ============================================================
const unauthorizedAttemptSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attemptedDeviceId: { type: String, default: null },
  attemptedAt:       { type: Date, default: Date.now },
  action:            { type: String, enum: ['clock_in','clock_out','heartbeat'] },
  reason:            { type: String }
}, { timestamps: true });

module.exports = mongoose.model('UnauthorizedAttempt', unauthorizedAttemptSchema);


// ============================================================
// models/HeartbeatLog.js
// ============================================================
const heartbeatLogSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedAt: { type: Date, default: Date.now },
  clientTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('HeartbeatLog', heartbeatLogSchema);


// ============================================================
// models/Notification.js
// ============================================================
const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:    { type: String, required: true },
  message: { type: String, required: true },
  isRead:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);


// ============================================================
// models/LeaveType.js   (DYNAMIC LEAVE MASTER)
// ============================================================
const leaveTypeSchema = new mongoose.Schema({
  name:                { type: String, required: true },
  code:                { type: String, required: true, unique: true },
  isPaid:              { type: Boolean, default: true },
  defaultQuotaPerYear: { type: Number, default: 0 },
  isActive:            { type: Boolean, default: true },
  createdBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);


// ============================================================
// models/LeaveBalance.js
// ============================================================
const leaveBalanceSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year:          { type: Number, required: true },
  allocatedDays: { type: Number, required: true },
  usedDays:      { type: Number, default: 0 }
}, { timestamps: true });

leaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);


// ============================================================
// models/LeaveRequest.js
// ============================================================
const leaveRequestSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  fromDate:        { type: Date, required: true },
  toDate:          { type: Date, required: true },
  totalDays:       { type: Number, required: true },
  reason:          { type: String },
  status:          { type: String, enum: ['PENDING','APPROVED','REJECTED','CANCELLED'], default: 'PENDING' },
  isPaidSnapshot:  { type: Boolean },
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:      { type: Date, default: null },
  rejectionReason: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);


// ============================================================
// models/LeaveBalanceAdjustment.js
// ============================================================
const leaveBalanceAdjustmentSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  adjustedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oldValue:    { type: Number, required: true },
  newValue:    { type: Number, required: true },
  reason:      { type: String, required: true },
  adjustedAt:  { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('LeaveBalanceAdjustment', leaveBalanceAdjustmentSchema);


// ============================================================
// models/Payroll.js
// ============================================================
const payrollSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:           { type: Number, required: true },
  year:            { type: Number, required: true },
  baseSalary:      { type: Number, required: true },
  daysInMonth:     { type: Number, required: true },
  presentDays:     { type: Number, required: true },
  paidLeaveDays:   { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  absentDays:      { type: Number, default: 0 },
  perDaySalary:    { type: Number, required: true },
  totalDeduction:  { type: Number, required: true },
  netSalary:       { type: Number, required: true },
  generatedAt:     { type: Date, default: Date.now },
  pdfPath:         { type: String, default: null }  // /storage/salary/<userId>/<year>/...
}, { timestamps: true });

payrollSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);


// ============================================================
// models/OfferLetter.js
// ============================================================
const offerLetterSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath:    { type: String, required: true },  // /storage/offer_letters/<userId>/...

  designationSnapshot: { type: String, required: true },
  departmentSnapshot:  { type: String, required: true },
  baseSalarySnapshot:  { type: Number, required: true },
  joiningDateSnapshot: { type: Date, required: true },

  status:      { type: String, enum: ['GENERATED','SENT','ACKNOWLEDGED'], default: 'GENERATED' },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('OfferLetter', offerLetterSchema);

================================================================================
PART 8 — FULL API CONTRACT (ALL ENDPOINTS, CONSOLIDATED)
================================================================================

--- Identity: RoleMaster + User ---
POST   /api/role-master/create              (Super Admin) { roleName, roleCode, description }
GET    /api/role-master/all
POST   /api/auth/login                      { email, password }
POST   /api/users/create                    (Super Admin/HR) { name, email, password, roleId,
                                              baseSalary, department, designation, joiningDate }
  -> creates User + role-profile doc
  -> AUTO-TRIGGERS Offer Letter generation (Part 6)
  -> response: { user, offerLetter: { id, filePath } }
GET    /api/users/:id
PUT    /api/users/:id
GET    /api/users?role=&department=

--- Device Registration ---
POST   /api/device/register                 { userId, deviceId }
POST   /api/device/approve                  (HR/Super Admin) { requestId, action }
GET    /api/device/status?userId=

--- Attendance ---
POST   /api/attendance/event                { userId, deviceId, type, clientTime }
POST   /api/attendance/sync                 (offline queue flush)
GET    /api/attendance/my?month=&year=
GET    /api/attendance/all?month=&year=&userId=   (HR/Super Admin)
POST   /api/attendance/correction/request   { attendanceId, requestedClockIn, requestedClockOut, reason }
POST   /api/attendance/correction/approve   (HR/Super Admin) { requestId }
POST   /api/attendance/correction/reject    (HR/Super Admin) { requestId, reason }
GET    /api/attendance-config
PUT    /api/attendance-config               (Super Admin only)

--- Leave Type (Dynamic Master) ---
POST   /api/leave-type/create               (Super Admin) { name, code, isPaid, defaultQuotaPerYear }
PUT    /api/leave-type/:id/update           (Super Admin)
PUT    /api/leave-type/:id/deactivate       (Super Admin)
GET    /api/leave-type/active               (everyone: dropdown source)
GET    /api/leave-type/all                  (Super Admin: incl. inactive)

--- Leave Balance ---
GET    /api/leave-balance/my?year=
GET    /api/leave-balance/:userId?year=     (HR/Super Admin)
POST   /api/leave-balance/adjust            (HR/Super Admin) { userId, leaveTypeId, newValue, reason }

--- Leave Request ---
POST   /api/leave/apply                     { userId, leaveTypeId, fromDate, toDate, reason }
GET    /api/leave/my?year=
POST   /api/leave/cancel                    { leaveRequestId }
GET    /api/leave/pending                   (Super Admin only)
POST   /api/leave/approve                   (Super Admin only) { leaveRequestId }
POST   /api/leave/reject                    (Super Admin only) { leaveRequestId, rejectionReason }
GET    /api/leave/all?department=&status=   (HR view)

--- Payroll ---
POST   /api/payroll/generate                (Super Admin) { month, year }
POST   /api/payroll/generate/:userId        (Super Admin) { month, year }
GET    /api/payroll/my?month=&year=
GET    /api/payroll/my/download?month=&year=              (self, own PDF from /storage/salary/...)
GET    /api/payroll/all?month=&year=        (Super Admin/HR)
GET    /api/payroll/download/:userId?month=&year=          (Super Admin)
GET    /api/payroll/download-all?month=&year=               (Super Admin, bulk zip)

--- Offer Letter ---
GET    /api/offer-letter/:userId
GET    /api/offer-letter/:userId/download   (self-scoped for employee; unrestricted for Admin/HR)
POST   /api/offer-letter/:userId/regenerate (Super Admin/HR only)

--- Notifications ---
GET    /api/notifications/my
PUT    /api/notifications/:id/read

================================================================================
PART 9 — NODE.JS FOLDER STRUCTURE (FINAL, CONSOLIDATED)
================================================================================
/server
  /models
    RoleMaster.js, User.js
    SuperAdmin.js, HR.js, ProjectManager.js, Architect.js, SiteEngineer.js, Employee.js
    Attendance.js, AttendanceConfig.js, AttendanceCorrectionRequest.js
    DeviceChangeRequest.js, UnauthorizedAttempt.js, HeartbeatLog.js
    LeaveType.js, LeaveBalance.js, LeaveRequest.js, LeaveBalanceAdjustment.js
    Payroll.js
    OfferLetter.js
    Notification.js
    Project.js, SiteLocation.js    (referenced only, out of deep scope here)
  /controllers
    roleMasterController.js, userController.js, deviceController.js
    attendanceController.js, correctionController.js
    leaveTypeController.js, leaveBalanceController.js, leaveRequestController.js
    payrollController.js, offerLetterController.js, notificationController.js
  /routes
    (one route file per controller above)
  /middleware
    authMiddleware.js        (JWT verify)
    roleMiddleware.js        (RBAC guard)
  /cron
    heartbeatTimeoutCron.js  (every 1 min)
    payrollGenerationCron.js (1st of month)
  /utils
    salaryCalculator.js
    payslipPdfGenerator.js
    offerLetterPdfGenerator.js
    dynamicLeaveBalanceSeeder.js
    storagePathResolver.js
  /config
    db.js
  server.js
  .env
/storage
  /offer_letters/.gitkeep
  /salary/.gitkeep

================================================================================
PART 10 — MASTER STEP-BY-STEP IMPLEMENTATION PLAN (BUILD ORDER)
================================================================================

STEP 1  — Project setup: Express + MongoDB connection, GET /api/health
STEP 2  — RoleMaster + User + Auth (JWT) + authMiddleware/roleMiddleware
STEP 3  — Role Profile auto-creation on user registration
STEP 4  — storagePathResolver.js (offer letter + salary paths, auto-mkdir)
STEP 5  — Device registration + Attendance core (event API, server-time authority)
STEP 6  — Offline sync endpoint (/attendance/sync, isOfflineEntry flag)
STEP 7  — Heartbeat-timeout cron (auto clock-out after 5 min silence)
STEP 8  — Attendance correction workflow (request/approve/reject)
STEP 9  — OfferLetter model + PDF generator + wire into user registration
STEP 10 — Offer Letter download/regenerate endpoints (self-scoped + admin)
STEP 11 — Dynamic LeaveType master (CRUD + seed Casual/Sick/Unpaid)
STEP 12 — LeaveBalance auto-seeding on new LeaveType creation (sync, critical)
STEP 13 — LeaveRequest apply/cancel/approve/reject + isPaidSnapshot logic
STEP 14 — salaryCalculator.js (pure function, test against 20000/30=666.67 example)
STEP 15 — Payroll generation (all users + single user) + payrollGenerationCron
STEP 16 — payslipPdfGenerator.js updated to save under /storage/salary/<userId>/<year>/
STEP 17 — Payroll download endpoints (self, admin single, admin bulk zip)
STEP 18 — Notifications wired into: leave applied/approved/rejected, correction
          raised, unauthorized device attempt, offer letter ready
STEP 19 — RBAC hardening pass across every endpoint + permission matrix tests
STEP 20 — Full test suite (unit + integration) + README + client UAT prep

(Each step: implement -> run -> verify against spec -> confirm before next step)

================================================================================
PART 11 — FORMULAS & WORKED EXAMPLES
================================================================================
Per-Day Salary:      perDaySalary = baseSalary / daysInMonth
Deduction:           deductionAmount = perDaySalary * unpaidOrAbsentDays
Net Salary:          netSalary = baseSalary - deductionAmount

Example 1 (client's exact numbers):
  baseSalary=20000, daysInMonth=30 -> perDaySalary=666.67
  1 unpaid day -> deduction=666.67 -> netSalary=19333.33

Example 2 (multiple unpaid days):
  baseSalary=20000, daysInMonth=30, unpaidDays=3
  deduction = 666.67*3 = 2000.01 -> netSalary=17999.99

Example 3 (31-day month):
  baseSalary=31000, daysInMonth=31 -> perDaySalary=1000.00 exactly
  2 unpaid days -> deduction=2000.00 -> netSalary=29000.00

Rounding: always Math.round(value*100)/100 — never truncate.

================================================================================
PART 12 — EDGE CASES & GUIDANCE (ALL MODULES)
================================================================================
Attendance:
  - Multiple monitors/RDP/VPN -> one session-id per OS login
  - Sleep/hibernate (not shutdown) -> don't auto-close if heartbeat
    resumes within 10 min
  - Pending device-change request -> don't block work; keep last
    approved device active meanwhile

Leave:
  - New LeaveType added mid-year -> LeaveBalance seeding MUST run
    synchronously right at creation, not deferred to a cron
  - Leave spanning month-end -> split days proportionally across the
    two months for payroll purposes
  - LeaveType isPaid flag changes after approval -> always use
    isPaidSnapshot on LeaveRequest, never re-read live LeaveType value

Payroll:
  - baseSalary <= 0 -> reject generation with clear error, don't
    produce a silent ₹0 payslip
  - Re-running generate for same month -> UPSERT via unique index
    (userId, month, year), never duplicate
  - Employee joins/leaves mid-month -> adjust effective daysInMonth
    base for that employee, document the chosen policy

Offer Letter / Storage:
  - Salary/designation changes after offer letter generated -> keep
    snapshot fields unchanged; use /regenerate for a corrected NEW record
  - Registration partially fails (User created, PDF generation errors)
    -> flag clearly for manual regenerate, don't leave a silently
    broken employee record
  - Legal/employment-terms wording in the offer letter template must
    be client-approved before Production use

================================================================================
PART 13 — SECURITY, AUDIT & DATA-INTEGRITY RULES
================================================================================
- JWT auth + roleMiddleware on EVERY route, not just sensitive ones
- Server time is the ONLY authoritative timestamp for attendance/
  approval events, everywhere
- Self-scoped endpoints (payslip, offer letter, attendance "my") derive
  userId from JWT, NEVER from a client-supplied parameter
- Every approval/rejection/adjustment records who + when
  (approvedBy/reviewedBy/adjustedBy + timestamps)
- Passwords: bcrypt hash only, never returned in API responses
- Device mismatches always logged to UnauthorizedAttempt, never
  silently allowed
- Soft-delete only for master records (LeaveType, User) — never hard-delete
- Monetary values always rounded to 2 decimals via one shared utility

================================================================================
PART 14 — PRODUCT-LEVEL STANDARDS (TESTING, DEPLOYMENT, BACKUP, HANDOFF)
================================================================================

14.1 Environments: Development -> Staging (Client UAT) -> Production,
     each with its own MongoDB DB and .env, never shared.

14.2 Testing (mandatory, not optional given financial impact):
  - Unit: salary formula (20000/30=666.67 case), dynamic LeaveType ->
    auto-balance seeding, heartbeat-timeout logic, device-mismatch
    rejection, leave balance validation
  - Integration: full attendance lifecycle, full leave lifecycle, full
    payroll lifecycle (generate -> PDF -> restricted download)
  - UAT: client walks through apply/approve leave, view attendance,
    generate payroll, download payslips (admin + employee), and
    explicitly signs off on deduction numbers before go-live
  - Security: cross-user data access attempts must be blocked (403);
    unregistered-device attendance attempts must be rejected + logged

14.3 Deployment:
  - Dev -> Staging -> Production, no environment skipped
  - Each release: changelog + modules affected + rollback plan
  - DB migrations scripted and tested on Staging first
  - Post-deploy smoke test: login, one attendance round-trip, one
    leave round-trip, payroll generation for a test month

14.4 Monitoring & Alerting:
  - Structured logs (winston/pino), retained 30+ days
  - Cron health checks for heartbeatTimeoutCron + payrollGenerationCron
    — alert if either fails to run
  - Security event alerts for unauthorized device attempts / repeated
    failed logins

14.5 Backup & Disaster Recovery:
  - Daily MongoDB backups, 30-day rolling retention, periodically
    restore-tested
  - /storage root (offer_letters + salary) backed up alongside the
    database — not just local disk reliance
  - Documented recovery runbook; agreed RTO/RPO with client

14.6 Documentation Deliverables (to hand to client):
  - This master document, API reference, Admin User Guide, Employee
    User Guide, Deployment Guide, Known Limitations doc

14.7 Client Handoff Checklist:
  - All modules pass acceptance criteria
  - Client UAT signed off in writing
  - Production deployed + smoke-tested
  - Real data seeded (not placeholders)
  - Admin trained on: adding leave types, approving leave, generating/
    downloading payroll, offer letter regeneration
  - Backups confirmed running
  - Credentials handed over via secure channel (not plaintext chat/email)

14.8 Support & SLA: define bug-fix SLAs (critical: 24h, non-critical:
     3-5 business days), support channel, maintenance window, scope of
     free vs. billable post-launch work.

14.9 Change Management: semantic versioning; any scope addition beyond
     Part 1.2 requires a written Change Request before work starts;
     maintain CHANGELOG.md per release.

================================================================================
PART 15 — DEFINITION OF DONE / SIGN-OFF CRITERIA
================================================================================
This product is DONE and ready for client sign-off when:
  1. Identity, Attendance, Leave, Payroll, and Offer Letter modules all
     meet their respective acceptance criteria (Part 14.2)
  2. Client has performed UAT on Staging and approved in writing
  3. Security requirements (Part 13) are implemented and verified
  4. Backups (including /storage) are running and verified restorable
  5. All documentation deliverables (Part 14.6) are handed over
  6. Client-side Admin can independently: add a leave type, approve a
     leave request, generate + download payroll, and regenerate an
     offer letter — without developer assistance
  7. Support/SLA terms (Part 14.8) are agreed and documented

Only after all 7 conditions are met is this marked a completed,
production-ready client deliverable.

================================================================================
END OF MASTER DOCUMENT
================================================================================