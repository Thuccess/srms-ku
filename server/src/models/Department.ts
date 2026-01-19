import mongoose, { Document, Schema } from 'mongoose';

export interface IDepartment extends Document {
  code: string; // Unique department code (e.g., "CS", "IT", "BA")
  name: string; // Department name (e.g., "Computer Science")
  facultyId: mongoose.Types.ObjectId; // Reference to Faculty
  description?: string; // Optional description
  hodId?: mongoose.Types.ObjectId; // Reference to User (HOD role)
  isActive: boolean; // Whether department is active
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
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
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hodId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
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
departmentSchema.index({ code: 1, isActive: 1 });
departmentSchema.index({ facultyId: 1, isActive: 1 });
departmentSchema.index({ name: 1, isActive: 1 });

export default mongoose.model<IDepartment>('Department', departmentSchema);

