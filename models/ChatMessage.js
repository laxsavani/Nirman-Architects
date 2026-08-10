const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  projectId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  authorType:       { type: String, enum: ['EMPLOYEE', 'CLIENT_CONTACT'], required: true },
  authorId:         { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'authorModel' },
  authorModel:      { type: String, enum: ['User', 'ClientContact'], required: true },
  messageText:      { type: String, required: true, trim: true },
  mentionedIds:           [{ type: mongoose.Schema.Types.ObjectId }], // Mixed references to User and ClientContact
  replyToMessageId:       { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage', default: null },
  linkedTaskId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  linkedDrawingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DrawingVersion', default: null },
  isOfflineSync:          { type: Boolean, default: false },
  localComposedAt:        { type: Date, default: null },
  sentAt:                 { type: Date, default: Date.now }
}, { timestamps: true });

chatMessageSchema.index({ projectId: 1, sentAt: 1 });
chatMessageSchema.index({ projectId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
