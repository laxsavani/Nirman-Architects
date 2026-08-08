const mongoose = require('mongoose');

const drawingVersionSchema = new mongoose.Schema({
  drawingId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', required: true },
  versionNumber:     { type: Number, required: true },
  filePath:          { type: String, required: true },
  thumbnailUrl:      { type: String, default: null },
  fileType:          { type: String, required: true, default: 'DWG' },
  uploadedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadDate:        { type: Date, default: Date.now },
  changeLog:         { type: String, default: null },

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

  visibleToClient:   { type: Boolean, default: false },

  pmReviewComments:   { type: String, default: null },
  pmReviewedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pmReviewedAt:         { type: Date, default: null },

  adminReviewComments: { type: String, default: null },
  adminReviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminReviewedAt:       { type: Date, default: null }
}, { timestamps: true });

drawingVersionSchema.index({ drawingId: 1, versionNumber: 1 }, { unique: true });

// Virtual fileUrl mapping for backward compatibility
drawingVersionSchema.virtual('fileUrl').get(function() {
  return this.filePath;
});

drawingVersionSchema.set('toJSON', { virtuals: true });
drawingVersionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('DrawingVersion', drawingVersionSchema);
