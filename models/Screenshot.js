const mongoose = require('mongoose');

const screenshotSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
  filePath:         { type: String, required: true },   // storage/screenshots/Bhakti-Kadam/07/28/12-00.png
  cloudinaryUrl:    { type: String },                   // https://res.cloudinary.com/...
  cloudinaryPublicId:{ type: String },                   // screenshots/Bhakti-Kadam/07/28/12:00
  capturedAt:       { type: Date, required: true },      // SERVER time, authoritative
  isFirstOfSession: { type: Boolean, default: false },   // true for 0th minute clock-in capture
  isOfflineSync:    { type: Boolean, default: false },   // true if uploaded late from local queue
  fileSizeKB:       { type: Number, default: 0 }
}, { timestamps: true });

screenshotSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

screenshotSchema.set('toJSON', { virtuals: true });
screenshotSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Screenshot', screenshotSchema);
