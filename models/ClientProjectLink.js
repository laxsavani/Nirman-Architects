const mongoose = require('mongoose');

const clientProjectLinkSchema = new mongoose.Schema({
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  projectId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  visibleToClient:  { type: Boolean, default: true },
  linkedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  // internal employee
  linkedAt:         { type: Date, default: Date.now },
  unlinkedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  unlinkedAt:       { type: Date, default: null },
  isActive:         { type: Boolean, default: true }   // soft-delete on unlink, preserves audit history
}, { timestamps: true });

clientProjectLinkSchema.index({ clientId: 1, projectId: 1 });

module.exports = mongoose.model('ClientProjectLink', clientProjectLinkSchema);
