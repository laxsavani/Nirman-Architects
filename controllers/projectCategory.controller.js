const ProjectCategory = require('../models/ProjectCategory');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/project-category/create
 * Create a dynamic project category (Admin / Super Admin)
 */
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user ? (req.user._id || req.user.id) : null;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Category name is required.');
    }

    const existing = await ProjectCategory.findOne({ name: name.trim() });
    if (existing) {
      return sendError(res, 400, 'Project category with this name already exists.');
    }

    const category = await ProjectCategory.create({
      name: name.trim(),
      createdBy: userId
    });

    return sendSuccess(res, 201, 'Project category created successfully.', { category });
  } catch (error) {
    console.error('Error creating project category:', error);
    return sendError(res, 500, error.message || 'Failed to create project category.');
  }
};

/**
 * GET /api/project-category/active
 * Get active project categories
 */
exports.getActiveCategories = async (req, res) => {
  try {
    const categories = await ProjectCategory.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Active project categories retrieved successfully.', { categories });
  } catch (error) {
    console.error('Error fetching project categories:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve project categories.');
  }
};

/**
 * PUT /api/project-category/:id/deactivate
 * Deactivate a project category
 */
exports.deactivateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await ProjectCategory.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!category) {
      return sendError(res, 404, 'Project category not found.');
    }
    return sendSuccess(res, 200, 'Project category deactivated successfully.', { category });
  } catch (error) {
    console.error('Error deactivating project category:', error);
    return sendError(res, 500, error.message || 'Failed to deactivate project category.');
  }
};
