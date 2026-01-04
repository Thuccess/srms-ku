/**
 * CSRF Protection Middleware
 * 
 * Note: For JWT-based authentication with Authorization headers (not cookies),
 * CSRF protection is less critical. However, this middleware is provided for
 * additional security if needed, especially for state-changing operations.
 * 
 * In production, consider:
 * - Using SameSite cookies if switching to cookie-based auth
 * - Implementing CSRF tokens for sensitive operations
 * - Using double-submit cookie pattern
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Generate CSRF token
 * This can be used to generate tokens for forms or sensitive operations
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF token endpoint (optional - for future use)
 * GET /api/csrf-token
 */
export const getCsrfToken = (req: Request, res: Response): void => {
  const token = generateCsrfToken();
  
  // Store token in session or return to client
  // For JWT-based auth, client can store in memory
  res.json({ csrfToken: token });
};

/**
 * Validate CSRF token middleware (optional)
 * Use this for sensitive operations if needed
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // For JWT-based APIs, CSRF validation is optional
  // Uncomment and implement if needed:
  
  // const token = req.headers['x-csrf-token'] || req.body.csrfToken;
  // const sessionToken = req.session?.csrfToken;
  
  // if (!token || token !== sessionToken) {
  //   return res.status(403).json({ error: 'Invalid CSRF token' });
  // }
  
  next();
};

