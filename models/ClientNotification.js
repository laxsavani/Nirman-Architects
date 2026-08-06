const mongoose = require('mongoose');

/**
 * ClientNotification Model
 * Stores in-app notifications generated for Client Portal contacts.
 */
const clientNotificationSchema = new mongoose.Schema({
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  deepLink: {
    type: String,
    default: null,
    trim: true
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

clientNotificationSchema.index({ contactId: 1, isRead: 1 });
clientNotificationSchema.index({ clientId: 1, createdAt: -1 });

module.exports = mongoose.model('ClientNotification', clientNotificationSchema);
