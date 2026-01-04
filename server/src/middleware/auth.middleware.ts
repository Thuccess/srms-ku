import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser, UserRole } from '../models/User.js';
import logger from '../utils/logger.js';

/**
 * Extended Express Request interface to include authenticated user
 */
export interface AuthRequest extends Request {
  user?: IUser;
}

/**
 * Get JWT Secret from environment (REQUIRED)
 * Must be set in production - minimum 32 characters recommended
 * This function is called lazily to allow environment validation to run first
 */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Please set it in your .env file. ' +
      'Generate a strong secret with: openssl rand -base64 32'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long for security. ' +
      'Current length: ' + secret.length
    );
  }
  return secret;
};

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request object
 * 
 * Usage: Add to routes that require authentication
 * Example: router.get('/protected', authenticate, handler)
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'Authentication required. Please provide a valid token.' 
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token has expired. Please login again.' });
        return;
      } else if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token. Please login again.' });
        return;
      }
      throw error;
    }

    // Fetch user from database (exclude password)
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      res.status(401).json({ error: 'User not found. Token is invalid.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
      return;
    }

    // Update last login (skip validation since we're not modifying password)
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Attach user to request object
    req.user = user;
    next();
  } catch (error: any) {
    logger.error('Authentication error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
};

/**
 * Generate JWT token for a user
 * 
 * @param userId - MongoDB user ID
 * @returns JWT token string
 */
export const generateToken = (userId: string): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  // Type assertion needed due to strict TypeScript types in jsonwebtoken
  return jwt.sign(
    { userId },
    getJwtSecret(),
    { expiresIn } as jwt.SignOptions
  );
};

