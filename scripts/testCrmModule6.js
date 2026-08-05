require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const Document = require('../models/Document');
const ClientDocumentAccessLog = require('../models/ClientDocumentAccessLog');

const clientDocumentController = require('../controllers/clientDocument.controller');
const documentController = require('../controllers/document.controller');
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

async function runModule6Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 6: CLIENT DOCUMENT ACCESS — TEST SUITE');
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
    // Cleanup previous test data
    const testEmails = [
      'client.m6.owner@m6.com',
      'client.m6.member@m6.com',
      'client.m6.viewonly@m6.com',
      'client.beta.m6@m6.com'
    ];

    const existingContacts = await ClientContact.find({ email: { $in: testEmails } });
    const existingClientIds = existingContacts.map(c => c.clientId);

    await ClientDocumentAccessLog.deleteMany({});
    await Document.deleteMany({});
    await ClientProjectLink.deleteMany({ clientId: { $in: existingClientIds } });
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });

    // 1. Create Test Clients
    const clientAlpha = await Client.create({
      name: 'Alpha Prime Infrastructure',
      companyName: 'Alpha Infra',
      phone: '9777711111',
      email: 'client.m6.owner@m6.com',
      isActive: true
    });

    const clientBeta = await Client.create({
      name: 'Beta Construction Co',
      phone: '9777722222',
      email: 'client.beta.m6@m6.com',
      isActive: true
    });

    // 2. Create Contacts for Client Alpha (OWNER, MEMBER, VIEW_ONLY)
    const contactAlphaOwner = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha Owner Contact',
      email: 'client.m6.owner@m6.com',
      password: await hashPassword('OwnerPass@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    const contactAlphaMember = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha Member Contact',
      email: 'client.m6.member@m6.com',
      password: await hashPassword('MemberPass@123'),
      permissionLevel: 'MEMBER',
      isPrimaryContact: false,
      isActive: true
    });

    const contactAlphaViewOnly = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha ViewOnly Contact',
      email: 'client.m6.viewonly@m6.com',
      password: await hashPassword('ViewPass@123'),
      permissionLevel: 'VIEW_ONLY',
      isPrimaryContact: false,
      isActive: true
    });

    const contactBetaOwner = await ClientContact.create({
      clientId: clientBeta._id,
      name: 'Beta Owner Contact',
      email: 'client.beta.m6@m6.com',
      password: await hashPassword('BetaPass@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    // 3. Create Test Projects & Links
    const projectAlpha = await Project.create({
      name: 'Alpha Corporate Plaza',
      status: 'In Progress'
    });

    const projectBeta = await Project.create({
      name: 'Beta Logistics Hub',
      status: 'In Progress'
    });

    const linkAlpha = await ClientProjectLink.create({
      clientId: clientAlpha._id,
      projectId: projectAlpha._id,
      visibleToClient: true,
      linkedBy: new mongoose.Types.ObjectId()
    });

    await ClientProjectLink.create({
      clientId: clientBeta._id,
      projectId: projectBeta._id,
      visibleToClient: true,
      linkedBy: new mongoose.Types.ObjectId()
    });

    // 4. Create Documents for projectAlpha
    const docContract = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Master Service Agreement 2026.pdf',
      filePath: 'https://cdn.nirman.com/docs/msa-2026.pdf',
      fileType: 'PDF',
      fileSize: 2450000,
      category: 'Contracts',
      visibleToClient: true
    });

    const docDrawingPdf = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Approved Structural Plan v2.pdf',
      filePath: 'https://cdn.nirman.com/docs/struct-v2.pdf',
      fileType: 'PDF',
      fileSize: 5120000,
      category: 'Approved Drawings PDFs',
      visibleToClient: true
    });

    const docPhoto = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Site Progress Photo July.jpg',
      filePath: 'https://cdn.nirman.com/docs/site-july.jpg',
      fileType: 'JPEG',
      fileSize: 1800000,
      category: 'Photos',
      visibleToClient: true
    });

    const docInvoice = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Milestone 2 Invoice.pdf',
      filePath: 'https://cdn.nirman.com/docs/inv-m2.pdf',
      fileType: 'PDF',
      fileSize: 850000,
      category: 'Invoices',
      visibleToClient: true
    });

    const docUnopened = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Soil Testing Report.pdf',
      filePath: 'https://cdn.nirman.com/docs/soil-report.pdf',
      fileType: 'PDF',
      fileSize: 3200000,
      category: 'Other Shared Documents',
      visibleToClient: true
    });

    // Internal-only document (visibleToClient: false by default)
    const docInternalOnly = await Document.create({
      projectId: projectAlpha._id,
      fileName: 'Internal Cost Estimation Draft.xlsx',
      filePath: 'https://cdn.nirman.com/docs/internal-cost.xlsx',
      fileType: 'XLSX',
      fileSize: 950000,
      category: 'Other Shared Documents',
      visibleToClient: false
    });

    console.log('\n--- 1. Testing Default Opt-In Visibility Isolation ---');

    const reqListAlpha = {
      params: { projectId: projectAlpha._id.toString() },
      query: {},
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resListAlpha = mockResponse();
    await clientDocumentController.getProjectDocuments(reqListAlpha, resListAlpha);

    assert(resListAlpha.statusCode === 200 && resListAlpha.body.success, 'Document list API returns HTTP 200 Success');
    assert(resListAlpha.body.totalCount === 5, 'Total client document count includes only visibleToClient:true items (5)');
    
    // Ensure internal-only doc is absent
    const allListedNames = Object.values(resListAlpha.body.documentsByFolder)
      .flat()
      .map(d => d.fileName);
    assert(!allListedNames.includes('Internal Cost Estimation Draft.xlsx'), 'Internal document (visibleToClient: false) is completely hidden from client document list');

    console.log('\n--- 2. Testing Folder Filtering & Search Query ---');

    // Folder Filter: Contracts
    const reqFolderFilter = {
      params: { projectId: projectAlpha._id.toString() },
      query: { folder: 'Contracts' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resFolderFilter = mockResponse();
    await clientDocumentController.getProjectDocuments(reqFolderFilter, resFolderFilter);
    assert(resFolderFilter.statusCode === 200 && resFolderFilter.body.totalCount === 1 && resFolderFilter.body.documentsByFolder.Contracts[0].fileName === 'Master Service Agreement 2026.pdf', 'Folder filter (Contracts) returns matching document');

    // Search Query: "Agreement"
    const reqSearchQuery = {
      params: { projectId: projectAlpha._id.toString() },
      query: { search: 'Agreement' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resSearchQuery = mockResponse();
    await clientDocumentController.getProjectDocuments(reqSearchQuery, resSearchQuery);
    assert(resSearchQuery.statusCode === 200 && resSearchQuery.body.totalCount === 1 && resSearchQuery.body.documentsByFolder.Contracts[0].fileName === 'Master Service Agreement 2026.pdf', 'Keyword search filter ("Agreement") returns matching document');

    console.log('\n--- 3. Testing Cross-Client Security Isolation ---');

    // Client Beta attempts to list Client Alpha's project documents -> REJECTED (403)
    const reqCrossList = {
      params: { projectId: projectAlpha._id.toString() },
      query: {},
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString() }
    };
    const resCrossList = mockResponse();
    await clientDocumentController.getProjectDocuments(reqCrossList, resCrossList);
    assert(resCrossList.statusCode === 403, 'Cross-client project document list request rejected with HTTP 403 Access Denied');

    // Client Beta attempts to preview Client Alpha's document -> REJECTED (403)
    const reqCrossPreview = {
      params: { documentId: docContract._id.toString() },
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString() }
    };
    const resCrossPreview = mockResponse();
    await clientDocumentController.previewDocument(reqCrossPreview, resCrossPreview);
    assert(resCrossPreview.statusCode === 403, 'Cross-client document preview request rejected with HTTP 403 Access Denied');

    console.log('\n--- 4. Testing Document Preview Endpoint & VIEW Action Logging ---');

    const reqPreview = {
      params: { documentId: docContract._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resPreview = mockResponse();
    await clientDocumentController.previewDocument(reqPreview, resPreview);
    assert(resPreview.statusCode === 200 && resPreview.body.previewUrl === 'https://cdn.nirman.com/docs/msa-2026.pdf', 'Authorized client previews document successfully');

    const logView = await ClientDocumentAccessLog.findOne({ documentId: docContract._id, action: 'VIEW' });
    assert(logView && logView.contactId.toString() === contactAlphaOwner._id.toString(), 'Document preview generates VIEW audit log entry with contact attribution');

    console.log('\n--- 5. Testing Document Download Endpoint & DOWNLOAD Action Logging ---');

    const reqDownload = {
      params: { documentId: docContract._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDownload = mockResponse();
    await clientDocumentController.downloadDocument(reqDownload, resDownload);
    assert(resDownload.statusCode === 200 && resDownload.body.downloadUrl === 'https://cdn.nirman.com/docs/msa-2026.pdf', 'Authorized client downloads document successfully');

    const logDownload = await ClientDocumentAccessLog.findOne({ documentId: docContract._id, action: 'DOWNLOAD' });
    assert(logDownload && logDownload.contactId.toString() === contactAlphaOwner._id.toString(), 'Document download generates DOWNLOAD audit log entry with contact attribution');

    console.log('\n--- 6. Testing Universal Permission Level Access (OWNER, MEMBER, VIEW_ONLY) ---');

    // MEMBER preview & download
    const reqMemberDownload = {
      params: { documentId: docDrawingPdf._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString(), permissionLevel: 'MEMBER' }
    };
    const resMemberDownload = mockResponse();
    await clientDocumentController.downloadDocument(reqMemberDownload, resMemberDownload);
    assert(resMemberDownload.statusCode === 200, 'MEMBER contact successfully downloads document');

    // VIEW_ONLY preview & download
    const reqViewOnlyDownload = {
      params: { documentId: docPhoto._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaViewOnly._id.toString(), permissionLevel: 'VIEW_ONLY' }
    };
    const resViewOnlyDownload = mockResponse();
    await clientDocumentController.downloadDocument(reqViewOnlyDownload, resViewOnlyDownload);
    assert(resViewOnlyDownload.statusCode === 200, 'VIEW_ONLY contact successfully downloads document');

    console.log('\n--- 7. Testing Parent-Project Linkage Toggle-Off Cascade ---');

    // Toggle parent project link visibility to false
    linkAlpha.visibleToClient = false;
    await linkAlpha.save();

    const reqCascadeDownload = {
      params: { documentId: docInvoice._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resCascadeDownload = mockResponse();
    await clientDocumentController.downloadDocument(reqCascadeDownload, resCascadeDownload);
    assert(resCascadeDownload.statusCode === 403 && resCascadeDownload.body.message.includes('Parent project is not linked or visible'), 'Document access blocked when parent project link visibility is toggled OFF');

    // Restore parent project link visibility
    linkAlpha.visibleToClient = true;
    await linkAlpha.save();

    console.log('\n--- 8. Testing Soft-Deleted Document Handling & Audit Trail Persistence ---');

    // Soft delete docInvoice
    docInvoice.isDeleted = true;
    await docInvoice.save();

    const reqDeletedDownload = {
      params: { documentId: docInvoice._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDeletedDownload = mockResponse();
    await clientDocumentController.downloadDocument(reqDeletedDownload, resDeletedDownload);
    assert(resDeletedDownload.statusCode === 410 && resDeletedDownload.body.message.includes('no longer available'), 'Soft-deleted document returns HTTP 410 clear unavailable message');

    console.log('\n--- 9. Testing Internal Team Access Log & Engagement Summary Views ---');

    // 1. Single Document Access Log
    const reqDocLog = { params: { documentId: docContract._id.toString() } };
    const resDocLog = mockResponse();
    await documentController.getDocumentAccessLog(reqDocLog, resDocLog);
    assert(resDocLog.statusCode === 200 && resDocLog.body.logs.length === 2, 'Internal team retrieves document access log (1 VIEW + 1 DOWNLOAD)');

    // 2. Client Engagement Summary
    const reqSummary = { params: { clientId: clientAlpha._id.toString() }, query: {} };
    const resSummary = mockResponse();
    await documentController.getClientEngagementSummary(reqSummary, resSummary);
    assert(resSummary.statusCode === 200 && resSummary.body.totalSharedDocumentsCount === 4, 'Engagement summary identifies 4 total active shared documents');
    assert(resSummary.body.engagedCount === 3 && resSummary.body.neverOpenedCount === 1, 'Engagement summary correctly distinguishes engaged documents (3) vs never opened (1)');
    assert(resSummary.body.neverOpenedDocuments[0].fileName === 'Soil Testing Report.pdf', 'Engagement summary accurately lists Soil Testing Report.pdf under neverOpenedDocuments');

    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 6 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 6 test run:', error);
    process.exit(1);
  }
}

runModule6Tests();
