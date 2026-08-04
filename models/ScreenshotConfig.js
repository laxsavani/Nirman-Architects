const mongoose = require('mongoose');

const screenshotConfigSchema = new mongoose.Schema({
  intervalMinutes:  { type: Number, default: 30 },   // gap between captures (30 min default)
  captureOnClockIn: { type: Boolean, default: true }, // fire immediate capture at clock-in
  imageFormat:      { type: String, enum: ['jpeg', 'png'], default: 'jpeg' },
  imageQuality:     { type: Number, default: 75 },     // 1-100 quality for jpeg compression
  isEnabled:        { type: Boolean, default: true },  // global enable/disable switch
  updatedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ScreenshotConfig', screenshotConfigSchema);
