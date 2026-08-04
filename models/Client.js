const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },   // company/family name
  companyName:     { type: String, default: null, trim: true },
  phone:           { type: String, required: true, trim: true },
  email:           { type: String, default: null, trim: true, lowercase: true },
  billingAddress:  { type: String, default: null },
  siteAddresses:   [{ type: String }],
  sourceLeadId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
  isActive:        { type: Boolean, default: true }
}, { timestamps: true });

clientSchema.index({ phone: 1 });
clientSchema.index({ sourceLeadId: 1 });

module.exports = mongoose.model('Client', clientSchema);
