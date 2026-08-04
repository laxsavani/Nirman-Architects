const mongoose = require('mongoose');

const architectSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: String, trim: true },
  portfolioLinks: [{ type: String, trim: true }]
}, { timestamps: true });

architectSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

architectSchema.set('toJSON', { virtuals: true });
architectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Architect', architectSchema);
