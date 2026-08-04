const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name:                 { type: String, required: true, trim: true },   // "Casual Leave"
  code:                 { type: String, required: true, unique: true, uppercase: true, trim: true },  // "CL"
  isPaid:               { type: Boolean, default: true },   // false => salary deduction applies
  defaultQuotaPerYear:  { type: Number, default: 0 },
  isActive:             { type: Boolean, default: true },
  createdBy:            { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

leaveTypeSchema.virtual('defaultQuota').get(function() {
  return this.defaultQuotaPerYear;
}).set(function(val) {
  this.defaultQuotaPerYear = val;
});

leaveTypeSchema.set('toJSON', { virtuals: true });
leaveTypeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
