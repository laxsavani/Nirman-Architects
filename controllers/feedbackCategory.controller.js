const FeedbackCategory = require('../models/FeedbackCategory');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/feedback-category/create
 * Creates a new feedback rating category (Super Admin / Admin).
 */
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const adminUserId = req.user ? (req.user.id || req.user._id) : null;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Category name is required.');
    }

    const cleanName = name.trim();
    const existing = await FeedbackCategory.findOne({ name: new RegExp(`^${cleanName}$`, 'i') });
    if (existing) {
      return sendError(res, 400, `Feedback category '${cleanName}' already exists.`);
    }

    const category = await FeedbackCategory.create({
      name: cleanName,
      isActive: true,
      createdBy: adminUserId
    });

    return sendSuccess(res, 201, 'Feedback category created successfully.', { category });
  } catch (error) {
    console.error('Error creating feedback category:', error);
    return sendError(res, 500, error.message || 'Failed to create feedback category.');
  }
};

/**
 * PUT /api/feedback-category/:id/deactivate
 * Toggles active state of a feedback category (Super Admin / Admin).
 */
exports.toggleCategoryActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const category = await FeedbackCategory.findById(id);
    if (!category) {
      return sendError(res, 404, 'Feedback category not found.');
    }

    category.isActive = typeof isActive === 'boolean' ? isActive : !category.isActive;
    await category.save();

    return sendSuccess(res, 200, `Feedback category ${category.isActive ? 'activated' : 'deactivated'} successfully.`, { category });
  } catch (error) {
    console.error('Error toggling feedback category active state:', error);
    return sendError(res, 500, error.message || 'Failed to update feedback category.');
  }
};

/**
 * GET /api/feedback-category/active
 * Returns all active feedback categories for rendering feedback forms.
 */
exports.getActiveCategories = async (req, res) => {
  try {
    const categories = await FeedbackCategory.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Active feedback categories retrieved successfully.', {
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error('Error fetching active feedback categories:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve feedback categories.');
  }
};
