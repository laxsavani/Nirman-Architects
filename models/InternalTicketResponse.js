const mongoose = require('mongoose');

const internalTicketResponseSchema = new mongoose.Schema({
  ticketId:    { type: mongoose.Schema.Types.ObjectId, ref: 'InternalTicket', required: true },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:     { type: String, required: true, trim: true },
  respondedAt: { type: Date, default: Date.now }
}, { timestamps: true });

internalTicketResponseSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model('InternalTicketResponse', internalTicketResponseSchema);
