const mongoose = require('mongoose');

const internalTicketSchema = new mongoose.Schema({
  raisedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:       { type: String, enum: ['IT', 'HR', 'ADMIN', 'FACILITIES', 'OTHER'], default: 'OTHER' },
  subject:        { type: String, required: true, trim: true },
  description:    { type: String, required: true, trim: true },
  priority:       { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  attachments:    [{ type: String }],
  status:         { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'], default: 'OPEN' },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt:     { type: Date, default: null },
  closedAt:       { type: Date, default: null },
  reopenedCount:  { type: Number, default: 0 }
}, { timestamps: true });

internalTicketSchema.index({ raisedBy: 1, status: 1 });
internalTicketSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('InternalTicket', internalTicketSchema);
