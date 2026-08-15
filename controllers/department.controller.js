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

const Task = require('../models/Task');

/**
 * GET /api/departments (supports ?includeInactive=true)
 */
exports.getDepartments = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const filter = includeInactive ? {} : { isActive: true };

    const departments = await Department.find(filter).sort({ name: 1 });
    return sendSuccess(res, 200, 'Departments retrieved successfully.', { departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve departments.');
  }
};

/**
 * GET /api/department/active
 * Alias for active departments
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

/**
 * PUT /api/departments/:id
 * Update Department Name (Admin / Super Admin)
 */
exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Department name is required.');
    }

    const department = await Department.findById(id);
    if (!department) {
      return sendError(res, 404, 'Department not found.');
    }

    const duplicate = await Department.findOne({ _id: { $ne: id }, name: name.trim() });
    if (duplicate) {
      return sendError(res, 400, 'Another department with this name already exists.');
    }

    department.name = name.trim();
    await department.save();

    return sendSuccess(res, 200, 'Department updated successfully.', { department });
  } catch (error) {
    console.error('Error updating department:', error);
    return sendError(res, 500, error.message || 'Failed to update department.');
  }
};

/**
 * DELETE /api/departments/:id
 * Soft Delete Department (Admin / Super Admin)
 */
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      return sendError(res, 404, 'Department not found.');
    }

    department.isActive = false;
    await department.save();

    const activeReferencesCount = await Task.countDocuments({ departmentId: id, isActive: true });

    return sendSuccess(res, 200, 'Department soft-deleted successfully.', {
      deletedDepartment: department,
      activeReferencesCount
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    return sendError(res, 500, error.message || 'Failed to delete department.');
  }
};
