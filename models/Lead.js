const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  phone:            { type: String, required: true, trim: true },
  email:            { type: String, default: null, trim: true, lowercase: true },
  source:           { type: String, enum: ['Referral', 'Website', 'WalkIn', 'SocialMedia', 'Other'], required: true },
  requirementNotes: { type: String, trim: true },
  assignedTo:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:           { 
                      type: String, 
                      enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'], 
                      default: 'NEW' 
                    },
  lostReason:       { type: String, default: null, trim: true },
  nextFollowUpDate: { type: Date, default: null },
  convertedToClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

leadSchema.index({ phone: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ nextFollowUpDate: 1 });

module.exports = mongoose.model('Lead', leadSchema);
