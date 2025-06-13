const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const authenticate = require('../middleware/auth');
const router = express.Router();
const jobs = require('../data/jobs.json');
const { analyzePrompt, enhanceResumePrompt } = require('../prompts');

const upload = multer({ storage: multer.memoryStorage() });

// Helper function to match resume to job profile
const matchJobProfile = (resumeSkills, resumeExperience) => {
  let bestMatch = null;
  let highestScore = 0;

  jobs.forEach((job) => {
    const matchedSkills = resumeSkills.filter((skill) =>
      job.skills.map((s) => s.toLowerCase().trim()).includes(skill.toLowerCase().trim())
    );
    const skillMatchScore = (matchedSkills.length / job.skills.length) * 100;

    const jobExp = parseInt(job.experience.split('-')[0]) || 0;
    const resumeExp = parseInt(resumeExperience.match(/\d+/)?.[0]) || 0;
    const expMatchScore = resumeExp >= jobExp ? 100 : (resumeExp / jobExp) * 100;

    const totalScore = skillMatchScore * 0.7 + expMatchScore * 0.3;

    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestMatch = job;
    }
  });

  return bestMatch || jobs[0];
};

// Helper function to determine experience level
const determineExperienceLevel = (resumeExperience) => {
  const years = parseInt(resumeExperience.match(/\d+/)?.[0]) || 0;
  if (years < 2) return 'entry-level';
  if (years <= 5) return 'mid-level';
  return 'senior';
};

router.post('/analyze', authenticate, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No resume file uploaded');
      return res.status(400).json({ message: 'No resume file uploaded' });
    }
    console.log('Received resume file:', req.file.originalname, req.file.size, 'bytes');

    const debugDir = path.join(__dirname, '../debug_pdfs');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir);
    }
    const debugPath = path.join(debugDir, `resume_${Date.now()}.pdf`);
    fs.writeFileSync(debugPath, req.file.buffer);
    console.log('Saved PDF for debugging at:', debugPath);

    const pdfData = await pdfParse(req.file.buffer, { max: 10 });
    const resumeText = pdfData.text.trim();
    console.log('PDF parsed, text length:', resumeText.length);
    console.log('PDF text sample:', resumeText.slice(0, 200));

    if (!resumeText || resumeText.length < 100 || !resumeText.match(/skills|experience/i)) {
      console.error('Resume text is empty or insufficient. PDF info:', pdfData.info);
      return res.status(400).json({
        error: {
          message: 'Resume content is empty or insufficient (lacking skills or experience)',
          pdfInfo: pdfData.info,
          textSample: resumeText.slice(0, 200),
        },
      });
    }

    const resumeSkills = resumeText
      .split('\n')
      .filter((line) => line.match(/skills/i))
      .flatMap((line) => line.split(/[,;]/))
      .map((skill) => skill.trim())
      .filter(Boolean);
    const resumeExperience = resumeText
      .split('\n')
      .find((line) => line.match(/experience/i)) || '0 years';

    const matchedJob = matchJobProfile(resumeSkills, resumeExperience);
    console.log('Matched job profile:', matchedJob.profile);

    if (!matchedJob.profile || !matchedJob.skills || !Array.isArray(matchedJob.skills)) {
      console.error('Invalid matched job data:', matchedJob);
      return res.status(500).json({ message: 'Invalid job profile data' });
    }

    const experienceLevel = determineExperienceLevel(resumeExperience);
    const industry = matchedJob.industry || 'General';

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = analyzePrompt(matchedJob, experienceLevel, industry, resumeText);

    const result = await model.generateContent([prompt]);
    const responseText = result.response.text();
    console.log('Gemini raw response length:', responseText.length);

    let atsResult;
    try {
      const cleanedResponse = responseText.replace(/```json\n|\n```/g, '').trim();
      atsResult = JSON.parse(cleanedResponse);

      if (
        typeof atsResult.atsScore !== 'number' ||
        atsResult.atsScore < 0 ||
        atsResult.atsScore > 100 ||
        !Array.isArray(atsResult.missingKeywords) ||
        !Array.isArray(atsResult.suggestions) ||
        atsResult.suggestions.length < 3 ||
        atsResult.suggestions.length > 5
      ) {
        throw new Error('Invalid JSON structure or data types');
      }

      atsResult.suggestions = atsResult.suggestions
        .filter((s) => typeof s === 'string' && s.trim())
        .slice(0, 5);
      if (atsResult.suggestions.length < 3) {
        atsResult.suggestions.push(
          `Include more keywords like ${matchedJob.skills.slice(0, 2).join(', ')}.`,
          'Add specific project details to highlight relevant experience.',
          'Use action verbs and quantify achievements where possible.'
        );
        atsResult.suggestions = atsResult.suggestions.slice(0, 5);
      }

      atsResult.missingKeywords = atsResult.missingKeywords
        .filter((k) => typeof k === 'string' && k.trim());
    } catch (parseErr) {
      console.warn('Failed to parse Gemini response as JSON:', parseErr.message);
      atsResult = {
        atsScore: 50,
        missingKeywords: [],
        suggestions: [
          `Include more keywords like ${matchedJob.skills.slice(0, 2).join(', ')}.`,
          'Add specific project details to highlight relevant experience.',
          'Use action verbs and quantify achievements where possible.',
        ],
      };
    }

    atsResult.atsScore = Math.max(0, Math.min(100, Number(atsResult.atsScore) || 50));
    atsResult.missingKeywords = Array.isArray(atsResult.missingKeywords) ? atsResult.missingKeywords : [];
    atsResult.suggestions = Array.isArray(atsResult.suggestions) ? atsResult.suggestions : [
      `Include more keywords like ${matchedJob.skills.slice(0, 2).join(', ')}.`,
      'Add specific project details to highlight relevant experience.',
      'Use action verbs and quantify achievements where possible.',
    ];

    console.log('Parsed ATS result:', atsResult);

    res.status(200).json({
      ...atsResult,
      matchedJob: {
        id: matchedJob.id,
        profile: matchedJob.profile,
        description: matchedJob.description,
        applyLink: matchedJob.applyLink,
        experience: matchedJob.experience,
        location: matchedJob.location,
        salary: matchedJob.salary,
      },
    });
  } catch (err) {
    console.error('ATS analysis error:', err.message, err.stack);
    let status = 500;
    let message = 'Failed to analyze resume';

    if (err.message.includes('API key')) {
      status = 500;
      message = 'Invalid or missing Gemini API key';
    } else if (err.message.includes('network') || err.code === 'ECONNABORTED') {
      status = 503;
      message = 'Network error connecting to Gemini API';
    } else if (err.message.includes('Quota')) {
      status = 429;
      message = 'Gemini API quota exceeded';
    }

    res.status(status).json({ message });
  }
});

// Enhanced resume endpoint
router.post('/enhance-resume', authenticate, async (req, res) => {
  try {
    const { resumeText } = req.body;
    if (!resumeText) {
      console.error('Missing required field: resumeText');
      return res.status(400).json({ message: 'Resume text is required' });
    }
    console.log('Input resumeText length:', resumeText.length);

    if (resumeText.trim().length < 50) {
      console.error('resumeText is too short:', resumeText.length);
      return res.status(400).json({ message: 'Resume text is too short or empty' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = enhanceResumePrompt(resumeText);

    console.log('Sending prompt to Gemini, length:', prompt.length);
    let enhancedResumeText;
    try {
      const result = await model.generateContent([prompt]);
      enhancedResumeText = result.response.text();
    } catch (geminiErr) {
      console.error('Gemini API error:', geminiErr.message, geminiErr.stack);
      throw new Error(`Gemini API failed: ${geminiErr.message}`);
    }
    console.log('Enhanced resume text length:', enhancedResumeText.length);
    console.log('Enhanced resume text sample:', enhancedResumeText.slice(0, 500));

    const debugPath = path.join(__dirname, `../debug_enhanced_resume_${Date.now()}.txt`);
    fs.writeFileSync(debugPath, enhancedResumeText);
    console.log('Saved enhanced resume debug at:', debugPath);

    const sections = {
      personalInfo: { name: '', email: '', phone: '', linkedin: '',portfolio: '',address: '',github: '' },
      summary: '',
      techSkills: [],
      experience: [],
      education: [],
      certifications: [],
      projects: [],
      softSkills: [],
      languages: [],
      hobbies: [],
      profilePicture: '',
      roleTitle: '',
      additionalFields: [],
    };

    const normalizeHeader = (header) => header?.toLowerCase().trim().replace(/\s+/g, ' ') || '';

    const originalSections = {};
    const originalBlocks = resumeText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    console.log('Original blocks detected:', originalBlocks.length);
    originalBlocks.forEach((block, idx) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        console.warn(`Empty block at index ${idx}`);
        return;
      }
      const header = normalizeHeader(lines[0]);
      originalSections[header] = lines.slice(1);
      console.log(`Parsed original section "${header}", lines:`, lines.slice(1));
    });

    try {
      if (originalSections[normalizeHeader('personal info')]) {
        originalSections[normalizeHeader('personal info')].forEach((line) => {
          const parts = line.split(/:(.+)/).map((s) => s.trim());
          if (parts.length < 2) return;
          const key = normalizeHeader(parts[0]);
          const value = parts[1] || '';
          if (key.includes('name')) sections.personalInfo.name = value;
          else if (key.includes('email')) sections.personalInfo.email = value;
          else if (key.includes('phone')) sections.personalInfo.phone = value;
          else if (key.includes('linkedin')) sections.personalInfo.linkedin = value;
          else if (key.includes('portfolio')) sections.personalInfo.portfolio = value;
          else if (key.includes('address')) sections.personalInfo.address = value;
          else if (key.includes('github')) sections.personalInfo.github = value;
          else console.warn(`Unknown personal info key: ${key}`);
        });
      }
      if (originalSections[normalizeHeader('summary')] || originalSections[normalizeHeader('professional summary')]) {
        const key = normalizeHeader('summary') in originalSections ? normalizeHeader('summary') : normalizeHeader('professional summary');
        sections.summary = originalSections[key]?.join(' ').trim() || '';
      }
      if (originalSections[normalizeHeader('technical skills')] || originalSections[normalizeHeader('skills')]) {
        const key = normalizeHeader('technical skills') in originalSections ? normalizeHeader('technical skills') : normalizeHeader('skills');
        sections.techSkills = originalSections[key]
          ?.filter((line) => line.match(/^-|\*/))
          .map((line) => ({
            name: line.replace(/^[-*]\s*/, '').trim(),
            proficiency: 90,
          }))
          .filter((s) => s.name) || [];
      }
      if (originalSections[normalizeHeader('experience')] || originalSections[normalizeHeader('work experience')]) {
        let currentExp = null;
        const key = normalizeHeader('experience') in originalSections ? normalizeHeader('experience') : normalizeHeader('work experience');
        originalSections[key]?.forEach((line) => {
          if (!line.match(/^-|\*/)) {
            if (currentExp) sections.experience.push(currentExp);
            const parts = line.split('|').map((p) => p.trim());
            currentExp = {
              role: parts[0] || '',
              company: parts[1] || '',
              duration: parts[2] || '',
              description: [],
            };
          } else if (currentExp) {
            currentExp.description.push(line.replace(/^[-*]\s*/, '').trim());
          }
        });
        if (currentExp) sections.experience.push(currentExp);
        sections.experience = sections.experience.filter((e) => e.role && e.company);
      }
      if (originalSections[normalizeHeader('education')]) {
        sections.education = originalSections[normalizeHeader('education')]
          ?.map((line) => {
            const parts = line.split('|').map((p) => p.trim());
            return {
              degree: parts[0] || '',
              institution: parts[1] || '',
              year: parts[2] || '',
            };
          })
          .filter((e) => e.degree && e.institution) || [];
      }
      if (originalSections[normalizeHeader('certifications')]) {
        sections.certifications = originalSections[normalizeHeader('certifications')]
          ?.map((line) => {
            const parts = line.split('|').map((p) => p.trim());
            return {
              name: parts[0] || '',
              issuer: parts[1] || '',
              year: parts[2] || '',
            };
          })
          .filter((c) => c.name) || [];
      }
      if (originalSections[normalizeHeader('projects')]) {
        console.log('Parsing projects section:', originalSections[normalizeHeader('projects')]);
        sections.projects = originalSections[normalizeHeader('projects')]
          ?.map((line) => {
            const parts = line.split('|').map((p) => p.trim());
            return {
              name: parts[0] || '',
              description: parts[1] || '',
              link: parts[2] || '',
            };
          })
          .filter((p) => p.name) || [];

          console.log('Parsed section projects:', sections.projects);
      }
      if (originalSections[normalizeHeader('soft skills')]) {
        sections.softSkills = originalSections[normalizeHeader('soft skills')]
          ?.filter((line) => line.match(/^-|\*/))
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean) || [];
      }
      if (originalSections[normalizeHeader('languages')]) {
        sections.languages = originalSections[normalizeHeader('languages')]
          ?.map((line) => {
            const parts = line.replace(/^[-*]\s*/, '').trim().split('|');
            return {
              language: parts[0]?.trim() || '',
              proficiency: parts[1]?.trim() || '',
              proficiencyLevel: parseInt(parts[2]?.trim()) || 0,
            };
          })
          .filter((s) => s.language) || [];
      }
      if (originalSections[normalizeHeader('hobbies')]) {
        sections.hobbies = originalSections[normalizeHeader('hobbies')]
          ?.filter((line) => line.match(/^-|\*/))
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean) || [];
      }
      if (originalSections[normalizeHeader('role title')]) {
        sections.roleTitle = originalSections[normalizeHeader('role title')]?.join(' ').trim() || '';
      }
      if (originalSections[normalizeHeader('additional fields')]) {
        let currentField = null;
        sections.additionalFields = [];
        originalSections[normalizeHeader('additional fields')]?.forEach((line) => {
          if (!line.match(/^-|\*/)) {
            if (currentField) sections.additionalFields.push(currentField);
            currentField = {
              title: line.trim(),
              content: [],
            };
          } else if (currentField) {
            const parts = line.replace(/^[-*]\s*/, '').trim().split('|');
            currentField.content.push({
              name: parts[0]?.trim() || '',
              year: parts[1]?.trim() || '',
            });
          }
        });
        if (currentField) sections.additionalFields.push(currentField);
        sections.additionalFields = sections.additionalFields.filter((f) => f.title);
      }
    } catch (parseErr) {
      console.error('Error parsing original resume:', parseErr.message);
    }

    console.log('Parsed original sections:', JSON.stringify(sections, null, 2));

    const enhancedBlocks = enhancedResumeText.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    console.log('Enhanced blocks detected:', enhancedBlocks.length);
    enhancedBlocks.forEach((block, idx) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        console.warn(`Empty enhanced block at index ${idx}`);
        return;
      }

      const header = normalizeHeader(lines[0]);
      console.log(`Processing enhanced section "${header}", lines:`, lines.slice(1));
      try {
        if (header.includes('personal info')) {
          lines.slice(1).forEach((line) => {
            const parts = line.split(/:(.+)/).map((s) => s.trim());
            if (parts.length < 2) return;
            const key = normalizeHeader(parts[0]);
            const value = parts[1] || '';
            if (key.includes('name')) sections.personalInfo.name = value;
            else if (key.includes('email')) sections.personalInfo.email = value;
            else if (key.includes('phone')) sections.personalInfo.phone = value;
            else if (key.includes('linkedin')) sections.personalInfo.linkedin = value;
            else if (key.includes('portfolio')) sections.personalInfo.portfolio = value;
            else if (key.includes('address')) sections.personalInfo.address = value;
            else if (key.includes('github')) sections.personalInfo.github = value;
            else console.warn(`Unknown personal info key in enhanced section: ${key}`);
          });
        } else if (header.includes('summary') || header.includes('professional summary')) {
          sections.summary = lines.slice(1).join(' ').trim();
        } else if (header.includes('technical skills')) {
          console.log('Parsing of the tech skills  :', header);
          sections.techSkills = lines
            .slice(1)
            .filter((line) => line.match(/^-|\*/))
            .map((line) => ({
              name: line.replace(/^[-*]\s*/, '').trim(),
              proficiency: 90,
            }))
            .filter((s) => s.name);

            console.log(' techSkills:', sections.techSkills);
        } else if (header.includes('experience') || header.includes('work experience')) {
          let currentExp = null;
          const enhancedExps = [];
          lines.slice(1).forEach((line) => {
            if (!line.match(/^-|\*/)) {
              if (currentExp) enhancedExps.push(currentExp);
              const parts = line.split('|').map((p) => p.trim());
              currentExp = {
                role: parts[0] || '',
                company: parts[1] || '',
                duration: parts[2] || '',
                description: [],
              };
            } else if (currentExp) {
              currentExp.description.push(line.replace(/^[-*]\s*/, '').trim());
            }
          });
          if (currentExp) enhancedExps.push(currentExp);
          sections.experience = sections.experience.map((origExp) => {
            const match = enhancedExps.find(
              (enhExp) =>
                (enhExp.role.toLowerCase().includes(origExp.role.toLowerCase().slice(0, 10)) ||
                  enhExp.company.toLowerCase().includes(origExp.company.toLowerCase().slice(0, 10))) &&
                (enhExp.duration === origExp.duration || !origExp.duration)
            );
            if (match) {
              return { ...origExp, description: match.description.filter(Boolean) };
            }
            return origExp;
          });
        } else if (header.includes('education')) {
          sections.education = lines
            .slice(1)
            .map((line) => {
              const parts = line.split('|').map((p) => p.trim());
              return {
                degree: parts[0] || '',
                institution: parts[1] || '',
                year: parts[2] || '',
              };
            })
            .filter((e) => e.degree && e.institution);
        } else if (header.includes('certifications')) {
          sections.certifications = lines
            .slice(1)
            .map((line) => {
              const parts = line.split('|').map((p) => p.trim());
              return {
                name: parts[0] || '',
                issuer: parts[1] || '',
                year: parts[2] || '',
              };
            })
            .filter((c) => c.name);
        } else if (header.includes('projects')) {
          const enhancedProjects = lines
            .slice(1)
            .map((line) => {
              const parts = line.split('|').map((p) => p.trim());
              return {
                name: parts[0] || '',
                description: parts[1] || '',
                link: parts[2] || '',
              };
            })
            .filter((p) => p.name);
          sections.projects = sections.projects.map((origProj) => {
            const match = enhancedProjects.find(
              (enhProj) =>
                enhProj.name.toLowerCase().includes(origProj.name.toLowerCase().slice(0, 10)) &&
                (enhProj.link === origProj.link || !origProj.link)
            );
            if (match) {
              return { ...origProj, description: match.description };
            }
            return origProj;
          });
        } else if (header.includes('soft skills')) {
          sections.softSkills = lines
            .slice(1)
            .filter((line) => line.match(/^-|\*/))
            .map((line) => line.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean);
        } else if (header.includes('languages')) {
          sections.languages = lines
            .slice(1)
            .map((line) => {
              const parts = line.replace(/^[-*]\s*/, '').trim().split('|');
              return {
                language: parts[0]?.trim() || '',
                proficiency: parts[1]?.trim() || '',
                proficiencyLevel: parseInt(parts[2]?.trim()) || 0,
              };
            })
            .filter((l) => l.language);
        } else if (header.includes('hobbies')) {
          sections.hobbies = lines
            .slice(1)
            .filter((line) => line.match(/^-|\*/))
            .map((line) => line.replace(/^[-*]\s*/, '').trim())
            .filter(Boolean);
        } else if (header.includes('role title')) {
          sections.roleTitle = lines.slice(1).join(' ').trim();
        } else if (header.includes('additional fields')) {
          let currentField = null;
          sections.additionalFields = [];
          lines.slice(1).forEach((line) => {
            if (!line.match(/^-|\*/)) {
              if (currentField) sections.additionalFields.push(currentField);
              currentField = {
                title: line.trim(),
                content: [],
              };
            } else if (currentField) {
              const parts = line.replace(/^[-*]\s*/, '').trim().split('|');
              currentField.content.push({
                name: parts[0]?.trim() || '',
                year: parts[1]?.trim() || '',
              });
            }
          });
          if (currentField) sections.additionalFields.push(currentField);
          sections.additionalFields = sections.additionalFields.filter((f) => f.title);
        }
      } catch (parseErr) {
        console.warn(`Failed to parse enhanced section "${header}":`, parseErr.message);
      }
    });

    sections.profilePicture = '';

    console.log('AI-Enhanced Resume (JSON):', JSON.stringify(sections, null, 2));

    if (
      !sections.personalInfo.name &&
      !sections.summary &&
      sections.experience.length === 0 &&
      sections.education.length === 0 &&
      sections.techSkills.length === 0
    ) {
      console.error('Enhanced resume is empty. Check debug file:', debugPath);
      console.error('Original sections:', JSON.stringify(originalSections, null, 2));
      console.error('Enhanced resume text:', enhancedResumeText);
      return res.status(500).json({
        message: 'Failed to generate enhanced resume. Resume data is empty.',
        debugFile: debugPath,
        originalSections,
        enhancedResumeText,
      });
    }

    res.status(200).json({
      enhancedResume: sections,
      rawText: enhancedResumeText,
    });
  } catch (err) {
    console.error('Enhance resume error:', err.message, err.stack);
    let status = 500;
    let message = 'Failed to enhance resume';
    if (err.message.includes('API key')) {
      status = 500;
      message = 'Invalid or missing Gemini API key';
    } else if (err.message.includes('network') || err.code === 'ECONNABORTED') {
      status = 503;
      message = 'Network error connecting to Gemini API';
    } else if (err.message.includes('Quota')) {
      status = 429;
      message = 'Failed due to quota exceeded';
    }
    res.status(status).json({ message, error: '' });
  }
});

module.exports = router;
