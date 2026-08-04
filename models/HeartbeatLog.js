const mongoose = require('mongoose');

const heartbeatLogSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedAt:   { type: Date, default: Date.now },   // server time
  clientTime:   { type: Date }                        // claimed by client, tamper-check ref
}, { timestamps: true });

heartbeatLogSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

heartbeatLogSchema.set('toJSON', { virtuals: true });
heartbeatLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('HeartbeatLog', heartbeatLogSchema);
