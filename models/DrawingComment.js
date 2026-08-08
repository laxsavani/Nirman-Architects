const mongoose = require('mongoose');

const drawingCommentSchema = new mongoose.Schema({
  drawingId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', required: true },
  drawingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingVersion', default: null },
  authorType:       { type: String, enum: ['CLIENT_CONTACT', 'EMPLOYEE'], required: true },
  authorId:         { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'authorModel' },
  authorModel:      { type: String, enum: ['ClientContact', 'User'], required: true },
  commentText:      { type: String, required: true },
  annotationCoords: { type: Object, default: null },  // e.g. {x, y} or region marker data, for image-pinned comments
  isDraft:          { type: Boolean, default: false }, // client's private draft note, not yet submitted
  createdAt:        { type: Date, default: Date.now }
}, { timestamps: true });

drawingCommentSchema.index({ drawingId: 1, isDraft: 1 });
drawingCommentSchema.index({ drawingVersionId: 1, isDraft: 1 });

module.exports = mongoose.model('DrawingComment', drawingCommentSchema);
