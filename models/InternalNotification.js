const mongoose = require('mongoose');

const internalNotificationSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  type:      { type: String, required: true },
  title:     { type: String, required: true },
  message:   { type: String, required: true },
  deepLink:  { type: String, default: null },
  refId:     { type: mongoose.Schema.Types.ObjectId, default: null },
  isRead:    { type: Boolean, default: false },
  readAt:    { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('InternalNotification', internalNotificationSchema);
