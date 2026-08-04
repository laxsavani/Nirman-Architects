const mongoose = require('mongoose');

const leaveBalanceAdjustmentSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  adjustedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oldValue:      { type: Number, required: true },
  newValue:      { type: Number, required: true },
  reason:        { type: String, required: true, trim: true },
  adjustedAt:    { type: Date, default: Date.now }
}, { timestamps: true });

leaveBalanceAdjustmentSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

leaveBalanceAdjustmentSchema.virtual('leaveType').get(function() {
  return this.leaveTypeId;
}).set(function(val) {
  this.leaveTypeId = val;
});

leaveBalanceAdjustmentSchema.set('toJSON', { virtuals: true });
leaveBalanceAdjustmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveBalanceAdjustment', leaveBalanceAdjustmentSchema);
