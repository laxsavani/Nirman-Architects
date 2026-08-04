const mongoose = require('mongoose');

const unauthorizedAttemptSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attemptedDeviceId:   { type: String, default: null, trim: true },
  attemptedAt:         { type: Date, default: Date.now },
  action:              { type: String, enum: ['clock_in', 'clock_out', 'heartbeat'] },
  reason:              { type: String, trim: true }  // e.g. 'device_mismatch'
}, { timestamps: true });

unauthorizedAttemptSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

unauthorizedAttemptSchema.set('toJSON', { virtuals: true });
unauthorizedAttemptSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('UnauthorizedAttempt', unauthorizedAttemptSchema);
