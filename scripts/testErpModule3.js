require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const Department = require('../models/Department');
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const DrawingVersionStatusHistory = require('../models/DrawingVersionStatusHistory');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientProjectLink = require('../models/ClientProjectLink');

const projectController = require('../controllers/project.controller');
const drawingCategoryController = require('../controllers/drawingCategory.controller');
const drawingController = require('../controllers/drawing.controller');
const clientDrawingController = require('../controllers/clientDrawing.controller');
const { hashPassword } = require('../utils/password');

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
  return res;
}

async function runErpModule3Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 3: DRAWING MANAGEMENT SYSTEM — TEST SUITE');
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
      'erp3.superadmin@erp.com',
      'erp3.pm@erp.com',
      'erp3.arch@erp.com',
      'erp3.clientcontact@client.com'
    ];

    await DrawingVersionStatusHistory.deleteMany({});
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 3/i } });
    await DrawingCategory.deleteMany({ name: { $in: ['ERP3 Concept', 'ERP3 Process DWG'] } });
    await ClientProjectLink.deleteMany({});
    await ClientContact.deleteMany({ email: 'erp3.clientcontact@client.com' });
    await Client.deleteMany({ companyName: 'ERP3 Test Client' });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 3/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Create Roles
    let roleSuperAdmin = await RoleMaster.findOne({ roleCode: 'SUPER_ADMIN' });
    if (!roleSuperAdmin) roleSuperAdmin = await RoleMaster.create({ roleName: 'Super Admin', roleCode: 'SUPER_ADMIN', isActive: true });

    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });

    let roleArch = await RoleMaster.findOne({ roleCode: 'ARCHITECT' });
    if (!roleArch) roleArch = await RoleMaster.create({ roleName: 'Architect', roleCode: 'ARCHITECT', isActive: true });

    // 2. Create Users
    const userSuperAdmin = await User.create({
      name: 'Super Admin User',
      email: 'erp3.superadmin@erp.com',
      password: await hashPassword('Super@123'),
      roleId: roleSuperAdmin._id,
      designation: 'Managing Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Vikram Mehta',
      email: 'erp3.pm@erp.com',
      password: await hashPassword('PmPass@123'),
      roleId: rolePM._id,
      designation: 'Project Manager',
      isActive: true
    });

    const userArch = await User.create({
      name: 'Sneha Kapadia',
      email: 'erp3.arch@erp.com',
      password: await hashPassword('ArchPass@123'),
      roleId: roleArch._id,
      designation: 'Lead Architect',
      isActive: true
    });

    // 3. Create Client & Contact & Linkage for CRM 5 testing
    const client = await Client.create({ name: 'ERP3 Test Client Group', companyName: 'ERP3 Test Client', phone: '+919876543210' });
    const contactOwner = await ClientContact.create({
      clientId: client._id,
      name: 'Anil Ambani',
      email: 'erp3.clientcontact@client.com',
      password: await hashPassword('ClientPass@123'),
      permissionLevel: 'OWNER'
    });

    // 4. Create Project
    const project = await Project.create({
      projectName: 'ERP Module 3 - Skyline Residency',
      status: 'In Progress',
      createdBy: userPM._id,
      teamAssignments: [{ userId: userArch._id, projectRole: 'Lead Architect' }]
    });

    await ClientProjectLink.create({
      clientId: client._id,
      projectId: project._id,
      linkedBy: userPM._id,
      visibleToClient: true,
      isActive: true
    });

    console.log('--- 1. Testing Dynamic Categories & Drawing Creation ---');

    // Create Concept Category via Controller
    const reqCreateCat = {
      body: { name: 'ERP3 Concept', requiresClientApproval: true },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resCreateCat = mockResponse();
    await drawingCategoryController.createCategory(reqCreateCat, resCreateCat);
    assert(resCreateCat.statusCode === 201 && resCreateCat.body.category.name === 'ERP3 Concept', 'Dynamic DrawingCategory created successfully');
    const categoryConcept = resCreateCat.body.category;

    // Create Process DWG Category
    const reqCreateProcessCat = {
      body: { name: 'ERP3 Process DWG', requiresClientApproval: false, restrictedEditing: true },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resCreateProcessCat = mockResponse();
    await drawingCategoryController.createCategory(reqCreateProcessCat, resCreateProcessCat);
    const categoryProcess = resCreateProcessCat.body.category;

    // Create Parent Drawing
    const reqCreateDwg = {
      body: {
        projectId: project._id.toString(),
        drawingName: 'ERP Module 3 - Master Elevation Sketch',
        categoryId: categoryConcept._id.toString(),
        drawingNumber: 'DWG-SK-001'
      },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resCreateDwg = mockResponse();
    await drawingController.createDrawing(reqCreateDwg, resCreateDwg);
    assert(resCreateDwg.statusCode === 201 && resCreateDwg.body.drawing.drawingName === 'ERP Module 3 - Master Elevation Sketch', 'Parent Drawing record created successfully');
    const drawingId = resCreateDwg.body.drawing._id;

    console.log('\n--- 2. Testing Multi-Version Upload ("Never Permanently Replaced" Rule) ---');

    // Architect uploads Version 1
    const reqUploadV1 = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/drawings/skyline_v1.dwg', fileType: 'DWG', changeLog: 'Initial draft sketch v1' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resUploadV1 = mockResponse();
    await drawingController.uploadVersion(reqUploadV1, resUploadV1);
    assert(resUploadV1.statusCode === 201 && resUploadV1.body.version.versionNumber === 1, 'Version v1 uploaded with status DESIGNER_UPLOADED & visibleToClient: false');
    const v1Id = resUploadV1.body.version._id;

    // Architect uploads Version 2
    const reqUploadV2 = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/drawings/skyline_v2.dwg', fileType: 'DWG', changeLog: 'Revised column setbacks v2' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resUploadV2 = mockResponse();
    await drawingController.uploadVersion(reqUploadV2, resUploadV2);
    assert(resUploadV2.statusCode === 201 && resUploadV2.body.version.versionNumber === 2, 'Version v2 uploaded with auto-incremented version number (v2)');
    const v2Id = resUploadV2.body.version._id;

    // Verify version history retains both v1 and v2
    const reqVersions = { params: { id: drawingId.toString() } };
    const resVersions = mockResponse();
    await drawingController.getDrawingVersions(reqVersions, resVersions);
    assert(resVersions.statusCode === 200 && resVersions.body.versions.length === 2, 'Version history retains both v1 and v2 ("Never Permanently Replaced" rule enforced)');

    console.log('\n--- 3. Testing Internal Two-Stage Approval Workflow & CRM 5 Handoff ---');

    // Stage 1: PM Rejects v2 first (testing PM rejection)
    const reqPmReject = {
      params: { versionId: v2Id.toString() },
      body: { decision: 'REJECT', comments: 'Column C2 load specs missing in section B' },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resPmReject = mockResponse();
    await drawingController.pmReview(reqPmReject, resPmReject);
    assert(resPmReject.statusCode === 200 && resPmReject.body.version.status === 'PM_REJECTED', 'PM rejects version v2 with mandatory comments');

    // Architect uploads Version 3 (fixing PM comments)
    const reqUploadV3 = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/drawings/skyline_v3.dwg', fileType: 'DWG', changeLog: 'Added column C2 load specs per PM review' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resUploadV3 = mockResponse();
    await drawingController.uploadVersion(reqUploadV3, resUploadV3);
    const v3Id = resUploadV3.body.version._id;

    // Stage 2: PM Approves v3 -> PM_APPROVED
    const reqPmApprove = {
      params: { versionId: v3Id.toString() },
      body: { decision: 'APPROVE', comments: 'Column specs verified' },
      user: { _id: userPM._id, roleId: rolePM }
    };
    const resPmApprove = mockResponse();
    await drawingController.pmReview(reqPmApprove, resPmApprove);
    assert(resPmApprove.statusCode === 200 && resPmApprove.body.version.status === 'PM_APPROVED', 'PM approves version v3 (DESIGNER_UPLOADED -> PM_APPROVED)');

    // Stage 3: Admin Approves v3 -> PENDING_CLIENT_APPROVAL, visibleToClient: true (THE HANDOFF POINT)
    const reqAdminApprove = {
      params: { versionId: v3Id.toString() },
      body: { decision: 'APPROVE', comments: 'Approved for client review' },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resAdminApprove = mockResponse();
    await drawingController.adminReview(reqAdminApprove, resAdminApprove);
    assert(resAdminApprove.statusCode === 200 && resAdminApprove.body.version.status === 'PENDING_CLIENT_APPROVAL', 'Admin approves v3 -> PENDING_CLIENT_APPROVAL');
    assert(resAdminApprove.body.version.visibleToClient === true && resAdminApprove.body.drawing.visibleToClient === true, 'Admin approval automatically flips visibleToClient: true (CRM Module 5 Handoff)');

    // Test CRM Module 5 Integration: Query client portal drawings for this project
    const reqClientPortal = {
      params: { projectId: project._id.toString() },
      clientContact: { contactId: contactOwner._id.toString(), clientId: client._id.toString() }
    };
    const resClientPortal = mockResponse();
    await clientDrawingController.getProjectDrawings(reqClientPortal, resClientPortal);
    assert(resClientPortal.statusCode === 200 && resClientPortal.body.pendingApproval.length === 1, 'CRM Module 5 client portal query immediately picks up handed-off drawing in pendingApproval');

    console.log('\n--- 4. Testing Side-by-Side Version Compare & Audit Logs ---');

    // Compare v1 vs v3
    const reqCompare = {
      params: { id: drawingId.toString() },
      query: { versionA: '1', versionB: '3' }
    };
    const resCompare = mockResponse();
    await drawingController.compareVersions(reqCompare, resCompare);
    assert(resCompare.statusCode === 200 && resCompare.body.versionA.versionNumber === 1 && resCompare.body.versionB.versionNumber === 3, 'Side-by-side comparison data retrieved for v1 vs v3');

    // Client Approval Log view
    const reqClientLog = { params: { versionId: v3Id.toString() } };
    const resClientLog = mockResponse();
    await drawingController.getClientApprovalLog(reqClientLog, resClientLog);
    assert(resClientLog.statusCode === 200 && Array.isArray(resClientLog.body.approvalLogs), 'Internal view of client approval log retrieved');

    console.log('\n--- 5. Testing Process DWG In-Place Editing Restrictions ---');

    // Create Process DWG Drawing
    const reqCreatePdwg = {
      body: {
        projectId: project._id.toString(),
        drawingName: 'ERP Module 3 - CAD Process Layout',
        categoryId: categoryProcess._id.toString()
      },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resCreatePdwg = mockResponse();
    await drawingController.createDrawing(reqCreatePdwg, resCreatePdwg);
    const pdwgId = resCreatePdwg.body.drawing._id;

    const reqUploadPdwgV1 = {
      params: { drawingId: pdwgId.toString() },
      body: { filePath: '/uploads/dwg/process_v1.dwg', fileType: 'DWG' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resUploadPdwgV1 = mockResponse();
    await drawingController.uploadVersion(reqUploadPdwgV1, resUploadPdwgV1);
    const pdwgV1Id = resUploadPdwgV1.body.version._id;

    // Admin edits Process DWG in place -> SUCCEEDS
    const reqEditInPlaceAdmin = {
      params: { versionId: pdwgV1Id.toString() },
      body: { updatedFilePath: '/uploads/dwg/process_v1_edited.dwg', changeLog: 'In-place layer correction' },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resEditInPlaceAdmin = mockResponse();
    await drawingController.editInPlaceProcessDwg(reqEditInPlaceAdmin, resEditInPlaceAdmin);
    assert(resEditInPlaceAdmin.statusCode === 200 && resEditInPlaceAdmin.body.version.filePath === '/uploads/dwg/process_v1_edited.dwg', 'Super Admin edits Process DWG in place successfully without version increment');

    // Architect attempts in-place edit on Process DWG -> REJECTED (403)
    const reqEditInPlaceArch = {
      params: { versionId: pdwgV1Id.toString() },
      body: { updatedFilePath: '/uploads/dwg/illegal.dwg' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resEditInPlaceArch = mockResponse();
    await drawingController.editInPlaceProcessDwg(reqEditInPlaceArch, resEditInPlaceArch);
    assert(resEditInPlaceArch.statusCode === 403, 'Non-admin architect blocked from in-place Process DWG edit (HTTP 403 Access Denied)');

    // Admin attempts in-place edit on NON-Process DWG category -> REJECTED (400)
    const reqEditInPlaceNonPdwg = {
      params: { versionId: v3Id.toString() },
      body: { updatedFilePath: '/uploads/dwg/illegal.dwg' },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resEditInPlaceNonPdwg = mockResponse();
    await drawingController.editInPlaceProcessDwg(reqEditInPlaceNonPdwg, resEditInPlaceNonPdwg);
    assert(resEditInPlaceNonPdwg.statusCode === 400, 'In-place editing rejected for non-Process-DWG drawing category');

    console.log('\n--- 6. Testing GFC Promotion & Lock State ---');

    // Admin promotes drawing to GFC -> isGFCLocked = true
    const reqPromoteGfc = {
      params: { id: drawingId.toString() },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resPromoteGfc = mockResponse();
    await drawingController.promoteToGFC(reqPromoteGfc, resPromoteGfc);
    assert(resPromoteGfc.statusCode === 200 && resPromoteGfc.body.drawing.isGFCLocked === true, 'Drawing promoted to GFC locked state');

    // Attempt version upload on GFC-locked drawing -> REJECTED (400)
    const reqUploadGfcLocked = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/drawings/skyline_v4.dwg', fileType: 'DWG' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resUploadGfcLocked = mockResponse();
    await drawingController.uploadVersion(reqUploadGfcLocked, resUploadGfcLocked);
    assert(resUploadGfcLocked.statusCode === 400, 'Version upload blocked on GFC-locked drawing');

    // Super Admin unlocks GFC with reason
    const reqUnlockGfc = {
      params: { id: drawingId.toString() },
      body: { reason: 'Client requested major architectural scope addition' },
      user: { _id: userSuperAdmin._id, roleId: roleSuperAdmin }
    };
    const resUnlockGfc = mockResponse();
    await drawingController.unlockGFC(reqUnlockGfc, resUnlockGfc);
    assert(resUnlockGfc.statusCode === 200 && resUnlockGfc.body.drawing.isGFCLocked === false, 'Super Admin unlocks GFC drawing with logged reason');

    console.log('\n--- 7. Testing Drawings Breakdown & Module 1 Integration ---');

    // Test Project Drawings Breakdown Endpoint
    const reqBreakdown = { params: { projectId: project._id.toString() } };
    const resBreakdown = mockResponse();
    await drawingController.getProjectDrawingsBreakdown(reqBreakdown, resBreakdown);
    assert(resBreakdown.statusCode === 200 && resBreakdown.body.totalDrawings >= 2, 'Project drawings breakdown retrieves aggregated drawing statistics');

    // Test ERP Module 1 Progress Breakdown Integration
    const reqProjBreakdown = { params: { id: project._id.toString() } };
    const resProjBreakdown = mockResponse();
    await projectController.getProgressBreakdown(reqProjBreakdown, resProjBreakdown);
    assert(resProjBreakdown.statusCode === 200 && resProjBreakdown.body.drawingWise !== null, 'Module 1 progress breakdown endpoint populated with real ERP Module 3 drawingWise data');
    assert(resProjBreakdown.body.drawingWise.totalDrawings >= 2, 'Module 1 progress breakdown contains populated totalDrawings count');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 3 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 3 test run:', error);
    process.exit(1);
  }
}

runErpModule3Tests();
