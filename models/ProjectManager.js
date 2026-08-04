const mongoose = require('mongoose');

const projectManagerSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }]
}, { timestamps: true });

projectManagerSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});

projectManagerSchema.set('toJSON', { virtuals: true });
projectManagerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ProjectManager', projectManagerSchema);
