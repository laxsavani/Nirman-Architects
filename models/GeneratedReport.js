const mongoose = require('mongoose');

const generatedReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: [
      'ATTENDANCE', 'PRODUCTIVITY', 'PROJECT', 'EMPLOYEE',
      'DRAWING', 'SITE', 'DAILY_PROGRESS', 'MONTHLY_PROGRESS',
      'CUSTOMER', 'TASK', 'APPROVAL'
    ],
    required: true
  },
  format:       { type: String, enum: ['PDF', 'EXCEL', 'CSV'], required: true },
  scope:        { type: Object, required: true },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:       { type: String, enum: ['PENDING', 'GENERATING', 'READY', 'FAILED'], default: 'PENDING' },
  filePath:     { type: String, default: null },
  errorMessage: { type: String, default: null },
  requestedAt:  { type: Date, default: Date.now },
  completedAt:  { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('GeneratedReport', generatedReportSchema);
