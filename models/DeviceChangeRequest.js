const mongoose = require('mongoose');

const deviceChangeRequestSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oldDeviceId:   { type: String, trim: true },
  newDeviceId:   { type: String, required: true, trim: true },
  status:        { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt:    { type: Date, default: null }
}, { timestamps: true });

deviceChangeRequestSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

deviceChangeRequestSchema.set('toJSON', { virtuals: true });
deviceChangeRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('DeviceChangeRequest', deviceChangeRequestSchema);
