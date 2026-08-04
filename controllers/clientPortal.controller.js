const ClientProjectLink = require('../models/ClientProjectLink');
const Project = require('../models/Project');
const ClientContact = require('../models/ClientContact');
const ClientPortalSession = require('../models/ClientPortalSession');
const SiteLocation = require('../models/SiteLocation');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Aggregated Dashboard View for Client Portal (Web & Mobile)
 * GET /api/client/dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const clientId = req.clientContact.clientId;

    // Fetch active visible links for this client
    const activeLinks = await ClientProjectLink.find({
      clientId,
      isActive: true,
      visibleToClient: true
    }).populate('projectId');

    const activeProjects = [];
    const pastProjects = [];

    for (const link of activeLinks) {
      if (!link.projectId) continue;

      const project = link.projectId;
      const pObj = typeof project.toObject === 'function' ? project.toObject() : project;

      // Find next milestone (first incomplete milestone by dueDate)
      let nextMilestone = null;
      if (Array.isArray(pObj.milestones) && pObj.milestones.length > 0) {
        const incomplete = pObj.milestones
          .filter(m => !m.isCompleted)
          .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
        if (incomplete.length > 0) {
          nextMilestone = {
            title: incomplete[0].title,
            dueDate: incomplete[0].dueDate
          };
        }
      }

      const projectSummary = {
        projectId: pObj._id,
        linkId: link._id,
        name: pObj.name,
        status: pObj.status || 'In Progress',
        progressPercent: pObj.progressPercent || 0,
        thumbnailUrl: pObj.thumbnailUrl || null,
        startDate: pObj.startDate || null,
        estimatedCompletion: pObj.estimatedCompletion || null,
        actualCompletion: pObj.actualCompletion || null,
        nextMilestone,
        linkedAt: link.linkedAt
      };

      if (['Completed', 'Archived'].includes(pObj.status)) {
        pastProjects.push(projectSummary);
      } else {
        activeProjects.push(projectSummary);
      }
    }

    return sendSuccess(res, 200, 'Client dashboard retrieved successfully.', {
      activeProjects,
      pastProjects,
      totalProjectsCount: activeProjects.length + pastProjects.length,
      contactPermissionLevel: req.clientContact.permissionLevel
    });
  } catch (error) {
    console.error('Error fetching client dashboard:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve dashboard.');
  }
};

/**
 * Helper to verify Client-Project linkage security guard
 */
async function verifyLinkage(clientId, projectId) {
  const link = await ClientProjectLink.findOne({
    clientId,
    projectId,
    isActive: true,
    visibleToClient: true
  });
  return link;
}

/**
 * Project Detail View (with Security Isolation Check)
 * GET /api/client/projects/:projectId
 */
exports.getProjectDetail = async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.clientContact.clientId;

    // Security Isolation: Verify project is genuinely linked & visible to this Client
    const link = await ClientProjectLink.findOne({
      clientId,
      projectId,
      isActive: true,
      visibleToClient: true
    });

    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const project = await Project.findById(projectId)
      .populate('projectManager', 'name email designation phone')
      .populate('siteLocation');

    if (!project) {
      return sendError(res, 404, 'Project details not found.');
    }

    const pObj = project.toObject();
    pObj.linkedAt = link.linkedAt;
    pObj.linkId = link._id;

    return sendSuccess(res, 200, 'Project details retrieved successfully.', { project: pObj });
  } catch (error) {
    console.error('Error fetching project detail for client:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project details.');
  }
};

/**
 * Get Project Milestones
 * GET /api/client/projects/:projectId/milestones
 */
exports.getProjectMilestones = async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.clientContact.clientId;

    // Security Isolation Check
    const link = await ClientProjectLink.findOne({
      clientId,
      projectId,
      isActive: true,
      visibleToClient: true
    });

    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const project = await Project.findById(projectId).select('name status progressPercent milestones');
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    return sendSuccess(res, 200, 'Project milestones retrieved successfully.', {
      projectId: project._id,
      projectName: project.name,
      progressPercent: project.progressPercent,
      milestones: project.milestones || []
    });
  } catch (error) {
    console.error('Error fetching project milestones:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve milestones.');
  }
};

/**
 * Get Formatted Project Timeline
 * GET /api/client/projects/:projectId/timeline
 */
exports.getProjectTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.clientContact.clientId;

    // Security Isolation Check
    const link = await ClientProjectLink.findOne({
      clientId,
      projectId,
      isActive: true,
      visibleToClient: true
    });

    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    const timelineEvents = [];

    // 1. Start Event
    if (project.startDate) {
      timelineEvents.push({
        type: 'START',
        title: 'Project Initiated',
        date: project.startDate,
        isCompleted: true,
        description: 'Project officially kicked off.'
      });
    }

    // 2. Milestones
    if (Array.isArray(project.milestones)) {
      project.milestones.forEach(m => {
        timelineEvents.push({
          type: 'MILESTONE',
          title: m.title,
          date: m.completedDate || m.dueDate,
          isCompleted: Boolean(m.isCompleted),
          description: m.description || null
        });
      });
    }

    // 3. Delays if any
    if (Array.isArray(project.delays)) {
      project.delays.forEach(d => {
        timelineEvents.push({
          type: 'DELAY',
          title: `Schedule Adjustment (+${d.delayedDays} days)`,
          date: d.reportedAt,
          isCompleted: true,
          description: d.reason
        });
      });
    }

    // 4. Target Completion Event
    if (project.estimatedCompletion) {
      timelineEvents.push({
        type: 'TARGET_COMPLETION',
        title: project.status === 'Completed' ? 'Project Completed' : 'Estimated Completion Target',
        date: project.actualCompletion || project.estimatedCompletion,
        isCompleted: project.status === 'Completed',
        description: project.status === 'Completed' ? 'Handed over to client.' : 'Expected completion date.'
      });
    }

    // Sort timeline by date
    timelineEvents.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    return sendSuccess(res, 200, 'Project timeline retrieved successfully.', {
      projectId: project._id,
      projectName: project.name,
      status: project.status,
      timeline: timelineEvents
    });
  } catch (error) {
    console.error('Error fetching project timeline:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project timeline.');
  }
};

/**
 * Update Logged-in ClientContact Profile (Name & Phone only)
 * PUT /api/client-auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const contactId = req.clientContact.contactId;
    const { name, phone } = req.body;

    if (!name && !phone) {
      return sendError(res, 400, 'At least one field (name or phone) is required to update.');
    }

    const contact = await ClientContact.findById(contactId);
    if (!contact || !contact.isActive) {
      return sendError(res, 404, 'ClientContact profile not found.');
    }

    if (name) contact.name = name.trim();
    if (phone) contact.phone = phone.trim();

    await contact.save();

    return sendSuccess(res, 200, 'Profile updated successfully.', {
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        permissionLevel: contact.permissionLevel
      }
    });
  } catch (error) {
    console.error('Error updating client profile:', error);
    return sendError(res, 500, error.message || 'Failed to update profile.');
  }
};

/**
 * Log Portal Session Login
 * POST /api/client/session/log-login
 */
exports.logSessionLogin = async (req, res) => {
  try {
    const contactId = req.clientContact.contactId;
    const { platform } = req.body;

    if (!platform || !['WEB', 'ANDROID', 'IOS'].includes(platform.toUpperCase())) {
      return sendError(res, 400, 'Platform must be one of WEB, ANDROID, or IOS.');
    }

    const session = await ClientPortalSession.create({
      contactId,
      platform: platform.toUpperCase(),
      loginAt: new Date(),
      lastActiveAt: new Date()
    });

    return sendSuccess(res, 201, 'Client portal session logged successfully.', { session });
  } catch (error) {
    console.error('Error logging client portal session:', error);
    return sendError(res, 500, error.message || 'Failed to log session.');
  }
};

/**
 * Client Session Heartbeat
 * POST /api/client/session/heartbeat
 */
exports.sessionHeartbeat = async (req, res) => {
  try {
    const contactId = req.clientContact.contactId;
    const { sessionId } = req.body || {};

    let session;
    if (sessionId) {
      session = await ClientPortalSession.findOne({ _id: sessionId, contactId });
    } else {
      session = await ClientPortalSession.findOne({ contactId }).sort({ loginAt: -1 });
    }

    if (session) {
      session.lastActiveAt = new Date();
      await session.save();
    }

    return sendSuccess(res, 200, 'Session heartbeat updated.', {
      lastActiveAt: session ? session.lastActiveAt : new Date(),
      serverTimestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating session heartbeat:', error);
    return sendError(res, 500, error.message || 'Failed to update session heartbeat.');
  }
};
