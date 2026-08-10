const DocumentFolder = require('../models/DocumentFolder');
const Document = require('../models/Document');
const Project = require('../models/Project');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/projects/:projectId/document-folders/create
 * Create a new document folder for a project
 */
exports.createFolder = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { folderName } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!folderName || !folderName.trim()) {
      return sendError(res, 400, 'folderName is required.');
    }

    const project = await Project.findById(projectId);
    if (!project || !project.isActive) {
      return sendError(res, 404, 'Project not found.');
    }

    const folder = await DocumentFolder.create({
      projectId,
      folderName: folderName.trim(),
      createdBy: userId
    });

    return sendSuccess(res, 201, 'Document folder created successfully.', { folder });
  } catch (error) {
    console.error('Error creating document folder:', error);
    return sendError(res, 500, error.message || 'Failed to create document folder.');
  }
};

/**
 * GET /api/projects/:projectId/document-folders
 * Get active document folders for a project
 */
exports.getProjectFolders = async (req, res) => {
  try {
    const { projectId } = req.params;

    const folders = await DocumentFolder.find({ projectId, isActive: true })
      .populate('createdBy', 'name email designation')
      .sort({ folderName: 1 });

    return sendSuccess(res, 200, 'Project document folders retrieved.', { folders, count: folders.length });
  } catch (error) {
    console.error('Error fetching project document folders:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve document folders.');
  }
};

/**
 * PUT /api/document-folders/:id
 * Rename a document folder
 */
exports.updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { folderName } = req.body;

    if (!folderName || !folderName.trim()) {
      return sendError(res, 400, 'folderName is required.');
    }

    const folder = await DocumentFolder.findById(id);
    if (!folder || !folder.isActive) {
      return sendError(res, 404, 'Document folder not found.');
    }

    folder.folderName = folderName.trim();
    await folder.save();

    return sendSuccess(res, 200, 'Document folder updated successfully.', { folder });
  } catch (error) {
    console.error('Error updating document folder:', error);
    return sendError(res, 500, error.message || 'Failed to update document folder.');
  }
};

/**
 * DELETE /api/document-folders/:id
 * Soft-delete a document folder; documents inside move to root (folderId: null)
 */
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await DocumentFolder.findById(id);
    if (!folder || !folder.isActive) {
      return sendError(res, 404, 'Document folder not found.');
    }

    folder.isActive = false;
    await folder.save();

    // Reassign contained documents to root (folderId: null)
    await Document.updateMany(
      { folderId: id },
      { $set: { folderId: null } }
    );

    return sendSuccess(res, 200, 'Document folder deleted. Contained documents moved to Uncategorized root.', { folderId: id });
  } catch (error) {
    console.error('Error deleting document folder:', error);
    return sendError(res, 500, error.message || 'Failed to delete document folder.');
  }
};
