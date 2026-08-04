const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const { sendError } = require('../utils/response');

/**
 * Middleware to strictly block tracking requests for Super Admin users
 */
module.exports = async function blockSuperAdminTracking(req, res, next) {
  try {
    const userId = (req.user && (req.user.userId || req.user.id || req.user._id)) || req.body.userId;
    if (!userId) {
      return next();
    }

    const user = await User.findById(userId).populate('roleId');
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    let roleCode = user.roleCode || req.user?.roleCode;
    if (!roleCode && user.roleId) {
      const roleDoc = typeof user.roleId === 'object' ? user.roleId : await RoleMaster.findById(user.roleId);
      if (roleDoc) roleCode = roleDoc.roleCode || roleDoc.roleName;
    }

    if (roleCode && String(roleCode).toUpperCase() === 'SUPER_ADMIN') {
      console.warn(`[BlockSuperAdminTracking] Rejected tracking sync attempt for Super Admin ${user.email} (${userId}).`);
      return sendError(res, 403, 'Super Admin users are strictly excluded from all tracking/monitoring modules.');
    }

    next();
  } catch (error) {
    console.error('Error in blockSuperAdminTracking middleware:', error);
    next(error);
  }
};
