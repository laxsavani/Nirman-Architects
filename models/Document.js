const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  folderId:          { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFolder', default: null },
  documentName:      { type: String, required: true, trim: true },
  fileName:          { type: String, trim: true },
  filePath:          { type: String },
  fileType:          { type: String, enum: ['PDF', 'DWG', 'JPEG', 'PNG', 'DOCX', 'XLSX', 'ZIP'], required: true },
  fileSize:          { type: Number, default: 0 },
  fileSizeKB:        { type: Number, default: 0 },
  category:          { 
    type: String, 
    enum: ['Contracts', 'Approved Drawings PDFs', 'Photos', 'Invoices', 'Other Shared Documents'], 
    default: 'Other Shared Documents' 
  },
  currentVersionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentVersion', default: null },
  visibleToClient:   { type: Boolean, default: false },
  restrictedToRoles: [{ type: String }],
  uploadedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version:           { type: Number, default: 1 },
  isActive:          { type: Boolean, default: true },
  isDeleted:         { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

documentSchema.pre('validate', function () {
  if (!this.fileName && this.documentName) {
    this.fileName = this.documentName;
  }
  if (!this.documentName && this.fileName) {
    this.documentName = this.fileName;
  }
  if (!this.createdBy && this.uploadedBy) {
    this.createdBy = this.uploadedBy;
  }
  if (!this.uploadedBy && this.createdBy) {
    this.uploadedBy = this.createdBy;
  }
});

documentSchema.index({ projectId: 1, visibleToClient: 1, isDeleted: 1 });
documentSchema.index({ projectId: 1, folderId: 1, isActive: 1 });

module.exports = mongoose.model('Document', documentSchema);
