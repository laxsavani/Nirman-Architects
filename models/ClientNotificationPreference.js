const mongoose = require('mongoose');

/**
 * ClientNotificationPreference Model
 * Stores per-contact delivery channel preferences (Push, Email, WhatsApp).
 */
const clientNotificationPreferenceSchema = new mongoose.Schema({
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true,
    unique: true
  },
  pushEnabled: {
    type: Boolean,
    default: true
  },
  emailEnabled: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ClientNotificationPreference', clientNotificationPreferenceSchema);
