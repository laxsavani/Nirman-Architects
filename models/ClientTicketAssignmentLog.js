const mongoose = require('mongoose');

/**
 * ClientTicketAssignmentLog Model
 * Tracks ticket reassignment history across internal staff members for accountability.
 */
const clientTicketAssignmentLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientTicket',
    required: true
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reassignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reassignedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

clientTicketAssignmentLogSchema.index({ ticketId: 1, reassignedAt: -1 });

module.exports = mongoose.model('ClientTicketAssignmentLog', clientTicketAssignmentLogSchema);
