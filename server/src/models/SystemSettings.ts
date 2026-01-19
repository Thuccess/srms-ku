import mongoose, { Document, Schema } from 'mongoose';

/**
 * System Settings Model
 * 
 * Stores system-wide configuration including:
 * - Risk assessment thresholds
 * - Registry AI risk score visibility
 * - Notification preferences
 */
export interface ISystemSettings extends Document {
  // Risk assessment thresholds
  criticalGpa: number;
  warningAttendance: number;
  financialLimit: number;
  
  // Registry AI risk score visibility
  registryCanViewRiskScores: boolean;
  
  // Notification preferences
  dailyDigest: boolean;
  smsAlerts: boolean;
  emailAlerts: boolean;
  notificationThreshold: number;
  autoAnalysis: boolean;
  
  // Metadata
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    criticalGpa: {
      type: Number,
      default: 2.0,
      min: 0,
      max: 5,
    },
    warningAttendance: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
    financialLimit: {
      type: Number,
      default: 1000000,
      min: 0,
    },
    registryCanViewRiskScores: {
      type: Boolean,
      default: false, // Default: REGISTRY cannot view AI risk scores
    },
    dailyDigest: {
      type: Boolean,
      default: true,
    },
    smsAlerts: {
      type: Boolean,
      default: false,
    },
    emailAlerts: {
      type: Boolean,
      default: true,
    },
    notificationThreshold: {
      type: Number,
      default: 70, // Risk score threshold for notifications
      min: 0,
      max: 100,
    },
    autoAnalysis: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const SystemSettingsModel = mongoose.model<ISystemSettings>('SystemSettings', systemSettingsSchema);

// Helper function to get or create system settings
export const getSystemSettings = async () => {
  let settings = await SystemSettingsModel.findOne();
  if (!settings) {
    settings = await SystemSettingsModel.create({});
  }
  return settings;
};

export default SystemSettingsModel;

