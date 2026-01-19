import { Router } from 'express';
import {
  getCourses,
  getEnrolledStudents,
  submitAttendance,
  getAttendanceSubmissions,
  getAttendanceReports,
  getCourseAttendanceSummary,
  getStudentAttendanceSummary,
  getAttendanceTrends,
} from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/rbac.middleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

// All attendance routes require authentication and RECEPTIONIST role
router.use(authenticate);
router.use(authorizeRoles(UserRole.RECEPTIONIST));

// Get all active courses (for selection)
router.get('/courses', getCourses);

// Get enrolled students for a course
router.get('/courses/:courseId/students', getEnrolledStudents);

// Submit attendance records
router.post('/submit', submitAttendance);

// Get attendance submissions (view only)
router.get('/submissions', getAttendanceSubmissions);

// Attendance reports and analytics endpoints
router.get('/reports', getAttendanceReports);
router.get('/reports/course-summary', getCourseAttendanceSummary);
router.get('/reports/student-summary', getStudentAttendanceSummary);
router.get('/reports/trends', getAttendanceTrends);

export default router;
