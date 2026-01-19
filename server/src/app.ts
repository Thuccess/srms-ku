import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeInput } from './middleware/sanitize.middleware.js';
import { requestLogger } from './middleware/requestLogger.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware.js';
import studentRoutes from './routes/student.routes.js';
import riskRoutes from './routes/risk.routes.js';
import authRoutes from './routes/auth.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Request logging middleware (should be early in the chain)
app.use(requestLogger);

// Security Headers - Helmet.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if needed
}));

// CORS configuration - allow client origin
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: 'text/csv', limit: '10mb' })); // Support CSV text uploads

// Input sanitization - apply to all routes
app.use(sanitizeInput);

// Rate limiting - General API (500 requests per 15 minutes per IP - increased for better UX)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs (increased from 100)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for DELETE operations (critical operations should not be rate limited)
    return req.method === 'DELETE';
  },
});

// Apply general rate limiting to all API routes
app.use('/api', generalLimiter);

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// CSRF token endpoint (optional - for JWT-based APIs, CSRF is less critical)
app.get('/api/csrf-token', (req, res) => {
  const { getCsrfToken } = require('./middleware/csrf.middleware.js');
  getCsrfToken(req, res);
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
app.use('/api/students', studentRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/attendance', attendanceRoutes);

// Serve static files from React app in production (optional - if deploying as single service)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
  const clientBuildPath = path.join(__dirname, '../../client/dist');
  const fs = require('fs');
  
  // Check if build directory exists
  if (fs.existsSync(clientBuildPath)) {
    console.info('Serving static files from', { path: clientBuildPath });
    
    // Serve static files (CSS, JS, images, etc.)
    app.use(express.static(clientBuildPath));
    
    // Handle React routing - return all non-API requests to React app
    app.get('*', (req, res, next) => {
      // Skip API routes and health check
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next();
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  } else {
    console.warn('Static files directory not found', { path: clientBuildPath, cwd: process.cwd(), __dirname });
  }
}

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;

