const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  fileName:        { type: String, required: true, trim: true },
  filePath:        { type: String, required: true },
  fileType:        { type: String, enum: ['PDF', 'DWG', 'JPEG', 'PNG', 'DOCX', 'XLSX', 'ZIP'], required: true },
  fileSize:        { type: Number, default: 0 },
  category:        { 
    type: String, 
    enum: ['Contracts', 'Approved Drawings PDFs', 'Photos', 'Invoices', 'Other Shared Documents'], 
    default: 'Other Shared Documents' 
  },
  uploadedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version:         { type: Number, default: 1 },
  visibleToClient: { type: Boolean, default: false }, // Default false (opt-IN for safety)
  isDeleted:       { type: Boolean, default: false }
}, { timestamps: true });

documentSchema.index({ projectId: 1, visibleToClient: 1, isDeleted: 1 });

module.exports = mongoose.model('Document', documentSchema);
