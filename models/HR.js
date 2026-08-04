const mongoose = require('mongoose');

const hrSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  hrPermissions: [{ type: String }]  // e.g. ['approve_correction','manage_balances']
}, { timestamps: true });

hrSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

hrSchema.set('toJSON', { virtuals: true });
hrSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('HR', hrSchema);
