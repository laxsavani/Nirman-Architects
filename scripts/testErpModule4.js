require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const DrawingCategory = require('../models/DrawingCategory');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const DrawingComment = require('../models/DrawingComment');
const DrawingMarking = require('../models/DrawingMarking');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const ClientProjectLink = require('../models/ClientProjectLink');

const drawingController = require('../controllers/drawing.controller');
const drawingReviewController = require('../controllers/drawingReview.controller');
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

async function runErpModule4Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 4: JPEG/3D DRAWING REVIEW — TEST SUITE');
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
      'erp4.admin@erp.com',
      'erp4.arch@erp.com',
      'erp4.emp@erp.com',
      'erp4.client@client.com'
    ];

    await DrawingMarking.deleteMany({});
    await DrawingComment.deleteMany({});
    await DrawingVersion.deleteMany({});
    await Drawing.deleteMany({ drawingName: { $regex: /ERP Module 4/i } });
    await DrawingCategory.deleteMany({ name: 'ERP4 3D Render' });
    await ClientProjectLink.deleteMany({});
    await ClientContact.deleteMany({ email: 'erp4.client@client.com' });
    await Client.deleteMany({ companyName: 'ERP4 Villa Client' });
    await Project.deleteMany({ projectName: { $regex: /ERP Module 4/i } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Roles
    let roleAdmin = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!roleAdmin) roleAdmin = await RoleMaster.create({ roleName: 'Admin', roleCode: 'ADMIN', isActive: true });

    let roleArch = await RoleMaster.findOne({ roleCode: 'ARCHITECT' });
    if (!roleArch) roleArch = await RoleMaster.create({ roleName: 'Architect', roleCode: 'ARCHITECT', isActive: true });

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });

    // 2. Users
    const userAdmin = await User.create({
      name: 'Rohan Sharma',
      email: 'erp4.admin@erp.com',
      password: await hashPassword('Admin@123'),
      roleId: roleAdmin._id,
      designation: 'Studio Admin',
      isActive: true
    });

    const userArch = await User.create({
      name: 'Pooja Varma',
      email: 'erp4.arch@erp.com',
      password: await hashPassword('ArchPass@123'),
      roleId: roleArch._id,
      designation: '3D Designer',
      isActive: true
    });

    const userEmp = await User.create({
      name: 'Karan Shah',
      email: 'erp4.emp@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Site Assistant',
      isActive: true
    });

    // 3. Client & Contact
    const client = await Client.create({ name: 'ERP4 Villa Client', companyName: 'ERP4 Villa Client', phone: '+919876543211' });
    const contactClient = await ClientContact.create({
      clientId: client._id,
      name: 'Deepak Patel',
      email: 'erp4.client@client.com',
      password: await hashPassword('ClientPass@123'),
      permissionLevel: 'OWNER'
    });

    // 4. Project
    const project = await Project.create({
      projectName: 'ERP Module 4 - Luxury 3D Villa Project',
      status: 'In Progress',
      createdBy: userAdmin._id,
      teamAssignments: [{ userId: userArch._id, projectRole: '3D Designer' }]
    });

    await ClientProjectLink.create({
      clientId: client._id,
      projectId: project._id,
      linkedBy: userAdmin._id,
      visibleToClient: true,
      isActive: true
    });

    // 5. Category & Drawing & Version 1
    const category = await DrawingCategory.create({ name: 'ERP4 3D Render', requiresClientApproval: true });

    const reqDwg = {
      body: {
        projectId: project._id.toString(),
        drawingName: 'ERP Module 4 - Living Room 3D Perspective Render',
        categoryId: category._id.toString()
      },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resDwg = mockResponse();
    await drawingController.createDrawing(reqDwg, resDwg);
    const drawingId = resDwg.body.drawing._id;

    // Upload Render Version 1 (JPEG format)
    const reqV1 = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/renders/living_v1.jpg', fileType: 'JPEG', changeLog: 'First 3D render draft' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resV1 = mockResponse();
    await drawingController.uploadVersion(reqV1, resV1);
    const v1Id = resV1.body.version._id;

    console.log('--- 1. Testing Comments vs Pinned Notes Distinction ---');

    // General Comment (no annotationCoords)
    const reqCommentGeneral = {
      params: { versionId: v1Id.toString() },
      body: { commentText: 'Overall 3D lighting setup looks natural.' },
      user: { _id: userArch._id }
    };
    const resCommentGeneral = mockResponse();
    await drawingReviewController.postCommentOrNote(reqCommentGeneral, resCommentGeneral);
    assert(resCommentGeneral.statusCode === 201 && resCommentGeneral.body.comment.annotationCoords === null, 'General Comment posted with null annotationCoords');

    // Pinned Note (with annotationCoords)
    const reqNotePinned = {
      params: { versionId: v1Id.toString() },
      body: {
        commentText: 'Verify railing height against safety building codes.',
        annotationCoords: { x: 450, y: 320 }
      },
      user: { _id: userArch._id }
    };
    const resNotePinned = mockResponse();
    await drawingReviewController.postCommentOrNote(reqNotePinned, resNotePinned);
    assert(resNotePinned.statusCode === 201 && resNotePinned.body.comment.annotationCoords.x === 450, 'Pinned Note created with image coordinates {x: 450, y: 320}');
    const noteId = resNotePinned.body.comment._id;

    console.log('\n--- 2. Testing Freehand & Shape Marking Tools ---');

    // Freehand Marking
    const reqFreehand = {
      params: { versionId: v1Id.toString() },
      body: {
        markingType: 'FREEHAND',
        geometry: { points: [{ x: 100, y: 150 }, { x: 120, y: 180 }, { x: 140, y: 200 }] },
        color: '#00FF00'
      },
      user: { _id: userArch._id }
    };
    const resFreehand = mockResponse();
    await drawingReviewController.postMarking(reqFreehand, resFreehand);
    assert(resFreehand.statusCode === 201 && resFreehand.body.marking.markingType === 'FREEHAND', 'FREEHAND marking created with multi-point geometry');

    // Highlight Area Marking linked to Note
    const reqHighlight = {
      params: { versionId: v1Id.toString() },
      body: {
        markingType: 'HIGHLIGHT_AREA',
        geometry: { x: 400, y: 300, width: 120, height: 80 },
        color: '#FFFF00',
        linkedCommentId: noteId.toString()
      },
      user: { _id: userArch._id }
    };
    const resHighlight = mockResponse();
    await drawingReviewController.postMarking(reqHighlight, resHighlight);
    assert(resHighlight.statusCode === 201 && resHighlight.body.marking.markingType === 'HIGHLIGHT_AREA' && resHighlight.body.marking.linkedCommentId._id.toString() === noteId.toString(), 'HIGHLIGHT_AREA marking created linked to Pinned Note');

    // Rectangle & Circle Markings
    const reqRect = {
      params: { versionId: v1Id.toString() },
      body: {
        markingType: 'RECTANGLE',
        geometry: { x: 50, y: 50, width: 200, height: 150 },
        color: '#FF0000'
      },
      user: { _id: userArch._id }
    };
    const resRect = mockResponse();
    await drawingReviewController.postMarking(reqRect, resRect);
    assert(resRect.statusCode === 201 && resRect.body.marking.markingType === 'RECTANGLE', 'RECTANGLE shape marking created');
    const rectMarkingId = resRect.body.marking._id;

    console.log('\n--- 3. Testing Aggregated Review Data Payload for Viewer ---');

    const reqReviewData = {
      params: { versionId: v1Id.toString() },
      user: { _id: userArch._id }
    };
    const resReviewData = mockResponse();
    await drawingReviewController.getAggregatedReviewData(reqReviewData, resReviewData);
    assert(resReviewData.statusCode === 200 && resReviewData.body.comments.length === 2 && resReviewData.body.markings.length === 3, 'GET /review-data returns aggregated payload with drawingVersion, comments (2), and markings (3)');

    console.log('\n--- 4. Testing Version Isolation (Canvas Reset on New Version) ---');

    // Upload Render Version 2
    const reqV2 = {
      params: { drawingId: drawingId.toString() },
      body: { filePath: '/uploads/renders/living_v2.jpg', fileType: 'JPEG', changeLog: 'Revised 3D lighting and railing height' },
      user: { _id: userArch._id, roleId: roleArch }
    };
    const resV2 = mockResponse();
    await drawingController.uploadVersion(reqV2, resV2);
    const v2Id = resV2.body.version._id;

    // Check version 2 markings -> SHOULD BE 0 (Clean Canvas)
    const reqV2Data = { params: { versionId: v2Id.toString() }, user: { _id: userArch._id } };
    const resV2Data = mockResponse();
    await drawingReviewController.getAggregatedReviewData(reqV2Data, resV2Data);
    assert(resV2Data.statusCode === 200 && resV2Data.body.markings.length === 0, 'Version v2 initializes with clean canvas (0 markings), preserving v1 annotations independently');

    console.log('\n--- 5. Testing Marking Deletion Authorization ---');

    // Employee attempts to delete Architect's rectangle marking -> REJECTED (403)
    const reqDelEmp = {
      params: { versionId: v1Id.toString(), markingId: rectMarkingId.toString() },
      user: { _id: userEmp._id, roleId: roleEmp }
    };
    const resDelEmp = mockResponse();
    await drawingReviewController.deleteMarking(reqDelEmp, resDelEmp);
    assert(resDelEmp.statusCode === 403, 'Non-author employee blocked from deleting another user marking (HTTP 403 Access Denied)');

    // Admin overrides deletion -> SUCCEEDS
    const reqDelAdmin = {
      params: { versionId: v1Id.toString(), markingId: rectMarkingId.toString() },
      user: { _id: userAdmin._id, roleId: roleAdmin }
    };
    const resDelAdmin = mockResponse();
    await drawingReviewController.deleteMarking(reqDelAdmin, resDelAdmin);
    assert(resDelAdmin.statusCode === 200, 'Admin override successfully deletes marking annotation');

    console.log('\n--- 6. Testing End-to-End Collaborative Review (Internal + Client) ---');

    // Advance v2 through PM and Admin Review to PENDING_CLIENT_APPROVAL (visibleToClient: true)
    await drawingController.pmReview(
      { params: { versionId: v2Id.toString() }, body: { decision: 'APPROVE', comments: 'Ready for client' }, user: { _id: userAdmin._id, roleId: roleAdmin } },
      mockResponse()
    );
    await drawingController.adminReview(
      { params: { versionId: v2Id.toString() }, body: { decision: 'APPROVE', comments: 'Approved for client handoff' }, user: { _id: userAdmin._id, roleId: roleAdmin } },
      mockResponse()
    );

    // Client posts an annotation/comment via CRM Module 5 client endpoint
    const reqClientComment = {
      params: { drawingId: drawingId.toString() },
      body: { commentText: 'The sofa fabric color in the 3D render looks great!', annotationCoords: { x: 550, y: 400 } },
      clientContact: { contactId: contactClient._id.toString(), clientId: client._id.toString(), permissionLevel: 'OWNER' }
    };
    const resClientComment = mockResponse();
    await clientDrawingController.addComment(reqClientComment, resClientComment);
    assert(resClientComment.statusCode === 201, 'Client posts pinned Note via CRM Module 5 client endpoint');

    // Internal team queries version 2 comments -> Sees Client Note!
    const reqGetSharedComments = { params: { versionId: v2Id.toString() }, user: { _id: userArch._id } };
    const resGetSharedComments = mockResponse();
    await drawingReviewController.getVersionComments(reqGetSharedComments, resGetSharedComments);
    assert(resGetSharedComments.statusCode === 200 && resGetSharedComments.body.comments.length >= 1, 'Internal team sees client-authored pinned Note in shared review layer (Collaborative Review verified)');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 4 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 4 test run:', error);
    process.exit(1);
  }
}

runErpModule4Tests();
