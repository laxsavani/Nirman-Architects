const mongoose = require('mongoose');

const scheduledReportSchema = new mongoose.Schema({
  reportType:      { type: String, required: true },
  format:          { type: String, enum: ['PDF', 'EXCEL', 'CSV'], required: true },
  scope:           { type: Object, required: true },
  frequency:       { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'], required: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:        { type: Boolean, default: true },
  lastRunAt:       { type: Date, default: null },
  nextRunAt:       { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);
