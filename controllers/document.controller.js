const Document = require('../models/Document');
const ClientDocumentAccessLog = require('../models/ClientDocumentAccessLog');
const ClientProjectLink = require('../models/ClientProjectLink');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/documents/:documentId/client-access-log
 * Internal view: list who viewed/downloaded a document and when.
 */
exports.getDocumentAccessLog = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findById(documentId);
    if (!document) {
      return sendError(res, 404, 'Document not found.');
    }

    const logs = await ClientDocumentAccessLog.find({ documentId })
      .populate('contactId', 'name email phone permissionLevel')
      .populate('clientId', 'name companyName')
      .sort({ accessedAt: -1 });

    return sendSuccess(res, 200, 'Document access logs retrieved successfully.', {
      documentId: document._id,
      fileName: document.fileName,
      category: document.category,
      visibleToClient: document.visibleToClient,
      logs
    });
  } catch (error) {
    console.error('Error fetching document access logs:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve access logs.');
  }
};

/**
 * GET /api/documents/client-engagement/:clientId?projectId=
 * Internal aggregate engagement summary view for a client.
 */
exports.getClientEngagementSummary = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { projectId } = req.query;

    // Get linked project IDs for this client
    const linkFilter = { clientId, isActive: true, visibleToClient: true };
    if (projectId) {
      linkFilter.projectId = projectId;
    }

    const activeLinks = await ClientProjectLink.find(linkFilter);
    const projectIds = activeLinks.map(l => l.projectId);

    // Fetch all client-visible documents for these projects
    const sharedDocuments = await Document.find({
      projectId: { $in: projectIds },
      visibleToClient: true,
      isDeleted: false
    });

    const sharedDocIds = sharedDocuments.map(d => d._id);

    // Fetch all access logs for this client
    const logs = await ClientDocumentAccessLog.find({
      clientId,
      documentId: { $in: sharedDocIds }
    });

    const accessedDocIds = new Set(logs.map(l => l.documentId.toString()));
    const viewedDocIds = new Set(logs.filter(l => l.action === 'VIEW').map(l => l.documentId.toString()));
    const downloadedDocIds = new Set(logs.filter(l => l.action === 'DOWNLOAD').map(l => l.documentId.toString()));

    const engagedDocuments = [];
    const neverOpenedDocuments = [];

    for (const doc of sharedDocuments) {
      const idStr = doc._id.toString();
      const hasViewed = viewedDocIds.has(idStr);
      const hasDownloaded = downloadedDocIds.has(idStr);

      if (hasViewed || hasDownloaded) {
        engagedDocuments.push({
          documentId: doc._id,
          fileName: doc.fileName,
          category: doc.category,
          hasViewed,
          hasDownloaded
        });
      } else {
        neverOpenedDocuments.push({
          documentId: doc._id,
          fileName: doc.fileName,
          category: doc.category,
          uploadedAt: doc.createdAt
        });
      }
    }

    return sendSuccess(res, 200, 'Client document engagement summary retrieved successfully.', {
      clientId,
      totalSharedDocumentsCount: sharedDocuments.length,
      engagedCount: engagedDocuments.length,
      neverOpenedCount: neverOpenedDocuments.length,
      engagedDocuments,
      neverOpenedDocuments
    });
  } catch (error) {
    console.error('Error retrieving client document engagement summary:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve engagement summary.');
  }
};
