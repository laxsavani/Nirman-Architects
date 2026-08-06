const mongoose = require('mongoose');

/**
 * FeedbackPromptStatus Model
 * Tracks non-intrusive feedback prompt states (PENDING, SUBMITTED, SKIPPED) per client contact.
 */
const feedbackPromptStatusSchema = new mongoose.Schema({
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true
  },
  triggerType: {
    type: String,
    enum: ['PROJECT_COMPLETION', 'DRAWING_BATCH_APPROVAL', 'TICKET_RESOLUTION'],
    required: true
  },
  triggerRefId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUBMITTED', 'SKIPPED'],
    default: 'PENDING'
  },
  lastPromptedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Ensures unique prompt per contact and trigger event instance
feedbackPromptStatusSchema.index({ contactId: 1, triggerType: 1, triggerRefId: 1 }, { unique: true });
feedbackPromptStatusSchema.index({ contactId: 1, status: 1 });

module.exports = mongoose.model('FeedbackPromptStatus', feedbackPromptStatusSchema);
