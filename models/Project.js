const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  targetDate:    { type: Date, required: true },
  isCompleted:   { type: Boolean, default: false },
  completedDate: { type: Date, default: null }
}, { _id: true });

// Backward compatibility virtuals for milestone Schema
milestoneSchema.virtual('title').get(function() {
  return this.name;
}).set(function(v) {
  this.name = v;
});

milestoneSchema.virtual('dueDate').get(function() {
  return this.targetDate;
}).set(function(v) {
  this.targetDate = v;
});

milestoneSchema.set('toJSON', { virtuals: true });
milestoneSchema.set('toObject', { virtuals: true });

const responsibilityEntrySchema = new mongoose.Schema({
  area:        { type: String, required: true }, // e.g. "Structural Design"
  responsible: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  accountable: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  consulted:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  informed:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { _id: true });

const teamAssignmentSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectRole:  { type: String, required: true }, // e.g. "Lead Designer"
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  assignedAt:   { type: Date, default: Date.now }
}, { _id: true });

const projectSchema = new mongoose.Schema({
  projectName:              { type: String, required: true, trim: true },
  clientInformation:        { type: String, default: null }, // Human-readable label only
  address:                  { type: String, default: null },
  budget:                   { type: Number, default: 0 },
  priority:                 { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  projectCategoryId:        { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectCategory', default: null },

  startDate:                { type: Date, default: null },
  estimatedCompletion:      { type: Date, default: null },
  actualCompletion:         { type: Date, default: null },
  isDelayed:                { type: Boolean, default: false },
  milestones:               [milestoneSchema],
  progressPercentage:       { type: Number, min: 0, max: 100, default: 0 },
  progressIsManualOverride: { type: Boolean, default: false },

  status: {
    type: String,
    enum: ['New', 'Planning', 'In Progress', 'On Hold', 'Approval Pending', 'Site Work', 'Completed', 'Archived'],
    default: 'New'
  },

  teamAssignments:          [teamAssignmentSchema],
  responsibilityMatrix:     [responsibilityEntrySchema],

  createdBy:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive:                 { type: Boolean, default: true }
}, { timestamps: true });

// Virtuals for backward compatibility with CRM/other modules referencing project.name or project.progressPercent
projectSchema.virtual('name').get(function() {
  return this.projectName;
}).set(function(v) {
  this.projectName = v;
});

projectSchema.virtual('progressPercent').get(function() {
  return this.progressPercentage;
}).set(function(v) {
  this.progressPercentage = v;
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Project', projectSchema, 'projects');
