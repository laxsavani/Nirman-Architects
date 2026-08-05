const mongoose = require('mongoose');

const clientChatReadStatusSchema = new mongoose.Schema({
  contactId:         { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', required: true },
  projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  lastReadMessageAt: { type: Date, default: null }
}, { timestamps: true });

clientChatReadStatusSchema.index({ contactId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('ClientChatReadStatus', clientChatReadStatusSchema);
