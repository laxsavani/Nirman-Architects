const mongoose = require('mongoose');

const appUsageLogSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
  batchReceivedAt: { type: Date, default: Date.now },   // server time, authoritative
  appUsage: [{
    appName:       { type: String, required: true },
    windowTitle:   { type: String, default: null },     // optional, off by default
    secondsActive: { type: Number, required: true }
  }],
  isOfflineSync:   { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AppUsageLog', appUsageLogSchema);
