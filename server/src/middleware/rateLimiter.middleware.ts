import rateLimit from 'express-rate-limit';

/**
 * Rate limiting - Login endpoint (5 attempts per 15 minutes per IP)
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting - Risk prediction (20 requests per minute per IP)
 */
export const riskPredictionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 risk prediction requests per minute
  message: 'Too many risk prediction requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

