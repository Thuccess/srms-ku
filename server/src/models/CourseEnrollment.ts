import mongoose, { Document, Schema } from 'mongoose';

export enum EnrollmentStatus {
  ENROLLED = 'ENROLLED',
  COMPLETED = 'COMPLETED',
  DROPPED = 'DROPPED',
  FAILED = 'FAILED',
}

export interface ICourseEnrollment extends Document {
  studentId: mongoose.Types.ObjectId; // Reference to Student
  courseId: mongoose.Types.ObjectId; // Reference to Course
  semester: '1' | '2'; // Semester (1 or 2)
  academicYear: number; // Academic year (e.g., 2024)
  grade?: number; // Final grade (0-5 scale)
  attendance?: number; // Attendance percentage (0-100)
  status: EnrollmentStatus; // Enrollment status
  enrolledAt: Date; // When student enrolled
  completedAt?: Date; // When course was completed
  createdAt: Date;
  updatedAt: Date;
}

const courseEnrollmentSchema = new Schema<ICourseEnrollment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    semester: {
      type: String,
      enum: ['1', '2'],
      required: true,
      index: true,
    },
    academicYear: {
      type: Number,
      required: true,
      index: true,
    },
    grade: {
      type: Number,
      min: 0,
      max: 5,
    },
    attendance: {
      type: Number,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: Object.values(EnrollmentStatus),
      default: EnrollmentStatus.ENROLLED,
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound unique index: student can only enroll in a course once per semester/year
courseEnrollmentSchema.index(
  { studentId: 1, courseId: 1, semester: 1, academicYear: 1 },
  { unique: true }
);

// Index for common queries
courseEnrollmentSchema.index({ studentId: 1, status: 1 });
courseEnrollmentSchema.index({ courseId: 1, status: 1 });
courseEnrollmentSchema.index({ academicYear: 1, semester: 1 });

export default mongoose.model<ICourseEnrollment>('CourseEnrollment', courseEnrollmentSchema);

