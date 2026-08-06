const ClientNotification = require('../models/ClientNotification');
const ClientNotificationPreference = require('../models/ClientNotificationPreference');
const ClientDeviceToken = require('../models/ClientDeviceToken');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/client/notifications/my?isRead=&page=1&limit=20
 * Returns paginated notifications for calling client contact.
 */
exports.getMyNotifications = async (req, res) => {
  try {
    const { contactId } = req.clientContact;
    const { isRead, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const filter = { contactId };
    if (typeof isRead !== 'undefined') {
      filter.isRead = isRead === 'true' || isRead === true;
    }

    const totalCount = await ClientNotification.countDocuments(filter);
    const notifications = await ClientNotification.find(filter)
      .populate('projectId', 'name projectNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const unreadCount = await ClientNotification.countDocuments({ contactId, isRead: false });

    return sendSuccess(res, 200, 'Notifications retrieved successfully.', {
      totalCount,
      unreadCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      notifications
    });
  } catch (error) {
    console.error('Error fetching client notifications:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve notifications.');
  }
};

/**
 * GET /api/client/notifications/unread-count
 * Returns unread notification count for bell badge.
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const { contactId } = req.clientContact;
    const unreadCount = await ClientNotification.countDocuments({ contactId, isRead: false });

    return sendSuccess(res, 200, 'Unread notification count retrieved successfully.', { unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve unread count.');
  }
};

/**
 * PUT /api/client/notifications/:id/read
 * Marks a single notification as read.
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { contactId } = req.clientContact;

    const notification = await ClientNotification.findOne({ _id: id, contactId });
    if (!notification) {
      return sendError(res, 404, 'Notification not found.');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    const unreadCount = await ClientNotification.countDocuments({ contactId, isRead: false });

    return sendSuccess(res, 200, 'Notification marked as read.', { notification, unreadCount });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return sendError(res, 500, error.message || 'Failed to mark notification as read.');
  }
};

/**
 * PUT /api/client/notifications/mark-all-read
 * Bulk marks all notifications as read for calling contact.
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { contactId } = req.clientContact;

    const result = await ClientNotification.updateMany(
      { contactId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return sendSuccess(res, 200, 'All notifications marked as read.', {
      modifiedCount: result.modifiedCount,
      unreadCount: 0
    });
  } catch (error) {
    console.error('Error bulk marking notifications read:', error);
    return sendError(res, 500, error.message || 'Failed to mark all notifications as read.');
  }
};

/**
 * GET /api/client/notifications/preferences
 * Returns calling contact's notification preferences.
 */
exports.getPreferences = async (req, res) => {
  try {
    const { contactId } = req.clientContact;

    let prefs = await ClientNotificationPreference.findOne({ contactId });
    if (!prefs) {
      prefs = await ClientNotificationPreference.create({
        contactId,
        pushEnabled: true,
        emailEnabled: true,
        whatsappEnabled: false
      });
    }

    return sendSuccess(res, 200, 'Notification preferences retrieved successfully.', { preferences: prefs });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve notification preferences.');
  }
};

/**
 * PUT /api/client/notifications/preferences
 * Updates channel delivery preferences.
 */
exports.updatePreferences = async (req, res) => {
  try {
    const { contactId } = req.clientContact;
    const { pushEnabled, emailEnabled, whatsappEnabled } = req.body;

    let prefs = await ClientNotificationPreference.findOne({ contactId });
    if (!prefs) {
      prefs = new ClientNotificationPreference({ contactId });
    }

    if (typeof pushEnabled === 'boolean') prefs.pushEnabled = pushEnabled;
    if (typeof emailEnabled === 'boolean') prefs.emailEnabled = emailEnabled;
    if (typeof whatsappEnabled === 'boolean') prefs.whatsappEnabled = whatsappEnabled;

    await prefs.save();

    return sendSuccess(res, 200, 'Notification preferences updated successfully.', { preferences: prefs });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return sendError(res, 500, error.message || 'Failed to update preferences.');
  }
};

/**
 * POST /api/client/notifications/register-device
 * Registers push notification device token for mobile client.
 */
exports.registerDeviceToken = async (req, res) => {
  try {
    const { contactId } = req.clientContact;
    const { platform, deviceToken } = req.body;

    if (!platform || !deviceToken || !['ANDROID', 'IOS'].includes(platform.toUpperCase())) {
      return sendError(res, 400, 'platform (ANDROID or IOS) and deviceToken are required fields.');
    }

    const tokenDoc = await ClientDeviceToken.findOneAndUpdate(
      { deviceToken: deviceToken.trim() },
      {
        contactId,
        platform: platform.toUpperCase(),
        deviceToken: deviceToken.trim(),
        isActive: true,
        registeredAt: new Date()
      },
      { upsert: true, new: true }
    );

    return sendSuccess(res, 200, 'Device push token registered successfully.', { deviceToken: tokenDoc });
  } catch (error) {
    console.error('Error registering device token:', error);
    return sendError(res, 500, error.message || 'Failed to register device token.');
  }
};

/**
 * DELETE /api/client/notifications/unregister-device
 * Deactivates push notification device token on logout.
 */
exports.unregisterDeviceToken = async (req, res) => {
  try {
    const { contactId } = req.clientContact;
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return sendError(res, 400, 'deviceToken is required.');
    }

    const result = await ClientDeviceToken.findOneAndUpdate(
      { contactId, deviceToken: deviceToken.trim() },
      { isActive: false }
    );

    return sendSuccess(res, 200, 'Device token unregistered successfully.', { unregistered: !!result });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    return sendError(res, 500, error.message || 'Failed to unregister device token.');
  }
};
