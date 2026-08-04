const mongoose = require('mongoose');

const leadStatusHistorySchema = new mongoose.Schema({
  leadId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  fromStatus:  { type: String, default: null },   // null for initial status on lead creation
  toStatus:    { type: String, required: true },
  changedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

leadStatusHistorySchema.index({ leadId: 1 });
leadStatusHistorySchema.index({ changedAt: -1 });

module.exports = mongoose.model('LeadStatusHistory', leadStatusHistorySchema);
