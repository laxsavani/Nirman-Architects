const mongoose = require('mongoose');

const companyDashboardSnapshotSchema = new mongoose.Schema({
  totalProjects:         { type: Number, default: 0 },
  activeProjects:        { type: Number, default: 0 },
  completedProjects:     { type: Number, default: 0 },
  delayedProjects:       { type: Number, default: 0 },
  pendingApprovals:      { type: Number, default: 0 },
  avgProjectProgress:    { type: Number, default: 0 },
  avgProjectHealthScore: { type: Number, default: 0 },
  taskSummary:           { type: Object, default: {} },
  drawingSummary:        { type: Object, default: {} },
  lastComputedAt:        { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CompanyDashboardSnapshot', companyDashboardSnapshotSchema);
