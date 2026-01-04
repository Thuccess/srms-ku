import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import connectDB from '../src/config/database.js';

dotenv.config();

/**
 * Test script to verify password hashing and comparison
 */
const testLogin = async () => {
  try {
    console.log('🔍 Testing login functionality...\n');

    await connectDB();

    // Test with VC user
    const testEmail = 'vc@ku.ac.ug';
    const testPassword = 'vc123456';

    console.log(`Testing login for: ${testEmail}`);
    console.log(`Password: ${testPassword}\n`);

    // Find user
    const user = await User.findOne({ email: testEmail }).select('+password');
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Password hash exists: ${!!user.password}`);
    console.log(`   Password hash length: ${user.password?.length || 0}`);
    console.log(`   Password hash preview: ${user.password?.substring(0, 20)}...\n`);

    // Test password comparison
    console.log('🔐 Testing password comparison...');
    const isValid = await user.comparePassword(testPassword);
    console.log(`   Result: ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);

    // Also test with bcrypt directly
    console.log('🔐 Testing with bcrypt directly...');
    const directCompare = await bcrypt.compare(testPassword, user.password);
    console.log(`   Result: ${directCompare ? '✅ VALID' : '❌ INVALID'}\n`);

    // Test with wrong password
    console.log('🔐 Testing with wrong password...');
    const wrongPassword = 'wrongpassword';
    const isWrong = await user.comparePassword(wrongPassword);
    console.log(`   Result: ${isWrong ? '❌ SHOULD BE INVALID' : '✅ CORRECTLY REJECTED'}\n`);

    if (isValid && directCompare) {
      console.log('✅ Login functionality is working correctly!');
    } else {
      console.error('❌ Password comparison is failing!');
      console.error('   This means the password was not hashed correctly during seeding.');
      console.error('   Solution: Re-run seed script or manually update password.');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testLogin();

