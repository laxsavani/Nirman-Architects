const mongoose = require('mongoose');

const employeeDeviceTokenSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform:     { type: String, enum: ['ANDROID', 'IOS'], required: true },
  deviceToken:  { type: String, required: true, unique: true },
  isActive:     { type: Boolean, default: true },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('EmployeeDeviceToken', employeeDeviceTokenSchema);
