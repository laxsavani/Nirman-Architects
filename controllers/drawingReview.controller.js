const DrawingVersion = require('../models/DrawingVersion');
const Drawing = require('../models/Drawing');
const DrawingComment = require('../models/DrawingComment');
const DrawingMarking = require('../models/DrawingMarking');
const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to get user role code
 */
async function getUserRoleCode(user) {
  if (!user) return '';
  if (user.roleId && typeof user.roleId === 'object' && user.roleId.roleCode) {
    return user.roleId.roleCode;
  }
  if (user.roleId) {
    const role = await RoleMaster.findById(user.roleId);
    return role ? role.roleCode : '';
  }
  return '';
}

/**
 * POST /api/drawing-versions/:versionId/comments
 * Employee posts a general Comment or coordinate-pinned Note on a drawing version
 */
exports.postCommentOrNote = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { commentText, annotationCoords, isDraft } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!commentText || !commentText.trim()) {
      return sendError(res, 400, 'commentText is required.');
    }

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const comment = await DrawingComment.create({
      drawingId: version.drawingId,
      drawingVersionId: version._id,
      authorType: 'EMPLOYEE',
      authorId: userId,
      authorModel: 'User',
      commentText: commentText.trim(),
      annotationCoords: annotationCoords || null,
      isDraft: isDraft || false
    });

    const populated = await DrawingComment.findById(comment._id)
      .populate('authorId', 'name email designation');

    return sendSuccess(res, 201, annotationCoords ? 'Pinned note created successfully.' : 'Comment posted successfully.', { comment: populated });
  } catch (error) {
    console.error('Error posting comment or note:', error);
    return sendError(res, 500, error.message || 'Failed to post comment or note.');
  }
};

/**
 * GET /api/drawing-versions/:versionId/comments
 * Retrieves all non-draft comments/notes for a version + user's own draft notes
 */
exports.getVersionComments = async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const comments = await DrawingComment.find({
      $or: [
        { drawingVersionId: versionId },
        { drawingId: version.drawingId, drawingVersionId: null }
      ],
      $or: [
        { isDraft: false },
        { authorId: userId }
      ]
    })
    .populate('authorId', 'name email designation permissionLevel')
    .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Version comments and notes retrieved successfully.', { comments, count: comments.length });
  } catch (error) {
    console.error('Error fetching version comments:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve version comments.');
  }
};

/**
 * POST /api/drawing-versions/:versionId/markings
 * Creates a freehand or shape marking annotation on a drawing version
 */
exports.postMarking = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { markingType, geometry, color, linkedCommentId } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const validTypes = ['FREEHAND', 'RECTANGLE', 'CIRCLE', 'ARROW', 'HIGHLIGHT_AREA'];
    if (!markingType || !validTypes.includes(markingType.toUpperCase())) {
      return sendError(res, 400, `markingType must be one of: ${validTypes.join(', ')}.`);
    }

    if (!geometry || typeof geometry !== 'object') {
      return sendError(res, 400, 'geometry object is required.');
    }

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const marking = await DrawingMarking.create({
      drawingVersionId: version._id,
      drawingId: version.drawingId,
      authorType: 'EMPLOYEE',
      authorId: userId,
      authorModel: 'User',
      markingType: markingType.toUpperCase(),
      geometry,
      color: color || '#FF0000',
      linkedCommentId: linkedCommentId || null
    });

    const populated = await DrawingMarking.findById(marking._id)
      .populate('authorId', 'name email designation')
      .populate('linkedCommentId', 'commentText annotationCoords');

    return sendSuccess(res, 201, 'Marking annotation created successfully.', { marking: populated });
  } catch (error) {
    console.error('Error posting marking annotation:', error);
    return sendError(res, 500, error.message || 'Failed to post marking annotation.');
  }
};

/**
 * GET /api/drawing-versions/:versionId/markings
 * Retrieves all markings for a specific drawing version
 */
exports.getVersionMarkings = async (req, res) => {
  try {
    const { versionId } = req.params;

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const markings = await DrawingMarking.find({ drawingVersionId: versionId })
      .populate('authorId', 'name email designation permissionLevel')
      .populate('linkedCommentId', 'commentText annotationCoords')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Version markings retrieved successfully.', { markings, count: markings.length });
  } catch (error) {
    console.error('Error fetching version markings:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve version markings.');
  }
};

/**
 * DELETE /api/drawing-versions/:versionId/markings/:markingId
 * Author or Admin/SuperAdmin override
 */
exports.deleteMarking = async (req, res) => {
  try {
    const { versionId, markingId } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const marking = await DrawingMarking.findById(markingId);
    if (!marking) {
      return sendError(res, 404, 'Marking annotation not found.');
    }

    const roleCode = await getUserRoleCode(req.user);
    const isAuthor = marking.authorId.toString() === userId.toString();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(roleCode);

    if (!isAuthor && !isAdmin) {
      return sendError(res, 403, 'Access denied. You can only delete your own markings.');
    }

    await DrawingMarking.findByIdAndDelete(markingId);

    return sendSuccess(res, 200, 'Marking annotation deleted successfully.', { markingId });
  } catch (error) {
    console.error('Error deleting marking annotation:', error);
    return sendError(res, 500, error.message || 'Failed to delete marking annotation.');
  }
};

/**
 * GET /api/drawing-versions/:versionId/review-data
 * Single aggregated response returning version metadata, comments, and markings for viewer initialization
 */
exports.getAggregatedReviewData = async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const version = await DrawingVersion.findById(versionId)
      .populate('uploadedBy', 'name email designation')
      .populate('pmReviewedBy', 'name email designation')
      .populate('adminReviewedBy', 'name email designation');

    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const drawing = await Drawing.findById(version.drawingId)
      .populate('projectId', 'projectName name')
      .populate('categoryId', 'name requiresClientApproval restrictedEditing');

    const comments = await DrawingComment.find({
      $or: [
        { drawingVersionId: versionId },
        { drawingId: version.drawingId, drawingVersionId: null }
      ],
      $or: [
        { isDraft: false },
        { authorId: userId }
      ]
    })
    .populate('authorId', 'name email designation permissionLevel')
    .sort({ createdAt: 1 });

    const markings = await DrawingMarking.find({ drawingVersionId: versionId })
      .populate('authorId', 'name email designation permissionLevel')
      .populate('linkedCommentId', 'commentText annotationCoords')
      .sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Aggregated review data retrieved successfully for viewer.', {
      drawingVersion: version,
      drawing,
      comments,
      markings
    });
  } catch (error) {
    console.error('Error fetching aggregated review data:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve aggregated review data.');
  }
};
