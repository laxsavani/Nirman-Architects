const Drawing = require('../models/Drawing');
const DrawingVersion = require('../models/DrawingVersion');
const DrawingCategory = require('../models/DrawingCategory');
const DrawingVersionStatusHistory = require('../models/DrawingVersionStatusHistory');
const ClientApprovalLog = require('../models/ClientApprovalLog');
const Project = require('../models/Project');
const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to get role code
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
 * POST /api/drawings/create
 * Creates parent Drawing record
 */
exports.createDrawing = async (req, res) => {
  try {
    const { projectId, drawingName, categoryId, drawingNumber } = req.body;

    if (!projectId || !drawingName || !drawingName.trim() || !categoryId) {
      return sendError(res, 400, 'projectId, drawingName, and categoryId are required.');
    }

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const category = await DrawingCategory.findById(categoryId);
    if (!category || !category.isActive) {
      return sendError(res, 404, 'Drawing category not found.');
    }

    const userId = req.user ? (req.user._id || req.user.id) : null;

    const drawing = await Drawing.create({
      projectId,
      drawingName: drawingName.trim(),
      drawingNumber: drawingNumber ? drawingNumber.trim() : null,
      categoryId: category._id,
      categoryName: category.name,
      createdBy: userId
    });

    return sendSuccess(res, 201, 'Parent drawing created successfully.', { drawing });
  } catch (error) {
    console.error('Error creating drawing:', error);
    return sendError(res, 500, error.message || 'Failed to create drawing.');
  }
};

/**
 * POST /api/drawings/:drawingId/versions/upload
 * Uploads a new DrawingVersion ("never permanently replaced" rule)
 */
exports.uploadVersion = async (req, res) => {
  try {
    const { drawingId } = req.params;
    const { filePath, fileType, changeLog, thumbnailUrl } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!filePath || !filePath.trim()) {
      return sendError(res, 400, 'filePath is required.');
    }

    const drawing = await Drawing.findById(drawingId);
    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    if (drawing.isGFCLocked) {
      return sendError(res, 400, 'Drawing is GFC locked. Version upload is blocked.');
    }

    // Auto-increment version number
    const latestVersion = await DrawingVersion.findOne({ drawingId }).sort({ versionNumber: -1 });
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const version = await DrawingVersion.create({
      drawingId: drawing._id,
      versionNumber: nextVersionNumber,
      filePath: filePath.trim(),
      thumbnailUrl: thumbnailUrl ? thumbnailUrl.trim() : null,
      fileType: fileType ? fileType.trim().toUpperCase() : 'DWG',
      uploadedBy: userId,
      changeLog: changeLog ? changeLog.trim() : null,
      status: 'DESIGNER_UPLOADED',
      visibleToClient: false
    });

    // Update parent Drawing pointer and backward compatibility embedded state
    drawing.currentVersionId = version._id;
    drawing.currentVersion = nextVersionNumber;
    drawing.status = 'DESIGNER_UPLOADED';
    drawing.visibleToClient = false;
    drawing.fileUrl = version.filePath;
    drawing.thumbnailUrl = version.thumbnailUrl;

    drawing.versions.push({
      versionNumber: nextVersionNumber,
      fileUrl: version.filePath,
      thumbnailUrl: version.thumbnailUrl,
      notes: version.changeLog,
      uploadedBy: userId,
      uploadedAt: version.uploadDate
    });

    await drawing.save();

    await DrawingVersionStatusHistory.create({
      drawingVersionId: version._id,
      fromStatus: null,
      toStatus: 'DESIGNER_UPLOADED',
      changedBy: userId,
      notes: changeLog || 'Initial version upload'
    });

    const populatedDrawing = await Drawing.findById(drawing._id)
      .populate('categoryId', 'name requiresClientApproval restrictedEditing')
      .populate('currentVersionId');

    return sendSuccess(res, 201, `Drawing version v${nextVersionNumber} uploaded successfully.`, {
      drawing: populatedDrawing,
      version
    });
  } catch (error) {
    console.error('Error uploading drawing version:', error);
    return sendError(res, 500, error.message || 'Failed to upload drawing version.');
  }
};

/**
 * GET /api/drawings
 */
exports.getDrawings = async (req, res) => {
  try {
    const { projectId, categoryId, status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter = { isActive: true };

    if (projectId) filter.projectId = projectId;
    if (categoryId) filter.categoryId = categoryId;
    if (status) filter.status = status;

    const totalCount = await Drawing.countDocuments(filter);
    const drawings = await Drawing.find(filter)
      .populate('projectId', 'projectName name')
      .populate('categoryId', 'name requiresClientApproval restrictedEditing')
      .populate('currentVersionId')
      .populate('createdBy', 'name email designation')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return sendSuccess(res, 200, 'Drawings retrieved successfully.', {
      drawings,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum
    });
  } catch (error) {
    console.error('Error fetching drawings:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawings.');
  }
};

/**
 * GET /api/drawings/:id
 */
exports.getDrawingById = async (req, res) => {
  try {
    const { id } = req.params;

    const drawing = await Drawing.findById(id)
      .populate('projectId', 'projectName name')
      .populate('categoryId', 'name requiresClientApproval restrictedEditing')
      .populate('currentVersionId')
      .populate('createdBy', 'name email designation');

    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const versionHistory = await DrawingVersion.find({ drawingId: id })
      .populate('uploadedBy', 'name email designation')
      .populate('pmReviewedBy', 'name email designation')
      .populate('adminReviewedBy', 'name email designation')
      .sort({ versionNumber: -1 });

    return sendSuccess(res, 200, 'Drawing details retrieved successfully.', {
      drawing,
      versionHistory
    });
  } catch (error) {
    console.error('Error fetching drawing detail:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing details.');
  }
};

/**
 * GET /api/drawings/:id/versions
 */
exports.getDrawingVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const drawing = await Drawing.findById(id);

    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const versions = await DrawingVersion.find({ drawingId: id })
      .populate('uploadedBy', 'name email designation')
      .sort({ versionNumber: -1 });

    return sendSuccess(res, 200, 'Drawing versions list retrieved successfully.', { versions });
  } catch (error) {
    console.error('Error fetching drawing versions:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing versions.');
  }
};

/**
 * PUT /api/drawing-versions/:versionId/pm-review
 */
exports.pmReview = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { decision, comments } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return sendError(res, 400, 'decision must be APPROVE or REJECT.');
    }

    if (decision === 'REJECT' && (!comments || !comments.trim())) {
      return sendError(res, 400, 'Comments are mandatory when PM rejects a drawing version.');
    }

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only PM or Admin can perform PM review.');
    }

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    if (!['DESIGNER_UPLOADED', 'PM_REJECTED'].includes(version.status)) {
      return sendError(res, 400, `Version cannot undergo PM review from status "${version.status}".`);
    }

    const fromStatus = version.status;
    const toStatus = decision === 'APPROVE' ? 'PM_APPROVED' : 'PM_REJECTED';

    version.status = toStatus;
    version.pmReviewComments = comments ? comments.trim() : null;
    version.pmReviewedBy = userId;
    version.pmReviewedAt = new Date();
    await version.save();

    // Update parent Drawing status if this is current version
    const drawing = await Drawing.findById(version.drawingId);
    if (drawing && drawing.currentVersionId && drawing.currentVersionId.toString() === version._id.toString()) {
      drawing.status = toStatus;
      await drawing.save();
    }

    await DrawingVersionStatusHistory.create({
      drawingVersionId: version._id,
      fromStatus,
      toStatus,
      changedBy: userId,
      notes: comments ? comments.trim() : `PM ${decision.toLowerCase()}d version`
    });

    return sendSuccess(res, 200, `PM review completed: ${toStatus}`, { version });
  } catch (error) {
    console.error('Error during PM review:', error);
    return sendError(res, 500, error.message || 'Failed to process PM review.');
  }
};

/**
 * PUT /api/drawing-versions/:versionId/admin-review
 * THE HANDOFF POINT TO CRM MODULE 5!
 */
exports.adminReview = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { decision, comments } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return sendError(res, 400, 'decision must be APPROVE or REJECT.');
    }

    if (decision === 'REJECT' && (!comments || !comments.trim())) {
      return sendError(res, 400, 'Comments are mandatory when Admin rejects a drawing version.');
    }

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only Admin or Super Admin can perform Admin review.');
    }

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    // Admin can review if PM_APPROVED or direct Admin bypass from DESIGNER_UPLOADED
    if (!['PM_APPROVED', 'DESIGNER_UPLOADED'].includes(version.status)) {
      return sendError(res, 400, `Version cannot undergo Admin review from status "${version.status}".`);
    }

    const fromStatus = version.status;
    const toStatus = decision === 'APPROVE' ? 'PENDING_CLIENT_APPROVAL' : 'ADMIN_REJECTED';
    const isClientVisible = decision === 'APPROVE';

    version.status = toStatus;
    version.visibleToClient = isClientVisible;
    version.adminReviewComments = comments ? comments.trim() : null;
    version.adminReviewedBy = userId;
    version.adminReviewedAt = new Date();
    await version.save();

    // Update parent Drawing - THE HANDOFF TO CRM MODULE 5!
    const drawing = await Drawing.findById(version.drawingId);
    if (drawing) {
      drawing.status = toStatus;
      drawing.visibleToClient = isClientVisible;

      // Ensure embedded version object status & fileUrl are updated for CRM 5 query
      if (drawing.versions && drawing.versions.length > 0) {
        const lastEmb = drawing.versions[drawing.versions.length - 1];
        if (lastEmb.versionNumber === version.versionNumber) {
          lastEmb.fileUrl = version.filePath;
        }
      }
      await drawing.save();
    }

    await DrawingVersionStatusHistory.create({
      drawingVersionId: version._id,
      fromStatus,
      toStatus,
      changedBy: userId,
      notes: comments ? comments.trim() : `Admin ${decision.toLowerCase()}d version. Handed off to client portal.`
    });

    return sendSuccess(res, 200, `Admin review completed: ${toStatus}. Visible to client: ${isClientVisible}`, {
      version,
      drawing
    });
  } catch (error) {
    console.error('Error during Admin review:', error);
    return sendError(res, 500, error.message || 'Failed to process Admin review.');
  }
};

/**
 * GET /api/drawings/:id/compare?versionA=&versionB=
 */
exports.compareVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const { versionA, versionB } = req.query;

    const drawing = await Drawing.findById(id);
    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    const numA = parseInt(versionA, 10);
    const numB = parseInt(versionB, 10);

    const vA = await DrawingVersion.findOne({ drawingId: id, versionNumber: numA }).populate('uploadedBy', 'name email');
    const vB = await DrawingVersion.findOne({ drawingId: id, versionNumber: numB }).populate('uploadedBy', 'name email');

    return sendSuccess(res, 200, 'Drawing versions comparison data retrieved successfully.', {
      drawingId: drawing._id,
      drawingName: drawing.drawingName,
      versionA: vA || null,
      versionB: vB || null
    });
  } catch (error) {
    console.error('Error comparing drawing versions:', error);
    return sendError(res, 500, error.message || 'Failed to compare drawing versions.');
  }
};

/**
 * PUT /api/drawings/:id/promote-to-gfc
 */
exports.promoteToGFC = async (req, res) => {
  try {
    const { id } = req.params;

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only Admin or Super Admin can promote a drawing to GFC.');
    }

    const drawing = await Drawing.findById(id);
    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    drawing.isGFCLocked = true;
    drawing.gfcLockedAt = new Date();
    drawing.gfcLockedBy = req.user ? (req.user._id || req.user.id) : null;
    await drawing.save();

    return sendSuccess(res, 200, 'Drawing promoted to locked GFC state.', { drawing });
  } catch (error) {
    console.error('Error promoting drawing to GFC:', error);
    return sendError(res, 500, error.message || 'Failed to promote drawing to GFC.');
  }
};

/**
 * PUT /api/drawings/:id/unlock-gfc
 */
exports.unlockGFC = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const roleCode = await getUserRoleCode(req.user);
    if (roleCode !== 'SUPER_ADMIN') {
      return sendError(res, 403, 'Access denied. Only Super Admin can unlock a GFC drawing.');
    }

    if (!reason || !reason.trim()) {
      return sendError(res, 400, 'Mandatory reason required to unlock GFC drawing.');
    }

    const drawing = await Drawing.findById(id);
    if (!drawing || !drawing.isActive) {
      return sendError(res, 404, 'Drawing not found.');
    }

    drawing.isGFCLocked = false;
    drawing.gfcLockedAt = null;
    drawing.gfcLockedBy = null;
    await drawing.save();

    return sendSuccess(res, 200, 'GFC drawing unlocked successfully.', { drawing, unlockReason: reason.trim() });
  } catch (error) {
    console.error('Error unlocking GFC drawing:', error);
    return sendError(res, 500, error.message || 'Failed to unlock GFC drawing.');
  }
};

/**
 * PUT /api/drawing-versions/:versionId/edit-in-place
 * In-place edit for Process DWG category only
 */
exports.editInPlaceProcessDwg = async (req, res) => {
  try {
    const { versionId } = req.params;
    const { updatedFilePath, changeLog } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only Admin or Super Admin can edit Process DWG in place.');
    }

    if (!updatedFilePath || !updatedFilePath.trim()) {
      return sendError(res, 400, 'updatedFilePath is required.');
    }

    const version = await DrawingVersion.findById(versionId);
    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const drawing = await Drawing.findById(version.drawingId).populate('categoryId');
    if (!drawing) {
      return sendError(res, 404, 'Parent drawing not found.');
    }

    // Verify Process DWG category restriction
    const isProcessDwg = (drawing.categoryName === 'Process DWG') ||
      (drawing.categoryId && drawing.categoryId.restrictedEditing);

    if (!isProcessDwg) {
      return sendError(res, 400, 'In-place file editing is restricted ONLY to Process DWG category drawings.');
    }

    const oldPath = version.filePath;
    version.filePath = updatedFilePath.trim();
    if (changeLog) version.changeLog = changeLog.trim();
    await version.save();

    if (drawing.currentVersionId && drawing.currentVersionId.toString() === version._id.toString()) {
      drawing.fileUrl = version.filePath;
      await drawing.save();
    }

    await DrawingVersionStatusHistory.create({
      drawingVersionId: version._id,
      fromStatus: version.status,
      toStatus: version.status,
      changedBy: userId,
      notes: `In-place edit Process DWG from ${oldPath} to ${version.filePath}`
    });

    return sendSuccess(res, 200, 'Process DWG file edited in place successfully.', { version });
  } catch (error) {
    console.error('Error during Process DWG in-place edit:', error);
    return sendError(res, 500, error.message || 'Failed to edit Process DWG in place.');
  }
};

/**
 * GET /api/drawing-versions/:versionId/client-approval-log
 */
exports.getClientApprovalLog = async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await DrawingVersion.findById(versionId);

    if (!version) {
      return sendError(res, 404, 'Drawing version not found.');
    }

    const approvalLogs = await ClientApprovalLog.find({ drawingId: version.drawingId })
      .populate('contactId', 'name email permissionLevel')
      .populate('clientId', 'companyName clientCode')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Client approval log retrieved successfully.', { approvalLogs });
  } catch (error) {
    console.error('Error fetching client approval log:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve client approval log.');
  }
};

/**
 * GET /api/projects/:projectId/drawings/breakdown
 */
exports.getProjectDrawingsBreakdown = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const drawings = await Drawing.find({ projectId, isActive: true });
    const totalDrawings = drawings.length;

    const approvedCount = drawings.filter(d => d.status === 'APPROVED').length;
    const pendingReviewCount = drawings.filter(d => ['DESIGNER_UPLOADED', 'PM_APPROVED'].includes(d.status)).length;
    const pendingClientApprovalCount = drawings.filter(d => d.status === 'PENDING_CLIENT_APPROVAL').length;
    const changesRequestedCount = drawings.filter(d => ['CHANGES_REQUESTED', 'PM_REJECTED', 'ADMIN_REJECTED'].includes(d.status)).length;

    return sendSuccess(res, 200, 'Project drawings breakdown retrieved successfully.', {
      projectId,
      totalDrawings,
      approvedCount,
      pendingReviewCount,
      pendingClientApprovalCount,
      changesRequestedCount,
      approvalRate: totalDrawings > 0 ? Math.round((approvedCount / totalDrawings) * 100) : 0
    });
  } catch (error) {
    console.error('Error fetching project drawings breakdown:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawings breakdown.');
  }
};
