import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

/**
 * Sanitize and validate request body
 * Removes potentially dangerous characters and validates input
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Recursively sanitize string values in request body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Validation middleware for common fields
 */
export const validateCommonFields = [
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('studentNumber').optional().trim().escape(),
  body('gpa').optional().isFloat({ min: 0, max: 5 }).withMessage('GPA must be between 0 and 5'),
  body('attendance').optional().isFloat({ min: 0, max: 100 }).withMessage('Attendance must be between 0 and 100'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  },
];

