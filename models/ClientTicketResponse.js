const mongoose = require('mongoose');

/**
 * ClientTicketResponse Model
 * Represents a threaded conversation response on a specific ticket.
 * Supports dual author types (EMPLOYEE vs CLIENT_CONTACT).
 */
const clientTicketResponseSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientTicket',
    required: true
  },
  authorType: {
    type: String,
    enum: ['EMPLOYEE', 'CLIENT_CONTACT'],
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'authorModel'
  },
  authorModel: {
    type: String,
    enum: ['User', 'ClientContact'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String
  }],
  respondedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

clientTicketResponseSchema.index({ ticketId: 1, respondedAt: 1 });

module.exports = mongoose.model('ClientTicketResponse', clientTicketResponseSchema);
