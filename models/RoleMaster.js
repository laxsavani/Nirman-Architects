const mongoose = require('mongoose');

const roleMasterSchema = new mongoose.Schema({
  roleName:    { type: String, required: true, unique: true, trim: true },  // e.g., "HR", "SUPER_ADMIN"
  roleCode:    { type: String, required: true, unique: true, uppercase: true, trim: true },  // e.g., "HR", "SUPER_ADMIN"
  description: { type: String, default: '' },
  isActive:    { type: Boolean, default: true }
}, { timestamps: true });

// Backward compatibility virtual for name
roleMasterSchema.virtual('name').get(function() {
  return this.roleName || this.roleCode;
});

roleMasterSchema.set('toJSON', { virtuals: true });
roleMasterSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RoleMaster', roleMasterSchema);
