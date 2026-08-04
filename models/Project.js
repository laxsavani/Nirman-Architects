const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String, default: null },
  dueDate:       { type: Date, default: null },
  completedDate: { type: Date, default: null },
  isCompleted:   { type: Boolean, default: false }
});

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['New', 'Planning', 'In Progress', 'On Hold', 'Approval Pending', 'Site Work', 'Completed', 'Archived'],
    default: 'In Progress'
  },
  progressPercent: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  startDate: {
    type: Date,
    default: null
  },
  estimatedCompletion: {
    type: Date,
    default: null
  },
  actualCompletion: {
    type: Date,
    default: null
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: null
  },
  delays: [{
    reason: { type: String },
    delayedDays: { type: Number },
    reportedAt: { type: Date, default: Date.now }
  }],
  milestones: [milestoneSchema],
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  siteLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SiteLocation',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema, 'projects');
