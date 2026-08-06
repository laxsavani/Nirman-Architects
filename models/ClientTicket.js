const mongoose = require('mongoose');

/**
 * ClientTicket Model
 * Represents a formal support query/ticket raised by a client within the Client Portal.
 */
const clientTicketSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientContact',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  attachments: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'],
    default: 'OPEN'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  reopenedCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Indexes for fast querying by project, client, status, and assigned employee
clientTicketSchema.index({ clientId: 1, status: 1 });
clientTicketSchema.index({ projectId: 1, status: 1 });
clientTicketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('ClientTicket', clientTicketSchema);
