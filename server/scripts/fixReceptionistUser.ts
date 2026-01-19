import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User, { UserRole } from '../src/models/User.js';
import connectDB from '../src/config/database.js';

dotenv.config();

/**
 * Fix/Create RECEPTIONIST user
 * This script ensures the receptionist@ku.ac.ug user exists with correct password hash
 * 
 * Usage: 
 *   tsx scripts/fixReceptionistUser.ts
 */

const fixReceptionistUser = async () => {
  try {
    console.log('🔧 Fixing RECEPTIONIST user...\n');

    // Connect to database
    await connectDB();

    const email = 'receptionist@ku.ac.ug';
    const password = 'receptionist123456';
    const fullName = 'Receptionist';
    const role = UserRole.RECEPTIONIST;

    // Check if user exists
    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing) {
      console.log(`📋 Found existing user: ${email}`);
      console.log(`   Current role: ${existing.role}`);
      console.log(`   isActive: ${existing.isActive}`);
      
      // Verify password hash
      const isPasswordValid = await existing.comparePassword(password);
      if (isPasswordValid) {
        console.log('✅ Password is correct');
      } else {
        console.log('⚠️  Password hash mismatch - updating password...');
        // Update password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await User.updateOne(
          { email: email.toLowerCase() },
          { 
            $set: { 
              password: hashedPassword,
              role: role, // Ensure role is correct
              isActive: true, // Ensure user is active
            } 
          }
        );
        console.log('✅ Password updated');
      }

      // Ensure role and isActive are correct
      if (existing.role !== role || !existing.isActive) {
        console.log('⚠️  Updating role and/or isActive status...');
        await User.updateOne(
          { email: email.toLowerCase() },
          { 
            $set: { 
              role: role,
              isActive: true,
            } 
          }
        );
        console.log('✅ Role and status updated');
      }

      console.log(`\n✅ RECEPTIONIST user is ready: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log(`📝 Creating new RECEPTIONIST user: ${email}`);
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create user using updateOne with upsert (bypasses pre-save hooks)
      // Note: Don't set updatedAt in $setOnInsert - Mongoose timestamps handle this
      await User.updateOne(
        { email: email.toLowerCase() },
        {
          $setOnInsert: {
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName: fullName,
            role: role,
            isActive: true,
          }
        },
        { upsert: true, timestamps: false }
      );
      
      console.log(`✅ Created RECEPTIONIST user: ${email}`);
      console.log(`   Password: ${password}`);
    }

    // Verify the user can be found and password works
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (user) {
      const passwordCheck = await user.comparePassword(password);
      if (passwordCheck) {
        console.log('\n✅ Verification successful: User can authenticate');
      } else {
        console.log('\n❌ Verification failed: Password comparison failed');
      }
    } else {
      console.log('\n❌ Verification failed: User not found after creation');
    }

    console.log('\n✅ Fix completed!\n');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Fix failed:', error);
    if (error.errors) {
      Object.values(error.errors).forEach((err: any) => {
        console.error(`   - ${err.path}: ${err.message}`);
      });
    }
    process.exit(1);
  }
};

fixReceptionistUser();
