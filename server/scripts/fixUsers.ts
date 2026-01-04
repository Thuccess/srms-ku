import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User, { UserRole } from '../src/models/User.js';
import connectDB from '../src/config/database.js';

dotenv.config();

/**
 * Fix users by deleting and recreating them properly
 */
const fixUsers = async () => {
  try {
    console.log('🔧 Fixing users...\n');

    await connectDB();

    // Delete all existing users
    await User.deleteMany({});
    console.log('✅ Deleted all existing users\n');

    const testUsers = [
      { email: 'vc@ku.ac.ug', password: 'vc123456', fullName: 'Vice Chancellor', role: UserRole.VC },
      { email: 'dvc@ku.ac.ug', password: 'dvc123456', fullName: 'Deputy Vice Chancellor', role: UserRole.DVC_ACADEMIC },
      { email: 'dean@ku.ac.ug', password: 'dean123456', fullName: 'Faculty Dean', role: UserRole.DEAN },
      { email: 'hod@ku.ac.ug', password: 'hod123456', fullName: 'Head of Department', role: UserRole.HOD },
      { email: 'advisor@ku.ac.ug', password: 'advisor123456', fullName: 'Academic Advisor', role: UserRole.ADVISOR },
      { email: 'lecturer@ku.ac.ug', password: 'lecturer123456', fullName: 'Course Lecturer', role: UserRole.LECTURER },
      { email: 'registry@ku.ac.ug', password: 'registry123456', fullName: 'Registry Staff', role: UserRole.REGISTRY },
      { email: 'admin@ku.ac.ug', password: 'admin123456', fullName: 'IT Administrator', role: UserRole.IT_ADMIN },
    ];

    for (const userData of testUsers) {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Add required fields for certain roles
      const userPayload: any = {
        email: userData.email,
        password: hashedPassword,
        fullName: userData.fullName,
        role: userData.role,
        isActive: true,
      };

      if (userData.role === UserRole.DEAN || userData.role === UserRole.HOD || userData.role === UserRole.LECTURER) {
        userPayload.facultyId = new mongoose.Types.ObjectId();
      }

      if (userData.role === UserRole.HOD || userData.role === UserRole.LECTURER) {
        userPayload.departmentId = new mongoose.Types.ObjectId();
      }

      // Use insertOne to bypass mongoose hooks (password is already hashed)
      await User.collection.insertOne({
        ...userPayload,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✅ Created: ${userData.email} (${userData.role})`);
    }

    console.log('\n✅ All users created successfully!\n');
    console.log('📝 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach(user => {
      console.log(`   ${user.role.padEnd(15)} | ${user.email.padEnd(25)} | ${user.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed:', error);
    if (error.errors) {
      Object.values(error.errors).forEach((err: any) => {
        console.error(`   - ${err.path}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

fixUsers();

