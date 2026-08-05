require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const Drawing = require('../models/Drawing');
const ClientApprovalLog = require('../models/ClientApprovalLog');
const DrawingComment = require('../models/DrawingComment');

const clientDrawingController = require('../controllers/clientDrawing.controller');
const drawingController = require('../controllers/drawing.controller');
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

async function runModule5Tests() {
  console.log('================================================================================');
  console.log('🚀 CRM MODULE 5: DRAWING APPROVAL WORKFLOW (CLIENT SIDE) — TEST SUITE');
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
      'client.m5.owner@m5.com',
      'client.m5.member@m5.com',
      'client.m5.viewonly@m5.com',
      'client.beta.m5@m5.com'
    ];

    const existingContacts = await ClientContact.find({ email: { $in: testEmails } });
    const existingClientIds = existingContacts.map(c => c.clientId);

    await DrawingComment.deleteMany({});
    await ClientApprovalLog.deleteMany({});
    await Drawing.deleteMany({});
    await ClientProjectLink.deleteMany({ clientId: { $in: existingClientIds } });
    await ClientContact.deleteMany({ email: { $in: testEmails } });
    await Client.deleteMany({ email: { $in: testEmails } });

    // 1. Create Test Clients
    const clientAlpha = await Client.create({
      name: 'Alpha Apex Developers',
      companyName: 'Apex Group',
      phone: '9888811111',
      email: 'client.m5.owner@m5.com',
      isActive: true
    });

    const clientBeta = await Client.create({
      name: 'Beta Commercial Ltd',
      phone: '9888822222',
      email: 'client.beta.m5@m5.com',
      isActive: true
    });

    // 2. Create Contacts under Client Alpha (OWNER, MEMBER, VIEW_ONLY)
    const contactAlphaOwner = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha Owner Contact',
      email: 'client.m5.owner@m5.com',
      password: await hashPassword('PassOwner@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    const contactAlphaMember = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha Member Contact',
      email: 'client.m5.member@m5.com',
      password: await hashPassword('PassMember@123'),
      permissionLevel: 'MEMBER',
      isPrimaryContact: false,
      isActive: true
    });

    const contactAlphaViewOnly = await ClientContact.create({
      clientId: clientAlpha._id,
      name: 'Alpha ViewOnly Contact',
      email: 'client.m5.viewonly@m5.com',
      password: await hashPassword('PassView@123'),
      permissionLevel: 'VIEW_ONLY',
      isPrimaryContact: false,
      isActive: true
    });

    // Contact under Client Beta
    const contactBetaOwner = await ClientContact.create({
      clientId: clientBeta._id,
      name: 'Beta Owner Contact',
      email: 'client.beta.m5@m5.com',
      password: await hashPassword('PassBeta@123'),
      permissionLevel: 'OWNER',
      isPrimaryContact: true,
      isActive: true
    });

    // 3. Create Test Projects & Links
    const projectAlpha = await Project.create({
      name: 'Alpha Luxury Heights',
      status: 'In Progress',
      progressPercent: 35
    });

    const projectBeta = await Project.create({
      name: 'Beta Industrial Park',
      status: 'In Progress',
      progressPercent: 15
    });

    await ClientProjectLink.create({
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

    // 4. Create Drawings for Alpha Luxury Heights
    const dwgPending = await Drawing.create({
      projectId: projectAlpha._id,
      title: 'Ground Floor Structural Plan',
      drawingNumber: 'DWG-STR-001',
      category: 'Working',
      currentVersion: 2,
      fileUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v2.pdf',
      thumbnailUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v2.jpg',
      status: 'PENDING_CLIENT_APPROVAL',
      visibleToClient: true,
      versions: [
        { versionNumber: 1, fileUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v1.pdf', thumbnailUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v1.jpg', notes: 'Initial Release' },
        { versionNumber: 2, fileUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v2.pdf', thumbnailUrl: 'https://cdn.nirman.com/drawings/dwg-str-001-v2.jpg', notes: 'Revised pillar offsets' }
      ]
    });

    const dwgApproved = await Drawing.create({
      projectId: projectAlpha._id,
      title: 'Exterior 3D Elevation Render',
      drawingNumber: 'DWG-3D-005',
      category: 'Concept',
      currentVersion: 1,
      fileUrl: 'https://cdn.nirman.com/drawings/dwg-3d-005-v1.jpg',
      thumbnailUrl: 'https://cdn.nirman.com/drawings/dwg-3d-005-v1-thumb.jpg',
      status: 'APPROVED',
      visibleToClient: true,
      versions: [
        { versionNumber: 1, fileUrl: 'https://cdn.nirman.com/drawings/dwg-3d-005-v1.jpg', notes: 'Final concept render' }
      ]
    });

    const dwgChanges = await Drawing.create({
      projectId: projectAlpha._id,
      title: 'Interior Electrical & Plumbing Layout',
      drawingNumber: 'DWG-INT-012',
      category: 'Interior',
      currentVersion: 1,
      fileUrl: 'https://cdn.nirman.com/drawings/dwg-int-012-v1.pdf',
      thumbnailUrl: 'https://cdn.nirman.com/drawings/dwg-int-012-v1.jpg',
      status: 'CHANGES_REQUESTED',
      visibleToClient: true,
      versions: [
        { versionNumber: 1, fileUrl: 'https://cdn.nirman.com/drawings/dwg-int-012-v1.pdf', notes: 'Draft plumbing' }
      ]
    });

    // Unapproved internal drawing (not yet visible to client)
    const dwgInternalOnly = await Drawing.create({
      projectId: projectAlpha._id,
      title: 'Internal Unreviewed Beam Calculations',
      drawingNumber: 'DWG-INT-CALC',
      category: 'Site',
      currentVersion: 1,
      fileUrl: 'https://cdn.nirman.com/drawings/internal-calc.pdf',
      status: 'PM_REVIEW',
      visibleToClient: false
    });

    console.log('\n--- 1. Testing Grouped Drawings Listing (GET /api/client/projects/:projectId/drawings) ---');

    const reqListAlpha = {
      params: { projectId: projectAlpha._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resListAlpha = mockResponse();
    await clientDrawingController.getProjectDrawings(reqListAlpha, resListAlpha);

    assert(resListAlpha.statusCode === 200 && resListAlpha.body.success, 'Drawing list API returns HTTP 200 Success');
    assert(resListAlpha.body.pendingApproval.length === 1 && resListAlpha.body.pendingApproval[0].title === 'Ground Floor Structural Plan', 'Pending Approval grouping contains correct drawing');
    assert(resListAlpha.body.approved.length === 1 && resListAlpha.body.approved[0].title === 'Exterior 3D Elevation Render', 'Approved grouping contains correct drawing');
    assert(resListAlpha.body.changesRequested.length === 1 && resListAlpha.body.changesRequested[0].title === 'Interior Electrical & Plumbing Layout', 'Changes Requested grouping contains correct drawing');
    assert(resListAlpha.body.totalCount === 3, 'Total client drawing count matches expected visible count (3)');

    console.log('\n--- 2. Testing Internal-Only Stage Drawing Isolation ---');
    const allRetrievedIds = [
      ...resListAlpha.body.pendingApproval,
      ...resListAlpha.body.approved,
      ...resListAlpha.body.changesRequested
    ].map(d => d._id.toString());
    assert(!allRetrievedIds.includes(dwgInternalOnly._id.toString()), 'Internal stage drawing (visibleToClient: false) is completely absent from client view');

    console.log('\n--- 3. Testing Cross-Client Security Linkage Isolation ---');

    // Client Beta attempts to view Client Alpha's project drawings -> REJECTED (403)
    const reqCrossList = {
      params: { projectId: projectAlpha._id.toString() },
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString() }
    };
    const resCrossList = mockResponse();
    await clientDrawingController.getProjectDrawings(reqCrossList, resCrossList);
    assert(resCrossList.statusCode === 403, 'Cross-client drawing list request rejected with HTTP 403 Access Denied');

    // Client Beta attempts to view Client Alpha's specific drawing detail -> REJECTED (403)
    const reqCrossDetail = {
      params: { drawingId: dwgPending._id.toString() },
      clientContact: { clientId: clientBeta._id.toString(), contactId: contactBetaOwner._id.toString() }
    };
    const resCrossDetail = mockResponse();
    await clientDrawingController.getDrawingDetail(reqCrossDetail, resCrossDetail);
    assert(resCrossDetail.statusCode === 403, 'Cross-client drawing detail request rejected with HTTP 403 Access Denied');

    console.log('\n--- 4. Testing Drawing Detail, Version History & Version Comparison ---');

    const reqDetailAuth = {
      params: { drawingId: dwgPending._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDetailAuth = mockResponse();
    await clientDrawingController.getDrawingDetail(reqDetailAuth, resDetailAuth);
    assert(resDetailAuth.statusCode === 200 && resDetailAuth.body.drawing.title === 'Ground Floor Structural Plan', 'Authorized client fetches genuine drawing detail');

    const resVersions = mockResponse();
    await clientDrawingController.getDrawingVersions(reqDetailAuth, resVersions);
    assert(resVersions.statusCode === 200 && resVersions.body.versions.length === 2, 'Drawing version history returns all versions');

    const reqCompare = {
      params: { drawingId: dwgPending._id.toString() },
      query: { versionA: '1', versionB: '2' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resCompare = mockResponse();
    await clientDrawingController.compareDrawingVersions(reqCompare, resCompare);
    assert(resCompare.statusCode === 200 && resCompare.body.versionA.versionNumber === 1 && resCompare.body.versionB.versionNumber === 2, 'Compare tool retrieves side-by-side versions correctly');

    console.log('\n--- 5. Testing Permission-Aware Actions (VIEW_ONLY Block) ---');

    // VIEW_ONLY contact attempts to approve -> REJECTED (403)
    const reqApproveViewOnly = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Looks good' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaViewOnly._id.toString(), permissionLevel: 'VIEW_ONLY' }
    };
    const resApproveViewOnly = mockResponse();
    await clientDrawingController.approveDrawing(reqApproveViewOnly, resApproveViewOnly);
    assert(resApproveViewOnly.statusCode === 403, 'VIEW_ONLY contact blocked from approving drawing (HTTP 403)');

    // VIEW_ONLY contact attempts to request changes -> REJECTED (403)
    const reqRequestChangesViewOnly = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Change beam spacing' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaViewOnly._id.toString(), permissionLevel: 'VIEW_ONLY' }
    };
    const resRequestChangesViewOnly = mockResponse();
    await clientDrawingController.requestChanges(reqRequestChangesViewOnly, resRequestChangesViewOnly);
    assert(resRequestChangesViewOnly.statusCode === 403, 'VIEW_ONLY contact blocked from requesting changes (HTTP 403)');

    console.log('\n--- 6. Testing Mandatory Comments Validation on Request Changes ---');

    // MEMBER contact requests changes WITHOUT comments -> REJECTED (400)
    const reqNoComments = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: '   ' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString(), permissionLevel: 'MEMBER' }
    };
    const resNoComments = mockResponse();
    await clientDrawingController.requestChanges(reqNoComments, resNoComments);
    assert(resNoComments.statusCode === 400, 'Request changes without comments rejected with HTTP 400 Bad Request');

    console.log('\n--- 7. Testing Successful Request Changes Flow ---');

    const reqRequestChangesValid = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Please adjust column C3 axis by 150mm towards west wall.' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString(), permissionLevel: 'MEMBER' }
    };
    const resRequestChangesValid = mockResponse();
    await clientDrawingController.requestChanges(reqRequestChangesValid, resRequestChangesValid);
    assert(resRequestChangesValid.statusCode === 200 && resRequestChangesValid.body.drawing.status === 'CHANGES_REQUESTED', 'Request changes succeeds and flips status to CHANGES_REQUESTED');

    // Verify audit log entry
    const logChanges = await ClientApprovalLog.findOne({ drawingId: dwgPending._id, action: 'CHANGES_REQUESTED' });
    assert(logChanges && logChanges.comments.includes('adjust column C3 axis'), 'Request changes action logged to ClientApprovalLog with comments');

    console.log('\n--- 8. Testing Successful Approval Flow ---');

    // Reset status to PENDING_CLIENT_APPROVAL (simulating internal revision upload v3)
    await Drawing.findByIdAndUpdate(dwgPending._id, { status: 'PENDING_CLIENT_APPROVAL' });

    const reqApproveValid = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Approved after column adjustment verification.' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString(), permissionLevel: 'OWNER' }
    };
    const resApproveValid = mockResponse();
    await clientDrawingController.approveDrawing(reqApproveValid, resApproveValid);
    assert(resApproveValid.statusCode === 200 && resApproveValid.body.drawing.status === 'APPROVED', 'Approve action succeeds and flips status to APPROVED');

    const logApprove = await ClientApprovalLog.findOne({ drawingId: dwgPending._id, action: 'APPROVED' });
    assert(logApprove && logApprove.contactId.toString() === contactAlphaOwner._id.toString(), 'Approve action logged to ClientApprovalLog with correct contact attribution');

    console.log('\n--- 9. Testing Double-Approval Race Condition Handling ---');

    const reqApproveSecond = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Second approve attempt by member' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString(), permissionLevel: 'MEMBER' }
    };
    const resApproveSecond = mockResponse();
    await clientDrawingController.approveDrawing(reqApproveSecond, resApproveSecond);
    assert(resApproveSecond.statusCode === 409 && resApproveSecond.body.message.includes('already approved by Alpha Owner Contact'), 'Second approval attempt gracefully rejected with HTTP 409 and clear approver attribution');

    console.log('\n--- 10. Testing Lock Enforcement on Already Approved Drawing ---');

    const reqChangesLocked = {
      params: { drawingId: dwgPending._id.toString() },
      body: { comments: 'Late change request' },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString(), permissionLevel: 'OWNER' }
    };
    const resChangesLocked = mockResponse();
    await clientDrawingController.requestChanges(reqChangesLocked, resChangesLocked);
    assert(resChangesLocked.statusCode === 400 && resChangesLocked.body.message.includes('Approved drawings are locked'), 'Requesting changes on an already approved drawing is rejected with HTTP 400 lock message');

    console.log('\n--- 11. Testing Drawing Comments & Draft Note Privacy Isolation ---');

    // 1. Owner posts draft note
    const reqDraftComment = {
      params: { drawingId: dwgPending._id.toString() },
      body: { commentText: 'Owner private draft note regarding budget impact', isDraft: true },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resDraftComment = mockResponse();
    await clientDrawingController.addComment(reqDraftComment, resDraftComment);
    assert(resDraftComment.statusCode === 201 && resDraftComment.body.comment.isDraft === true, 'Draft note added successfully by Owner');

    // 2. Owner posts shared submitted comment with annotation coordinates
    const reqSharedComment = {
      params: { drawingId: dwgPending._id.toString() },
      body: { commentText: 'Shared note on beam joinery', annotationCoords: { x: 120, y: 340, width: 50, height: 50 }, isDraft: false },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resSharedComment = mockResponse();
    await clientDrawingController.addComment(reqSharedComment, resSharedComment);
    assert(resSharedComment.statusCode === 201 && resSharedComment.body.comment.isDraft === false, 'Shared annotation comment added successfully');

    // 3. Owner fetches comments -> sees BOTH draft and shared comment
    const reqGetCommentsOwner = {
      params: { drawingId: dwgPending._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaOwner._id.toString() }
    };
    const resGetCommentsOwner = mockResponse();
    await clientDrawingController.getComments(reqGetCommentsOwner, resGetCommentsOwner);
    assert(resGetCommentsOwner.statusCode === 200 && resGetCommentsOwner.body.comments.length === 2, 'Author contact sees both draft notes and shared comments (count: 2)');

    // 4. Member fetches comments -> sees ONLY shared comment (draft isolated)
    const reqGetCommentsMember = {
      params: { drawingId: dwgPending._id.toString() },
      clientContact: { clientId: clientAlpha._id.toString(), contactId: contactAlphaMember._id.toString() }
    };
    const resGetCommentsMember = mockResponse();
    await clientDrawingController.getComments(reqGetCommentsMember, resGetCommentsMember);
    assert(resGetCommentsMember.statusCode === 200 && resGetCommentsMember.body.comments.length === 1 && !resGetCommentsMember.body.comments[0].isDraft, 'Other contact sees ONLY shared comment; draft note remains private to author');

    console.log('\n--- 12. Testing Internal Team Approval Log View (GET /api/drawings/:drawingId/client-approval-log) ---');

    const reqInternalLog = {
      params: { drawingId: dwgPending._id.toString() }
    };
    const resInternalLog = mockResponse();
    await drawingController.getClientApprovalLog(reqInternalLog, resInternalLog);
    assert(resInternalLog.statusCode === 200 && resInternalLog.body.logs.length === 2, 'Internal team retrieves full client approval history log (2 actions logged)');
    assert(resInternalLog.body.logs[0].contactId.email === 'client.m5.owner@m5.com', 'Internal log correctly populates acting contact profile');

    console.log('\n================================================================================');
    console.log(`🎉 CRM MODULE 5 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during Module 5 test run:', error);
    process.exit(1);
  }
}

runModule5Tests();
