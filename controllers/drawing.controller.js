const Drawing = require('../models/Drawing');
const ClientApprovalLog = require('../models/ClientApprovalLog');
const { sendSuccess, sendError } = require('../utils/response');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * POST /api/drawings/upload
 * Upload new Drawing file (PDF, PNG, JPG, DWG) to Cloudinary and create DB record.
 */
exports.uploadDrawing = async (req, res) => {
  try {
    const { projectId, title, drawingNumber, category, notes, visibleToClient } = req.body;
    const uploadedBy = req.user ? (req.user._id || req.user.id || req.user.userId) : null;

    if (!projectId || !title || !category) {
      return sendError(res, 400, 'projectId, title, and category are required.');
    }

    if (!req.file || !req.file.buffer) {
      return sendError(res, 400, 'Drawing file is required for upload.');
    }

    // Determine Cloudinary resource_type ('image' or 'raw' for pdf/dwg)
    const isImage = req.file.mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';

    console.log(`[Drawing Controller] Uploading drawing "${title}" to Cloudinary (resource_type: ${resourceType})...`);

    const cloudResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'nirman/drawings',
      resource_type: resourceType
    });

    const fileUrl = cloudResult ? cloudResult.secure_url : null;

    if (!fileUrl) {
      return sendError(res, 500, 'Failed to upload drawing file to Cloudinary.');
    }

    const thumbnailUrl = isImage ? fileUrl : null;

    const newDrawing = await Drawing.create({
      projectId,
      title,
      drawingNumber: drawingNumber || `DWG-${Math.floor(1000 + Math.random() * 9000)}`,
      category,
      currentVersion: 1,
      fileUrl,
      thumbnailUrl,
      status: 'PENDING_CLIENT_APPROVAL',
      visibleToClient: visibleToClient !== undefined ? Boolean(visibleToClient) : true,
      uploadedBy,
      versions: [
        {
          versionNumber: 1,
          fileUrl,
          thumbnailUrl,
          notes: notes || 'Initial upload',
          uploadedBy,
          uploadedAt: new Date()
        }
      ]
    });

    return sendSuccess(res, 201, 'Drawing uploaded successfully to Cloudinary.', { drawing: newDrawing });
  } catch (error) {
    console.error('[Drawing Upload Error]', error);
    return sendError(res, 500, error.message || 'Failed to upload drawing.');
  }
};

/**
 * POST /api/drawings/:drawingId/upload-version
 * Upload new revision version (V2, V3...) of an existing drawing to Cloudinary.
 */
exports.uploadDrawingVersion = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { notes } = req.body;
    const uploadedBy = req.user ? (req.user._id || req.user.id || req.user.userId) : null;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing) {
      return sendError(res, 404, 'Drawing not found.');
    }

    if (!req.file || !req.file.buffer) {
      return sendError(res, 400, 'New revision drawing file is required.');
    }

    const isImage = req.file.mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';

    console.log(`[Drawing Controller] Uploading new version for drawing "${drawing.title}" to Cloudinary...`);

    const cloudResult = await uploadToCloudinary(req.file.buffer, {
      folder: 'nirman/drawings',
      resource_type: resourceType
    });

    const fileUrl = cloudResult ? cloudResult.secure_url : null;
    if (!fileUrl) {
      return sendError(res, 500, 'Failed to upload new drawing version to Cloudinary.');
    }

    const nextVersion = (drawing.currentVersion || 1) + 1;
    const thumbnailUrl = isImage ? fileUrl : drawing.thumbnailUrl;

    drawing.currentVersion = nextVersion;
    drawing.fileUrl = fileUrl;
    drawing.thumbnailUrl = thumbnailUrl;
    drawing.status = 'PENDING_CLIENT_APPROVAL'; // Reset approval status for new version
    drawing.versions.push({
      versionNumber: nextVersion,
      fileUrl,
      thumbnailUrl,
      notes: notes || `Revision V${nextVersion}`,
      uploadedBy,
      uploadedAt: new Date()
    });

    await drawing.save();

    return sendSuccess(res, 200, `Drawing version V${nextVersion} uploaded successfully.`, { drawing });
  } catch (error) {
    console.error('[Drawing Version Upload Error]', error);
    return sendError(res, 500, error.message || 'Failed to upload new drawing version.');
  }
};

/**
 * GET /api/drawings/:drawingId/client-approval-log
 * Internal PM/Admin view of full client approval history for a drawing.
 */
exports.getClientApprovalLog = async (req, res) => {
  try {
    const { drawingId } = req.params;

    const drawing = await Drawing.findById(drawingId);
    if (!drawing) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const logs = await ClientApprovalLog.find({ drawingId })
      .populate('contactId', 'name email phone permissionLevel isPrimaryContact')
      .populate('clientId', 'name companyName email')
      .sort({ actedAt: -1 });

    return sendSuccess(res, 200, 'Client approval log retrieved successfully.', {
      drawingId: drawing._id,
      title: drawing.title,
      status: drawing.status,
      logs
    });
  } catch (error) {
    console.error('Error retrieving client approval log for internal team:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve client approval log.');
  }
};

