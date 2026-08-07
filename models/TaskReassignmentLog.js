const mongoose = require('mongoose');

const taskReassignmentLogSchema = new mongoose.Schema({
  taskId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  fromEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  toEmployee:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reassignedAt: { type: Date, default: Date.now },
  reason:       { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TaskReassignmentLog', taskReassignmentLogSchema);
