require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const DocumentFolder = require('../models/DocumentFolder');
const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentAccessLog = require('../models/DocumentAccessLog');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientProjectLink = require('../models/ClientProjectLink');

const documentFolderController = require('../controllers/documentFolder.controller');
const documentController = require('../controllers/document.controller');
const clientDocumentController = require('../controllers/clientDocument.controller');
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

async function runErpModule6Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 6: DOCUMENT MANAGEMENT — TEST SUITE');
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
      'erp6.admin@erp.com',
      'erp6.pm@erp.com',
      'erp6.architect@erp.com',
      'erp6.client@client.com'
    ];

    await DocumentAccessLog.deleteMany({});
    await DocumentVersion.deleteMany({});
    await Document.deleteMany({ documentName: { $regex: /ERP Module 6/i } });
    await DocumentFolder.deleteMany({ folderName: { $regex: /ERP Module 6/i } });
    await ClientProjectLink.deleteMany({});
    await ClientContact.deleteMany({ email: 'erp6.client@client.com' });
    await Client.deleteMany({ companyName: 'ERP6 Corporate Client' });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 6/i } });
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
      name: 'Aditya Birla',
      email: 'erp6.admin@erp.com',
      password: await hashPassword('AdminPass@123'),
      roleId: roleAdmin._id,
      designation: 'Studio Director',
      isActive: true
    });

    const userPM = await User.create({
      name: 'Vikram Sarabhai',
      email: 'erp6.pm@erp.com',
      password: await hashPassword('PMPass@123'),
      roleId: rolePM._id,
      designation: 'Senior Project Manager',
      isActive: true
    });

    const userArchitect = await User.create({
      name: 'Nikhil Mehta',
      email: 'erp6.architect@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Architect',
      isActive: true
    });

    // 3. Client & Contact
    const client = await Client.create({ name: 'ERP6 Corporate Client', companyName: 'ERP6 Corporate Client', phone: '+919876543222' });
    const contactClient = await ClientContact.create({
      clientId: client._id,
      name: 'Sunil Mittal',
      email: 'erp6.client@client.com',
      password: await hashPassword('ClientPass@123'),
      permissionLevel: 'OWNER'
    });

    // 4. Project & Client Linkage
    const project = await Project.create({
      projectName: 'ERP Module 6 - Structural Design Project',
      status: 'In Progress',
      createdBy: userAdmin._id,
      teamAssignments: [
        { userId: userPM._id, projectRole: 'Project Manager' },
        { userId: userArchitect._id, projectRole: 'Architect' }
      ]
    });

    await ClientProjectLink.create({
      clientId: client._id,
      projectId: project._id,
      linkedBy: userAdmin._id,
      visibleToClient: true,
      isActive: true
    });

    console.log('--- 1. Testing File Type Validation ---');

    // Unsupported extension (.EXE) -> REJECTED (HTTP 400)
    const reqUploadExe = {
      body: {
        projectId: project._id.toString(),
        documentName: 'ERP Module 6 - Executable Patch.exe',
        fileType: 'EXE'
      },
      user: userArchitect
    };
    const resUploadExe = mockResponse();
    await documentController.uploadDocument(reqUploadExe, resUploadExe);
    assert(resUploadExe.statusCode === 400, 'Unsupported file type (.EXE) rejected with HTTP 400 Bad Request');

    // Supported extensions (PDF, DWG) -> ACCEPTED
    const reqUploadPdf = {
      body: {
        projectId: project._id.toString(),
        documentName: 'ERP Module 6 - Soil Test Report.pdf',
        fileType: 'PDF',
        fileSizeKB: 2048
      },
      user: userArchitect
    };
    const resUploadPdf = mockResponse();
    await documentController.uploadDocument(reqUploadPdf, resUploadPdf);
    assert(resUploadPdf.statusCode === 201 && resUploadPdf.body.document.visibleToClient === false, 'Supported file type (PDF) uploaded with visibleToClient: false default');
    const docSoil = resUploadPdf.body.document;

    console.log('\n--- 2. Testing DocumentFolder CRUD & Soft Deletion ---');

    // Create Folder
    const reqCreateFolder = {
      params: { projectId: project._id.toString() },
      body: { folderName: 'ERP Module 6 - Contracts & Agreements' },
      user: userPM
    };
    const resCreateFolder = mockResponse();
    await documentFolderController.createFolder(reqCreateFolder, resCreateFolder);
    assert(resCreateFolder.statusCode === 201, 'DocumentFolder created successfully');
    const folderContracts = resCreateFolder.body.folder;

    // Upload Document into Folder
    const reqUploadContract = {
      body: {
        projectId: project._id.toString(),
        folderId: folderContracts._id.toString(),
        documentName: 'ERP Module 6 - Client Agreement 2026.pdf',
        fileType: 'PDF',
        fileSizeKB: 4096
      },
      user: userPM
    };
    const resUploadContract = mockResponse();
    await documentController.uploadDocument(reqUploadContract, resUploadContract);
    assert(resUploadContract.statusCode === 201 && resUploadContract.body.document.folderId._id.toString() === folderContracts._id.toString(), 'Document uploaded directly into target folder');
    const docContract = resUploadContract.body.document;

    // Delete Folder -> Moves document to root (folderId: null)
    const reqDelFolder = { params: { id: folderContracts._id.toString() }, user: userAdmin };
    const resDelFolder = mockResponse();
    await documentFolderController.deleteFolder(reqDelFolder, resDelFolder);
    assert(resDelFolder.statusCode === 200, 'DocumentFolder soft-deleted successfully');

    const reqGetDocAfterDel = { params: { id: docContract._id.toString() }, user: userPM };
    const resGetDocAfterDel = mockResponse();
    await documentController.getDocumentById(reqGetDocAfterDel, resGetDocAfterDel);
    assert(resGetDocAfterDel.body.document.folderId === null, 'Contained document automatically reassigned to Uncategorized root (folderId: null)');

    console.log('\n--- 3. Testing Multi-Version Control & Automatic Visibility Reset Rule ---');

    // PM toggles docContract visibleToClient: true
    const reqToggleTrue = {
      params: { id: docContract._id.toString() },
      body: { visibleToClient: true },
      user: userPM
    };
    const resToggleTrue = mockResponse();
    await documentController.toggleClientVisibility(reqToggleTrue, resToggleTrue);
    assert(resToggleTrue.statusCode === 200 && resToggleTrue.body.visibleToClient === true, 'PM toggled visibleToClient: true');

    // Upload New Version v2 -> MUST AUTOMATICALLY RESET visibleToClient to false!
    const reqUploadV2 = {
      params: { id: docContract._id.toString() },
      body: {
        changeLog: 'Version 2: Updated clause 4.2 timeline',
        fileSizeKB: 4200
      },
      user: userArchitect
    };
    const resUploadV2 = mockResponse();
    await documentController.uploadDocumentVersion(reqUploadV2, resUploadV2);
    assert(resUploadV2.statusCode === 201 && resUploadV2.body.document.version === 2, 'New version v2 created with auto-incremented version number');
    assert(resUploadV2.body.document.visibleToClient === false, 'CRITICAL RULE VERIFIED: New version upload automatically RESETS visibleToClient to false');

    console.log('\n--- 4. Testing CRM Module 6 Handoff Integration ---');

    // Client portal query BEFORE re-sharing -> docContract NOT listed
    const reqClientList1 = {
      params: { projectId: project._id.toString() },
      clientContact: { clientId: client._id.toString(), contactId: contactClient._id.toString() }
    };
    const resClientList1 = mockResponse();
    await clientDocumentController.getProjectDocuments(reqClientList1, resClientList1);
    assert(resClientList1.statusCode === 200 && resClientList1.body.totalCount === 0, 'Client portal excludes document while visibleToClient is false');

    // PM re-toggles visibleToClient: true
    await documentController.toggleClientVisibility(reqToggleTrue, resToggleTrue);

    // Client portal query AFTER re-sharing -> docContract LISTED!
    const reqClientList2 = {
      params: { projectId: project._id.toString() },
      clientContact: { clientId: client._id.toString(), contactId: contactClient._id.toString() }
    };
    const resClientList2 = mockResponse();
    await clientDocumentController.getProjectDocuments(reqClientList2, resClientList2);
    assert(resClientList2.statusCode === 200 && resClientList2.body.totalCount === 1, 'CRM Module 6 handoff verified: Document immediately appears in Client Portal list once visibleToClient: true');

    console.log('\n--- 5. Testing Role-Restricted Document Access ---');

    // Create PM-only restricted document
    const reqUploadRestricted = {
      body: {
        projectId: project._id.toString(),
        documentName: 'ERP Module 6 - Project Budget Summary.xlsx',
        fileType: 'XLSX',
        restrictedToRoles: ['PROJECT_MANAGER', 'ADMIN']
      },
      user: userPM
    };
    const resUploadRestricted = mockResponse();
    await documentController.uploadDocument(reqUploadRestricted, resUploadRestricted);
    assert(resUploadRestricted.statusCode === 201, 'Role-restricted document created successfully');
    const docBudget = resUploadRestricted.body.document;

    // Regular Architect attempts to access restricted document -> REJECTED (HTTP 403)
    const reqGetRestrictedEmp = { params: { id: docBudget._id.toString() }, user: userArchitect };
    const resGetRestrictedEmp = mockResponse();
    await documentController.getDocumentById(reqGetRestrictedEmp, resGetRestrictedEmp);
    assert(resGetRestrictedEmp.statusCode === 403, 'Non-authorized employee blocked from viewing restricted document (HTTP 403 Access Denied)');

    // PM accesses restricted document -> SUCCEEDS
    const reqGetRestrictedPM = { params: { id: docBudget._id.toString() }, user: userPM };
    const resGetRestrictedPM = mockResponse();
    await documentController.getDocumentById(reqGetRestrictedPM, resGetRestrictedPM);
    assert(resGetRestrictedPM.statusCode === 200, 'Matching role (PROJECT_MANAGER) retrieves restricted document details');

    console.log('\n--- 6. Testing Logged Preview & Download (DocumentAccessLog) ---');

    // Preview Document
    const reqPreview = { params: { id: docContract._id.toString() }, user: userArchitect };
    const resPreview = mockResponse();
    await documentController.previewDocument(reqPreview, resPreview);
    assert(resPreview.statusCode === 200 && resPreview.body.previewUrl !== undefined, 'Document preview payload generated');

    // Download Document
    const reqDownload = { params: { id: docContract._id.toString() }, user: userArchitect };
    const resDownload = mockResponse();
    await documentController.downloadDocument(reqDownload, resDownload);
    assert(resDownload.statusCode === 200 && resDownload.body.downloadUrl !== undefined, 'Document download authorized');

    // Check DocumentAccessLog
    const reqLog = { params: { id: docContract._id.toString() }, user: userPM };
    const resLog = mockResponse();
    await documentController.getDocumentAccessLog(reqLog, resLog);
    assert(resLog.statusCode === 200 && resLog.body.totalCount === 2, 'DocumentAccessLog correctly recorded 1 VIEW and 1 DOWNLOAD action');

    console.log('\n--- 7. Testing Filtered Search & List Endpoints ---');

    const reqSearch = {
      params: { projectId: project._id.toString() },
      query: { q: 'Soil', fileType: 'PDF' },
      user: userArchitect
    };
    const resSearch = mockResponse();
    await documentController.searchDocuments(reqSearch, resSearch);
    assert(resSearch.statusCode === 200 && resSearch.body.documents.length === 1 && resSearch.body.documents[0].documentName === 'ERP Module 6 - Soil Test Report.pdf', 'Filtered document search by keyword and fileType returns exact match');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 6 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 6 test run:', error);
    process.exit(1);
  }
}

runErpModule6Tests();
