const express = require('express');
const Resume = require('../models/Resume');
const authenticate = require('../middleware/auth');
const router = express.Router();

router.get('/resumes', authenticate, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.session.userId }).sort({ updatedAt: -1 });
    res.json(resumes);
  } catch (err) {
    console.error('Get resumes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.json(resume);
  } catch (err) {
    console.error('Get resume error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticate, async (req, res) => {
  const {
    resumeId,
    template,
    personalInfo,
    summary,
    education,
    experience,
    projects,
    techSkills,
    softSkills,
    certifications,
    languages,
    hobbies,
    roleTitle,
    additionalFields,
  } = req.body;

  if (!template || !['chronological', 'functional', 'combination', 'pillar'].includes(template)) {
    return res.status(400).json({ message: 'Invalid template' });
  }
  if (!summary || !personalInfo?.name) {
    return res.status(400).json({ message: 'Name and summary are required' });
  }

  try {
    let resume;
    if (resumeId) {
      resume = await Resume.findOne({ _id: resumeId, userId: req.session.userId });
      if (!resume) {
        return res.status(404).json({ message: 'Resume not found' });
      }
      resume.template = template;
      resume.personalInfo = personalInfo;
      resume.summary = summary;
      resume.education = education;
      resume.experience = experience;
      resume.projects = projects;
      resume.techSkills = techSkills;
      resume.softSkills = softSkills;
      resume.certifications = certifications;
      resume.languages = languages;
      resume.hobbies = hobbies;
      resume.roleTitle = roleTitle;
      resume.additionalFields = additionalFields;
      resume.updatedAt = Date.now();
    } else {
      resume = new Resume({
        userId: req.session.userId,
        template,
        personalInfo,
        summary,
        education,
        experience,
        projects,
        techSkills,
        softSkills,
        certifications,
        languages,
        hobbies,
        roleTitle,
        additionalFields,
        updatedAt: Date.now(),
      });
    }
    await resume.save();
    res.status(resumeId ? 200 : 201).json(resume);
  } catch (err) {
    console.error('Save resume error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    res.json({ message: 'Resume deleted successfully' });
  } catch (err) {
    console.error('Delete resume error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;