import mongoose, { Document, Schema } from 'mongoose';

export interface IFaculty extends Document {
  code: string; // Unique faculty code (e.g., "FST", "FBA", "FED")
  name: string; // Faculty name (e.g., "Faculty of Science and Technology")
  description?: string; // Optional description
  deanId?: mongoose.Types.ObjectId; // Reference to User (DEAN role)
  isActive: boolean; // Whether faculty is active
  createdAt: Date;
  updatedAt: Date;
}

const facultySchema = new Schema<IFaculty>(
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
    description: {
      type: String,
      trim: true,
    },
    deanId: {
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
facultySchema.index({ code: 1, isActive: 1 });
facultySchema.index({ name: 1, isActive: 1 });

export default mongoose.model<IFaculty>('Faculty', facultySchema);

