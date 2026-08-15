const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId:        { type: String, trim: true },
  clockInTime:     { type: Date, required: true },   // SERVER time, authoritative
  clockOutTime:    { type: Date, default: null },     // SERVER time, authoritative
  clientClockIn:   { type: Date, default: null },     // reference only
  clientClockOut:  { type: Date, default: null },     // reference only
  workingHours:    { type: Number, default: 0 },      // In hours
  mode:            { type: String, enum: ['OFFICE_AUTO', 'SITE_MOBILE'], default: 'OFFICE_AUTO' },
  status:          { type: String, default: 'PRESENT', enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'OFFLINE', 'AUTO_CLOSED'] },
  reason:          { type: String, default: '' },      // E.g., "Normal Shutdown", "Unexpected Shutdown", "Power Failure"
  clockInSource:   { type: String, enum: ['AGENT_AUTO', 'MANUAL'], default: 'AGENT_AUTO', required: true },
  clockOutSource:  { type: String, enum: ['AGENT_AUTO', 'MANUAL', 'HEARTBEAT_TIMEOUT'], default: null },
  isOfflineEntry:  { type: Boolean, default: false }, // synced late from local JSON queue
  autoClosed:      { type: Boolean, default: false }, // closed via heartbeat-timeout cron
  lastHeartbeat:   { type: Date, default: Date.now }
}, { timestamps: true });

// Virtuals for schema compatibility across PRD terminology
attendanceSchema.virtual('employeeId').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

attendanceSchema.virtual('clockIn').get(function() {
  return this.clockInTime;
});

attendanceSchema.virtual('clockOut').get(function() {
  return this.clockOutTime;
});

attendanceSchema.virtual('date').get(function() {
  return this.clockInTime ? this.clockInTime.toISOString().split('T')[0] : null;
});

attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
