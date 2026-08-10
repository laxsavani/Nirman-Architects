const Document = require('../models/Document');
const ClientDocumentAccessLog = require('../models/ClientDocumentAccessLog');
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
 * GET /api/client/projects/:projectId/documents?folder=&search=
 * Returns project documents filtered to visibleToClient:true and grouped by category/folder.
 */
exports.getProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { folder, search } = req.query || {};
    const clientId = req.clientContact.clientId;

    // Security Isolation: Verify project is genuinely linked & visible to this Client
    const link = await verifyProjectLink(clientId, projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. This project is not linked or visible to your Client account.');
    }

    const filter = {
      projectId,
      visibleToClient: true,
      isDeleted: false
    };

    if (folder) {
      filter.category = folder.trim();
    }

    if (search && search.trim()) {
      filter.fileName = { $regex: search.trim(), $options: 'i' };
    }

    const documents = await Document.find(filter).sort({ createdAt: -1 });

    const grouped = {
      'Contracts': [],
      'Approved Drawings PDFs': [],
      'Photos': [],
      'Invoices': [],
      'Other Shared Documents': []
    };

    for (const doc of documents) {
      const cat = doc.category || 'Other Shared Documents';
      if (grouped[cat]) {
        grouped[cat].push(doc);
      } else {
        if (!grouped['Other Shared Documents']) {
          grouped['Other Shared Documents'] = [];
        }
        grouped['Other Shared Documents'].push(doc);
      }
    }

    return sendSuccess(res, 200, 'Client project documents retrieved successfully.', {
      documentsByFolder: grouped,
      totalCount: documents.length
    });
  } catch (error) {
    console.error('Error fetching client project documents:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve documents.');
  }
};

/**
 * GET /api/client/documents/:documentId/preview
 * Preview endpoint with dual security cascade check and VIEW action logging.
 */
exports.previewDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const clientId = req.clientContact.clientId;
    const contactId = req.clientContact.contactId;

    const document = await Document.findById(documentId);
    if (!document || document.isDeleted) {
      return sendError(res, 404, 'Document not found or no longer available.');
    }

    if (!document.visibleToClient) {
      return sendError(res, 403, 'Access denied. Document is not shared with client portal.');
    }

    // Dual Security Check: Parent project must be active & visible to client
    const link = await verifyProjectLink(clientId, document.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Parent project is not linked or visible to your Client account.');
    }

    // Audit Log Action
    await ClientDocumentAccessLog.create({
      clientId,
      contactId,
      documentId: document._id,
      projectId: document.projectId,
      action: 'VIEW'
    });

    return sendSuccess(res, 200, 'Document preview retrieved successfully.', {
      document,
      previewUrl: document.filePath,
      fileType: document.fileType
    });
  } catch (error) {
    console.error('Error previewing client document:', error);
    return sendError(res, 500, error.message || 'Failed to preview document.');
  }
};

/**
 * GET /api/client/documents/:documentId/download
 * Download endpoint with dual security cascade check and DOWNLOAD action logging.
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const clientId = req.clientContact.clientId;
    const contactId = req.clientContact.contactId;

    const document = await Document.findById(documentId);
    if (!document) {
      return sendError(res, 404, 'Document not found.');
    }

    if (document.isDeleted) {
      return sendError(res, 410, 'This document is no longer available.');
    }

    if (!document.visibleToClient) {
      return sendError(res, 403, 'Access denied. Document is not shared with client portal.');
    }

    // Dual Security Check: Parent project must be active & visible to client
    const link = await verifyProjectLink(clientId, document.projectId);
    if (!link) {
      return sendError(res, 403, 'Access denied. Parent project is not linked or visible to your Client account.');
    }

    // Audit Log Action
    await ClientDocumentAccessLog.create({
      clientId,
      contactId,
      documentId: document._id,
      projectId: document.projectId,
      action: 'DOWNLOAD'
    });

    return sendSuccess(res, 200, 'Document download ready.', {
      document,
      downloadUrl: document.filePath,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize
    });
  } catch (error) {
    console.error('Error downloading client document:', error);
    return sendError(res, 500, error.message || 'Failed to download document.');
  }
};
