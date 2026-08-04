const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

// Seed default system roles
const DEFAULT_ROLES = [
  { roleName: 'Super Admin', roleCode: 'SUPER_ADMIN', description: 'Full system access' },
  { roleName: 'HR', roleCode: 'HR', description: 'HR and Payroll Management' },
  { roleName: 'Project Manager', roleCode: 'PROJECT_MANAGER', description: 'Manages projects & teams' },
  { roleName: 'Architect', roleCode: 'ARCHITECT', description: 'Design and architecture staff' },
  { roleName: 'Site Engineer', roleCode: 'SITE_ENGINEER', description: 'On-site engineering staff' },
  { roleName: 'Employee', roleCode: 'EMPLOYEE', description: 'Standard office staff' },
  { roleName: 'Client', roleCode: 'CLIENT', description: 'External client (CRM)', isActive: false }
];

async function seedDefaultRoles() {
  try {
    for (const r of DEFAULT_ROLES) {
      await RoleMaster.findOneAndUpdate(
        { roleCode: r.roleCode },
        { $setOnInsert: r },
        { upsert: true, returnDocument: 'after' }
      );
    }
  } catch (err) {
    console.error('Failed to seed default roles:', err);
  }
}

/**
 * Create a new dynamic RoleMaster entry
 */
exports.createRole = async (req, res) => {
  try {
    const { roleName, roleCode, description } = req.body;
    if (!roleName || !roleCode) {
      return sendError(res, 400, 'roleName and roleCode are required.');
    }

    const formattedCode = roleCode.toUpperCase().trim();
    const existing = await RoleMaster.findOne({ 
      $or: [{ roleCode: formattedCode }, { roleName: roleName.trim() }] 
    });

    if (existing) {
      return sendError(res, 400, 'Role with this name or code already exists.');
    }

    const newRole = await RoleMaster.create({
      roleName: roleName.trim(),
      roleCode: formattedCode,
      description: description || '',
      isActive: true
    });

    return sendSuccess(res, 201, 'Role created successfully.', newRole);
  } catch (error) {
    console.error('Error creating role:', error);
    return sendError(res, 500, error.message);
  }
};

/**
 * Get all roles
 */
exports.getAllRoles = async (req, res) => {
  try {
    // Ensure default roles are seeded
    await seedDefaultRoles();
    const roles = await RoleMaster.find().sort({ createdAt: 1 });
    return sendSuccess(res, 200, 'Roles retrieved successfully.', roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return sendError(res, 500, error.message);
  }
};

exports.seedDefaultRoles = seedDefaultRoles;
