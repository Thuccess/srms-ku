import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';
import Student from '../models/Student.js';
import { buildStudentScopeFilter, canViewRiskScores } from '../middleware/rbac.middleware.js';

/**
 * Analytics Controller
 * 
 * Provides role-based aggregated analytics.
 * 
 * Access Rules:
 * - VC/DVC: University-wide aggregated data only, NO individual student data
 * - DEAN: Faculty-level aggregated data
 * - HOD: Department-level aggregated data
 * - ADVISOR: Aggregated data for assigned students only
 * - LECTURER: Aggregated data for students in assigned courses
 * - REGISTRY: Academic data integrity metrics (NO AI risk scores)
 * - IT_ADMIN: No access to analytics
 */

/**
 * Get university-wide aggregated analytics
 * For VC and DVC_ACADEMIC roles
 */
export const getUniversityAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only VC and DVC_ACADEMIC can access university-wide analytics
    if (![UserRole.VC, UserRole.DVC_ACADEMIC].includes(req.user.role)) {
      res.status(403).json({ error: 'Access denied. University-wide analytics require VC or DVC_ACADEMIC role.' });
      return;
    }

    // Get all students for aggregation (no individual data returned)
    const students = await Student.find({});

    // Calculate aggregated metrics - only using allowed fields
    const totalStudents = students.length;

    const avgAttendance = students.length > 0
      ? students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length
      : 0;

    const avgGPA = students.length > 0
      ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length
      : 0;

    const totalBalance = students.reduce((sum, s) => sum + (s.balance || 0), 0);

    // Return aggregated data only (NO individual student identifiers)
    res.status(200).json({
      scope: 'university',
      period: new Date().toISOString(),
      metrics: {
        totalStudents,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        averageGPA: Math.round(avgGPA * 100) / 100,
        totalBalance,
      },
      // Explicitly exclude individual student data
      students: [],
    });
  } catch (error: any) {
    console.error('University analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch university analytics' });
  }
};

/**
 * Get faculty-level aggregated analytics
 * For DEAN role
 */
export const getFacultyAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== UserRole.DEAN) {
      res.status(403).json({ error: 'Access denied. Faculty analytics require DEAN role.' });
      return;
    }

    if (!req.user.facultyId) {
      res.status(400).json({ error: 'Faculty assignment required for DEAN role' });
      return;
    }

    // Build scope filter for faculty
    const scopeFilter = await buildStudentScopeFilter(req.user);
    const students = await Student.find(scopeFilter);

    // Calculate aggregated metrics - only using allowed fields
    const totalStudents = students.length;

    const avgAttendance = students.length > 0
      ? students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length
      : 0;

    const avgGPA = students.length > 0
      ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length
      : 0;

    // Group by program (within faculty) - support both 'program' and 'course' fields
    const courseStats: Record<string, any> = {};
    students.forEach(s => {
      const program = s.program || (s as any).course || 'Unknown';
      if (!courseStats[program]) {
        courseStats[program] = {
          total: 0,
        };
      }
      courseStats[program].total++;
    });

    res.status(200).json({
      scope: 'faculty',
      facultyId: req.user.facultyId,
      period: new Date().toISOString(),
      metrics: {
        totalStudents,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        averageGPA: Math.round(avgGPA * 100) / 100,
        courseBreakdown: Object.entries(courseStats).map(([program, stats]) => ({
          course: program, // Keep 'course' key for backward compatibility
          program, // Also include 'program' key
          ...stats,
        })),
      },
      // NO individual student data
      students: [],
    });
  } catch (error: any) {
    console.error('Faculty analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch faculty analytics' });
  }
};

/**
 * Get department-level aggregated analytics
 * For HOD role
 */
export const getDepartmentAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== UserRole.HOD) {
      res.status(403).json({ error: 'Access denied. Department analytics require HOD role.' });
      return;
    }

    if (!req.user.departmentId) {
      res.status(400).json({ error: 'Department assignment required for HOD role' });
      return;
    }

    const scopeFilter = await buildStudentScopeFilter(req.user);
    const students = await Student.find(scopeFilter);

    // Calculate aggregated metrics - only using allowed fields
    const totalStudents = students.length;

    const avgAttendance = students.length > 0
      ? students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length
      : 0;

    const avgGPA = students.length > 0
      ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length
      : 0;

    res.status(200).json({
      scope: 'department',
      departmentId: req.user.departmentId,
      period: new Date().toISOString(),
      metrics: {
        totalStudents,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        averageGPA: Math.round(avgGPA * 100) / 100,
      },
      // HOD can see individual students (handled in student routes)
      // But analytics endpoint returns aggregated only
      students: [],
    });
  } catch (error: any) {
    console.error('Department analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch department analytics' });
  }
};

/**
 * Get registry data integrity metrics
 * For REGISTRY role - NO AI risk scores
 */
export const getRegistryMetrics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (req.user.role !== UserRole.REGISTRY) {
      res.status(403).json({ error: 'Access denied. Registry metrics require REGISTRY role.' });
      return;
    }

    // Get all students (registry can see all for data integrity)
    const students = await Student.find({});

    // Calculate enrollment and progression metrics - only using allowed fields
    const totalStudents = students.length;

    const avgGPA = students.length > 0
      ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length
      : 0;

    const avgAttendance = students.length > 0
      ? students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length
      : 0;

    const totalBalance = students.reduce((sum, s) => sum + (s.balance || 0), 0);

    res.status(200).json({
      scope: 'registry',
      period: new Date().toISOString(),
      metrics: {
        enrollment: {
          total: totalStudents,
        },
        averageGPA: Math.round(avgGPA * 100) / 100,
        averageAttendance: Math.round(avgAttendance * 100) / 100,
        totalBalance,
      },
    });
  } catch (error: any) {
    console.error('Registry metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch registry metrics' });
  }
};

/**
 * Get general analytics based on user role
 * Automatically routes to appropriate analytics endpoint
 */
export const getAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Route to appropriate analytics based on role
    switch (req.user.role) {
      case UserRole.VC:
      case UserRole.DVC_ACADEMIC:
        return getUniversityAnalytics(req, res);
      case UserRole.DEAN:
        return getFacultyAnalytics(req, res);
      case UserRole.HOD:
        return getDepartmentAnalytics(req, res);
      case UserRole.REGISTRY:
        return getRegistryMetrics(req, res);
      case UserRole.IT_ADMIN:
        res.status(403).json({ error: 'IT Admin cannot access academic analytics' });
        return;
      default:
        res.status(403).json({ error: 'Access denied. No analytics available for this role.' });
        return;
    }
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

