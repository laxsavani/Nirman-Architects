const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:            { type: Number, required: true },  // 1-12
  year:             { type: Number, required: true },
  baseSalary:       { type: Number, required: true },
  daysInMonth:      { type: Number, required: true },
  presentDays:      { type: Number, required: true },
  paidLeaveDays:    { type: Number, default: 0 },
  unpaidLeaveDays:  { type: Number, default: 0 },
  absentDays:       { type: Number, default: 0 },
  perDaySalary:     { type: Number, required: true },
  totalDeduction:   { type: Number, required: true },
  netSalary:        { type: Number, required: true },
  generatedAt:      { type: Date, default: Date.now },
  pdfPath:          { type: String, default: null }
}, { timestamps: true });

payrollSchema.index({ userId: 1, month: 1, year: 1 }, { unique: true });

payrollSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

payrollSchema.set('toJSON', { virtuals: true });
payrollSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Payroll', payrollSchema);
