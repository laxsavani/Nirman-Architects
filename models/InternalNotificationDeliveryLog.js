const mongoose = require('mongoose');

const internalNotificationDeliveryLogSchema = new mongoose.Schema({
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalNotification', required: true },
  channel:        { type: String, enum: ['IN_APP', 'PUSH', 'EMAIL', 'WHATSAPP'], required: true },
  status:         { type: String, enum: ['SENT', 'FAILED', 'SKIPPED_PREFERENCE', 'SKIPPED_NOT_CONFIGURED'], required: true },
  errorMessage:   { type: String, default: null },
  attemptedAt:    { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('InternalNotificationDeliveryLog', internalNotificationDeliveryLogSchema);
