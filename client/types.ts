export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

/**
 * User Roles - MUST MATCH backend enum exactly
 */
export enum UserRole {
  VC = 'VC',
  DVC_ACADEMIC = 'DVC_ACADEMIC',
  DEAN = 'DEAN',
  HOD = 'HOD',
  ADVISOR = 'ADVISOR',
  LECTURER = 'LECTURER',
  REGISTRY = 'REGISTRY',
  IT_ADMIN = 'IT_ADMIN',
}

export enum InterventionType {
  COUNSELING = 'Counseling',
  ACADEMIC_SUPPORT = 'Academic Support',
  FINANCIAL_AID = 'Financial Aid Review',
  PARENT_MEETING = 'Parent Meeting',
}

export interface Intervention {
  id: string;
  type: InterventionType;
  date: string;
  notes: string;
  status: 'Pending' | 'Completed';
}

export interface AIAnalysis {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  recommendation: string;
  lastAnalyzed: string;
}

export interface Student {
  id: string;
  // Allowed fields only
  studentNumber: string;
  studentRegistrationNumber: string;
  course: string;
  yearOfStudy: number;
  semesterOfStudy: '1' | '2';
  gpa: number;
  attendance: number;
  balance: number;
}

export interface DashboardStats {
  totalStudents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgAttendance: number;
}

// --- System Configuration Types ---

export interface SystemThresholds {
  criticalGpa: number;
  warningAttendance: number;
  financialLimit: number;
}

export interface SystemPreferences {
  dailyDigest: boolean;
  smsAlerts: boolean;
  emailAlerts: boolean;
  notificationThreshold: number;
  autoAnalysis: boolean;
}

export interface SystemSettings {
  thresholds: SystemThresholds;
  preferences: SystemPreferences;
  registryCanViewRiskScores?: boolean; // Registry AI risk score visibility (default: false)
}