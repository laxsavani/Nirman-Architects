const Project = require('../models/Project');
const Task = require('../models/Task');
const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const ProjectHealthConfig = require('../models/ProjectHealthConfig');

/**
 * Get active health scoring configuration
 */
async function getHealthConfig() {
  let config = await ProjectHealthConfig.findOne();
  if (!config) {
    config = await ProjectHealthConfig.create({
      timelineWeight: 30,
      drawingVelocityWeight: 25,
      productivityWeight: 25,
      clientEngagementWeight: 20
    });
  }
  return config;
}

/**
 * Calculate Project Health Score for a single project
 */
async function calculateProjectHealth(projectId, customConfig = null) {
  const project = await Project.findById(projectId);
  if (!project) {
    return {
      score: 0,
      status: 'CRITICAL',
      factors: { timelineScore: 0, drawingVelocityScore: 0, productivityScore: 0, clientEngagementScore: 0 }
    };
  }

  const config = customConfig || await getHealthConfig();

  // 1. Timeline Adherence Score (0 - 100)
  let timelineScore = 100;
  if (project.isDelayed || project.status === 'Delayed') {
    timelineScore -= 30;
  }
  const tasks = await Task.find({ projectId, isActive: true });
  const totalTasks = tasks.length;
  if (totalTasks > 0) {
    const overdueTasks = tasks.filter(t => t.isDelayed || (t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed'));
    const overdueRatio = overdueTasks.length / totalTasks;
    timelineScore = Math.max(0, Math.round(timelineScore - (overdueRatio * 50)));
  }

  // 2. Drawing Velocity Score (0 - 100)
  let drawingVelocityScore = 100;
  const versions = await DrawingVersion.find({ projectId });
  if (versions.length > 0) {
    const approvedVersions = versions.filter(v => ['PM_APPROVED', 'ADMIN_APPROVED', 'APPROVED_BY_CLIENT', 'GFC_RELEASED'].includes(v.status));
    drawingVelocityScore = Math.round((approvedVersions.length / versions.length) * 100);
  }

  // 3. Team Productivity Score (0 - 100)
  let productivityScore = 80;
  const completedTasks = tasks.filter(t => t.status === 'Completed' && t.productivityScore !== null && t.productivityScore !== undefined);
  if (completedTasks.length > 0) {
    const sum = completedTasks.reduce((acc, val) => acc + val.productivityScore, 0);
    productivityScore = Math.round(sum / completedTasks.length);
  }

  // 4. Client Engagement Score (0 - 100)
  let clientEngagementScore = 90;
  if (project.clientId) {
    const clientApproved = versions.filter(v => v.status === 'APPROVED_BY_CLIENT');
    if (versions.length > 0) {
      clientEngagementScore = Math.round((clientApproved.length / versions.length) * 100);
    }
  }

  // Calculate Weighted Composite Score
  const totalWeight = config.timelineWeight + config.drawingVelocityWeight + config.productivityWeight + config.clientEngagementWeight;
  const weightedSum = (timelineScore * config.timelineWeight) +
                      (drawingVelocityScore * config.drawingVelocityWeight) +
                      (productivityScore * config.productivityWeight) +
                      (clientEngagementScore * config.clientEngagementWeight);

  const finalScore = Math.min(100, Math.max(0, Math.round(weightedSum / (totalWeight || 100))));

  let status = 'GOOD';
  if (finalScore >= 85) status = 'EXCELLENT';
  else if (finalScore >= 70) status = 'GOOD';
  else if (finalScore >= 50) status = 'AT_RISK';
  else status = 'CRITICAL';

  return {
    projectId: project._id,
    projectName: project.projectName || project.name,
    score: finalScore,
    status,
    factors: {
      timelineScore,
      drawingVelocityScore,
      productivityScore,
      clientEngagementScore
    },
    weights: {
      timelineWeight: config.timelineWeight,
      drawingVelocityWeight: config.drawingVelocityWeight,
      productivityWeight: config.productivityWeight,
      clientEngagementWeight: config.clientEngagementWeight
    }
  };
}

/**
 * Calculate Company Average Health Score across all active projects
 */
async function calculateCompanyAverageHealth() {
  const activeProjects = await Project.find({
    isActive: true,
    status: { $ne: 'Completed' }
  });

  if (activeProjects.length === 0) {
    return {
      averageScore: 100,
      overallStatus: 'EXCELLENT',
      projectCount: 0,
      breakdown: { EXCELLENT: 0, GOOD: 0, AT_RISK: 0, CRITICAL: 0 },
      projects: []
    };
  }

  const healthList = [];
  let sumScore = 0;
  const breakdown = { EXCELLENT: 0, GOOD: 0, AT_RISK: 0, CRITICAL: 0 };

  for (const proj of activeProjects) {
    const health = await calculateProjectHealth(proj._id);
    healthList.push(health);
    sumScore += health.score;
    if (breakdown[health.status] !== undefined) {
      breakdown[health.status]++;
    }
  }

  const averageScore = Math.round(sumScore / activeProjects.length);

  let overallStatus = 'GOOD';
  if (averageScore >= 85) overallStatus = 'EXCELLENT';
  else if (averageScore >= 70) overallStatus = 'GOOD';
  else if (averageScore >= 50) overallStatus = 'AT_RISK';
  else overallStatus = 'CRITICAL';

  return {
    averageScore,
    overallStatus,
    projectCount: activeProjects.length,
    breakdown,
    projects: healthList
  };
}

module.exports = {
  getHealthConfig,
  calculateProjectHealth,
  calculateCompanyAverageHealth
};
