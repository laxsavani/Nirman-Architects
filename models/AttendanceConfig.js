const mongoose = require('mongoose');

const attendanceConfigSchema = new mongoose.Schema({
  heartbeatIntervalSeconds:  { type: Number, default: 120 },   // 2 min
  heartbeatTimeoutMinutes:   { type: Number, default: 5 },
  shiftStartTime:            { type: String, default: '09:30' },
  shiftEndTime:              { type: String, default: '18:30' },
  updatedBy:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);
