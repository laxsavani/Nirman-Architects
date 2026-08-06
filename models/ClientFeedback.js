const mongoose = require('mongoose');

/**
 * ClientFeedback Model
 * Stores client satisfaction ratings (overall 1-5 stars, dynamic category ratings, and comments).
 */
const clientFeedbackSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  triggerType: {
    type: String,
    enum: ['PROJECT_COMPLETION', 'DRAWING_BATCH_APPROVAL', 'TICKET_RESOLUTION'],
    required: true
  },
  triggerRefId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  categoryRatings: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeedbackCategory'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  comments: {
    type: String,
    default: null,
    trim: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

clientFeedbackSchema.index({ clientId: 1, projectId: 1 });
clientFeedbackSchema.index({ contactId: 1 });
clientFeedbackSchema.index({ overallRating: 1 });

module.exports = mongoose.model('ClientFeedback', clientFeedbackSchema);
