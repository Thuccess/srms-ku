import type { Response } from 'express';
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';
import Student from '../models/Student.js';
import { emitToAll, emitDashboardStats } from '../socket/socket.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { canViewRiskScores, canViewStudent } from '../middleware/rbac.middleware.js';
import { calculateRiskScore } from '../services/riskScoring.service.js';
import SystemSettings, { getSystemSettings } from '../models/SystemSettings.js';
import { riskPredictionLimiter } from '../middleware/rateLimiter.middleware.js';
import logger from '../utils/logger.js';

const router = Router();

// All risk routes require authentication
router.use(authenticate);

/**
 * Predict risk for a student
 * 
 * This endpoint:
 * 1. Calculates risk score using RULES-BASED logic (deterministic)
 * 
 * Access Rules:
 * - User must be able to view risk scores (not REGISTRY or IT_ADMIN)
 * - User must have access to the student (scope check)
 */
router.post('/predict-risk', riskPredictionLimiter, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Get system settings to check REGISTRY AI risk score visibility
  const settings = await getSystemSettings();
  const registryCanViewRiskScores = settings?.registryCanViewRiskScores || false;

  // Check if user can view risk scores (with system settings check)
  if (!canViewRiskScores(req.user, registryCanViewRiskScores)) {
    return res.status(403).json({ 
      error: 'Access denied. Your role does not have permission to view or generate risk scores.' 
    });
  }

  const { studentId, gpa, attendance, yearOfStudy, balance } = req.body;

  if (!studentId || typeof gpa !== 'number' || typeof attendance !== 'number' || typeof yearOfStudy !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid student risk payload.' });
  }

  try {
    // Find student first to check permissions
    const student = await Student.findOne({ 
      $or: [{ studentNumber: studentId }] 
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if user can view this student
    const canView = await canViewStudent(req.user, student._id);
    if (!canView) {
      return res.status(403).json({ 
        error: 'Access denied. This student is not within your assigned scope.' 
      });
    }

    // Use data from request or fallback to student record (only allowed fields)
    const studentGpa = gpa !== undefined ? gpa : (student.gpa || 0);
    const studentAttendance = attendance !== undefined ? attendance : (student.attendance || 0);
    const studentYear = yearOfStudy !== undefined ? yearOfStudy : (student.yearOfStudy || 1);
    const studentBalance = balance !== undefined ? balance : (student.balance || 0);

    // STEP 1: Calculate risk score using RULES-BASED logic (NO AI)
    // Only using allowed fields: gpa, attendance, yearOfStudy, balance
    const riskResult = calculateRiskScore({
      gpa: studentGpa,
      attendanceRate: studentAttendance,
      year: studentYear,
      tuitionBalance: studentBalance,
      financialStatus: studentBalance > 0 ? 'ARREARS' : 'CLEAR', // Infer from balance
    });

    logger.info(`Calculated risk score: ${riskResult.riskScore}/100 (${riskResult.riskLevel})`, {
      studentNumber: student.studentNumber,
    });

    // Emit real-time event
    emitToAll('risk:updated', {
      studentNumber: student.studentNumber,
      riskScore: riskResult.riskScore,
      riskLevel: riskResult.riskLevel,
    });
    emitDashboardStats();

    // Return response
    return res.json({ 
      riskScore: riskResult.riskScore, 
      riskLevel: riskResult.riskLevel,
      riskFactors: riskResult.riskFactors,
    });
  } catch (error: any) {
    logger.error('Risk prediction error:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Failed to calculate risk score.',
      details: error.message,
    });
  }
});

export default router;

