const mongoose = require('mongoose');

const taskCommentSchema = new mongoose.Schema({
  taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commentText: { type: String, required: true, trim: true },
  createdAt:   { type: Date, default: Date.now }
}, { timestamps: true });

taskCommentSchema.index({ taskId: 1, createdAt: 1 });

module.exports = mongoose.model('TaskComment', taskCommentSchema);
