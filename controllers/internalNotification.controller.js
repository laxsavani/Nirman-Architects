const InternalNotification = require('../models/InternalNotification');
const InternalNotificationPreference = require('../models/InternalNotificationPreference');
const EmployeeDeviceToken = require('../models/EmployeeDeviceToken');
const InternalNotificationDeliveryLog = require('../models/InternalNotificationDeliveryLog');
const RoleMaster = require('../models/RoleMaster');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Helper to get user role code
 */
async function getUserRoleCode(user) {
  if (!user) return '';
  if (user.roleId && typeof user.roleId === 'object' && user.roleId.roleCode) {
    return user.roleId.roleCode;
  }
  if (user.roleId) {
    const role = await RoleMaster.findById(user.roleId);
    return role ? role.roleCode : '';
  }
  return '';
}

/**
 * GET /api/notifications/my
 * Get caller's In-App notification list (Notification Center)
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { isRead, page = 1, limit = 20 } = req.query;

    const filter = { userId };
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await InternalNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await InternalNotification.countDocuments(filter);
    const unreadCount = await InternalNotification.countDocuments({ userId, isRead: false });

    return sendSuccess(res, 200, 'Employee notifications retrieved successfully.', {
      notifications,
      unreadCount,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching employee notifications:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve notifications.');
  }
};

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const unreadCount = await InternalNotification.countDocuments({ userId, isRead: false });

    return sendSuccess(res, 200, 'Unread notification count retrieved successfully.', { unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve unread count.');
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark single notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.id;

    const notification = await InternalNotification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 404, 'Notification record not found.');
    }

    return sendSuccess(res, 200, 'Notification marked as read.', { notification });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return sendError(res, 500, error.message || 'Failed to mark notification read.');
  }
};

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for calling user
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const result = await InternalNotification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return sendSuccess(res, 200, 'All notifications marked as read.', {
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return sendError(res, 500, error.message || 'Failed to mark notifications read.');
  }
};

/**
 * GET /api/notifications/preferences
 * Get employee notification preferences
 */
exports.getPreferences = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    let prefs = await InternalNotificationPreference.findOne({ userId });
    if (!prefs) {
      prefs = await InternalNotificationPreference.create({
        userId,
        pushEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false
      });
    }

    return sendSuccess(res, 200, 'Notification preferences retrieved successfully.', { preferences: prefs });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve notification preferences.');
  }
};

/**
 * PUT /api/notifications/preferences
 * Update employee notification channel preferences
 */
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { pushEnabled, emailEnabled, whatsappEnabled } = req.body;

    const updateFields = {};
    if (pushEnabled !== undefined) updateFields.pushEnabled = Boolean(pushEnabled);
    if (emailEnabled !== undefined) updateFields.emailEnabled = Boolean(emailEnabled);
    if (whatsappEnabled !== undefined) updateFields.whatsappEnabled = Boolean(whatsappEnabled);

    const prefs = await InternalNotificationPreference.findOneAndUpdate(
      { userId },
      updateFields,
      { new: true, upsert: true }
    );

    return sendSuccess(res, 200, 'Notification preferences updated successfully.', { preferences: prefs });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return sendError(res, 500, error.message || 'Failed to update notification preferences.');
  }
};

/**
 * POST /api/notifications/register-device
 * Register employee push device token
 */
exports.registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { platform = 'ANDROID', deviceToken } = req.body;

    if (!deviceToken) {
      return sendError(res, 400, 'deviceToken is required.');
    }

    const tokenDoc = await EmployeeDeviceToken.findOneAndUpdate(
      { deviceToken },
      { userId, platform: platform.toUpperCase(), isActive: true, registeredAt: new Date() },
      { upsert: true, new: true }
    );

    return sendSuccess(res, 200, 'Employee device token registered successfully.', { token: tokenDoc });
  } catch (error) {
    console.error('Error registering device token:', error);
    return sendError(res, 500, error.message || 'Failed to register device token.');
  }
};

/**
 * DELETE /api/notifications/unregister-device
 * Unregister employee push device token
 */
exports.unregisterDeviceToken = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return sendError(res, 400, 'deviceToken is required.');
    }

    await EmployeeDeviceToken.findOneAndUpdate(
      { deviceToken, userId },
      { isActive: false }
    );

    return sendSuccess(res, 200, 'Employee device token unregistered successfully.');
  } catch (error) {
    console.error('Error unregistering device token:', error);
    return sendError(res, 500, error.message || 'Failed to unregister device token.');
  }
};

/**
 * GET /api/notifications/:notificationId/delivery-log
 * Admin/Super Admin delivery debugging log
 */
exports.getDeliveryLog = async (req, res) => {
  try {
    const roleCode = await getUserRoleCode(req.user);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return sendError(res, 403, 'Access denied. Admin privileges required.');
    }

    const { notificationId } = req.params;
    const logs = await InternalNotificationDeliveryLog.find({ notificationId }).sort({ attemptedAt: 1 });

    return sendSuccess(res, 200, 'Delivery logs retrieved successfully.', { logs });
  } catch (error) {
    console.error('Error fetching delivery log:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve delivery logs.');
  }
};
