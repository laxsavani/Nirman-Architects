/**
 * Verification Test Suite for CRM Module 9: Client Feedback & Satisfaction
 * 
 * Runs end-to-end functional, trigger, RBAC exception, and analytics validation.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Client = require('../models/Client');
const ClientContact = require('../models/ClientContact');
const Project = require('../models/Project');
const ClientProjectLink = require('../models/ClientProjectLink');
const FeedbackCategory = require('../models/FeedbackCategory');
const ClientFeedback = require('../models/ClientFeedback');
const FeedbackPromptStatus = require('../models/FeedbackPromptStatus');

const feedbackCategoryController = require('../controllers/feedbackCategory.controller');
const clientFeedbackController = require('../controllers/clientFeedback.controller');
const feedbackController = require('../controllers/feedback.controller');

// Mock Express Helpers
function createMockReq(params = {}, body = {}, query = {}, clientContact = null, user = null) {
  return {
    params,
    body,
    query,
    clientContact,
    user
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    responseData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.responseData = data;
      return this;
    }
  };
  return res;
}

async function runVerificationSuite() {
  console.log('====================================================');
  console.log('🚀 Starting CRM Module 9: Client Feedback Test Suite');
  console.log('====================================================');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log('\n--- Setting Up Test Entities ---');

    // RoleMaster
    let adminRole = await RoleMaster.findOne({ roleCode: 'ADMIN' });
    if (!adminRole) {
      adminRole = await RoleMaster.create({
        roleName: 'Admin',
        roleCode: 'ADMIN',
        description: 'System Admin'
      });
    }

    // Admin User
    let testAdmin = await User.findOne({ email: 'admin.feedback.test@nirman.com' });
    if (!testAdmin) {
      testAdmin = await User.create({
        name: 'Feedback Test Admin',
        email: 'admin.feedback.test@nirman.com',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        roleId: adminRole._id,
        phone: '9988776655',
        designation: 'Admin',
        department: 'Management',
        baseSalary: 50000,
        isActive: true
      });
    }

    // Client
    let clientObj = await Client.findOne({ name: 'Client Feedback Corp' });
    if (!clientObj) {
      clientObj = await Client.create({
        name: 'Client Feedback Corp',
        companyName: 'Feedback Enterprise',
        email: 'info@feedbackcorp.com',
        phone: '9777788881',
        isActive: true
      });
    }

    // Client Contact 1 (OWNER)
    let contactOwner = await ClientContact.findOne({ email: 'owner.fb@client.com' });
    if (!contactOwner) {
      contactOwner = await ClientContact.create({
        clientId: clientObj._id,
        name: 'Aarav Sharma (Owner)',
        email: 'owner.fb@client.com',
        phone: '9876543211',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'OWNER',
        isPrimaryContact: true,
        isActive: true
      });
    }

    // Client Contact 2 (VIEW_ONLY)
    let contactViewOnly = await ClientContact.findOne({ email: 'view.fb@client.com' });
    if (!contactViewOnly) {
      contactViewOnly = await ClientContact.create({
        clientId: clientObj._id,
        name: 'Meera Nair (Auditor)',
        email: 'view.fb@client.com',
        phone: '9876543212',
        password: '$2a$10$YourHashedPasswordHereForTesting',
        permissionLevel: 'VIEW_ONLY',
        isActive: true
      });
    }

    // Project
    let projectObj = await Project.findOne({ name: 'Feedback Apex Towers' });
    if (!projectObj) {
      projectObj = await Project.create({
        name: 'Feedback Apex Towers',
        status: 'In Progress',
        projectManager: testAdmin._id
      });
    }

    // Linkage
    await ClientProjectLink.findOneAndUpdate(
      { clientId: clientObj._id, projectId: projectObj._id },
      { isActive: true, visibleToClient: true },
      { upsert: true }
    );

    console.log('Setup completed.');

    // ----------------------------------------------------
    // TEST 1: Admin Master Category Creation
    // ----------------------------------------------------
    console.log('\n--- Test 1: Admin Category Master Management ---');
    const catNames = ['Communication', 'Timeliness', 'Quality'];
    const createdCats = [];

    for (const cName of catNames) {
      const reqCat = createMockReq({}, { name: cName }, {}, null, { id: testAdmin._id.toString() });
      const resCat = createMockRes();
      await feedbackCategoryController.createCategory(reqCat, resCat);
      if (resCat.statusCode === 201) {
        createdCats.push(resCat.responseData.category);
      } else {
        const existingCat = await FeedbackCategory.findOne({ name: cName });
        createdCats.push(existingCat);
      }
    }

    const reqActiveCat = createMockReq();
    const resActiveCat = createMockRes();
    await feedbackCategoryController.getActiveCategories(reqActiveCat, resActiveCat);

    assert(resActiveCat.statusCode === 200, 'GET /active categories returned HTTP 200');
    assert(resActiveCat.responseData.categories.length >= 3, 'Active categories list contains at least 3 categories');

    // ----------------------------------------------------
    // TEST 2: Milestone Trigger on Project Completion
    // ----------------------------------------------------
    console.log('\n--- Test 2: Milestone Trigger (onProjectStatusChangedToCompleted) ---');
    const createdPromptsCount = await feedbackController.onProjectStatusChangedToCompleted(projectObj._id);

    assert(createdPromptsCount === 2, 'Project completion trigger created exactly 2 pending prompts (1 per active contact)');

    const promptOwner = await FeedbackPromptStatus.findOne({ contactId: contactOwner._id, triggerRefId: projectObj._id });
    const promptView = await FeedbackPromptStatus.findOne({ contactId: contactViewOnly._id, triggerRefId: projectObj._id });

    assert(promptOwner && promptOwner.status === 'PENDING', 'Owner contact prompt state is PENDING');
    assert(promptView && promptView.status === 'PENDING', 'ViewOnly contact prompt state is PENDING');

    // ----------------------------------------------------
    // TEST 3: Pending Prompts Isolation
    // ----------------------------------------------------
    console.log('\n--- Test 3: Pending Prompts Endpoint & Ownership Isolation ---');
    const reqPromptsView = createMockReq({}, {}, {}, { contactId: contactViewOnly._id.toString(), clientId: clientObj._id.toString() });
    const resPromptsView = createMockRes();
    await clientFeedbackController.getPendingPrompts(reqPromptsView, resPromptsView);

    assert(resPromptsView.statusCode === 200, 'getPendingPrompts returned HTTP 200');
    assert(resPromptsView.responseData.prompts.length === 1, 'ViewOnly contact sees exactly 1 pending prompt');

    // Cross-contact prompt submission attempt (Owner attempting to submit ViewOnly prompt)
    const reqCross = createMockReq(
      { promptId: promptView._id.toString() },
      { overallRating: 5 },
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString(), permissionLevel: 'OWNER' }
    );
    const resCross = createMockRes();
    await clientFeedbackController.submitFeedback(reqCross, resCross);

    assert(resCross.statusCode === 403, 'Cross-contact prompt submission attempt blocked with HTTP 403');

    // ----------------------------------------------------
    // TEST 4: VIEW_ONLY Permission Level Feedback Submission
    // ----------------------------------------------------
    console.log('\n--- Test 4: VIEW_ONLY Feedback Submission (Explicit Exception) ---');
    const catRatingsData = [
      { categoryId: createdCats[0]._id.toString(), rating: 5 },
      { categoryId: createdCats[2]._id.toString(), rating: 4 }
    ];

    const reqSubmitView = createMockReq(
      { promptId: promptView._id.toString() },
      {
        overallRating: 5,
        categoryRatings: catRatingsData,
        comments: 'Outstanding architectural guidance and timely structural drawing releases.'
      },
      {},
      { contactId: contactViewOnly._id.toString(), clientId: clientObj._id.toString(), permissionLevel: 'VIEW_ONLY' }
    );
    const resSubmitView = createMockRes();
    await clientFeedbackController.submitFeedback(reqSubmitView, resSubmitView);

    assert(resSubmitView.statusCode === 201, 'VIEW_ONLY contact feedback submission succeeded with HTTP 201');
    const feedbackDoc = resSubmitView.responseData.feedback;
    assert(feedbackDoc.overallRating === 5, 'overallRating stored as 5');
    assert(feedbackDoc.categoryRatings.length === 2, 'categoryRatings array populated with 2 category entries');

    const updatedPromptView = await FeedbackPromptStatus.findById(promptView._id);
    assert(updatedPromptView.status === 'SUBMITTED', 'Prompt status updated to SUBMITTED');

    // Verify getPendingPrompts now returns 0 for ViewOnly contact
    const resPromptsViewAfter = createMockRes();
    await clientFeedbackController.getPendingPrompts(reqPromptsView, resPromptsViewAfter);
    assert(resPromptsViewAfter.responseData.prompts.length === 0, 'Pending prompts count is now 0 after submission');

    // ----------------------------------------------------
    // TEST 5: Skip Prompt Workflow
    // ----------------------------------------------------
    console.log('\n--- Test 5: Skip Prompt Workflow ---');
    const reqSkip = createMockReq(
      { promptId: promptOwner._id.toString() },
      {},
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString(), permissionLevel: 'OWNER' }
    );
    const resSkip = createMockRes();
    await clientFeedbackController.skipPrompt(reqSkip, resSkip);

    assert(resSkip.statusCode === 200, 'Skip prompt request returned HTTP 200');
    const updatedPromptOwner = await FeedbackPromptStatus.findById(promptOwner._id);
    assert(updatedPromptOwner.status === 'SKIPPED', 'Prompt status updated to SKIPPED');

    const ownerFeedbacks = await ClientFeedback.find({ contactId: contactOwner._id });
    assert(ownerFeedbacks.length === 0, 'Skipping prompt did not create any ClientFeedback document');

    // ----------------------------------------------------
    // TEST 6: History & Shared Project Feedback View
    // ----------------------------------------------------
    console.log('\n--- Test 6: Personal History & Shared Project View ---');
    const reqMy = createMockReq({}, {}, {}, { contactId: contactViewOnly._id.toString(), clientId: clientObj._id.toString() });
    const resMy = createMockRes();
    await clientFeedbackController.getMyFeedbackHistory(reqMy, resMy);

    assert(resMy.responseData.feedbacks.length === 1, 'ViewOnly contact history returns 1 submission');

    const reqProjectFb = createMockReq(
      { projectId: projectObj._id.toString() },
      {},
      {},
      { contactId: contactOwner._id.toString(), clientId: clientObj._id.toString() }
    );
    const resProjectFb = createMockRes();
    await clientFeedbackController.getProjectClientFeedback(reqProjectFb, resProjectFb);

    assert(resProjectFb.statusCode === 200, 'getProjectClientFeedback returned HTTP 200');
    assert(resProjectFb.responseData.feedbacks.length === 1, 'Owner contact can see feedback submitted for project under shared client account');
    assert(resProjectFb.responseData.feedbacks[0].formattedAuthorName.includes('VIEW_ONLY'), 'Formatted author name includes role designation');

    // ----------------------------------------------------
    // TEST 7: Internal Team Feedback Analytics & Summary
    // ----------------------------------------------------
    console.log('\n--- Test 7: Internal Team Analytics & Aggregation ---');
    const reqAll = createMockReq({}, {}, { projectId: projectObj._id.toString() }, null, { id: testAdmin._id.toString() });
    const resAll = createMockRes();
    await feedbackController.getAllFeedback(reqAll, resAll);

    assert(resAll.statusCode === 200, 'getAllFeedback returned HTTP 200');
    assert(resAll.responseData.feedbacks.length === 1, 'Internal team view lists submitted feedback');

    const reqSummary = createMockReq({}, {}, { projectId: projectObj._id.toString() }, null, { id: testAdmin._id.toString() });
    const resSummary = createMockRes();
    await feedbackController.getAggregateSummary(reqSummary, resSummary);

    assert(resSummary.statusCode === 200, 'getAggregateSummary returned HTTP 200');
    assert(resSummary.responseData.totalSubmissions === 1, 'totalSubmissions is 1');
    assert(resSummary.responseData.averageOverallRating === 5, 'averageOverallRating is 5');
    assert(resSummary.responseData.categoryAverages.length === 2, 'categoryAverages array contains 2 evaluated categories');

    // ----------------------------------------------------
    // TEST 8: Dynamic Category Lifecycle & Historical Integrity
    // ----------------------------------------------------
    console.log('\n--- Test 8: Dynamic Category Lifecycle & Historical Integrity ---');
    // Deactivate Communication category
    const reqDeact = createMockReq(
      { id: createdCats[0]._id.toString() },
      { isActive: false },
      {},
      null,
      { id: testAdmin._id.toString() }
    );
    const resDeact = createMockRes();
    await feedbackCategoryController.toggleCategoryActive(reqDeact, resDeact);

    assert(resDeact.statusCode === 200, 'Category deactivated successfully');

    // Create new category "Value for Money"
    const reqNewCat = createMockReq({}, { name: 'Value for Money' }, {}, null, { id: testAdmin._id.toString() });
    const resNewCat = createMockRes();
    await feedbackCategoryController.createCategory(reqNewCat, resNewCat);

    assert(resNewCat.statusCode === 201, 'New category "Value for Money" created');

    const resActiveCatAfter = createMockRes();
    await feedbackCategoryController.getActiveCategories(createMockReq(), resActiveCatAfter);

    const activeCatNames = resActiveCatAfter.responseData.categories.map(c => c.name);
    assert(!activeCatNames.includes('Communication'), 'Deactivated category "Communication" excluded from active list');
    assert(activeCatNames.includes('Value for Money'), 'New category "Value for Money" included in active list');

    // Verify historical feedback summary calculation handles deactivated category gracefully
    const resSummaryAfter = createMockRes();
    await feedbackController.getAggregateSummary(reqSummary, resSummaryAfter);

    assert(resSummaryAfter.responseData.totalSubmissions === 1, 'Historical summary calculation completes without error');
    assert(resSummaryAfter.responseData.categoryAverages.some(c => c.categoryName === 'Communication'), 'Historical category ratings for deactivated category remain intact in summary');

    console.log('\n====================================================');
    console.log(`📊 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('CRITICAL ERROR in feedback test suite:', err);
    process.exit(1);
  }
}

runVerificationSuite();
