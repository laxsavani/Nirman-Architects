const mongoose = require('mongoose');

const projectStatusHistorySchema = new mongoose.Schema({
  projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  fromStatus: { type: String, default: null },
  toStatus:   { type: String, required: true },
  changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt:  { type: Date, default: Date.now },
  notes:      { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('ProjectStatusHistory', projectStatusHistorySchema);
