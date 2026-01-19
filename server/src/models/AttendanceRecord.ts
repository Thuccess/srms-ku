import mongoose, { Document, Schema } from 'mongoose';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export interface IAttendanceRecord extends Document {
  courseId: mongoose.Types.ObjectId; // Reference to Course
  courseUnit?: string; // Optional course unit identifier
  lectureDate: Date; // Date of the lecture
  lecturerName: string; // Name of the lecturer
  studentId: mongoose.Types.ObjectId; // Reference to Student
  status: AttendanceStatus; // PRESENT or ABSENT
  receptionistId: mongoose.Types.ObjectId; // Reference to User (RECEPTIONIST)
  submittedAt: Date; // When attendance was submitted
  isFinalized: boolean; // If true, record cannot be edited
  createdAt: Date;
  updatedAt: Date;
}

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    courseUnit: {
      type: String,
      trim: true,
    },
    lectureDate: {
      type: Date,
      required: true,
      index: true,
    },
    lecturerName: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      required: true,
      index: true,
    },
    receptionistId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isFinalized: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index: prevent duplicate attendance records for same student, course, and lecture date
attendanceRecordSchema.index(
  { studentId: 1, courseId: 1, lectureDate: 1 },
  { unique: true }
);

// Index for querying by receptionist
attendanceRecordSchema.index({ receptionistId: 1, submittedAt: -1 });

// Index for querying by course and date
attendanceRecordSchema.index({ courseId: 1, lectureDate: -1 });

export default mongoose.model<IAttendanceRecord>('AttendanceRecord', attendanceRecordSchema);
