const mongoose = require('mongoose');

const offerLetterSchema = new mongoose.Schema({
  userId:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  generatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Admin/HR who registered them
  filePath:            { type: String, required: true },   // /storage/offer_letters/<userId>/...

  // Snapshot fields — captured at generation time, never re-derived from live User data later
  designationSnapshot: { type: String, required: true, trim: true },
  departmentSnapshot:  { type: String, required: true, trim: true },
  baseSalarySnapshot:  { type: Number, required: true },
  joiningDateSnapshot: { type: Date, required: true },

  status:              { type: String, enum: ['GENERATED', 'SENT', 'ACKNOWLEDGED'], default: 'GENERATED' },
  generatedAt:         { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('OfferLetter', offerLetterSchema);
