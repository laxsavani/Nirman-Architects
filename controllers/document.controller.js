const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentFolder = require('../models/DocumentFolder');
const DocumentAccessLog = require('../models/DocumentAccessLog');
const Project = require('../models/Project');
const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

const SUPPORTED_FILE_TYPES = ['PDF', 'DWG', 'JPEG', 'PNG', 'DOCX', 'XLSX', 'ZIP'];

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
 * Helper to check role restriction
 */
async function checkRoleRestriction(user, document) {
  if (!document || !Array.isArray(document.restrictedToRoles) || document.restrictedToRoles.length === 0) {
    return true; // No restriction
  }
  const roleCode = await getUserRoleCode(user);
  if (['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
    return true; // Admin bypass
  }
  return document.restrictedToRoles.includes(roleCode);
}

/**
 * POST /api/documents/upload
 * Create document & upload initial version v1 (visibleToClient defaults to false)
 */
exports.uploadDocument = async (req, res) => {
  try {
    const { projectId, folderId, documentName, fileName, filePath, fileType, fileSizeKB, restrictedToRoles } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const nameToUse = (documentName || fileName || '').trim();
    if (!nameToUse) {
      return sendError(res, 400, 'documentName or fileName is required.');
    }

    const typeUpper = (fileType || '').toUpperCase().trim();
    if (!SUPPORTED_FILE_TYPES.includes(typeUpper)) {
      return sendError(res, 400, `Unsupported file type '${fileType}'. Supported types are: ${SUPPORTED_FILE_TYPES.join(', ')}.`);
    }

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    if (folderId) {
      const folder = await DocumentFolder.findById(folderId);
      if (!folder || !folder.isActive) {
        return sendError(res, 404, 'Document folder not found.');
      }
    }

    const pathVal = filePath || `/storage/documents/${projectId}/${folderId || 'root'}/${Date.now()}_${nameToUse.replace(/\s+/g, '_')}`;

    // Create Document record
    const document = await Document.create({
      projectId,
      folderId: folderId || null,
      documentName: nameToUse,
      fileName: nameToUse,
      filePath: pathVal,
      fileType: typeUpper,
      fileSize: fileSizeKB || 0,
      fileSizeKB: fileSizeKB || 0,
      visibleToClient: false, // Default opt-IN
      restrictedToRoles: Array.isArray(restrictedToRoles) ? restrictedToRoles : [],
      createdBy: userId,
      uploadedBy: userId,
      version: 1
    });

    // Create DocumentVersion v1
    const version = await DocumentVersion.create({
      documentId: document._id,
      versionNumber: 1,
      filePath: pathVal,
      fileSizeKB: fileSizeKB || 0,
      uploadedBy: userId,
      uploadDate: new Date(),
      changeLog: 'Initial upload'
    });

    document.currentVersionId = version._id;
    await document.save();

    const populatedDoc = await Document.findById(document._id)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation');

    return sendSuccess(res, 201, 'Document uploaded successfully.', { document: populatedDoc });
  } catch (error) {
    console.error('Error uploading document:', error);
    return sendError(res, 500, error.message || 'Failed to upload document.');
  }
};

/**
 * POST /api/documents/:id/versions/upload
 * Upload new document version (Auto-increments version, RESETS visibleToClient to false)
 */
exports.uploadDocumentVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { filePath, fileSizeKB, changeLog } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const document = await Document.findById(id);
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    const versionCount = await DocumentVersion.countDocuments({ documentId: id });
    const newVersionNumber = versionCount + 1;

    const pathVal = filePath || `/storage/documents/${document.projectId}/${document.folderId || 'root'}/${document._id}_v${newVersionNumber}_${document.documentName.replace(/\s+/g, '_')}`;

    const newVersion = await DocumentVersion.create({
      documentId: id,
      versionNumber: newVersionNumber,
      filePath: pathVal,
      fileSizeKB: fileSizeKB || document.fileSizeKB || 0,
      uploadedBy: userId,
      uploadDate: new Date(),
      changeLog: changeLog || `Version ${newVersionNumber} upload`
    });

    // Update parent document & RESET visibleToClient to false
    document.currentVersionId = newVersion._id;
    document.version = newVersionNumber;
    document.filePath = pathVal;
    document.visibleToClient = false; // CRITICAL RESET RULE
    await document.save();

    const populatedDoc = await Document.findById(id)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation');

    return sendSuccess(res, 201, `Document version v${newVersionNumber} uploaded successfully. Client visibility reset to false.`, { document: populatedDoc, version: newVersion });
  } catch (error) {
    console.error('Error uploading document version:', error);
    return sendError(res, 500, error.message || 'Failed to upload document version.');
  }
};

/**
 * GET /api/projects/:projectId/documents
 * Internal document list for a project
 */
exports.getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { folderId, search, fileType } = req.query;

    const filter = { projectId, isDeleted: false, isActive: true };

    if (folderId !== undefined) {
      if (folderId === 'null' || folderId === '' || folderId === 'root') {
        filter.folderId = null;
      } else {
        filter.folderId = folderId;
      }
    }

    if (fileType) {
      filter.fileType = fileType.toUpperCase();
    }

    if (search && search.trim()) {
      filter.documentName = { $regex: search.trim(), $options: 'i' };
    }

    const rawDocuments = await Document.find(filter)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation')
      .sort({ createdAt: -1 });

    // Filter restricted documents based on caller role
    const documents = [];
    for (const doc of rawDocuments) {
      const allowed = await checkRoleRestriction(req.user, doc);
      if (allowed) {
        documents.push(doc);
      }
    }

    return sendSuccess(res, 200, 'Project documents retrieved successfully.', { documents, totalCount: documents.length });
  } catch (error) {
    console.error('Error fetching project documents:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project documents.');
  }
};

/**
 * GET /api/documents/:id
 * Get document detail + version history list
 */
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation');

    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    const allowed = await checkRoleRestriction(req.user, document);
    if (!allowed) {
      return sendError(res, 403, 'Access denied. Document is restricted to specific roles.');
    }

    const versionHistory = await DocumentVersion.find({ documentId: id })
      .populate('uploadedBy', 'name email designation')
      .sort({ versionNumber: -1 });

    return sendSuccess(res, 200, 'Document detail retrieved successfully.', { document, versionHistory });
  } catch (error) {
    console.error('Error fetching document by ID:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve document details.');
  }
};

/**
 * PUT /api/documents/:id
 * Update document metadata (name, folder, restrictedToRoles)
 */
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentName, fileName, folderId, restrictedToRoles } = req.body;

    const document = await Document.findById(id);
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    if (documentName && documentName.trim()) {
      document.documentName = documentName.trim();
      document.fileName = documentName.trim();
    } else if (fileName && fileName.trim()) {
      document.documentName = fileName.trim();
      document.fileName = fileName.trim();
    }

    if (folderId !== undefined) {
      if (folderId === null || folderId === 'null' || folderId === '') {
        document.folderId = null;
      } else {
        const folder = await DocumentFolder.findById(folderId);
        if (!folder || !folder.isActive) {
          return sendError(res, 404, 'Target document folder not found.');
        }
        document.folderId = folderId;
      }
    }

    if (Array.isArray(restrictedToRoles)) {
      document.restrictedToRoles = restrictedToRoles;
    }

    await document.save();

    const populatedDoc = await Document.findById(id)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation');

    return sendSuccess(res, 200, 'Document updated successfully.', { document: populatedDoc });
  } catch (error) {
    console.error('Error updating document:', error);
    return sendError(res, 500, error.message || 'Failed to update document.');
  }
};

/**
 * DELETE /api/documents/:id
 * Soft-delete a document
 */
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findById(id);
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    document.isDeleted = true;
    document.isActive = false;
    await document.save();

    return sendSuccess(res, 200, 'Document soft-deleted successfully.', { documentId: id });
  } catch (error) {
    console.error('Error deleting document:', error);
    return sendError(res, 500, error.message || 'Failed to delete document.');
  }
};

/**
 * PUT /api/documents/:id/visibility
 * PM/Admin toggle visibleToClient flag (The CRM Module 6 handoff control)
 */
exports.toggleClientVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { visibleToClient } = req.body;
    const roleCode = await getUserRoleCode(req.user);

    // Permission check: PM, ADMIN, SUPER_ADMIN
    if (!['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only PMs and Admins can toggle client document visibility.');
    }

    if (typeof visibleToClient !== 'boolean') {
      return sendError(res, 400, 'visibleToClient boolean parameter is required.');
    }

    const document = await Document.findById(id);
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    document.visibleToClient = visibleToClient;
    await document.save();

    return sendSuccess(res, 200, `Document client visibility updated to ${visibleToClient}.`, {
      documentId: id,
      visibleToClient: document.visibleToClient
    });
  } catch (error) {
    console.error('Error toggling document client visibility:', error);
    return sendError(res, 500, error.message || 'Failed to update document visibility.');
  }
};

/**
 * GET /api/documents/:id/preview
 * Preview document file & log VIEW in DocumentAccessLog
 */
exports.previewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const document = await Document.findById(id).populate('currentVersionId');
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    const allowed = await checkRoleRestriction(req.user, document);
    if (!allowed) {
      return sendError(res, 403, 'Access denied. Document is restricted to specific roles.');
    }

    // Log internal VIEW action
    await DocumentAccessLog.create({
      userId,
      documentId: id,
      projectId: document.projectId,
      action: 'VIEW',
      accessedAt: new Date()
    });

    const activeVersion = document.currentVersionId || {};

    return sendSuccess(res, 200, 'Document preview retrieved.', {
      documentId: document._id,
      documentName: document.documentName,
      fileType: document.fileType,
      filePath: activeVersion.filePath || document.filePath,
      versionNumber: activeVersion.versionNumber || document.version,
      previewUrl: activeVersion.filePath || document.filePath
    });
  } catch (error) {
    console.error('Error previewing document:', error);
    return sendError(res, 500, error.message || 'Failed to preview document.');
  }
};

/**
 * GET /api/documents/:id/download
 * Download document file & log DOWNLOAD in DocumentAccessLog
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    const document = await Document.findById(id).populate('currentVersionId');
    if (!document || document.isDeleted || !document.isActive) {
      return sendError(res, 404, 'Document not found.');
    }

    const allowed = await checkRoleRestriction(req.user, document);
    if (!allowed) {
      return sendError(res, 403, 'Access denied. Document is restricted to specific roles.');
    }

    // Log internal DOWNLOAD action
    await DocumentAccessLog.create({
      userId,
      documentId: id,
      projectId: document.projectId,
      action: 'DOWNLOAD',
      accessedAt: new Date()
    });

    const activeVersion = document.currentVersionId || {};

    return sendSuccess(res, 200, 'Document download authorized.', {
      documentId: document._id,
      documentName: document.documentName,
      fileType: document.fileType,
      filePath: activeVersion.filePath || document.filePath,
      versionNumber: activeVersion.versionNumber || document.version,
      downloadUrl: activeVersion.filePath || document.filePath
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    return sendError(res, 500, error.message || 'Failed to download document.');
  }
};

/**
 * GET /api/projects/:projectId/documents/search
 * Search documents by filename, folder, fileType, date range
 */
exports.searchDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { q, fileType, dateFrom, dateTo } = req.query;

    const filter = { projectId, isDeleted: false, isActive: true };

    if (q && q.trim()) {
      filter.documentName = { $regex: q.trim(), $options: 'i' };
    }

    if (fileType) {
      filter.fileType = fileType.toUpperCase();
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const rawDocuments = await Document.find(filter)
      .populate('currentVersionId')
      .populate('folderId', 'folderName')
      .populate('createdBy', 'name email designation')
      .sort({ createdAt: -1 });

    const documents = [];
    for (const doc of rawDocuments) {
      const allowed = await checkRoleRestriction(req.user, doc);
      if (allowed) documents.push(doc);
    }

    return sendSuccess(res, 200, 'Document search results retrieved.', { documents, totalCount: documents.length });
  } catch (error) {
    console.error('Error searching documents:', error);
    return sendError(res, 500, error.message || 'Failed to search documents.');
  }
};

const ClientDocumentAccessLog = require('../models/ClientDocumentAccessLog');
const ClientProjectLink = require('../models/ClientProjectLink');

/**
 * GET /api/documents/:id/access-log
 * Internal PM/Admin view of document access audit history (internal + client)
 */
exports.getDocumentAccessLog = async (req, res) => {
  try {
    const docId = req.params.id || req.params.documentId;
    const roleCode = await getUserRoleCode(req.user);

    if (req.user && !['PROJECT_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Only PMs and Admins can view access logs.');
    }

    const internalLogs = await DocumentAccessLog.find({ documentId: docId })
      .populate('userId', 'name email designation department')
      .sort({ accessedAt: -1 });

    const clientLogs = await ClientDocumentAccessLog.find({ documentId: docId })
      .populate('contactId', 'name email permissionLevel')
      .sort({ accessedAt: -1 });

    const logs = [...internalLogs, ...clientLogs];

    return sendSuccess(res, 200, 'Document access logs retrieved.', {
      logs,
      totalCount: logs.length,
      internalLogs,
      clientLogs
    });
  } catch (error) {
    console.error('Error fetching document access logs:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve access logs.');
  }
};

/**
 * GET /api/documents/client/:clientId/engagement-summary
 * Summary of client document engagement (engaged vs never opened)
 */
exports.getClientEngagementSummary = async (req, res) => {
  try {
    const { clientId } = req.params;

    const links = await ClientProjectLink.find({ clientId, isActive: true, visibleToClient: true });
    const projectIds = links.map(l => l.projectId);

    const sharedDocs = await Document.find({
      projectId: { $in: projectIds },
      visibleToClient: true,
      isDeleted: false
    });

    const docIds = sharedDocs.map(d => d._id);

    const accessLogs = await ClientDocumentAccessLog.find({ documentId: { $in: docIds } });
    const accessedMap = new Set(accessLogs.map(l => l.documentId.toString()));

    const engagedDocuments = [];
    const neverOpenedDocuments = [];

    for (const doc of sharedDocs) {
      if (accessedMap.has(doc._id.toString())) {
        engagedDocuments.push(doc);
      } else {
        neverOpenedDocuments.push(doc);
      }
    }

    return sendSuccess(res, 200, 'Client document engagement summary retrieved.', {
      totalSharedDocumentsCount: sharedDocs.length,
      engagedCount: engagedDocuments.length,
      neverOpenedCount: neverOpenedDocuments.length,
      engagedDocuments,
      neverOpenedDocuments
    });
  } catch (error) {
    console.error('Error retrieving client engagement summary:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve client engagement summary.');
  }
};
