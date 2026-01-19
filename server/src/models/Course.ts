import mongoose, { Document, Schema } from 'mongoose';

export interface ICourse extends Document {
  code: string; // Unique course code (e.g., "CS101", "IT201")
  name: string; // Course name (e.g., "Introduction to Programming")
  departmentId: mongoose.Types.ObjectId; // Reference to Department
  credits: number; // Number of credit hours
  description?: string; // Optional description
  isActive: boolean; // Whether course is active
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
      max: 10, // Reasonable max credits per course
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for common queries
courseSchema.index({ code: 1, isActive: 1 });
courseSchema.index({ departmentId: 1, isActive: 1 });
courseSchema.index({ name: 1, isActive: 1 });

export default mongoose.model<ICourse>('Course', courseSchema);

