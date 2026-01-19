import { Router } from 'express';
import { register, login, getProfile, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { loginLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', loginLimiter, login); // Apply rate limiting to login
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/profile', authenticate, getProfile);

export default router;

