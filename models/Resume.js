const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  template: { type: String, required: true, enum: ['chronological', 'functional', 'combination', 'pillar'] },
  personalInfo: { type: Object, default: {} },
  summary: { type: String, default: '' },
  education: { type: Array, default: [] },
  experience: { type: Array, default: [] },
  projects: { type: Array, default: [] },
  techSkills: { type: Array, default: [] },
  softSkills: { type: Array, default: [] },
  certifications: { type: Array, default: [] },
  languages: { type: Array, default: [] },
  hobbies: { type: Array, default: [] },
  roleTitle: { type: String, default: '' },
  additionalFields: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Resume', resumeSchema);