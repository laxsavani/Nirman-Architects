const mongoose = require('mongoose');

const leadInteractionSchema = new mongoose.Schema({
  leadId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  type:       { type: String, enum: ['Call', 'Meeting', 'Email', 'Note'], required: true },
  notes:      { type: String, required: true, trim: true },
  loggedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loggedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

leadInteractionSchema.index({ leadId: 1 });
leadInteractionSchema.index({ loggedAt: -1 });

module.exports = mongoose.model('LeadInteraction', leadInteractionSchema);
