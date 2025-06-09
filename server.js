// const express = require('express');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const cors = require('cors');
// const session = require('express-session');
// const multer = require('multer');
// const pdfParse = require('pdf-parse');
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config();

// const app = express();

// // Middleware
// app.use(cors({
//   origin: 'http://localhost:5173',
//   credentials: true
// }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || 'resumebuildersecret',
//     resave: false,
//     saveUnInitialized: false,
//     cookie: { secure: false, maxAge: 3600000 },
//   })
// );

// // Multer for file uploads (ATS analysis)
// const upload = multer({ storage: multer.memoryStorage() });

// // MongoDB connection
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/resume_builder', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(() => console.log('Connected to MongoDB'))
// .catch((err) => console.error('MongoDB connection error:', err));

// // User Schema
// const userSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
// });
// const User = mongoose.model('User', userSchema);

// // Resume Schema
// const resumeSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   template: { type: String, required: true, enum: ['chronological', 'functional', 'combination', 'pillar'] },
//   personalInfo: { type: Object, default: {} },
//   summary: { type: String, default: '' },
//   education: { type: Array, default: [] },
//   experience: { type: Array, default: [] },
//   projects: { type: Array, default: [] },
//   techSkills: { type: Array, default: [] },
//   softSkills: { type: Array, default: [] },
//   certifications: { type: Array, default: [] },
//   languages: { type: Array, default: [] },
//   hobbies: { type: Array, default: [] },
//   roleTitle: { type: String, default: '' },
//   additionalFields: { type: Array, default: [] },
//   updatedAt: { type: Date, default: Date.now },
// });
// const Resume = mongoose.model('Resume', resumeSchema);

// // Middleware to check if user is authenticated
// const authenticate = (req, res, next) => {
//   if (!req.session.userId) {
//     return res.status(401).json({ message: 'Not authenticated' });
//   }
//   next();
// };

// // Authentication Routes
// app.post('/api/register', async (req, res) => {
//   const { name, email, password } = req.body;
//   if (!name || !email || !password) {
//     return res.status(400).json({ message: 'All fields are required' });
//   }
//   try {
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'Email already registered' });
//     }
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = new User({ name, email, password: hashedPassword });
//     await user.save();
//     req.session.userId = user._id;
//     req.session.user = { id: user._id, name: user.name, email: user.email };
//     res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
//   } catch (err) {
//     console.error('Register error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// app.post('/api/login', async (req, res) => {
//   const { email, password } = req.body;
//   if (!email || !password) {
//     return res.status(400).json({ message: 'Email and password are required' });
//   }
//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ message: 'Invalid credentials' });
//     }
//     req.session.userId = user._id;
//     req.session.user = { id: user._id, name: user.name, email: user.email };
//     res.json({ user: { id: user._id, name: user.name, email: user.email } });
//   } catch (err) {
//     console.error('Login error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// app.post('/api/logout', (req, res) => {
//   req.session.destroy((err) => {
//     if (err) {
//       console.error('Logout error:', err);
//       return res.status(500).json({ message: 'Error logging out' });
//     }
//     res.json({ message: 'Logged out successfully' });
//   });
// });

// app.get('/api/me', authenticate, async (req, res) => {
//   try {
//     const user = await User.findById(req.session.userId).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }
//     res.json(user);
//   } catch (err) {
//     console.error('Get user error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // Resume Routes
// app.get('/api/resumes', authenticate, async (req, res) => {
//   try {
//     const resumes = await Resume.find({ userId: req.session.userId }).sort({ updatedAt: -1 });
//     res.json(resumes);
//   } catch (err) {
//     console.error('Get resumes error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// app.get('/api/resumes/:id', authenticate, async (req, res) => {
//   try {
//     const resume = await Resume.findOne({ _id: req.params.id, userId: req.session.userId });
//     if (!resume) {
//       return res.status(404).json({ message: 'Resume not found' });
//     }
//     res.json(resume);
//   } catch (err) {
//     console.error('Get resume error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// app.post('/api/resumes', authenticate, async (req, res) => {
//   const {
//     resumeId,
//     template,
//     personalInfo,
//     summary,
//     education,
//     experience,
//     projects,
//     techSkills,
//     softSkills,
//     certifications,
//     languages,
//     hobbies,
//     roleTitle,
//     additionalFields,
//   } = req.body;

//   if (!template || !['chronological', 'functional', 'combination', 'pillar'].includes(template)) {
//     return res.status(400).json({ message: 'Invalid template' });
//   }
//   if (!summary || !personalInfo?.name) {
//     return res.status(400).json({ message: 'Name and summary are required' });
//   }

//   try {
//     let resume;
//     if (resumeId) {
//       resume = await Resume.findOne({ _id: resumeId, userId: req.session.userId });
//       if (!resume) {
//         return res.status(404).json({ message: 'Resume not found' });
//       }
//       resume.template = template;
//       resume.personalInfo = personalInfo;
//       resume.summary = summary;
//       resume.education = education;
//       resume.experience = experience;
//       resume.projects = projects;
//       resume.techSkills = techSkills;
//       resume.softSkills = softSkills;
//       resume.certifications = certifications;
//       resume.languages = languages;
//       resume.hobbies = hobbies;
//       resume.roleTitle = roleTitle;
//       resume.additionalFields = additionalFields;
//       resume.updatedAt = Date.now();
//     } else {
//       resume = new Resume({
//         userId: req.session.userId,
//         template,
//         personalInfo,
//         summary,
//         education,
//         experience,
//         projects,
//         techSkills,
//         softSkills,
//         certifications,
//         languages,
//         hobbies,
//         roleTitle,
//         additionalFields,
//         updatedAt: Date.now(),
//       });
//     }
//     await resume.save();
//     res.status(resumeId ? 200 : 201).json(resume);
//   } catch (err) {
//     console.error('Save resume error:', err);
//     res.status(500).json({ message: 'Server error', error: err.message });
//   }
// });

// app.delete('/api/resumes/:id', authenticate, async (req, res) => {
//   try {
//     const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
//     if (!resume) {
//       return res.status(404).json({ message: 'Resume not found' });
//     }
//     res.json({ message: 'Resume deleted successfully' });
//   } catch (err) {
//     console.error('Delete resume error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// // ATS Analysis Route
// app.post('/api/analyze', authenticate, upload.single('resume'), async (req, res) => {
//   try {
//     // Validate file upload
//     if (!req.file) {
//       console.error('No resume file uploaded');
//       return res.status(400).json({ message: 'No resume file uploaded' });
//     }
//     console.log('Received resume file:', req.file.originalname, req.file.size, 'bytes');

//     // Save PDF for debugging
//     const debugDir = path.join(__dirname, 'debug_pdfs');
//     if (!fs.existsSync(debugDir)) {
//       fs.mkdirSync(debugDir);
//     }
//     const debugPath = path.join(debugDir, `resume_${Date.now()}.pdf`);
//     fs.writeFileSync(debugPath, req.file.buffer);
//     console.log('Saved PDF for debugging at:', debugPath);

//     // Parse PDF with debug options
//     const pdfData = await pdfParse(req.file.buffer, { max: 10 });
//     const resumeText = pdfData.text.trim();
//     console.log('PDF parsed, text length:', resumeText.length);
//     console.log('PDF text sample:', resumeText.slice(0, 200));
//     if (!resumeText) {
//       console.error('Resume text is empty or unreadable. PDF info:', pdfData.info);
//       return res.status(400).json({ 
//         message: 'Resume content is empty or unreadable',
//         pdfInfo: pdfData.info,
//         textSample: pdfData.text.slice(0, 200)
//       });
//     }

//     // Initialize Gemini API
//     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

//     // Define job keywords for MERN stack developer
//     const jobKeywords = [
//       'React', 'Node.js', 'Express', 'MongoDB', 'JavaScript', 'TypeScript', 'REST API',
//       'GraphQL', 'Redux', 'HTML', 'CSS', 'Git', 'AWS', 'Docker', 'CI/CD', 'Agile'
//     ];

//     // Construct prompt
//     const prompt = `
// You are an ATS (Applicant Tracking System) analyzer. Analyze the following resume for compatibility with a MERN stack developer job role. Use the following job keywords for reference: ${jobKeywords.join(', ')}.
// Provide the analysis in JSON format with the following structure:
// {
//   "atsScore": <number between 0 and 100>,
//   "missingKeywords": [<array of missing keywords from the job keywords>],
//   "suggestions": [<array of 3-5 specific, actionable suggestions to improve ATS compatibility>]
// }

// Resume text:
// ${resumeText}`;

//     // Call Gemini API
//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();

//     console.log('Gemini raw response:', responseText);

//     // Parse response
//     let atsResult;
//     try {
//       // Remove markdown code block markers if present
//       const cleanedResponse = responseText.replace(/```json\n|\n```/g, '').trim();
//       atsResult = JSON.parse(cleanedResponse);
//     } catch (parseErr) {
//       console.warn('Failed to parse Gemini response as JSON:', parseErr.message);
//       // Fallback parsing with regex
//       const scoreMatch = responseText.match(/atsScore["']?\s*:\s*(\d+)/i);
//       const keywordsMatch = responseText.match(/missingKeywords["']?\s*:\s*\[([^\]]*)\]/i);
//       const suggestionsMatch = responseText.match(/suggestions["']?\s*:\s*\[([^\]]*)\]/i);

//       const parseArray = (str) => {
//         if (!str) return [];
//         return str.split(',').map(item => item.trim().replace(/['"]+/g, '')).filter(item => item);
//       };

//       atsResult = {
//         atsScore: scoreMatch ? parseInt(scoreMatch[1]) : 50,
//         missingKeywords: keywordsMatch ? parseArray(keywordsMatch[1]) : [],
//         suggestions: suggestionsMatch ? parseArray(suggestionsMatch[1]) : [
//           'Include more technical keywords like React, Node.js, or MongoDB.',
//           'Add specific project details to highlight relevant experience.',
//           'Use action verbs and quantify achievements where possible.'
//         ]
//       };
//     }

//     // Validate and normalize response
//     atsResult.atsScore = Math.max(0, Math.min(100, atsResult.atsScore || 50));
//     atsResult.missingKeywords = Array.isArray(atsResult.missingKeywords) ? atsResult.missingKeywords : [];
//     atsResult.suggestions = Array.isArray(atsResult.suggestions) && atsResult.suggestions.length >= 3
//       ? atsResult.suggestions.slice(0, 5)
//       : [
//           'Include more technical keywords like React, Node.js, or MongoDB.',
//           'Add specific project details to highlight relevant experience.',
//           'Use action verbs and quantify achievements where possible.'
//         ];

//     console.log('Parsed ATS result:', atsResult);

//     res.status(200).json(atsResult);
//   } catch (err) {
//     console.error('ATS analysis error:', err.message, err.stack);
//     let status = 500;
//     let message = 'Failed to analyze resume';

//     if (err.message.includes('API key')) {
//       status = 500;
//       message = 'Invalid or missing Gemini API key';
//     } else if (err.message.includes('network') || err.code === 'ECONNABORTED') {
//       status = 503;
//       message = 'Network error connecting to Gemini API';
//     } else if (err.message.includes('Quota')) {
//       status = 429;
//       message = 'Gemini API quota exceeded';
//     }

//     res.status(status).json({ message });
//   }
// });

// // Start server
// const PORT = process.env.PORT || 4000;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));




const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resumes');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173','https://resume-builder-frontend-dun.vercel.app/'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'resumebuildersecret',
    resave: false,
    saveUnInitialized: false,
    cookie: { secure: false, maxAge: 3600000 },
  })
);

// Connect to MongoDB
connectDB();

// Routes
app.use('/api', authRoutes);
app.use('/api/resumes', resumeRoutes);
// app.use('/api', atsRoutes);

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port${PORT}`));