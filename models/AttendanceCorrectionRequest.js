const mongoose = require('mongoose');

const correctionRequestSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
  requestedClockIn:    { type: Date },
  requestedClockOut:   { type: Date },
  reason:              { type: String, required: true, trim: true },
  status:              { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:          { type: Date, default: null }
}, { timestamps: true });

correctionRequestSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

correctionRequestSchema.set('toJSON', { virtuals: true });
correctionRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AttendanceCorrectionRequest', correctionRequestSchema);
