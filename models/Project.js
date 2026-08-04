const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  siteLocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SiteLocation',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema, 'projects');
