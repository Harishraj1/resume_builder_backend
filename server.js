const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const resumeRoutes = require('./routes/resumes');
const app = express();
// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://resume-builder-frontend-b8qv.onrender.com'
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
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'resumebuildersecret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production' ? true : false,
      maxAge: 3600000,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    },
  })
);
// Connect to MongoDB
connectDB();
// Routes
app.use('/api', authRoutes);
app.use('/api/resumes', resumeRoutes);

app.use('/', (req, res) => {
  res.send('Welcome to the Resume Builder API');
});
// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));