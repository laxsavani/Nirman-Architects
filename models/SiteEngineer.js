const mongoose = require('mongoose');

const siteEngineerSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedSites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });

siteEngineerSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

siteEngineerSchema.set('toJSON', { virtuals: true });
siteEngineerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SiteEngineer', siteEngineerSchema);
