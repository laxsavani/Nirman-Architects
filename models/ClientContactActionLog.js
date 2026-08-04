const mongoose = require('mongoose');

const clientContactActionLogSchema = new mongoose.Schema({
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  contactId:        { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', required: true },
  action:           { type: String, required: true },  // e.g. 'CONTACT_ADDED', 'CONTACT_DEACTIVATED', 'PERMISSION_CHANGED', 'LOGIN', 'PASSWORD_CHANGED'
  targetContactId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', default: null },
  performedAt:      { type: Date, default: Date.now }
}, { timestamps: true });

clientContactActionLogSchema.index({ clientId: 1 });
clientContactActionLogSchema.index({ contactId: 1 });

module.exports = mongoose.model('ClientContactActionLog', clientContactActionLogSchema);
