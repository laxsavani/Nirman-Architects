const mongoose = require('mongoose');

const internalNotificationPreferenceSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  pushEnabled:     { type: Boolean, default: true },
  emailEnabled:    { type: Boolean, default: true },
  whatsappEnabled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('InternalNotificationPreference', internalNotificationPreferenceSchema);
