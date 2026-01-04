import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { UserRole } from '../models/User.js';
import Student from '../models/Student.js';
import mongoose from 'mongoose';
import { getProgramsForFaculty, getProgramsForDepartment, getCoursesForLecturer, isStudentEnrolledInCourse } from '../services/mappingService.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Enforces access control based on user roles and scoping fields.
 * This is the AUTHORITATIVE access control - frontend checks are for UX only.
 * 
 * Security Principle: Fail closed (deny by default)
 */

/**
 * Middleware to authorize specific roles
 * 
 * @param roles - Array of allowed roles
 * 
 * Usage:
 * router.get('/admin-only', authenticate, authorizeRoles(UserRole.IT_ADMIN), handler)
 * router.get('/academic', authenticate, authorizeRoles(UserRole.DEAN, UserRole.HOD), handler)
 */
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Access denied. Insufficient permissions for this operation.' 
      });
      return;
    }

    next();
  };
};

/**
 * Scope enforcement: Filter students based on user's role and scope
 * 
 * This function builds a MongoDB query filter based on:
 * - User role (VC/DVC see aggregated only, no individual access)
 * - Faculty ID (for DEAN)
 * - Department ID (for HOD)
 * - Assigned courses (for LECTURER)
 * - Assigned students (for ADVISOR)
 * 
 * @param user - Authenticated user
 * @returns Promise<MongoDB query filter object>
 */
export const buildStudentScopeFilter = async (user: AuthRequest['user']): Promise<any> => {
  if (!user) {
    // No user = no access
    return { _id: { $in: [] } }; // Empty result set
  }

  const filter: any = {};

  switch (user.role) {
    case UserRole.VC:
    case UserRole.DVC_ACADEMIC:
      // VC and DVC_ACADEMIC should NOT see individual students
      // They only see aggregated analytics (handled in analytics controller)
      return { _id: { $in: [] } }; // Empty result set - force aggregation only

    case UserRole.DEAN:
      // Faculty-scoped: Only students in their faculty
      // Uses facultyId to filter students directly
      if (user.facultyId) {
        filter.facultyId = user.facultyId;
        // Also filter by programs in this faculty (for backward compatibility with program field)
        const facultyPrograms = await getProgramsForFaculty(user.facultyId.toString());
        if (facultyPrograms.length > 0) {
          filter.$or = [
            { facultyId: user.facultyId },
            { program: { $in: facultyPrograms } }
          ];
        }
      } else {
        // No faculty assigned = no access
        return { _id: { $in: [] } };
      }
      break;

    case UserRole.HOD:
      // Department-scoped: Only students in their department
      if (user.departmentId) {
        filter.departmentId = user.departmentId;
        // Also filter by programs in this department (for backward compatibility)
        const departmentPrograms = await getProgramsForDepartment(user.departmentId.toString());
        if (departmentPrograms.length > 0) {
          filter.$or = [
            { departmentId: user.departmentId },
            { program: { $in: departmentPrograms } }
          ];
        }
      } else {
        return { _id: { $in: [] } };
      }
      break;

    case UserRole.ADVISOR:
      // Assigned students ONLY
      if (user.assignedStudents && user.assignedStudents.length > 0) {
        filter._id = { $in: user.assignedStudents };
      } else {
        // No assigned students = no access
        return { _id: { $in: [] } };
      }
      break;

    case UserRole.LECTURER:
      // Course-scoped: Only students enrolled in their assigned courses
      if (user.assignedCourses && user.assignedCourses.length > 0) {
        const lecturerCourseIds = await getCoursesForLecturer(
          user.assignedCourses.map(id => id.toString())
        );
        
        if (lecturerCourseIds.length > 0) {
          // Filter students by enrolledCourses array
          filter.enrolledCourses = { $in: lecturerCourseIds };
        } else {
          // No courses mapped = no access
          return { _id: { $in: [] } };
        }
      } else {
        // No assigned courses = no access
        return { _id: { $in: [] } };
      }
      break;

    case UserRole.REGISTRY:
      // Registry can see all students for data integrity purposes
      // But NO AI risk scores unless explicitly enabled (handled in response transformation)
      // No filter needed - can see all
      break;

    case UserRole.IT_ADMIN:
      // IT Admin should NOT see student data
      return { _id: { $in: [] } };

    default:
      // Unknown role = no access
      return { _id: { $in: [] } };
  }

  return filter;
};

/**
 * Middleware to enforce student access scope
 * Automatically filters student queries based on user role
 * 
 * Usage:
 * router.get('/students', authenticate, enforceStudentScope, getAllStudents)
 */
export const enforceStudentScope = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // Attach scope filter to request for use in controllers
    (req as any).scopeFilter = await buildStudentScopeFilter(req.user);
    next();
  } catch (error) {
    console.error('Error building student scope filter:', error);
    res.status(500).json({ error: 'Failed to determine access scope' });
  }
};

/**
 * Check if user can view a specific student
 * 
 * @param user - Authenticated user
 * @param studentId - Student ID to check
 * @returns Promise<boolean> - true if user can view this student
 */
export const canViewStudent = async (
  user: AuthRequest['user'],
  studentId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  if (!user) return false;

  try {
    const scopeFilter = await buildStudentScopeFilter(user);
    
    // If filter returns empty set, user cannot view any students
    if (scopeFilter._id && Array.isArray(scopeFilter._id.$in) && scopeFilter._id.$in.length === 0) {
      return false;
    }

    // Check if student exists in scope
    const studentObjectId = typeof studentId === 'string' 
      ? new mongoose.Types.ObjectId(studentId) 
      : studentId;

    const student = await Student.findOne({
      _id: studentObjectId,
      ...scopeFilter,
    });

    return !!student;
  } catch (error) {
    console.error('Error checking student access:', error);
    return false;
  }
};

/**
 * Check if user can view aggregated data (for VC, DVC, DEAN)
 * 
 * @param user - Authenticated user
 * @returns boolean
 */
export const canViewAggregatedData = (user: AuthRequest['user']): boolean => {
  if (!user) return false;

  return [
    UserRole.VC,
    UserRole.DVC_ACADEMIC,
    UserRole.DEAN,
    UserRole.HOD,
    UserRole.REGISTRY,
  ].includes(user.role);
};

/**
 * Check if user can view individual student data
 * 
 * @param user - Authenticated user
 * @returns boolean
 */
export const canViewIndividualStudents = (user: AuthRequest['user']): boolean => {
  if (!user) return false;

  // VC and DVC_ACADEMIC cannot view individual students
  if ([UserRole.VC, UserRole.DVC_ACADEMIC, UserRole.IT_ADMIN].includes(user.role)) {
    return false;
  }

  return true;
};

/**
 * Check if user can view AI risk scores
 * 
 * @param user - Authenticated user
 * @param registryCanViewRiskScores - System setting for REGISTRY AI risk score visibility (optional)
 * @returns boolean
 */
export const canViewRiskScores = (
  user: AuthRequest['user'],
  registryCanViewRiskScores: boolean = false
): boolean => {
  if (!user) return false;

  // IT_ADMIN cannot view any student data
  if (user.role === UserRole.IT_ADMIN) {
    return false;
  }

  // REGISTRY cannot view AI risk scores unless explicitly enabled in system settings
  if (user.role === UserRole.REGISTRY) {
    return registryCanViewRiskScores;
  }

  return true;
};

