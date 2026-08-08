const mongoose = require('mongoose');

const drawingVersionStatusHistorySchema = new mongoose.Schema({
  drawingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingVersion', required: true },
  fromStatus:       { type: String, default: null },
  toStatus:         { type: String, required: true },
  changedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedByClient:  { type: mongoose.Schema.Types.ObjectId, ref: 'ClientContact', default: null },
  changedAt:        { type: Date, default: Date.now },
  notes:            { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('DrawingVersionStatusHistory', drawingVersionStatusHistorySchema);
