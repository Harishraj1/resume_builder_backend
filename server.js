  const express = require('express');
  const cors = require('cors');
  const session = require('express-session');
  const fs = require('fs').promises;
  const path = require('path');
  require('dotenv').config();
  const connectDB = require('./config/db');
  const authRoutes = require('./routes/auth');
  const resumeRoutes = require('./routes/resumes');
  const atsRoutes = require('./routes/ats');

  const app = express();

  // Middleware
 const allowedOrigins = [
  'https://resume-builder-frontend-h8wa.onrender.com',
  'http://localhost:5173'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));




  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  
  // Add this after creating the app
app.set('trust proxy', 1); // Trust first proxy

// Update session configuration
app.use(
  session({
    name: 'resume.sid', // Explicit session cookie name
    secret: process.env.SESSION_SECRET || 'resumebuildersecret',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Add this if behind a proxy (like on Render)
    cookie: { 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 3600000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: true,
      path: '/',
    }  
  })
);

  // Connect to MongoDB
  connectDB();
  // Routes
  app.use('/api', authRoutes);
  app.use('/resumes', resumeRoutes);
  app.use('/api', atsRoutes);

  // New endpoint to fetch jobs from jobs.json
  app.get('/jobs', async (req, res) => {
    try {
      const jobsPath = path.join(__dirname, 'data', 'jobs.json');
      console.log('Attempting to read jobs from:', jobsPath); // Debug log
      const jobsData = await fs.readFile(jobsPath, 'utf8');
      const jobs = JSON.parse(jobsData);
      console.log('Jobs data:', jobs); // Debug log
      res.status(200).json(jobs);
    } catch (err) {
      console.error('Error reading jobs.json:', err);
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  app.use('/test', (req, res) => {
    res.send('Welcome to the Resume Builder API');
  });
  // Start server
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));