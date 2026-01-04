import { Request, Response } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.middleware.js';
import { validatePassword } from '../utils/passwordValidator.js';
import logger from '../utils/logger.js';

/**
 * Register a new user (typically for admin use only)
 * In production, this should be protected and only accessible to IT_ADMIN
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, role, facultyId, departmentId, assignedCourses, assignedStudents } = req.body;

    // Validation
    if (!email || !password || !fullName || !role) {
      res.status(400).json({ error: 'Email, password, full name, and role are required' });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      fullName,
      role,
      facultyId,
      departmentId,
      assignedCourses,
      assignedStudents,
    });

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data (excluding password) and token
    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        facultyId: user.facultyId,
        departmentId: user.departmentId,
        assignedCourses: user.assignedCourses,
        assignedStudents: user.assignedStudents,
      },
      token,
    });
  } catch (error: any) {
    logger.error('Registration error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to register user' });
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Please contact administrator.' });
      return;
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password', { email: user.email });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Update last login (skip password validation since password wasn't modified)
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = generateToken(user._id.toString());

    // Return user data (excluding password) and token
    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        facultyId: user.facultyId,
        departmentId: user.departmentId,
        assignedCourses: user.assignedCourses,
        assignedStudents: user.assignedStudents,
      },
      token,
    });
  } catch (error: any) {
    logger.error('Login error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({ error: 'Failed to login', details: error.message });
  }
};

/**
 * Get current user profile
 * Requires authentication
 */
export const getProfile = async (req: any, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Return user data (excluding password)
    res.status(200).json({
      user: {
        id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        facultyId: req.user.facultyId,
        departmentId: req.user.departmentId,
        assignedCourses: req.user.assignedCourses,
        assignedStudents: req.user.assignedStudents,
        lastLogin: req.user.lastLogin,
      },
    });
  } catch (error: any) {
    logger.error('Get profile error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Forgot password - Generate reset token
 * Sends password reset token (in production, this would send an email)
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Don't reveal if user exists (security best practice)
    if (!user) {
      // Return success even if user doesn't exist (prevent email enumeration)
      res.status(200).json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // Token expires in 1 hour

    // Save reset token to user
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save({ validateBeforeSave: false });

    // In production, send email with reset link
    // For now, log the token (remove this in production!)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Password reset token generated', {
        email: user.email,
        resetToken,
        resetLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
      });
    }

    res.status(200).json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Remove this in production - only for development/testing
      ...(process.env.NODE_ENV === 'development' && {
        resetToken,
        resetLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`,
      }),
    });
  } catch (error: any) {
    logger.error('Forgot password error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

/**
 * Reset password - Validate token and update password
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      res.status(400).json({ 
        error: 'Password does not meet requirements',
        details: passwordValidation.errors 
      });
      return;
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }, // Token not expired
    }).select('+resetToken');

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Update password
    user.password = password;
    delete user.resetToken;
    delete user.resetTokenExpiry;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error: any) {
    logger.error('Reset password error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

