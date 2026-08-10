const mongoose = require('mongoose');

const documentVersionSchema = new mongoose.Schema({
  documentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  versionNumber: { type: Number, required: true },
  filePath:      { type: String, required: true },
  fileSizeKB:    { type: Number, default: 0 },
  uploadedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadDate:    { type: Date, default: Date.now },
  changeLog:     { type: String, default: null }
}, { timestamps: true });

documentVersionSchema.index({ documentId: 1, versionNumber: 1 }, { unique: true });

module.exports = mongoose.model('DocumentVersion', documentVersionSchema);
