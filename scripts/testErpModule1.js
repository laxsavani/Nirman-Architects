require('../utils/logger');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Project = require('../models/Project');
const ProjectCategory = require('../models/ProjectCategory');
const ProjectStatusHistory = require('../models/ProjectStatusHistory');
const Department = require('../models/Department');

const projectController = require('../controllers/project.controller');
const projectCategoryController = require('../controllers/projectCategory.controller');
const departmentController = require('../controllers/department.controller');
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

async function runErpModule1Tests() {
  console.log('================================================================================');
  console.log('🚀 ERP MODULE 1: PROJECT MANAGEMENT — TEST SUITE');
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
      'erp.pm.m1@erp.com',
      'erp.arch.m1@erp.com',
      'erp.other.m1@erp.com'
    ];

    await ProjectStatusHistory.deleteMany({});
    await Project.deleteMany({ projectName: { $regex: /ERP Module 1/i } });
    await ProjectCategory.deleteMany({ name: { $in: ['Residential Villa', 'Commercial Complex'] } });
    await Department.deleteMany({ name: { $in: ['Architectural Design', 'Site Engineering'] } });
    await User.deleteMany({ email: { $in: testEmails } });

    // 1. Create Roles
    let rolePM = await RoleMaster.findOne({ roleCode: 'PROJECT_MANAGER' });
    if (!rolePM) {
      rolePM = await RoleMaster.create({ roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', isActive: true });
    }

    let roleArch = await RoleMaster.findOne({ roleCode: 'ARCHITECT' });
    if (!roleArch) {
      roleArch = await RoleMaster.create({ roleName: 'Architect', roleCode: 'ARCHITECT', isActive: true });
    }

    let roleEmp = await RoleMaster.findOne({ roleCode: 'EMPLOYEE' });
    if (!roleEmp) {
      roleEmp = await RoleMaster.create({ roleName: 'Employee', roleCode: 'EMPLOYEE', isActive: true });
    }

    // 2. Create Users
    const userPM = await User.create({
      name: 'Vikram Mehta',
      email: 'erp.pm.m1@erp.com',
      password: await hashPassword('PmPass@123'),
      roleId: rolePM._id,
      designation: 'Senior Project Manager',
      isActive: true
    });

    const userArch = await User.create({
      name: 'Ananya Roy',
      email: 'erp.arch.m1@erp.com',
      password: await hashPassword('ArchPass@123'),
      roleId: roleArch._id,
      designation: 'Lead Architect',
      isActive: true
    });

    const userOther = await User.create({
      name: 'Karan Patel',
      email: 'erp.other.m1@erp.com',
      password: await hashPassword('EmpPass@123'),
      roleId: roleEmp._id,
      designation: 'Junior Draftsman',
      isActive: true
    });

    console.log('--- 1. Testing Dynamic Masters (ProjectCategory & Department) ---');

    // Create Category
    const reqCat = { body: { name: 'Residential Villa' }, user: { _id: userPM._id } };
    const resCat = mockResponse();
    await projectCategoryController.createCategory(reqCat, resCat);
    assert(resCat.statusCode === 201 && resCat.body.category.name === 'Residential Villa', 'Dynamic ProjectCategory created successfully');
    const categoryId = resCat.body.category._id;

    // Create Department
    const reqDept = { body: { name: 'Architectural Design' } };
    const resDept = mockResponse();
    await departmentController.createDepartment(reqDept, resDept);
    assert(resDept.statusCode === 201 && resDept.body.department.name === 'Architectural Design', 'Dynamic Department created successfully');
    const departmentId = resDept.body.department._id;

    console.log('\n--- 2. Testing Project Creation & Default State ---');

    const reqCreateProj = {
      body: {
        projectName: 'ERP Module 1 - Horizon Bungalow',
        clientInformation: 'Patel Family (Reference)',
        address: 'Plot 42, Green Park, Ahmedabad',
        budget: 7500000,
        priority: 'High',
        projectCategoryId: categoryId.toString(),
        startDate: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 86400000 * 60).toISOString()
      },
      user: { _id: userPM._id }
    };
    const resCreateProj = mockResponse();
    await projectController.createProject(reqCreateProj, resCreateProj);
    assert(resCreateProj.statusCode === 201 && resCreateProj.body.project.projectName === 'ERP Module 1 - Horizon Bungalow', 'Project created successfully with initial status "New"');
    assert(resCreateProj.body.project.status === 'New', 'Initial status defaults to "New"');
    assert(resCreateProj.body.project.isDelayed === false, 'New project with future completion date is not delayed (isDelayed: false)');

    const projectId = resCreateProj.body.project._id;

    console.log('\n--- 3. Testing Status Transitions & Audit Logging ---');

    // Status change: New -> Planning
    const reqStatus1 = {
      params: { id: projectId.toString() },
      body: { newStatus: 'Planning', notes: 'Commencing initial architectural conceptual design phase.' },
      user: { _id: userPM._id }
    };
    const resStatus1 = mockResponse();
    await projectController.updateStatus(reqStatus1, resStatus1);
    assert(resStatus1.statusCode === 200 && resStatus1.body.toStatus === 'Planning', 'Project status transitioned from New -> Planning');

    // Fetch status history
    const reqHist = { params: { id: projectId.toString() } };
    const resHist = mockResponse();
    await projectController.getStatusHistory(reqHist, resHist);
    assert(resHist.statusCode === 200 && resHist.body.history.length === 2, 'Status transition history audit log contains 2 entries (Creation + Transition)');
    assert(resHist.body.history[0].toStatus === 'Planning' && resHist.body.history[0].fromStatus === 'New', 'Status audit entry correctly records fromStatus "New" to "Planning"');

    console.log('\n--- 4. Testing Milestones & Progress Auto-Calculation ---');

    // Add 2 Milestones
    const reqM1 = {
      params: { id: projectId.toString() },
      body: { name: 'Concept Drawings Approval', targetDate: new Date(Date.now() + 86400000 * 15).toISOString() }
    };
    const resM1 = mockResponse();
    await projectController.addMilestone(reqM1, resM1);

    const reqM2 = {
      params: { id: projectId.toString() },
      body: { name: 'Structural 3D Submission', targetDate: new Date(Date.now() + 86400000 * 30).toISOString() }
    };
    const resM2 = mockResponse();
    await projectController.addMilestone(reqM2, resM2);

    assert(resM2.statusCode === 201 && resM2.body.milestones.length === 2, 'Two project milestones added successfully');

    const m1Id = resM2.body.milestones[0]._id;

    // Complete first milestone -> auto-calculate progress (1 out of 2 = 50%)
    const reqCompleteM1 = { params: { id: projectId.toString(), milestoneId: m1Id.toString() } };
    const resCompleteM1 = mockResponse();
    await projectController.completeMilestone(reqCompleteM1, resCompleteM1);
    assert(resCompleteM1.statusCode === 200 && resCompleteM1.body.progressPercentage === 50, 'Completing 1 of 2 milestones auto-calculates progressPercentage to 50%');

    // Test Manual Progress Override
    const reqOverride = {
      params: { id: projectId.toString() },
      body: { progressPercentage: 65, isManualOverride: true }
    };
    const resOverride = mockResponse();
    await projectController.updateProgress(reqOverride, resOverride);
    assert(resOverride.statusCode === 200 && resOverride.body.progressPercentage === 65 && resOverride.body.progressIsManualOverride === true, 'PM manual progress override sets percentage to 65% with progressIsManualOverride: true');

    console.log('\n--- 5. Testing Delay Detection Logic ---');

    // Set estimatedCompletion date to the past
    const reqUpdatePast = {
      params: { id: projectId.toString() },
      body: { estimatedCompletion: new Date(Date.now() - 86400000 * 10).toISOString() }
    };
    const resUpdatePast = mockResponse();
    await projectController.updateProject(reqUpdatePast, resUpdatePast);
    assert(resUpdatePast.statusCode === 200 && resUpdatePast.body.project.isDelayed === true, 'Past estimatedCompletion date automatically triggers isDelayed: true');

    console.log('\n--- 6. Testing Team Assignment & Role Scoped Access ---');

    // Assign Architect to project team
    const reqAssign = {
      params: { id: projectId.toString() },
      body: { userId: userArch._id.toString(), projectRole: 'Lead Architectural Designer', departmentId: departmentId.toString() }
    };
    const resAssign = mockResponse();
    await projectController.assignTeamMember(reqAssign, resAssign);
    assert(resAssign.statusCode === 200 && resAssign.body.team.length === 1, 'Architect assigned to project team with custom projectRole');

    // Architect fetches projects list -> SHOULD include Horizon Bungalow
    const reqListArch = { query: {}, user: { _id: userArch._id, roleId: roleArch } };
    const resListArch = mockResponse();
    await projectController.getProjects(reqListArch, resListArch);
    assert(resListArch.statusCode === 200 && resListArch.body.projects.length === 1, 'Assigned Architect retrieves project in role-scoped project list');

    // Unassigned Employee fetches projects list -> SHOULD return empty array
    const reqListOther = { query: {}, user: { _id: userOther._id, roleId: roleEmp } };
    const resListOther = mockResponse();
    await projectController.getProjects(reqListOther, resListOther);
    assert(resListOther.statusCode === 200 && resListOther.body.projects.length === 0, 'Unassigned employee role-scoped query excludes unassigned project');

    // Unassigned Employee attempts getProjectById -> REJECTED (403 Access Denied)
    const reqGetOther = { params: { id: projectId.toString() }, user: { _id: userOther._id, roleId: roleEmp } };
    const resGetOther = mockResponse();
    await projectController.getProjectById(reqGetOther, resGetOther);
    assert(resGetOther.statusCode === 403, 'Unassigned employee access attempt to project details blocked (HTTP 403 Access Denied)');

    console.log('\n--- 7. Testing Responsibility Matrix ---');

    const reqMatrix = {
      params: { id: projectId.toString() },
      body: {
        area: 'Structural & Elevation Design',
        responsible: userArch._id.toString(),
        accountable: userPM._id.toString()
      }
    };
    const resMatrix = mockResponse();
    await projectController.addResponsibilityMatrix(reqMatrix, resMatrix);
    assert(resMatrix.statusCode === 201 && resMatrix.body.matrix.length === 1, 'Responsibility Matrix entry added with populated user references');

    console.log('\n--- 8. Testing Progress Breakdown Placeholder ---');

    const reqBreakdown = { params: { id: projectId.toString() } };
    const resBreakdown = mockResponse();
    await projectController.getProgressBreakdown(reqBreakdown, resBreakdown);
    assert(resBreakdown.statusCode === 200 && resBreakdown.body.overallProgress === 65, 'Progress breakdown returns current overall progress (65%)');
    assert(resBreakdown.body.taskWise !== null && resBreakdown.body.drawingWise === null, 'Progress breakdown populated with Module 2 taskWise data while preserving drawingWise placeholder');

    console.log('\n================================================================================');
    console.log(`🎉 ERP MODULE 1 TEST SUMMARY: ${passedCount} / ${totalTests} TESTS PASSED!`);
    console.log('================================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error during ERP Module 1 test run:', error);
    process.exit(1);
  }
}

runErpModule1Tests();
