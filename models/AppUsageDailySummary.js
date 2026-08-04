const mongoose = require('mongoose');

const appUsageDailySummarySchema = new mongoose.Schema({
  userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:                 { type: String, required: true },   // 'YYYY-MM-DD'
  appTotals: [{
    appName:            { type: String, required: true },
    totalSeconds:       { type: Number, required: true, default: 0 }
  }],
  idleSeconds:          { type: Number, default: 0 },
  totalTrackedSeconds:  { type: Number, default: 0 }
}, { timestamps: true });

appUsageDailySummarySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AppUsageDailySummary', appUsageDailySummarySchema);
