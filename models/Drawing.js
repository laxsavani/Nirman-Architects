const mongoose = require('mongoose');

const drawingVersionSchema = new mongoose.Schema({
  versionNumber:   { type: Number, required: true },
  fileUrl:         { type: String, required: true },
  thumbnailUrl:    { type: String, default: null },
  notes:           { type: String, default: null },
  uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt:      { type: Date, default: Date.now }
});

const drawingSchema = new mongoose.Schema({
  projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title:           { type: String, required: true, trim: true },
  drawingNumber:   { type: String, trim: true },
  category:        { type: String, enum: ['Concept', 'Working', 'Process DWG', 'GFC', 'Site', 'Interior'], required: true },
  currentVersion:  { type: Number, default: 1 },
  fileUrl:         { type: String, required: true },
  thumbnailUrl:    { type: String, default: null },
  status:          { 
    type: String, 
    enum: ['DESIGNER_UPLOADED', 'PM_REVIEW', 'ADMIN_REVIEW', 'PENDING_CLIENT_APPROVAL', 'APPROVED', 'CHANGES_REQUESTED'], 
    default: 'PENDING_CLIENT_APPROVAL' 
  },
  visibleToClient: { type: Boolean, default: true },
  uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectManager:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  versions:        [drawingVersionSchema]
}, { timestamps: true });

drawingSchema.index({ projectId: 1, visibleToClient: 1, status: 1 });

module.exports = mongoose.model('Drawing', drawingSchema);
