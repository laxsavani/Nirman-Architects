const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  permissions: [{ type: String }]   // e.g. ['full_access']
}, { timestamps: true });

superAdminSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

superAdminSchema.set('toJSON', { virtuals: true });
superAdminSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SuperAdmin', superAdminSchema);
