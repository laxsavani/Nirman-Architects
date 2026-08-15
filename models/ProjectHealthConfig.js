const mongoose = require('mongoose');

const projectHealthConfigSchema = new mongoose.Schema({
  timelineWeight:         { type: Number, default: 30 },
  drawingVelocityWeight:  { type: Number, default: 25 },
  productivityWeight:     { type: Number, default: 25 },
  clientEngagementWeight: { type: Number, default: 20 },
  updatedBy:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ProjectHealthConfig', projectHealthConfigSchema);
