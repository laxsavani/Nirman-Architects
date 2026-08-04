const RoleMaster = require('../models/RoleMaster');
const { sendError } = require('../utils/response');

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param {Array<string>} allowedRoleCodes Array of allowed role codes (e.g. ['SUPER_ADMIN', 'HR'])
 */
module.exports = (allowedRoleCodes = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendError(res, 401, 'Unauthorized access.');
      }

      let userRoleCode = req.user.roleCode || req.user.role;

      // If user has roleId as an ObjectId, resolve roleCode from RoleMaster
      if (!userRoleCode && req.user.roleId) {
        const roleDoc = await RoleMaster.findById(req.user.roleId);
        if (roleDoc) {
          userRoleCode = roleDoc.roleCode || roleDoc.roleName;
        }
      }

      if (!userRoleCode) {
        return sendError(res, 403, 'Access denied. Role not assigned.');
      }

      const normalizedUserRole = userRoleCode.toUpperCase();
      const normalizedAllowed = allowedRoleCodes.map(r => r.toUpperCase());

      // If SUPER_ADMIN is allowed, or exact role matches
      if (normalizedAllowed.includes(normalizedUserRole) || normalizedUserRole === 'SUPER_ADMIN') {
        req.user.roleCode = normalizedUserRole;
        return next();
      }

      return sendError(res, 403, `Access denied. Requires one of roles: ${allowedRoleCodes.join(', ')}`);
    } catch (error) {
      console.error('Role middleware error:', error);
      return sendError(res, 500, 'Server error validating permissions.');
    }
  };
};
