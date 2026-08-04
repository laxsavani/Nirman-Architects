const mongoose = require('mongoose');

const clientPortalSessionSchema = new mongoose.Schema({
  contactId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', required: true },
  platform:     { type: String, enum: ['WEB', 'ANDROID', 'IOS'], required: true },
  loginAt:      { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

clientPortalSessionSchema.index({ contactId: 1, lastActiveAt: -1 });

module.exports = mongoose.model('ClientPortalSession', clientPortalSessionSchema);
