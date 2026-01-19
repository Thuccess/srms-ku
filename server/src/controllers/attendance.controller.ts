import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { UserRole } from '../models/User.js';
import AttendanceRecord, { AttendanceStatus } from '../models/AttendanceRecord.js';
import Course from '../models/Course.js';
import CourseEnrollment from '../models/CourseEnrollment.js';
import Student from '../models/Student.js';
import logger from '../utils/logger.js';

/**
 * Get all active courses
 * RECEPTIONIST only - for course selection
 */
export const getCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const courses = await Course.find({ isActive: true })
      .select('code name credits')
      .sort({ code: 1 })
      .lean();

    res.json(courses);
  } catch (error: any) {
    logger.error('Error fetching courses:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

/**
 * Get enrolled students for a course
 * RECEPTIONIST only - returns student ID and name only
 */
export const getEnrolledStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const { courseId } = req.params;
    const { semester, academicYear } = req.query;

    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required' });
      return;
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Build query for enrollments
    const enrollmentQuery: any = {
      courseId,
      status: 'ENROLLED',
    };

    if (semester) {
      enrollmentQuery.semester = semester;
    }
    if (academicYear) {
      enrollmentQuery.academicYear = Number(academicYear);
    }

    // Get enrollments
    const enrollments = await CourseEnrollment.find(enrollmentQuery)
      .populate('studentId', 'studentNumber studentRegistrationNumber')
      .lean();

    // Extract student info (only ID and name/studentNumber as required)
    const students = enrollments
      .filter((enrollment: any) => enrollment.studentId) // Filter out any null studentIds
      .map((enrollment: any) => ({
        id: enrollment.studentId._id?.toString() || enrollment.studentId.toString(),
        studentId: enrollment.studentId.studentNumber || enrollment.studentId.studentRegistrationNumber || 'N/A',
        studentName: enrollment.studentId.studentNumber || enrollment.studentId.studentRegistrationNumber || 'N/A',
      }));

    res.json(students);
  } catch (error: any) {
    logger.error('Error fetching enrolled students:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch enrolled students' });
  }
};

/**
 * Submit attendance records
 * RECEPTIONIST only - creates attendance records for students
 */
export const submitAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can submit attendance.' });
      return;
    }

    const {
      courseId,
      courseUnit,
      lectureDate,
      lecturerName,
      attendanceRecords, // Array of { studentId, status }
    } = req.body;

    // Validation
    if (!courseId || !lectureDate || !lecturerName || !Array.isArray(attendanceRecords)) {
      res.status(400).json({ error: 'Missing required fields: courseId, lectureDate, lecturerName, attendanceRecords' });
      return;
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Validate lecture date
    const lectureDateObj = new Date(lectureDate);
    if (isNaN(lectureDateObj.getTime())) {
      res.status(400).json({ error: 'Invalid lecture date' });
      return;
    }

    // Process attendance records
    const records = [];
    const errors = [];

    for (const record of attendanceRecords) {
      const { studentId, status } = record;

      if (!studentId || !status) {
        errors.push(`Invalid record: missing studentId or status`);
        continue;
      }

      if (!Object.values(AttendanceStatus).includes(status)) {
        errors.push(`Invalid status for student ${studentId}: ${status}`);
        continue;
      }

      // Verify student exists
      const student = await Student.findById(studentId);
      if (!student) {
        errors.push(`Student not found: ${studentId}`);
        continue;
      }

      try {
        // Use findOneAndUpdate with upsert to handle duplicates
        const attendanceRecord = await AttendanceRecord.findOneAndUpdate(
          {
            studentId,
            courseId,
            lectureDate: lectureDateObj,
          },
          {
            courseId,
            courseUnit: courseUnit || undefined,
            lectureDate: lectureDateObj,
            lecturerName,
            studentId,
            status,
            receptionistId: req.user._id,
            submittedAt: new Date(),
            isFinalized: true, // Once submitted, it's finalized
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        records.push(attendanceRecord);
      } catch (error: any) {
        logger.error('Error creating attendance record:', { error: error.message, studentId, courseId });
        errors.push(`Failed to create record for student ${studentId}: ${error.message}`);
      }
    }

    res.json({
      message: 'Attendance submitted successfully',
      recordsCreated: records.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error('Error submitting attendance:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to submit attendance' });
  }
};

/**
 * Get attendance submissions
 * RECEPTIONIST only - view their own submissions
 */
export const getAttendanceSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can view attendance submissions.' });
      return;
    }

    const { courseId, lectureDate } = req.query;

    // Build query
    const query: any = {
      receptionistId: req.user._id,
    };

    if (courseId) {
      query.courseId = courseId;
    }

    if (lectureDate) {
      const date = new Date(lectureDate as string);
      if (!isNaN(date.getTime())) {
        // Query for records on the same day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.lectureDate = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    const records = await AttendanceRecord.find(query)
      .populate('courseId', 'code name')
      .populate('studentId', 'studentNumber studentRegistrationNumber')
      .sort({ submittedAt: -1, lectureDate: -1 })
      .lean();

    // Format response
    const formattedRecords = records.map((record: any) => ({
      id: record._id.toString(),
      course: {
        id: record.courseId._id.toString(),
        code: record.courseId.code,
        name: record.courseId.name,
      },
      courseUnit: record.courseUnit,
      lectureDate: record.lectureDate,
      lecturerName: record.lecturerName,
      student: {
        id: record.studentId._id.toString(),
        studentId: record.studentId.studentNumber || record.studentId.studentRegistrationNumber,
      },
      status: record.status,
      submittedAt: record.submittedAt,
      isFinalized: record.isFinalized,
    }));

    res.json(formattedRecords);
  } catch (error: any) {
    logger.error('Error fetching attendance submissions:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch attendance submissions' });
  }
};

/**
 * Get comprehensive attendance reports with filters
 * RECEPTIONIST only - generates reports based on query parameters
 */
export const getAttendanceReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const { courseId, studentId, lecturerName, startDate, endDate } = req.query;

    // Build query
    const query: any = {
      receptionistId: req.user._id,
    };

    if (courseId) {
      query.courseId = courseId;
    }

    if (studentId) {
      query.studentId = studentId;
    }

    if (lecturerName) {
      query.lecturerName = { $regex: lecturerName as string, $options: 'i' };
    }

    if (startDate || endDate) {
      query.lectureDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.lectureDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.lectureDate.$lte = end;
      }
    }

    // Get all matching records
    const records = await AttendanceRecord.find(query)
      .populate('courseId', 'code name')
      .populate('studentId', 'studentNumber studentRegistrationNumber')
      .sort({ lectureDate: -1 })
      .lean();

    // Calculate summary statistics
    const totalRecords = records.length;
    const presentCount = records.filter((r: any) => r.status === AttendanceStatus.PRESENT).length;
    const absentCount = records.filter((r: any) => r.status === AttendanceStatus.ABSENT).length;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    // Group by course
    const courseStats: Record<string, any> = {};
    records.forEach((record: any) => {
      const courseId = record.courseId._id.toString();
      if (!courseStats[courseId]) {
        courseStats[courseId] = {
          course: {
            id: courseId,
            code: record.courseId.code,
            name: record.courseId.name,
          },
          total: 0,
          present: 0,
          absent: 0,
          attendanceRate: 0,
        };
      }
      courseStats[courseId].total++;
      if (record.status === AttendanceStatus.PRESENT) {
        courseStats[courseId].present++;
      } else {
        courseStats[courseId].absent++;
      }
    });

    // Calculate attendance rates for each course
    Object.values(courseStats).forEach((stat: any) => {
      stat.attendanceRate = stat.total > 0 ? (stat.present / stat.total) * 100 : 0;
    });

    res.json({
      summary: {
        totalRecords,
        presentCount,
        absentCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      },
      courseStats: Object.values(courseStats),
      records: records.map((record: any) => ({
        id: record._id.toString(),
        course: {
          id: record.courseId._id.toString(),
          code: record.courseId.code,
          name: record.courseId.name,
        },
        student: {
          id: record.studentId._id.toString(),
          studentId: record.studentId.studentNumber || record.studentId.studentRegistrationNumber,
        },
        lectureDate: record.lectureDate,
        lecturerName: record.lecturerName,
        status: record.status,
        courseUnit: record.courseUnit,
      })),
    });
  } catch (error: any) {
    logger.error('Error fetching attendance reports:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch attendance reports' });
  }
};

/**
 * Get attendance statistics by course
 * RECEPTIONIST only - course-level summaries
 */
export const getCourseAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const { startDate, endDate } = req.query;

    // Build query
    const query: any = {
      receptionistId: req.user._id,
    };

    if (startDate || endDate) {
      query.lectureDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.lectureDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.lectureDate.$lte = end;
      }
    }

    // Aggregate by course
    const courseSummary = await AttendanceRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$courseId',
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
          },
          uniqueStudents: { $addToSet: '$studentId' },
          uniqueLectures: { $addToSet: '$lectureDate' },
        },
      },
      {
        $project: {
          courseId: '$_id',
          totalRecords: 1,
          presentCount: 1,
          absentCount: 1,
          uniqueStudentCount: { $size: '$uniqueStudents' },
          uniqueLectureCount: { $size: '$uniqueLectures' },
          attendanceRate: {
            $cond: [
              { $eq: ['$totalRecords', 0] },
              0,
              { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
            ],
          },
        },
      },
    ]);

    // Populate course details
    const courseIds = courseSummary.map((item: any) => item.courseId);
    const courses = await Course.find({ _id: { $in: courseIds } })
      .select('code name credits')
      .lean();

    const courseMap = new Map(courses.map((c: any) => [c._id.toString(), c]));

    const formattedSummary = courseSummary.map((item: any) => {
      const course = courseMap.get(item.courseId.toString());
      return {
        course: course
          ? {
              id: course._id.toString(),
              code: course.code,
              name: course.name,
              credits: course.credits,
            }
          : null,
        totalRecords: item.totalRecords,
        presentCount: item.presentCount,
        absentCount: item.absentCount,
        uniqueStudentCount: item.uniqueStudentCount,
        uniqueLectureCount: item.uniqueLectureCount,
        attendanceRate: Math.round(item.attendanceRate * 100) / 100,
      };
    });

    res.json(formattedSummary);
  } catch (error: any) {
    logger.error('Error fetching course attendance summary:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch course attendance summary' });
  }
};

/**
 * Get attendance statistics by student
 * RECEPTIONIST only - student-level summaries
 */
export const getStudentAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const { courseId, startDate, endDate } = req.query;

    // Build query
    const query: any = {
      receptionistId: req.user._id,
    };

    if (courseId) {
      query.courseId = courseId;
    }

    if (startDate || endDate) {
      query.lectureDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.lectureDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.lectureDate.$lte = end;
      }
    }

    // Aggregate by student
    const studentSummary = await AttendanceRecord.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$studentId',
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
          },
          uniqueCourses: { $addToSet: '$courseId' },
          uniqueLectures: { $addToSet: '$lectureDate' },
        },
      },
      {
        $project: {
          studentId: '$_id',
          totalRecords: 1,
          presentCount: 1,
          absentCount: 1,
          uniqueCourseCount: { $size: '$uniqueCourses' },
          uniqueLectureCount: { $size: '$uniqueLectures' },
          attendanceRate: {
            $cond: [
              { $eq: ['$totalRecords', 0] },
              0,
              { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
            ],
          },
        },
      },
    ]);

    // Populate student details
    const studentIds = studentSummary.map((item: any) => item.studentId);
    const students = await Student.find({ _id: { $in: studentIds } })
      .select('studentNumber studentRegistrationNumber program yearOfStudy')
      .lean();

    const studentMap = new Map(students.map((s: any) => [s._id.toString(), s]));

    const formattedSummary = studentSummary.map((item: any) => {
      const student = studentMap.get(item.studentId.toString());
      return {
        student: student
          ? {
              id: student._id.toString(),
              studentId: student.studentNumber || student.studentRegistrationNumber,
              program: student.program,
              yearOfStudy: student.yearOfStudy,
            }
          : null,
        totalRecords: item.totalRecords,
        presentCount: item.presentCount,
        absentCount: item.absentCount,
        uniqueCourseCount: item.uniqueCourseCount,
        uniqueLectureCount: item.uniqueLectureCount,
        attendanceRate: Math.round(item.attendanceRate * 100) / 100,
      };
    });

    // Sort by attendance rate (ascending - lowest first)
    formattedSummary.sort((a, b) => a.attendanceRate - b.attendanceRate);

    res.json(formattedSummary);
  } catch (error: any) {
    logger.error('Error fetching student attendance summary:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch student attendance summary' });
  }
};

/**
 * Get attendance trends over time
 * RECEPTIONIST only - time-based trend analysis (daily/weekly/monthly)
 */
export const getAttendanceTrends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only RECEPTIONIST can access
    if (req.user.role !== UserRole.RECEPTIONIST) {
      res.status(403).json({ error: 'Access denied. Only RECEPTIONIST can access this endpoint.' });
      return;
    }

    const { courseId, period = 'daily', startDate, endDate } = req.query;

    // Build base query
    const matchQuery: any = {
      receptionistId: req.user._id,
    };

    if (courseId) {
      matchQuery.courseId = new mongoose.Types.ObjectId(courseId as string);
    }

    if (startDate || endDate) {
      matchQuery.lectureDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        matchQuery.lectureDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        matchQuery.lectureDate.$lte = end;
      }
    }

    // Determine date grouping based on period
    let dateFormat: any;
    if (period === 'daily') {
      dateFormat = {
        year: { $year: '$lectureDate' },
        month: { $month: '$lectureDate' },
        day: { $dayOfMonth: '$lectureDate' },
      };
    } else if (period === 'weekly') {
      dateFormat = {
        year: { $year: '$lectureDate' },
        week: { $week: '$lectureDate' },
      };
    } else if (period === 'monthly') {
      dateFormat = {
        year: { $year: '$lectureDate' },
        month: { $month: '$lectureDate' },
      };
    } else {
      dateFormat = {
        year: { $year: '$lectureDate' },
        month: { $month: '$lectureDate' },
        day: { $dayOfMonth: '$lectureDate' },
      };
    }

    // Aggregate trends
    const trends = await AttendanceRecord.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: dateFormat,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.PRESENT] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', AttendanceStatus.ABSENT] }, 1, 0] },
          },
          date: { $first: '$lectureDate' },
        },
      },
      {
        $project: {
          period: '$_id',
          date: 1,
          totalRecords: 1,
          presentCount: 1,
          absentCount: 1,
          attendanceRate: {
            $cond: [
              { $eq: ['$totalRecords', 0] },
              0,
              { $multiply: [{ $divide: ['$presentCount', '$totalRecords'] }, 100] },
            ],
          },
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Format the response
    const formattedTrends = trends.map((trend: any) => ({
      period: trend.period,
      date: trend.date,
      totalRecords: trend.totalRecords,
      presentCount: trend.presentCount,
      absentCount: trend.absentCount,
      attendanceRate: Math.round(trend.attendanceRate * 100) / 100,
    }));

    res.json({
      period: period as string,
      trends: formattedTrends,
    });
  } catch (error: any) {
    logger.error('Error fetching attendance trends:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch attendance trends' });
  }
};
