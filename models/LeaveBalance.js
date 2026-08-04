const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year:           { type: Number, required: true },
  allocatedDays:  { type: Number, required: true },
  usedDays:       { type: Number, default: 0 }
  // remainingDays is COMPUTED at query time = allocatedDays - usedDays
}, { timestamps: true });

leaveBalanceSchema.index({ userId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

leaveBalanceSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

leaveBalanceSchema.virtual('leaveType').get(function() {
  return this.leaveTypeId;
}).set(function(val) {
  this.leaveTypeId = val;
});

leaveBalanceSchema.virtual('remainingDays').get(function() {
  return Math.max(0, (this.allocatedDays || 0) - (this.usedDays || 0));
});

leaveBalanceSchema.set('toJSON', { virtuals: true });
leaveBalanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
