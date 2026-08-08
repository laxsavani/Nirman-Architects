const mongoose = require('mongoose');

/**
 * DrawingMarking Model
 * Stores shape/freehand marking tool annotations on a specific DrawingVersion image.
 */
const drawingMarkingSchema = new mongoose.Schema({
  drawingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingVersion', required: true },
  drawingId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Drawing', required: true },
  authorType:       { type: String, enum: ['EMPLOYEE', 'CLIENT_CONTACT'], required: true },
  authorId:         { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'authorModel' },
  authorModel:      { type: String, enum: ['User', 'ClientContact'], required: true },
  markingType:      { 
    type: String, 
    enum: ['FREEHAND', 'RECTANGLE', 'CIRCLE', 'ARROW', 'HIGHLIGHT_AREA'], 
    required: true 
  },
  geometry:         { type: Object, required: true },
  color:            { type: String, default: '#FF0000' },
  linkedCommentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingComment', default: null },
  createdAt:        { type: Date, default: Date.now }
}, { timestamps: true });

drawingMarkingSchema.index({ drawingVersionId: 1 });
drawingMarkingSchema.index({ drawingId: 1 });

module.exports = mongoose.model('DrawingMarking', drawingMarkingSchema);
