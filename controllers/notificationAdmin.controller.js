const NotificationDeliveryLog = require('../models/NotificationDeliveryLog');
const WhatsAppConfig = require('../models/WhatsAppConfig');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/notifications/:notificationId/delivery-log
 * PM / Admin audit view of exact delivery log attempts for a notification ID.
 */
exports.getDeliveryLog = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const logs = await NotificationDeliveryLog.find({ notificationId })
      .populate('notificationId', 'title type contactId')
      .sort({ attemptedAt: -1 });

    return sendSuccess(res, 200, 'Notification delivery logs retrieved successfully.', {
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Error fetching notification delivery logs:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve delivery logs.');
  }
};

/**
 * POST /api/notifications/whatsapp-config
 * Super Admin configures WhatsApp Business API credentials.
 */
exports.configureWhatsApp = async (req, res) => {
  try {
    const { apiKey, businessAccountId, phoneNumberId, isActive } = req.body;
    const adminUserId = req.user ? (req.user.id || req.user._id) : null;

    if (!apiKey || !apiKey.trim()) {
      return sendError(res, 400, 'apiKey is required for WhatsApp integration.');
    }

    // Deactivate prior configs
    await WhatsAppConfig.updateMany({}, { isActive: false });

    const config = await WhatsAppConfig.create({
      apiKey: apiKey.trim(),
      businessAccountId: businessAccountId ? businessAccountId.trim() : null,
      phoneNumberId: phoneNumberId ? phoneNumberId.trim() : null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      configuredBy: adminUserId
    });

    return sendSuccess(res, 201, 'WhatsApp Business API credentials configured successfully.', { config });
  } catch (error) {
    console.error('Error configuring WhatsApp:', error);
    return sendError(res, 500, error.message || 'Failed to configure WhatsApp credentials.');
  }
};

/**
 * GET /api/notifications/whatsapp-config/status
 * Returns current WhatsApp integration status.
 */
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const config = await WhatsAppConfig.findOne({ isActive: true }).select('-apiKey');

    return sendSuccess(res, 200, 'WhatsApp configuration status retrieved.', {
      isConfigured: !!config,
      config: config || null
    });
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    return sendError(res, 500, error.message || 'Failed to retrieve WhatsApp status.');
  }
};
