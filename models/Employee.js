const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  teamId:           { type: String, trim: true },
  reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

employeeSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
