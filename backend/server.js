// Main server file for car shop application
// This handles HTTPS setup and middleware configuration

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Load environment variables first
require('dotenv').config();

// Import route handlers
const authRoutes = require('./routes/auth');
const carRoutes = require('./routes/cars');
const inquiryRoutes = require('./routes/inquiries');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic security middleware
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting - learned this prevents spam attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window
  message: 'Too many requests, please try again later.'
});
app.use(limiter);

// CORS setup - needed for frontend to communicate with backend
app.use(cors({
  origin: ['https://localhost:3000', 'https://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // For handling cookies with refresh tokens

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/inquiries', inquiryRoutes);

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// SSL certificate setup - required for HTTPS
const privateKey = fs.readFileSync(path.join(__dirname, 'ssl', 'server.key'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt'), 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Create HTTPS server (requirement for exam)
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`SSL Certificate: Active`);
  console.log(`Health check: https://localhost:${PORT}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully');
  httpsServer.close(() => {
    console.log('Process terminated');
  });
});