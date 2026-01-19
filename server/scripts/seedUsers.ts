import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User, { UserRole } from '../src/models/User.js';
import connectDB from '../src/config/database.js';

dotenv.config();

/**
 * Seed script to create initial test users for all roles
 * 
 * Usage: 
 *   npm run seed-users
 *   or
 *   tsx scripts/seedUsers.ts
 */

const testUsers = [
  {
    email: 'vc@ku.ac.ug',
    password: 'vc123456',
    fullName: 'Vice Chancellor',
    role: UserRole.VC,
  },
  {
    email: 'dvc@ku.ac.ug',
    password: 'dvc123456',
    fullName: 'Deputy Vice Chancellor (Academic)',
    role: UserRole.DVC_ACADEMIC,
  },
  {
    email: 'dean@ku.ac.ug',
    password: 'dean123456',
    fullName: 'Faculty Dean',
    role: UserRole.DEAN,
    // Note: facultyId is conditionally required - we'll create a dummy ObjectId for testing
    // In production, use actual faculty IDs from your database
  },
  {
    email: 'hod@ku.ac.ug',
    password: 'hod123456',
    fullName: 'Head of Department',
    role: UserRole.HOD,
    // Note: departmentId is conditionally required - we'll create a dummy ObjectId for testing
    // In production, use actual department IDs from your database
  },
  {
    email: 'advisor@ku.ac.ug',
    password: 'advisor123456',
    fullName: 'Academic Advisor',
    role: UserRole.ADVISOR,
    // Note: assignedStudents would be set in production with actual student IDs
  },
  {
    email: 'lecturer@ku.ac.ug',
    password: 'lecturer123456',
    fullName: 'Course Lecturer',
    role: UserRole.LECTURER,
    // Note: assignedCourses would be set in production with actual course IDs
  },
  {
    email: 'registry@ku.ac.ug',
    password: 'registry123456',
    fullName: 'Registry Staff',
    role: UserRole.REGISTRY,
  },
  {
    email: 'admin@ku.ac.ug',
    password: 'admin123456',
    fullName: 'IT Administrator',
    role: UserRole.IT_ADMIN,
  },
  {
    email: 'receptionist@ku.ac.ug',
    password: 'receptionist123456',
    fullName: 'Receptionist',
    role: UserRole.RECEPTIONIST,
  },
];

const seedUsers = async () => {
  try {
    console.log('🌱 Starting user seed...\n');

    // Connect to database
    await connectDB();

    // Option to clear existing users (uncomment to reset all users)
    // await User.deleteMany({});
    // console.log('✅ Cleared existing users\n');

    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existing = await User.findOne({ email: userData.email });
        if (existing) {
          // Update password if user exists (fixes password hashing issues from direct insert)
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(userData.password, salt);
          
          // Update password using updateOne to bypass hooks
          await User.updateOne(
            { email: userData.email },
            { $set: { password: hashedPassword } }
          );
          
          console.log(`🔄 Updated password for existing user: ${userData.email}`);
          skipped++;
          continue;
        }

        // For roles that require facultyId/departmentId, create dummy ObjectIds if not provided
        // This allows the seed to work even without actual faculty/department data
        const userPayload: any = { ...userData };
        
        if (userData.role === UserRole.DEAN && !userPayload.facultyId) {
          // Create a dummy ObjectId for testing (in production, use real faculty ID)
          userPayload.facultyId = new mongoose.Types.ObjectId();
        }
        
        if (userData.role === UserRole.HOD) {
          // HOD requires both facultyId and departmentId
          if (!userPayload.facultyId) {
            userPayload.facultyId = new mongoose.Types.ObjectId();
          }
          if (!userPayload.departmentId) {
            userPayload.departmentId = new mongoose.Types.ObjectId();
          }
        }
        
        if (userData.role === UserRole.LECTURER) {
          // Create dummy ObjectIds for testing
          if (!userPayload.facultyId) {
            userPayload.facultyId = new mongoose.Types.ObjectId();
          }
          if (!userPayload.departmentId) {
            userPayload.departmentId = new mongoose.Types.ObjectId();
          }
        }

        // Hash password manually
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userPayload.password, salt);
        
        // Use updateOne with upsert to create user (bypasses pre-save hooks)
        // This ensures password is stored correctly and can be retrieved with .select('+password')
        await User.updateOne(
          { email: userPayload.email },
          {
            $setOnInsert: {
              ...userPayload,
              password: hashedPassword,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          { upsert: true }
        );
        
        console.log(`✅ Created user: ${userPayload.email} (${userPayload.role})`);
        created++;
      } catch (error: any) {
        console.error(`❌ Failed to create user ${userData.email}:`, error.message);
        if (error.errors) {
          Object.values(error.errors).forEach((err: any) => {
            console.error(`   - ${err.path}: ${err.message}`);
          });
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created} users`);
    console.log(`   Skipped: ${skipped} users (already exist)`);
    console.log(`\n✅ User seeding completed!\n`);

    console.log('📝 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach(user => {
      console.log(`   ${user.role.padEnd(15)} | ${user.email.padEnd(25)} | ${user.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedUsers();

