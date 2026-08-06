const mongoose = require('mongoose');

/**
 * WhatsAppConfig Model
 * Global configuration for WhatsApp Business API credentials (Super Admin managed).
 */
const whatsAppConfigSchema = new mongoose.Schema({
  apiKey: {
    type: String,
    required: true,
    trim: true
  },
  businessAccountId: {
    type: String,
    default: null,
    trim: true
  },
  phoneNumberId: {
    type: String,
    default: null,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  configuredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppConfig', whatsAppConfigSchema);
