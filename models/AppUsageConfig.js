const mongoose = require('mongoose');

const appUsageConfigSchema = new mongoose.Schema({
  pollIntervalSeconds: { type: Number, default: 5 },
  syncIntervalMinutes: { type: Number, default: 5 },
  captureWindowTitle: { type: Boolean, default: false },
  isEnabled: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('AppUsageConfig', appUsageConfigSchema);
