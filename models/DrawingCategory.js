const mongoose = require('mongoose');

const drawingCategorySchema = new mongoose.Schema({
  name:                   { type: String, required: true, unique: true, trim: true },
  requiresClientApproval: { type: Boolean, default: true },
  restrictedEditing:      { type: Boolean, default: false },
  isActive:               { type: Boolean, default: true },
  createdBy:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('DrawingCategory', drawingCategorySchema);
