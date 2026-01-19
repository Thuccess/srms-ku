import mongoose, { Document, Schema } from 'mongoose';

export interface IStudent extends Document {
  // Allowed fields only
  studentNumber: string;
  studentRegistrationNumber?: string; // Optional field to satisfy database unique index constraint
  program: string; // Program name (renamed from 'course' for clarity)
  yearOfStudy: number;
  semesterOfStudy: '1' | '2';
  gpa: number;
  attendance: number;
  balance: number;

  // New relationship fields
  facultyId?: mongoose.Types.ObjectId; // Reference to Faculty
  departmentId?: mongoose.Types.ObjectId; // Reference to Department
  enrolledCourses?: mongoose.Types.ObjectId[]; // Array of Course IDs (for quick access)

  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    studentNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentRegistrationNumber: {
      type: String,
      required: false, // Optional - set to studentNumber when creating to satisfy DB unique index
      sparse: true, // Sparse index allows multiple null values, but unique values must be unique
    },
    program: {
      type: String,
      required: true,
      // Index added below to avoid duplicates
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      // Index added below to avoid duplicates
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      // Index added below to avoid duplicates
    },
    enrolledCourses: [{
      type: Schema.Types.ObjectId,
      ref: 'Course',
    }],
    yearOfStudy: {
      type: Number,
      required: true,
      min: 1,
    },
    semesterOfStudy: {
      type: String,
      enum: ['1', '2'],
      required: true,
    },
    gpa: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    attendance: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

// Performance Optimization: Add indexes for frequently queried fields
// These indexes improve query performance for large datasets (3000+ students)
// Indexes are added after schema definition to avoid affecting existing write operations

// Index for GPA queries (used in risk assessments and filtering)
studentSchema.index({ gpa: 1 });

// Index for attendance queries (used in risk assessments and filtering)
studentSchema.index({ attendance: 1 });

// Index for balance queries (used in financial risk assessments)
studentSchema.index({ balance: 1 });

// Index for program queries (used in filtering and scope-based access)
studentSchema.index({ program: 1 });
// Index for faculty and department relationships
studentSchema.index({ facultyId: 1 });
studentSchema.index({ departmentId: 1 });

// Index for year of study queries (used in filtering)
studentSchema.index({ yearOfStudy: 1 });

// Compound index for common query patterns (balance + createdAt for financial alerts)
studentSchema.index({ balance: 1, createdAt: -1 });

// Compound index for attendance + createdAt (for attendance risk queries)
studentSchema.index({ attendance: 1, createdAt: -1 });

// Compound index for GPA + createdAt (for academic risk queries)
studentSchema.index({ gpa: 1, createdAt: -1 });

export default mongoose.model<IStudent>('Student', studentSchema);

