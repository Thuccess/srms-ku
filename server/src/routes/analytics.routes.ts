import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  getAnalytics,
  getUniversityAnalytics,
  getFacultyAnalytics,
  getDepartmentAnalytics,
  getRegistryMetrics,
} from '../controllers/analytics.controller.js';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// General analytics (auto-routes based on role)
router.get('/', getAnalytics);

// Specific analytics endpoints (for explicit access)
router.get('/university', getUniversityAnalytics);
router.get('/faculty', getFacultyAnalytics);
router.get('/department', getDepartmentAnalytics);
router.get('/registry', getRegistryMetrics);

export default router;

