const mongoose = require('mongoose');

/**
 * NotificationDeliveryLog Model
 * Audit log tracking exact delivery attempt status across channels (IN_APP, PUSH, EMAIL, WHATSAPP).
 */
const notificationDeliveryLogSchema = new mongoose.Schema({
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientNotification',
    required: true
  },
  channel: {
    type: String,
    enum: ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'],
    required: true
  },
  status: {
    type: String,
    enum: ['SENT', 'FAILED', 'SKIPPED_PREFERENCE', 'SKIPPED_NOT_CONFIGURED'],
    required: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  attemptedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

notificationDeliveryLogSchema.index({ notificationId: 1 });

module.exports = mongoose.model('NotificationDeliveryLog', notificationDeliveryLogSchema);
