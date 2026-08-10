const mongoose = require('mongoose');

const employeeChatReadStatusSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  lastReadMessageAt: { type: Date, default: null }
}, { timestamps: true });

employeeChatReadStatusSchema.index({ userId: 1, projectId: 1 }, { unique: true });

module.exports = mongoose.model('EmployeeChatReadStatus', employeeChatReadStatusSchema);
