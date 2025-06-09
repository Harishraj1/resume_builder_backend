// const express = require('express');
// const multer = require('multer');
// const pdfParse = require('pdf-parse');
// const { GoogleGenerativeAI } = require('@google/generative-ai');
// const fs = require('fs');
// const path = require('path');
// const authenticate = require('../middleware/auth');
// const router = express.Router();

// const upload = multer({ storage: multer.memoryStorage() });

// router.post('/analyze', authenticate, upload.single('resume'), async (req, res) => {
//   try {
//     if (!req.file) {
//       console.error('No resume file uploaded');
//       return res.status(400).json({ message: 'No resume file uploaded' });
//     }
//     console.log('Received resume file:', req.file.originalname, req.file.size, 'bytes');

//     const debugDir = path.join(__dirname, '../debug_pdfs');
//     if (!fs.existsSync(debugDir)) {
//       fs.mkdirSync(debugDir);
//     }
//     const debugPath = path.join(debugDir, `resume_${Date.now()}.pdf`);
//     fs.writeFileSync(debugPath, req.file.buffer);
//     console.log('Saved PDF for debugging at:', debugPath);

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

//     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

//     const jobKeywords = [
//       'React', 'Node.js', 'Express', 'MongoDB', 'JavaScript', 'TypeScript', 'REST API',
//       'GraphQL', 'Redux', 'HTML', 'CSS', 'Git', 'AWS', 'Docker', 'CI/CD', 'Agile'
//     ];

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

//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();

//     console.log('Gemini raw response:', responseText);

//     let atsResult;
//     try {
//       const cleanedResponse = responseText.replace(/```json\n|\n```/g, '').trim();
//       atsResult = JSON.parse(cleanedResponse);
//     } catch (parseErr) {
//       console.warn('Failed to parse Gemini response as JSON:', parseErr.message);
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

// module.exports = router;