import mongoose, { Document, Schema } from 'mongoose';

export interface IIntervention extends Document {
  studentId: mongoose.Types.ObjectId;
  type: string;
  description: string;
  date: Date;
  outcome?: string;
  status: 'Pending' | 'Completed';
  notes: string;
}

const interventionSchema = new Schema<IIntervention>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    outcome: { type: String },
    status: { type: String, enum: ['Pending', 'Completed'], required: true, default: 'Pending' },
    notes: { type: String, required: true, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model<IIntervention>('Intervention', interventionSchema);

