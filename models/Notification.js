const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:      { type: String, required: true, trim: true },  // 'LEAVE_APPROVED', 'CORRECTION_RAISED', etc.
  message:   { type: String, required: true, trim: true },
  isRead:    { type: Boolean, default: false }
}, { timestamps: true });

notificationSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
