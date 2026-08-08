const mongoose = require('mongoose');

const embeddedVersionSchema = new mongoose.Schema({
  versionNumber:   { type: Number, required: true },
  fileUrl:         { type: String, required: true },
  thumbnailUrl:    { type: String, default: null },
  notes:           { type: String, default: null },
  uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt:      { type: Date, default: Date.now }
}, { _id: false });

const drawingSchema = new mongoose.Schema({
  projectId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  drawingName:      { type: String, required: true, trim: true },
  drawingNumber:    { type: String, trim: true },
  categoryId:       { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingCategory' },
  categoryName:     { type: String, default: 'Concept Drawings' }, // Fallback string category
  currentVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingVersion', default: null },

  // Embedded backward-compatibility state synced with currentVersionId for CRM Module 5
  status: {
    type: String,
    enum: [
      'DESIGNER_UPLOADED',
      'PM_APPROVED',
      'PM_REJECTED',
      'ADMIN_REJECTED',
      'PENDING_CLIENT_APPROVAL',
      'APPROVED',
      'CHANGES_REQUESTED'
    ],
    default: 'DESIGNER_UPLOADED'
  },
  visibleToClient:  { type: Boolean, default: false },
  fileUrl:          { type: String, default: '' },
  thumbnailUrl:     { type: String, default: null },
  currentVersion:   { type: Number, default: 1 },
  versions:         [embeddedVersionSchema],

  isGFCLocked:      { type: Boolean, default: false },
  gfcLockedAt:      { type: Date, default: null },
  gfcLockedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive:         { type: Boolean, default: true }
}, { timestamps: true });

// Virtual getter mapping title -> drawingName for CRM 5
drawingSchema.virtual('title').get(function() {
  return this.drawingName;
}).set(function(v) {
  this.drawingName = v;
});

// Virtual category string fallback
drawingSchema.virtual('category').get(function() {
  return this.categoryName || 'Concept Drawings';
}).set(function(v) {
  this.categoryName = v;
});

drawingSchema.set('toJSON', { virtuals: true });
drawingSchema.set('toObject', { virtuals: true });

drawingSchema.index({ projectId: 1, visibleToClient: 1, status: 1 });

module.exports = mongoose.model('Drawing', drawingSchema);
