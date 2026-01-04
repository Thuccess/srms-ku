import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Role-Based Access Control (RBAC) Roles
 * These roles define the access level and scope for each user in the system.
 * 
 * Access Rules:
 * - VC: University-wide aggregated analytics only, NO individual student data
 * - DVC_ACADEMIC: University-wide + faculty-level summaries, NO individual identities
 * - DEAN: Faculty-scoped access, aggregated and program-level risk data
 * - HOD: Department-scoped access, CAN view individual students in their department
 * - ADVISOR: Assigned students ONLY, full access to assigned students
 * - LECTURER: Course-scoped access ONLY, risk indicators for enrolled students
 * - REGISTRY: Academic data integrity dashboards, NO AI risk scores unless enabled
 * - IT_ADMIN: System-level access ONLY, NO academic or student data
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

export interface IUser extends Document {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  
  // Scoping fields for role-based data access
  facultyId?: mongoose.Types.ObjectId; // For DEAN, HOD, LECTURER
  departmentId?: mongoose.Types.ObjectId; // For HOD, LECTURER
  assignedCourses?: mongoose.Types.ObjectId[]; // For LECTURER
  assignedStudents?: mongoose.Types.ObjectId[]; // For ADVISOR
  
  // Metadata
  isActive: boolean;
  lastLogin?: Date;
  
  // Password reset fields
  resetToken?: string;
  resetTokenExpiry?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false, // Don't return password by default
      validate: {
        validator: function(this: IUser, password: string): boolean {
          // Only validate on new passwords (not when updating other fields)
          if (!this.isModified('password')) {
            return true;
          }
          
          // Check password complexity
          const hasUpperCase = /[A-Z]/.test(password);
          const hasLowerCase = /[a-z]/.test(password);
          const hasNumber = /[0-9]/.test(password);
          const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
          
          return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
        },
        message: 'Password must be at least 8 characters and contain: uppercase letter, lowercase letter, number, and special character',
      },
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: function(this: IUser) {
        // Required for DEAN, HOD, LECTURER
        return [UserRole.DEAN, UserRole.HOD, UserRole.LECTURER].includes(this.role);
      },
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: function(this: IUser) {
        // Required for HOD, LECTURER
        return [UserRole.HOD, UserRole.LECTURER].includes(this.role);
      },
    },
    assignedCourses: [{
      type: Schema.Types.ObjectId,
      ref: 'Course',
    }],
    assignedStudents: [{
      type: Schema.Types.ObjectId,
      ref: 'Student',
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    resetToken: {
      type: String,
      select: false, // Don't return reset token by default
    },
    resetTokenExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function() {
  // Skip if password is not modified
  if (!this.isModified('password')) {
    return;
  }
  
  // Skip if password is already hashed (starts with $2a$, $2b$, or $2y$)
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return;
  }
  
  // Hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>('User', userSchema);

