const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:      { type: String, required: true },   // bcrypt hash
  phone:         { type: String, trim: true },
  roleId:        { type: mongoose.Schema.Types.ObjectId, ref: 'RoleMaster', required: true },
  department:    { type: String, trim: true },
  designation:   { type: String, trim: true },
  joiningDate:   { type: Date },
  baseSalary:    { type: Number, required: true, default: 0 },
  deviceId:      { type: String, default: null, trim: true },   // Machine GUID (office staff)
  deviceStatus:  { type: String, enum: ['APPROVED', 'PENDING', 'BLOCKED'], default: 'APPROVED' },
  isActive:      { type: Boolean, default: true }
}, { timestamps: true });

// Alias getters/setters for legacy fields compatibility
userSchema.virtual('role').get(function() {
  return this.roleId;
}).set(function(val) {
  this.roleId = val;
});

userSchema.virtual('mobileNumber').get(function() {
  return this.phone;
}).set(function(val) {
  this.phone = val;
});

userSchema.virtual('registeredDeviceId').get(function() {
  return this.deviceId;
}).set(function(val) {
  this.deviceId = val;
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
