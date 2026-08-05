const Drawing = require('../models/Drawing');
const ClientApprovalLog = require('../models/ClientApprovalLog');
const DrawingComment = require('../models/DrawingComment');
const ClientProjectLink = require('../models/ClientProjectLink');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to verify client-project security linkage
 */
async function verifyProjectLink(clientId, projectId) {
  return await ClientProjectLink.findOne({
    clientId,
    projectId,
    isActive: true,
    visibleToClient: true
  });
}

/**
 * GET /api/client/projects/:projectId/drawings
 * Returns drawings grouped into pendingApproval, approved, and changesRequested.
 */
exports.getProjectDrawings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const clientId = req.clientContact.clientId;

    // Security Isolation: Verify project is genuinely linked & visible to this Client
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const drawings = await Drawing.find({
      projectId,
      visibleToClient: true,
      status: { $in: ['PENDING_CLIENT_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED'] }
    }).sort({ updatedAt: -1 });

    const pendingApproval = [];
    const approved = [];
    const changesRequested = [];

    for (const dwg of drawings) {
      if (dwg.status === 'PENDING_CLIENT_APPROVAL') {
        pendingApproval.push(dwg);
      } else if (dwg.status === 'APPROVED') {
        approved.push(dwg);
      } else if (dwg.status === 'CHANGES_REQUESTED') {
        changesRequested.push(dwg);
      }
    }

    return sendSuccess(res, 200, 'Client drawings retrieved successfully.', {
      pendingApproval,
      approved,
      changesRequested,
      totalCount: drawings.length
    });
  } catch (error) {
    console.error('Error fetching project drawings for client:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawings.');
  }
};

/**
 * GET /api/client/drawings/:drawingId
 * Full drawing detail + version history list.
 */
exports.getDrawingDetail = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const clientId = req.clientContact.clientId;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found or not accessible.');
    }

    // Security Isolation Check
    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    return sendSuccess(res, 200, 'Drawing details retrieved successfully.', { drawing });
  } catch (error) {
    console.error('Error fetching drawing detail:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing detail.');
  }
};

/**
 * GET /api/client/drawings/:drawingId/versions
 * All versions of a drawing, independently viewable/downloadable.
 */
exports.getDrawingVersions = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const clientId = req.clientContact.clientId;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    return sendSuccess(res, 200, 'Drawing versions retrieved successfully.', {
      drawingId: drawing._id,
      currentVersion: drawing.currentVersion,
      versions: drawing.versions || []
    });
  } catch (error) {
    console.error('Error fetching drawing versions:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing versions.');
  }
};

/**
 * GET /api/client/drawings/:drawingId/compare?versionA=&versionB=
 * Comparison data between two specified versions.
 */
exports.compareDrawingVersions = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { versionA, versionB } = req.query;
    const clientId = req.clientContact.clientId;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    const numA = Number(versionA);
    const numB = Number(versionB);

    const vA = drawing.versions.find(v => v.versionNumber === numA) || 
               (drawing.currentVersion === numA ? { versionNumber: drawing.currentVersion, fileUrl: drawing.fileUrl, thumbnailUrl: drawing.thumbnailUrl } : null);
               
    const vB = drawing.versions.find(v => v.versionNumber === numB) || 
               (drawing.currentVersion === numB ? { versionNumber: drawing.currentVersion, fileUrl: drawing.fileUrl, thumbnailUrl: drawing.thumbnailUrl } : null);

    return sendSuccess(res, 200, 'Drawing version comparison retrieved successfully.', {
      drawingId: drawing._id,
      versionA: vA || null,
      versionB: vB || null
    });
  } catch (error) {
    console.error('Error comparing drawing versions:', error);
    return sendError(res, 500, error.message || 'Failed to compare drawing versions.');
  }
};

/**
 * POST /api/client/drawings/:drawingId/approve
 * Client approves drawing (OWNER / MEMBER only).
 */
exports.approveDrawing = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { comments } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    // Permission Check: OWNER or MEMBER only
    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only accounts cannot approve drawings.');
    }

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found or not accessible.');
    }

    // Linkage Verification
    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    // Double-Approval Race Condition Handling & Status Check
    if (drawing.status === 'APPROVED') {
      const latestLog = await ClientApprovalLog.findOne({ drawingId: drawing._id, action: 'APPROVED' })
        .populate('contactId', 'name email');

      const approverName = latestLog && latestLog.contactId ? latestLog.contactId.name : 'another client contact';
      const approvedAt = latestLog && latestLog.actedAt ? latestLog.actedAt.toISOString() : drawing.updatedAt.toISOString();

      return sendError(res, 409, `Drawing was already approved by ${approverName} at ${approvedAt}.`);
    }

    if (drawing.status !== 'PENDING_CLIENT_APPROVAL') {
      return sendError(res, 400, `Drawing cannot be approved from its current status: ${drawing.status}`);
    }

    drawing.status = 'APPROVED';
    await drawing.save();

    const log = await ClientApprovalLog.create({
      clientId,
      contactId,
      drawingId: drawing._id,
      projectId: drawing.projectId,
      action: 'APPROVED',
      comments: comments ? comments.trim() : null
    });

    // Hook point for Module 10 Notifications (Internal Team notification)
    console.log(`[NOTIFICATION HOOK] Internal team notified: Drawing "${drawing.title}" approved by contact ${contactId}`);

    return sendSuccess(res, 200, 'Drawing approved successfully.', {
      drawing,
      log
    });
  } catch (error) {
    console.error('Error approving drawing:', error);
    return sendError(res, 500, error.message || 'Failed to approve drawing.');
  }
};

/**
 * POST /api/client/drawings/:drawingId/request-changes
 * Client requests changes on drawing (OWNER / MEMBER only, comments required).
 */
exports.requestChanges = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { comments } = req.body;
    const { clientId, contactId, permissionLevel } = req.clientContact;

    // Permission Check: OWNER or MEMBER only
    if (['VIEW_ONLY'].includes(permissionLevel)) {
      return sendError(res, 403, 'Access denied. View Only accounts cannot request changes.');
    }

    // Mandatory comments validation
    if (!comments || !comments.trim()) {
      return sendError(res, 400, 'Comments are mandatory when requesting changes.');
    }

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found or not accessible.');
    }

    // Linkage Verification
    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    // Lock check on approved drawing
    if (drawing.status === 'APPROVED') {
      return sendError(res, 400, 'Approved drawings are locked. A new revision must be uploaded by the design team to make changes.');
    }

    drawing.status = 'CHANGES_REQUESTED';
    await drawing.save();

    const log = await ClientApprovalLog.create({
      clientId,
      contactId,
      drawingId: drawing._id,
      projectId: drawing.projectId,
      action: 'CHANGES_REQUESTED',
      comments: comments.trim()
    });

    // Hook point for Module 10 Notifications (Designer & PM notification)
    console.log(`[NOTIFICATION HOOK] Designer & PM notified: Drawing "${drawing.title}" changes requested by contact ${contactId}`);

    return sendSuccess(res, 200, 'Changes requested successfully.', {
      drawing,
      log
    });
  } catch (error) {
    console.error('Error requesting changes for drawing:', error);
    return sendError(res, 500, error.message || 'Failed to request changes.');
  }
};

/**
 * POST /api/client/drawings/:drawingId/comments
 * Add comment or image annotation to drawing (draft or shared).
 */
exports.addComment = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { commentText, annotationCoords, isDraft } = req.body;
    const { clientId, contactId } = req.clientContact;

    if (!commentText || !commentText.trim()) {
      return sendError(res, 400, 'Comment text is required.');
    }

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found or not accessible.');
    }

    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    const comment = await DrawingComment.create({
      drawingId: drawing._id,
      authorType: 'CLIENT_CONTACT',
      authorId: contactId,
      authorModel: 'ClientContact',
      commentText: commentText.trim(),
      annotationCoords: annotationCoords || null,
      isDraft: Boolean(isDraft)
    });

    return sendSuccess(res, 201, 'Comment added successfully.', { comment });
  } catch (error) {
    console.error('Error adding drawing comment:', error);
    return sendError(res, 500, error.message || 'Failed to add comment.');
  }
};

/**
 * GET /api/client/drawings/:drawingId/comments
 * Retrieve non-draft comments PLUS calling contact's own draft comments.
 */
exports.getComments = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { clientId, contactId } = req.clientContact;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.visibleToClient) {
      return sendError(res, 404, 'Drawing not found or not accessible.');
    }

    const link = await verifyProjectLink(clientId, drawing.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. You do not have access to this drawing.');
    }

    const comments = await DrawingComment.find({
      drawingId: drawing._id,
      $or: [
        { isDraft: false },
        { isDraft: true, authorId: contactId }
      ]
    }).sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Drawing comments retrieved successfully.', { comments });
  } catch (error) {
    console.error('Error fetching drawing comments:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve comments.');
  }
};
