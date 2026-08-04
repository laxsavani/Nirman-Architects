const ClientProjectLink = require('../models/ClientProjectLink');
const ClientProjectLinkHistory = require('../models/ClientProjectLinkHistory');
const Client = require('../models/Client');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Create a link between a Client account and a Project
 * POST /api/client-project-links/create
 */
exports.createLink = async (req, res) => {
  try {
    const { clientId, projectId, visibleToClient } = req.body;
    const currentUserId = req.user.id || req.user._id;

    if (!clientId || !projectId) {
      return sendError(res, 400, 'Both clientId and projectId are required.');
    }

    // 1. Validate Client exists and is active
    const client = await Client.findById(clientId);
    if (!client) {
      return sendError(res, 404, 'Client account not found.');
    }
    if (!client.isActive) {
      return sendError(res, 400, 'Cannot link project to a deactivated Client account.');
    }

    // 2. Validate Project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return sendError(res, 404, 'Project not found.');
    }

    // 3. Prevent duplicate ACTIVE link for the same pair
    const existingActiveLink = await ClientProjectLink.findOne({
      clientId,
      projectId,
      isActive: true
    });

    if (existingActiveLink) {
      return sendError(res, 400, 'An active link already exists between this Client and Project.');
    }

    // 4. Create new ClientProjectLink
    const link = new ClientProjectLink({
      clientId,
      projectId,
      visibleToClient: visibleToClient !== undefined ? Boolean(visibleToClient) : true,
      linkedBy: currentUserId,
      linkedAt: new Date(),
      isActive: true
    });

    await link.save();

    // 5. Audit log
    await ClientProjectLinkHistory.create({
      clientId,
      projectId,
      action: 'LINKED',
      performedBy: currentUserId,
      performedAt: new Date()
    });

    const populatedLink = await ClientProjectLink.findById(link._id)
      .populate('clientId', 'name companyName phone email')
      .populate('projectId', 'name status projectManager teamMembers')
      .populate('linkedBy', 'name email designation');

    return sendSuccess(res, 201, 'Project successfully linked to Client account.', {
      link: populatedLink
    });
  } catch (error) {
    console.error('Error creating client-project link:', error);
    return sendError(res, 500, error.message || 'Failed to link Project to Client.');
  }
};

/**
 * Get active project links for a specific Client account (Internal Team)
 * GET /api/client-project-links/by-client/:clientId
 */
exports.getLinksByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const links = await ClientProjectLink.find({ clientId, isActive: true })
      .populate('projectId')
      .populate('linkedBy', 'name email designation')
      .sort({ linkedAt: -1 });

    return sendSuccess(res, 200, 'Client project links retrieved successfully.', { links });
  } catch (error) {
    console.error('Error fetching links by client:', error);
    return sendError(res, 500, error.message || 'Failed to fetch client project links.');
  }
};

/**
 * Get active client links for a specific Project (Internal Team)
 * GET /api/client-project-links/by-project/:projectId
 */
exports.getLinksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const links = await ClientProjectLink.find({ projectId, isActive: true })
      .populate('clientId', 'name companyName phone email billingAddress siteAddresses')
      .populate('linkedBy', 'name email designation')
      .sort({ linkedAt: -1 });

    return sendSuccess(res, 200, 'Project client links retrieved successfully.', { links });
  } catch (error) {
    console.error('Error fetching links by project:', error);
    return sendError(res, 500, error.message || 'Failed to fetch project client links.');
  }
};

/**
 * Toggle visibility of a project to client portal
 * PUT /api/client-project-links/:id/visibility
 */
exports.toggleVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { visibleToClient } = req.body;
    const currentUserId = req.user.id || req.user._id;

    if (visibleToClient === undefined) {
      return sendError(res, 400, 'visibleToClient boolean value is required.');
    }

    const link = await ClientProjectLink.findOne({ _id: id, isActive: true });
    if (!link) {
      return sendError(res, 404, 'Active ClientProjectLink not found.');
    }

    const newVisibility = Boolean(visibleToClient);
    link.visibleToClient = newVisibility;
    await link.save();

    // Audit log
    await ClientProjectLinkHistory.create({
      clientId: link.clientId,
      projectId: link.projectId,
      action: 'VISIBILITY_CHANGED',
      performedBy: currentUserId,
      notes: `Visibility set to ${newVisibility}`,
      performedAt: new Date()
    });

    return sendSuccess(res, 200, `Project visibility updated to ${newVisibility}.`, { link });
  } catch (error) {
    console.error('Error toggling link visibility:', error);
    return sendError(res, 500, error.message || 'Failed to toggle visibility.');
  }
};

/**
 * Soft-delete (unlink) a project from a client (Admin / Super Admin ONLY)
 * DELETE /api/client-project-links/:id
 */
exports.unlinkProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};
    const currentUserId = req.user.id || req.user._id;

    const link = await ClientProjectLink.findOne({ _id: id, isActive: true });
    if (!link) {
      return sendError(res, 404, 'Active ClientProjectLink not found.');
    }

    link.isActive = false;
    link.unlinkedBy = currentUserId;
    link.unlinkedAt = new Date();
    await link.save();

    // Audit log
    await ClientProjectLinkHistory.create({
      clientId: link.clientId,
      projectId: link.projectId,
      action: 'UNLINKED',
      performedBy: currentUserId,
      notes: notes ? notes.trim() : 'Project unlinked from Client account',
      performedAt: new Date()
    });

    return sendSuccess(res, 200, 'Project unlinked from Client account successfully.', { link });
  } catch (error) {
    console.error('Error unlinking project:', error);
    return sendError(res, 500, error.message || 'Failed to unlink project.');
  }
};

/**
 * Client Portal Endpoint: Get logged-in ClientContact's visible linked projects
 * GET /api/client/projects/my
 */
exports.getMyProjects = async (req, res) => {
  try {
    const clientId = req.clientContact.clientId;

    const activeLinks = await ClientProjectLink.find({
      clientId,
      isActive: true,
      visibleToClient: true
    })
      .populate('projectId')
      .sort({ linkedAt: -1 });

    const projects = activeLinks.map(link => {
      const pObj = link.projectId ? (typeof link.projectId.toObject === 'function' ? link.projectId.toObject() : link.projectId) : {};
      pObj.linkId = link._id;
      pObj.linkedAt = link.linkedAt;
      return pObj;
    });

    return sendSuccess(res, 200, 'Client visible projects retrieved successfully.', {
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error('Error fetching my projects for client:', error);
    return sendError(res, 500, error.message || 'Failed to fetch client projects.');
  }
};
