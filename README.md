Resume Builder Backend
Overview
This repository contains the backend code for the Resume Builder application, built using Node.js and Express. It provides RESTful APIs for managing resume data, user authentication, and other backend services.
Prerequisites

Node.js (version 16.x or higher)
npm (version 8.x or higher) or yarn
MongoDB (local or cloud instance, e.g., MongoDB Atlas)
(Optional) Postman or similar tool for testing APIs

Installation

Clone the repository:
git clone https://github.com/your-username/resume-builder-backend.git
cd resume-builder-backend


Install dependencies:
npm install

Or, if using yarn:
yarn install



Configuration
Create a .env file in the root directory with the following variables:
PORT=5000
MONGO_URI=mongodb://localhost:27017/resume-builder
JWT_SECRET=your_jwt_secret_key


Replace mongodb://localhost:27017/resume-builder with your MongoDB connection string.
Replace your_jwt_secret_key with a secure key for JWT authentication.

Running the Application

Start the server:
node server.js

Or, if using yarn:
yarn server.js

API Endpoints

POST /api/auth/register: Register a new user.
POST /api/auth/login: Authenticate a user and return a JWT.
GET /api/resumes: Fetch all resumes for a user.
POST /api/resumes: Create a new resume.
PUT /api/resumes/:id: Update a resume.
DELETE /api/resumes/:id: Delete a resume.

Project Structure

src/: Contains the source code, including routes, controllers, and models.
config/: Database connection and configuration files.
package.json: Lists dependencies and scripts.

Available Scripts

npm start: Runs the app using Node.js.
npm run dev: Runs the app with nodemon for development.
npm test: Runs the test suite (if configured).

Notes

Ensure MongoDB is running and accessible via the MONGO_URI specified in .env.
The frontend expects the backend to be available at the URL specified in its REACT_APP_API_URL.
For production, consider using a process manager like PM2 and secure the server with HTTPS.
