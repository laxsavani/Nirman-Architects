const mongoose = require('mongoose');

const clientApprovalLogSchema = new mongoose.Schema({
  clientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  contactId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', required: true },  // WHO specifically acted
  drawingId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', required: true },
  projectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  action:       { type: String, enum: ['APPROVED', 'CHANGES_REQUESTED'], required: true },
  comments:     { type: String, default: null },   // required for CHANGES_REQUESTED, optional for APPROVED
  actedAt:      { type: Date, default: Date.now }
}, { timestamps: true });

clientApprovalLogSchema.index({ drawingId: 1, actedAt: -1 });
clientApprovalLogSchema.index({ clientId: 1, projectId: 1 });

module.exports = mongoose.model('ClientApprovalLog', clientApprovalLogSchema);
