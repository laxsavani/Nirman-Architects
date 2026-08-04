const User = require('../models/User');
const RoleMaster = require('../models/RoleMaster');
const Notification = require('../models/Notification');

/**
 * Creates a notification for all active Super Admins and HRs
 * @param {string} type - Notification type (e.g. 'AGENT_CLOSED', 'AGENT_TERMINATED')
 * @param {string} message - Notification text message
 */
async function notifyAdmins(type, message) {
  try {
    // Find Super Admin and HR roles
    const adminRoles = await RoleMaster.find({
      $or: [
        { roleCode: { $in: ['SUPER_ADMIN', 'HR', 'PROJECT_MANAGER'] } },
        { roleName: { $in: ['Super Admin', 'HR', 'Project Manager'] } }
      ]
    });

    const roleIds = adminRoles.map(r => r._id);

    // Find all active admins and HRs
    const admins = await User.find({
      $or: [
        { roleId: { $in: roleIds } },
        { roleCode: { $in: ['SUPER_ADMIN', 'HR'] } }
      ],
      isActive: true
    });

    if (!admins || admins.length === 0) return;

    const notifications = admins.map(admin => ({
      userId: admin._id,
      type,
      message,
      isRead: false
    }));

    await Notification.insertMany(notifications);
    console.log(`[Notification] Admin alert created for ${admins.length} admin(s): [${type}] ${message}`);
  } catch (err) {
    console.error('[Notification Error] Failed to notify admins:', err.message);
  }
}

module.exports = notifyAdmins;
