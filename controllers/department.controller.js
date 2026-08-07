const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/department/create
 * Create a department (Admin / Super Admin)
 */
exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Department name is required.');
    }

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return sendError(res, 400, 'Department with this name already exists.');
    }

    const department = await Department.create({ name: name.trim() });
    return sendSuccess(res, 201, 'Department created successfully.', { department });
  } catch (error) {
    console.error('Error creating department:', error);
    return sendError(res, 500, error.message || 'Failed to create department.');
  }
};

/**
 * GET /api/department/active
 * Get active departments
 */
exports.getActiveDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, 200, 'Active departments retrieved successfully.', { departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve departments.');
  }
};
