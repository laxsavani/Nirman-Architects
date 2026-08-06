const mongoose = require('mongoose');

/**
 * FeedbackCategory Model
 * Dynamic master for admin-configurable feedback rating categories (e.g. Communication, Timeliness, Quality).
 */
const feedbackCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('FeedbackCategory', feedbackCategorySchema);
