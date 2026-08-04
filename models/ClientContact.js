const mongoose = require('mongoose');

const clientContactSchema = new mongoose.Schema({
  clientId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  name:              { type: String, required: true, trim: true },
  email:             { type: String, required: true, unique: true, trim: true, lowercase: true },  // login identifier
  password:          { type: String, required: true },   // bcrypt hash
  phone:             { type: String, trim: true },
  permissionLevel:   { type: String, enum: ['OWNER', 'MEMBER', 'VIEW_ONLY'], default: 'MEMBER' },
  isPrimaryContact:  { type: Boolean, default: false },
  mustChangePassword:{ type: Boolean, default: true },   // true until first password change
  isActive:          { type: Boolean, default: true },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
  createdByModel:    { type: String, enum: ['User', 'ClientContact'], default: 'User' }
}, { timestamps: true });

clientContactSchema.index({ clientId: 1 });

module.exports = mongoose.model('ClientContact', clientContactSchema);
