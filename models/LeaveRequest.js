const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveTypeId:       { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  fromDate:          { type: Date, required: true },
  toDate:            { type: Date, required: true },
  totalDays:         { type: Number, required: true },
  reason:            { type: String, trim: true },
  status:            { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' },
  isPaidSnapshot:    { type: Boolean },  // snapshot of LeaveType.isPaid AT APPROVAL TIME (audit safety)
  approvedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:        { type: Date, default: null },
  rejectionReason:   { type: String, default: null, trim: true }
}, { timestamps: true });

leaveRequestSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

leaveRequestSchema.virtual('leaveType').get(function() {
  return this.leaveTypeId;
}).set(function(val) {
  this.leaveTypeId = val;
});

leaveRequestSchema.set('toJSON', { virtuals: true });
leaveRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
