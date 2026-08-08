const DrawingCategory = require('../models/DrawingCategory');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/drawing-category/create
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, requiresClientApproval, restrictedEditing } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Category name is required.');
    }

    const existing = await DrawingCategory.findOne({ name: name.trim() });
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        if (requiresClientApproval !== undefined) existing.requiresClientApproval = !!requiresClientApproval;
        if (restrictedEditing !== undefined) existing.restrictedEditing = !!restrictedEditing;
        await existing.save();
        return sendSuccess(res, 200, 'Drawing category reactivated successfully.', { category: existing });
      }
      return sendError(res, 400, `Drawing category "${name.trim()}" already exists.`);
    }

    const userId = req.user ? (req.user._id || req.user.id) : null;

    const category = await DrawingCategory.create({
      name: name.trim(),
      requiresClientApproval: requiresClientApproval !== undefined ? !!requiresClientApproval : true,
      restrictedEditing: restrictedEditing !== undefined ? !!restrictedEditing : false,
      createdBy: userId
    });

    return sendSuccess(res, 201, 'Drawing category created successfully.', { category });
  } catch (error) {
    console.error('Error creating drawing category:', error);
    return sendError(res, 500, error.message || 'Failed to create drawing category.');
  }
};

/**
 * GET /api/drawing-category/active
 */
exports.getActiveCategories = async (req, res) => {
  try {
    let categories = await DrawingCategory.find({ isActive: true }).sort({ name: 1 });

    // Seed default categories if none exist
    if (categories.length === 0) {
      const defaults = [
        { name: 'Concept Drawings', requiresClientApproval: true, restrictedEditing: false },
        { name: 'Working Drawings', requiresClientApproval: true, restrictedEditing: false },
        { name: 'Process DWG', requiresClientApproval: false, restrictedEditing: true },
        { name: 'GFC Drawings', requiresClientApproval: false, restrictedEditing: false },
        { name: 'Site', requiresClientApproval: true, restrictedEditing: false },
        { name: 'Interior Drawings', requiresClientApproval: true, restrictedEditing: false }
      ];

      categories = await DrawingCategory.insertMany(defaults);
    }

    return sendSuccess(res, 200, 'Active drawing categories retrieved successfully.', { categories });
  } catch (error) {
    console.error('Error fetching drawing categories:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve drawing categories.');
  }
};

/**
 * PUT /api/drawing-category/:id/deactivate
 */
exports.deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await DrawingCategory.findById(id);

    if (!category || !category.isActive) {
      return sendError(res, 404, 'Drawing category not found or already inactive.');
    }

    category.isActive = false;
    await category.save();

    return sendSuccess(res, 200, 'Drawing category deactivated successfully.', { category });
  } catch (error) {
    console.error('Error deactivating drawing category:', error);
    return sendError(res, 500, error.message || 'Failed to deactivate drawing category.');
  }
};
