const mongoose = require('mongoose');

const clientDocumentAccessLogSchema = new mongoose.Schema({
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  contactId:   { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', required: true },
  documentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  action:      { type: String, enum: ['VIEW', 'DOWNLOAD'], required: true },
  accessedAt:  { type: Date, default: Date.now }
}, { timestamps: true });

clientDocumentAccessLogSchema.index({ documentId: 1, accessedAt: -1 });
clientDocumentAccessLogSchema.index({ clientId: 1, projectId: 1 });

module.exports = mongoose.model('ClientDocumentAccessLog', clientDocumentAccessLogSchema);
