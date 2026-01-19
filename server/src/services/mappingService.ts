/**
 * Mapping Service
 * 
 * Provides mappings between:
 * - Programs and Faculties (via Departments)
 * - Programs and Departments
 * - Courses and Students
 * 
 * Uses database queries with the new Faculty, Department, Course, and CourseEnrollment models.
 */

import mongoose from 'mongoose';
import Department from '../models/Department.js';
import Course from '../models/Course.js';
import CourseEnrollment, { EnrollmentStatus } from '../models/CourseEnrollment.js';
import Student from '../models/Student.js';
import logger from '../utils/logger.js';

/**
 * Get departments for a faculty
 * Returns department IDs that belong to the faculty
 */
export const getDepartmentsForFaculty = async (facultyId: string): Promise<mongoose.Types.ObjectId[]> => {
  try {
    if (!facultyId || !mongoose.Types.ObjectId.isValid(facultyId)) {
      return [];
    }

    const departments = await Department.find({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      isActive: true,
    }).select('_id');

    return departments.map(dept => dept._id);
  } catch (error: any) {
    logger.error('Error getting departments for faculty:', { error: error.message, stack: error.stack });
    return [];
  }
};

/**
 * Get programs (departments) for a faculty
 * Returns department names/codes that belong to the faculty
 * This is used for filtering students by program name
 */
export const getProgramsForFaculty = async (facultyId: string): Promise<string[]> => {
  try {
    if (!facultyId || !mongoose.Types.ObjectId.isValid(facultyId)) {
      return [];
    }

    const departments = await Department.find({
      facultyId: new mongoose.Types.ObjectId(facultyId),
      isActive: true,
    }).select('name code');

    // Return both department names and codes for flexible matching
    const programs: string[] = [];
    departments.forEach(dept => {
      if (dept.name) programs.push(dept.name);
      if (dept.code) programs.push(dept.code);
    });

    return programs;
  } catch (error: any) {
    logger.error('Error getting programs for faculty:', { error: error.message, stack: error.stack });
    return [];
  }
};

/**
 * Get courses for a department
 * Returns course names/codes that belong to the department
 */
export const getProgramsForDepartment = async (departmentId: string): Promise<string[]> => {
  try {
    if (!departmentId || !mongoose.Types.ObjectId.isValid(departmentId)) {
      return [];
    }

    const courses = await Course.find({
      departmentId: new mongoose.Types.ObjectId(departmentId),
      isActive: true,
    }).select('name code');

    // Return both course names and codes
    const programs: string[] = [];
    courses.forEach(course => {
      if (course.name) programs.push(course.name);
      if (course.code) programs.push(course.code);
    });

    return programs;
  } catch (error: any) {
    logger.error('Error getting programs for department:', { error: error.message, stack: error.stack });
    return [];
  }
};

/**
 * Get courses for a lecturer
 * Returns course IDs that a lecturer is assigned to
 * 
 * @param assignedCourseIds - Array of course ObjectIds from User.assignedCourses
 * @returns Array of course ObjectIds
 */
export const getCoursesForLecturer = async (assignedCourseIds: string[]): Promise<mongoose.Types.ObjectId[]> => {
  try {
    if (!assignedCourseIds || assignedCourseIds.length === 0) {
      return [];
    }

    // Validate and convert to ObjectIds
    const courseIds = assignedCourseIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    if (courseIds.length === 0) {
      return [];
    }

    // Verify courses exist and are active
    const courses = await Course.find({
      _id: { $in: courseIds },
      isActive: true,
    }).select('_id');

    return courses.map(course => course._id);
  } catch (error: any) {
    logger.error('Error getting courses for lecturer:', { error: error.message, stack: error.stack });
    return [];
  }
};

/**
 * Check if a student is enrolled in a course
 * 
 * Uses Student.enrolledCourses array or CourseEnrollment model
 * 
 * @param studentId - Student ObjectId
 * @param courseId - Course ObjectId
 * @returns true if student is enrolled in the course
 */
export const isStudentEnrolledInCourse = async (
  studentId: mongoose.Types.ObjectId | string,
  courseId: mongoose.Types.ObjectId | string
): Promise<boolean> => {
  try {
    if (!studentId || !courseId) {
      return false;
    }

    const studentObjId = typeof studentId === 'string' 
      ? new mongoose.Types.ObjectId(studentId) 
      : studentId;
    const courseObjId = typeof courseId === 'string'
      ? new mongoose.Types.ObjectId(courseId)
      : courseId;

    // First, check Student.enrolledCourses array (quick check)
    const student = await Student.findById(studentObjId).select('enrolledCourses');
    if (student?.enrolledCourses?.some(id => id.toString() === courseObjId.toString())) {
      return true;
    }

    // Also check CourseEnrollment model for active enrollments
    const enrollment = await CourseEnrollment.findOne({
      studentId: studentObjId,
      courseId: courseObjId,
      status: { $in: [EnrollmentStatus.ENROLLED, EnrollmentStatus.COMPLETED] },
    });

    return !!enrollment;
  } catch (error: any) {
    logger.error('Error checking student enrollment:', { error: error.message, stack: error.stack });
    return false;
  }
};

