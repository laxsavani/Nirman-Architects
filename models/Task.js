const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  text:        { type: String, required: true },
  isCompleted: { type: Boolean, default: false }
}, { _id: true });

const taskSchema = new mongoose.Schema({
  projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  taskName:          { type: String, required: true, trim: true },
  description:       { type: String, default: null },
  priority:          { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  departmentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  assignedEmployee:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  estimatedTime:     { type: Number, default: null }, // hours
  deadline:          { type: Date, default: null },
  attachments:       [{ type: String }],
  checklist:         [checklistItemSchema],
  dependsOn:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'In Progress', 'Review', 'Approved', 'Completed'],
    default: 'Pending'
  },

  actualStartTime:          { type: Date, default: null }, // Stamped on -> In Progress
  completionTime:           { type: Date, default: null }, // Stamped on -> Completed
  totalWorkingTimeMinutes:  { type: Number, default: null }, // Computed
  isDelayed:                { type: Boolean, default: false },
  idleTimeMinutes:          { type: Number, default: null }, // Computed from HRM AppUsageDailySummary
  productivityScore:        { type: Number, min: 0, max: 100, default: null }, // Computed

  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:          { type: Boolean, default: true }
}, { timestamps: true });

taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assignedEmployee: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
