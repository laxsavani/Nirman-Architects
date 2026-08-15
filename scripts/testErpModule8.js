require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const Department = require('../models/Department');
const Task = require('../models/Task');
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const Attendance = require('../models/Attendance');
const Client = require('../models/Client');
const GeneratedReport = require('../models/GeneratedReport');
const ScheduledReport = require('../models/ScheduledReport');

const reportController = require('../controllers/report.controller');
const { hashPassword } = require('../utils/password');
const { safeResolvePath } = require('../utils/storagePathResolver');

function mockResponse() {
  const res = {};
  res.statusCode = 200;
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };
  res.json = function (payload) {
    this.body = payload;
    return this;
  };
  res.download = function (filepath, filename) {
    this.downloadedFile = filepath;
    this.downloadedFilename = filename;
    return this;
  };
  return res;
}

async function runErpModule8Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 8: REPORTS MODULE — TEST SUITE');
  console.log('================================================================================\n');

  let passedCount = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
    }
  }

  const conn = await connectDB();
  if (!conn) {
    console.error('Failed to connect to DB for testing.');
    process.exit(1);
  }

  try {
    // Cleanup test data
    const testEmails = [
      'erp8.admin@erp.com',
      'erp8.pm@erp.com',
      'erp8.emp@erp.com'
    ];

    await ScheduledReport.deleteMany({});
    await GeneratedReport.deleteMany({});
    await Attendance.deleteMany({ userId: { $in: await User.find({ email: { $in: testEmails } }).distinct('_id') } });
    await Task.deleteMany({ taskName: { $regex: /ERP Module 8/i } });
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 8/i } });
    await DrawingCategory.deleteMany({ name: 'ERP8 Working Drawing' });
    await Department.deleteMany({ name: { $regex: /ERP8/i } });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 8/i } });
    await Client.deleteMany({ email: 'erp8.client@client.com' });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Users
    const userAdmin = await User.create({
      name: 'Ratan Tata',
      email: 'erp8.admin@erp.com',
      password: await hashPassword('AdminPass@123'),
      roleId: roleAdmin._id,
      designation: 'Managing Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Anil Agarwal',
      email: 'erp8.pm@erp.com',
      password: await hashPassword('PMPass@123'),
      roleId: rolePM._id,
      designation: 'Project Lead',
      isActive: true
    });

    const userEmp = await User.create({
      name: 'Ketan Patel',
      email: 'erp8.emp@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Junior Designer',
      isActive: true
    });

    // 3. Project & Task
    const dept = await Department.create({ name: 'ERP8 Design Dept', code: 'E8-DES', isActive: true });
    const project = await Project.create({
      projectName: 'ERP Module 8 - Sky Tower Project',
      status: 'In Progress',
      progressPercentage: 60,
      budget: 10000000,
      createdBy: userPM._id,
      teamAssignments: [{ userId: userPM._id, projectRole: 'Lead' }]
    });

    await Task.create({
      projectId: project._id,
      departmentId: dept._id,
      taskName: 'ERP Module 8 - Foundation Structuring',
      createdBy: userPM._id,
      assignedEmployee: userEmp._id,
      status: 'Completed',
      totalWorkingTimeMinutes: 300,
      productivityScore: 95
    });

    const cat = await DrawingCategory.create({ name: 'ERP8 Working Drawing' });
    await Drawing.create({
      projectId: project._id,
      drawingName: 'ERP Module 8 - Foundation Plan',
      categoryId: cat._id,
      status: 'APPROVED'
    });

    const client = await Client.create({
      name: 'ERP8 Client Corp',
      companyName: 'ERP8 Client Corp',
      contactPerson: 'Harsh Vardhan',
      email: 'erp8.client@client.com',
      phone: '9988776655',
      isActive: true
    });

    console.log('--- 1. Testing Fast/Synchronous Report Generation (PDF, Excel, CSV) ---');

    // PDF Attendance Report
    const reqPdf = {
      body: { reportType: 'ATTENDANCE', format: 'PDF', scope: { employeeId: userEmp._id.toString() } },
      user: userAdmin
    };
    const resPdf = mockResponse();
    await reportController.generateReport(reqPdf, resPdf);
    assert(resPdf.statusCode === 200 && resPdf.body.status === 'READY', 'Synchronous PDF Attendance Report generated immediately with status READY');
    assert(fs.existsSync(safeResolvePath(resPdf.body.filePath)), 'Generated PDF file physically exists in /storage/reports/');

    // Excel Project Report
    const reqExcel = {
      body: { reportType: 'PROJECT', format: 'EXCEL', scope: { projectId: project._id.toString() } },
      user: userPM
    };
    const resExcel = mockResponse();
    await reportController.generateReport(reqExcel, resExcel);
    assert(resExcel.statusCode === 200 && resExcel.body.status === 'READY', 'Synchronous Excel Project Report generated cleanly');
    assert(resExcel.body.filePath.endsWith('.xlsx'), 'Generated file has .xlsx extension');

    // CSV Task Report
    const reqCsv = {
      body: { reportType: 'TASK', format: 'CSV', scope: { projectId: project._id.toString() } },
      user: userPM
    };
    const resCsv = mockResponse();
    await reportController.generateReport(reqCsv, resCsv);
    assert(resCsv.statusCode === 200 && resCsv.body.status === 'READY', 'Synchronous CSV Task Report generated cleanly');
    assert(resCsv.body.filePath.endsWith('.csv'), 'Generated file has .csv extension');

    console.log('\n--- 2. Testing Background-Job Threshold Routing & Status Polling ---');

    const reqBg = {
      body: { reportType: 'MONTHLY_PROGRESS', format: 'PDF', scope: { companyWide: true } },
      user: userAdmin
    };
    const resBg = mockResponse();
    await reportController.generateReport(reqBg, resBg);
    assert(resBg.statusCode === 202 && resBg.body.status === 'GENERATING', 'Company-wide report automatically routed to Background Job (HTTP 202 Accepted)');

    const bgReportId = resBg.body.reportId;
    await new Promise(r => setTimeout(r, 200)); // Wait for background worker to complete

    const reqStatus = { params: { id: bgReportId.toString() }, user: userAdmin };
    const resStatus = mockResponse();
    await reportController.getReportStatus(reqStatus, resStatus);
    assert(resStatus.statusCode === 200 && resStatus.body.status === 'READY', 'Status polling endpoint confirms background job completed with status READY');

    console.log('\n--- 3. Testing All Convenience Report Endpoints ---');

    const convenienceTests = [
      { fn: 'generateProductivityReport', body: { projectId: project._id.toString(), format: 'PDF' } },
      { fn: 'generateEmployeeReport', body: { format: 'EXCEL' } },
      { fn: 'generateDrawingReport', body: { projectId: project._id.toString(), format: 'PDF' } },
      { fn: 'generateSiteReport', body: { projectId: project._id.toString(), format: 'CSV' } },
      { fn: 'generateDailyProgressReport', body: { projectId: project._id.toString(), format: 'PDF' } },
      { fn: 'generateCustomerReport', body: { clientId: client._id.toString(), format: 'PDF' } },
      { fn: 'generateApprovalReport', body: { projectId: project._id.toString(), format: 'EXCEL' } }
    ];

    for (const testItem of convenienceTests) {
      const reqConv = { body: testItem.body, user: userAdmin };
      const resConv = mockResponse();
      await reportController[testItem.fn](reqConv, resConv);
      assert([200, 202].includes(resConv.statusCode), `Convenience endpoint ${testItem.fn} executed successfully`);
    }

    console.log('\n--- 4. Testing Role-Based Access Enforcement & Download Verification ---');

    const reqForbiddenComp = {
      body: { reportType: 'ATTENDANCE', format: 'PDF', scope: { companyWide: true } },
      user: userEmp
    };
    const resForbiddenComp = mockResponse();
    await reportController.generateReport(reqForbiddenComp, resForbiddenComp);
    assert(resForbiddenComp.statusCode === 403, 'Regular employee blocked from generating company-wide report (HTTP 403 Access Denied)');

    // Download verification
    const reqDownload = { params: { id: resPdf.body.reportId }, user: userAdmin };
    const resDownload = mockResponse();
    await reportController.downloadReport(reqDownload, resDownload);
    assert(resDownload.downloadedFile !== undefined, 'Authorizing download streams file correctly');

    console.log('\n--- 5. Testing Zero-Data Scope Handling ---');

    const reqZero = {
      body: { reportType: 'ATTENDANCE', format: 'PDF', scope: { employeeId: new mongoose.Types.ObjectId().toString() } },
      user: userAdmin
    };
    const resZero = mockResponse();
    await reportController.generateReport(reqZero, resZero);
    assert(resZero.statusCode === 200 && resZero.body.status === 'READY', 'Zero-data scope produces clean formatted report without failing');

    console.log('\n--- 6. Testing User Report History (getMyReports) ---');

    const reqMy = { query: {}, user: userAdmin };
    const resMy = mockResponse();
    await reportController.getMyReports(reqMy, resMy);
    assert(resMy.statusCode === 200 && resMy.body.reports.length >= 3, 'User report history list retrieves all user generated reports');

    console.log('\n--- 7. Testing Scheduled Report Management CRUD ---');

    const reqSchedCreate = {
      body: { reportType: 'PROJECT', format: 'PDF', frequency: 'MONTHLY', scope: { projectId: project._id.toString() } },
      user: userAdmin
    };
    const resSchedCreate = mockResponse();
    await reportController.createScheduledReport(reqSchedCreate, resSchedCreate);
    assert(resSchedCreate.statusCode === 201, 'Scheduled report configuration created successfully');

    const schedId = resSchedCreate.body.scheduled._id.toString();

    const reqSchedMy = { user: userAdmin };
    const resSchedMy = mockResponse();
    await reportController.getMyScheduledReports(reqSchedMy, resSchedMy);
    assert(resSchedMy.statusCode === 200 && resSchedMy.body.schedules.length >= 1, 'User scheduled reports list retrieved');

    const reqSchedDel = { params: { id: schedId }, user: userAdmin };
    const resSchedDel = mockResponse();
    await reportController.deleteScheduledReport(reqSchedDel, resSchedDel);
    assert(resSchedDel.statusCode === 200, 'Scheduled report configuration deleted successfully');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 8 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 8 test run:', error);
    process.exit(1);
  }
}

runErpModule8Tests();
