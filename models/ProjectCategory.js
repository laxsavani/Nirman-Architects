const mongoose = require('mongoose');

const projectCategorySchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true, trim: true }, // e.g. "Residential", "Commercial"
  isActive:  { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('ProjectCategory', projectCategorySchema);
