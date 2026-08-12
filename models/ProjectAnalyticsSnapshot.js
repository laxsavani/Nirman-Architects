const mongoose = require('mongoose');

const projectAnalyticsSnapshotSchema = new mongoose.Schema({
  projectId:             { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
  progressPercentage:    { type: Number, default: 0 },
  pendingTasksCount:     { type: Number, default: 0 },
  delayedTasksCount:     { type: Number, default: 0 },
  totalDrawings:         { type: Number, default: 0 },
  approvedDrawingsCount: { type: Number, default: 0 },
  employeeBreakdown:     [{
    userId:               { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTasks:        { type: Number, default: 0 },
    completedTasks:       { type: Number, default: 0 },
    avgCompletionMinutes: { type: Number, default: 0 },
    avgProductivityScore: { type: Number, default: 0 }
  }],
  lastComputedAt:        { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('ProjectAnalyticsSnapshot', projectAnalyticsSnapshotSchema);
