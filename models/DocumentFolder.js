const mongoose = require('mongoose');

const documentFolderSchema = new mongoose.Schema({
  projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  folderName: { type: String, required: true, trim: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:   { type: Boolean, default: true }
}, { timestamps: true });

documentFolderSchema.index({ projectId: 1, isActive: 1 });

module.exports = mongoose.model('DocumentFolder', documentFolderSchema);
