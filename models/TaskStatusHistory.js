const mongoose = require('mongoose');

const taskStatusHistorySchema = new mongoose.Schema({
  taskId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  fromStatus: { type: String, default: null },
  toStatus:   { type: String, required: true },
  changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt:  { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('TaskStatusHistory', taskStatusHistorySchema);
