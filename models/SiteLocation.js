const mongoose = require('mongoose');

const siteLocationSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  radiusMeters: {
    type: Number,
    default: 100
  }
}, { timestamps: true });

module.exports = mongoose.model('SiteLocation', siteLocationSchema, 'sitelocations');
