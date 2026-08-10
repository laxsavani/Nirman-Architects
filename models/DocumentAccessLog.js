const mongoose = require('mongoose');

const documentAccessLogSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  action:     { type: String, enum: ['VIEW', 'DOWNLOAD'], required: true },
  accessedAt: { type: Date, default: Date.now }
}, { timestamps: true });

documentAccessLogSchema.index({ documentId: 1, accessedAt: -1 });

module.exports = mongoose.model('DocumentAccessLog', documentAccessLogSchema);
