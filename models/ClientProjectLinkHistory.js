const mongoose = require('mongoose');

const clientProjectLinkHistorySchema = new mongoose.Schema({
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  action:      { type: String, enum: ['LINKED', 'UNLINKED', 'VISIBILITY_CHANGED'], required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes:       { type: String, default: null },
  performedAt: { type: Date, default: Date.now }
}, { timestamps: true });

clientProjectLinkHistorySchema.index({ clientId: 1 });
clientProjectLinkHistorySchema.index({ projectId: 1 });

module.exports = mongoose.model('ClientProjectLinkHistory', clientProjectLinkHistorySchema);
