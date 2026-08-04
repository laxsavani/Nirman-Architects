const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get logged-in user notifications.
 */
exports.getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notifications = await Notification.find({
      $or: [{ userId }, { recipient: userId }]
    }).sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      $or: [{ userId }, { recipient: userId }],
      isRead: false
    });

    return sendSuccess(res, 200, 'Notifications retrieved successfully.', {
      unreadCount,
      notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read.
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      $or: [{ userId }, { recipient: userId }]
    });

    if (!notification) {
      return sendError(res, 404, 'Notification not found.');
    }

    notification.isRead = true;
    await notification.save();

    return sendSuccess(res, 200, 'Notification marked as read.', notification);
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = exports.getMyNotifications;
