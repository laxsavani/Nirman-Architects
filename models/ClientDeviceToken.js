const mongoose = require('mongoose');

/**
 * ClientDeviceToken Model
 * Registers push notification device tokens (Android/iOS) for mobile clients.
 */
const clientDeviceTokenSchema = new mongoose.Schema({
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true
  },
  platform: {
    type: String,
    enum: ['ANDROID', 'IOS'],
    required: true
  },
  deviceToken: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

clientDeviceTokenSchema.index({ contactId: 1, isActive: 1 });

module.exports = mongoose.model('ClientDeviceToken', clientDeviceTokenSchema);
