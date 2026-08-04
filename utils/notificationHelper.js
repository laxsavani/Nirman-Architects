const User = require('../models/User');
const Notification = require('../models/Notification');
const { isHR } = require('./roles');

/**
 * Reusable helper to send system notification to a specific user.
 * 
 * @param {string|mongoose.Types.ObjectId} recipientId
 * @param {string} type 'CORRECTION_RAISED' | 'SECURITY_ALERT' | 'GEOFENCE_REJECTED' | 'DAILY_SUMMARY'
 * @param {string} title
 * @param {string} message
 * @param {object} metadata
 */
const notifyUser = async (recipientId, type, title, message, metadata = {}) => {
  try {
    return await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      metadata
    });
  } catch (error) {
    console.error(`[-] Failed to dispatch notification to user ${recipientId}:`, error.message);
  }
};

/**
 * Reusable helper to send notification to all HR & Admin users.
 * 
 * @param {string} type 'CORRECTION_RAISED' | 'SECURITY_ALERT' | 'GEOFENCE_REJECTED' | 'DAILY_SUMMARY'
 * @param {string} title
 * @param {string} message
 * @param {object} metadata
 */
const notifyAdminsAndHR = async (type, title, message, metadata = {}) => {
  try {
    const hrUsers = await User.find().populate('role');
    const notificationPromises = [];

    for (const u of hrUsers) {
      if (u.role && isHR(u.role.name)) {
        notificationPromises.push(
          Notification.create({
            recipient: u._id,
            type,
            title,
            message,
            metadata
          })
        );
      }
    }

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('[-] Failed to dispatch HR notification:', error.message);
  }
};

module.exports = {
  notifyUser,
  notifyAdminsAndHR
};
