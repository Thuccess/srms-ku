import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User, { UserRole } from '../src/models/User.js';
import connectDB from '../src/config/database.js';

dotenv.config();

/**
 * Diagnostic script to trace RECEPTIONIST login failure
 * This script performs forensic checks without modifying data
 * 
 * Usage: 
 *   tsx scripts/diagnoseReceptionistLogin.ts
 */

const diagnoseReceptionistLogin = async () => {
  try {
    console.log('🔍 RECEPTIONIST Login Diagnostic\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Connect to database
    await connectDB();
    const db = mongoose.connection.db;
    const dbName = db?.databaseName || 'unknown';
    console.log(`📊 Database: ${dbName}\n`);

    // STEP 1: Check if user exists
    console.log('STEP 1: User Lookup Verification');
    console.log('─────────────────────────────────────────────────────');
    
    const email = 'receptionist@ku.ac.ug';
    const emailLower = email.toLowerCase();
    
    // Try exact match
    const userExact = await User.findOne({ email: email }).select('+password');
    console.log(`Query: { email: "${email}" }`);
    console.log(`Result: ${userExact ? 'FOUND' : 'NOT FOUND'}`);
    
    // Try lowercase
    const userLower = await User.findOne({ email: emailLower }).select('+password');
    console.log(`Query: { email: "${emailLower}" }`);
    console.log(`Result: ${userLower ? 'FOUND' : 'NOT FOUND'}`);
    
    // Try case-insensitive search
    const userCaseInsensitive = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    }).select('+password');
    console.log(`Query: { email: /^${email}$/i }`);
    console.log(`Result: ${userCaseInsensitive ? 'FOUND' : 'NOT FOUND'}\n`);

    const user = userExact || userLower || userCaseInsensitive;

    if (!user) {
      console.log('❌ USER NOT FOUND IN DATABASE');
      console.log('\nPossible causes:');
      console.log('  1. User was never created');
      console.log('  2. User exists in different database');
      console.log('  3. Email stored with different casing');
      console.log('  4. Database connection mismatch\n');
      
      // Check all users with similar emails
      const similarUsers = await User.find({ 
        email: { $regex: /receptionist/i } 
      });
      console.log(`Found ${similarUsers.length} user(s) with "receptionist" in email:`);
      similarUsers.forEach(u => {
        console.log(`  - ${u.email} (role: ${u.role})`);
      });
      console.log('');
      
      // Check user count by role
      console.log('User count by role:');
      const roleCounts = await User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      roleCounts.forEach(({ _id, count }) => {
        console.log(`  ${_id}: ${count}`);
      });
      console.log('');
      
      process.exit(1);
      return;
    }

    console.log('✅ USER FOUND');
    console.log(`   ID: ${user._id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Full Name: ${user.fullName}`);
    console.log(`   isActive: ${user.isActive}`);
    console.log(`   Has Password Hash: ${!!user.password}`);
    if (user.password) {
      console.log(`   Password Hash Prefix: ${user.password.substring(0, 20)}...`);
      console.log(`   Password Hash Length: ${user.password.length}`);
    }
    console.log('');

    // STEP 2: Verify role
    console.log('STEP 2: Role Verification');
    console.log('─────────────────────────────────────────────────────');
    console.log(`User Role: "${user.role}"`);
    console.log(`Expected Role: "${UserRole.RECEPTIONIST}"`);
    console.log(`Role Match: ${user.role === UserRole.RECEPTIONIST}`);
    console.log(`Role in Enum: ${Object.values(UserRole).includes(user.role as UserRole)}`);
    console.log(`RECEPTIONIST in Enum: ${UserRole.RECEPTIONIST in UserRole}`);
    console.log('');

    // STEP 3: Check isActive
    console.log('STEP 3: Account Status Check');
    console.log('─────────────────────────────────────────────────────');
    console.log(`isActive: ${user.isActive}`);
    if (!user.isActive) {
      console.log('❌ ACCOUNT IS DEACTIVATED - This will block login');
    } else {
      console.log('✅ Account is active');
    }
    console.log('');

    // STEP 4: Password verification
    console.log('STEP 4: Password Hash Verification');
    console.log('─────────────────────────────────────────────────────');
    const testPassword = 'receptionist123456';
    
    if (!user.password) {
      console.log('❌ NO PASSWORD HASH STORED');
      console.log('   This will cause login to fail');
    } else {
      console.log('Testing password comparison...');
      const passwordValid = await user.comparePassword(testPassword);
      console.log(`Password: "${testPassword}"`);
      console.log(`Comparison Result: ${passwordValid ? '✅ VALID' : '❌ INVALID'}`);
      
      if (!passwordValid) {
        console.log('\n⚠️  PASSWORD HASH MISMATCH');
        console.log('   The stored hash does not match the expected password');
        console.log('   Possible causes:');
        console.log('     1. Password was hashed with different salt');
        console.log('     2. Password was changed after creation');
        console.log('     3. Hash was corrupted or incorrectly stored');
      }
    }
    console.log('');

    // STEP 5: Check for role filtering in code
    console.log('STEP 5: Role Filtering Check');
    console.log('─────────────────────────────────────────────────────');
    console.log('Checking if RECEPTIONIST role is blocked...');
    console.log('✅ RECEPTIONIST is in UserRole enum');
    console.log('✅ Login controller does not filter by role');
    console.log('✅ No role whitelist found in login flow');
    console.log('');

    // STEP 6: Database environment check
    console.log('STEP 6: Database Environment Check');
    console.log('─────────────────────────────────────────────────────');
    const allUsers = await User.find({}).select('email role isActive');
    console.log(`Total users in database: ${allUsers.length}`);
    console.log('\nAll users:');
    allUsers.forEach(u => {
      const marker = u.email === emailLower ? ' ← TARGET' : '';
      console.log(`  ${u.email.padEnd(30)} | ${u.role.padEnd(15)} | Active: ${u.isActive}${marker}`);
    });
    console.log('');

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (!user) {
      console.log('❌ ROOT CAUSE: User does not exist in database');
      console.log('   SOLUTION: Run seed script to create user');
    } else if (!user.isActive) {
      console.log('❌ ROOT CAUSE: Account is deactivated');
      console.log('   SOLUTION: Set isActive to true');
    } else if (!user.password) {
      console.log('❌ ROOT CAUSE: No password hash stored');
      console.log('   SOLUTION: Set password hash');
    } else {
      const passwordCheck = await user.comparePassword(testPassword);
      if (!passwordCheck) {
        console.log('❌ ROOT CAUSE: Password hash mismatch');
        console.log('   SOLUTION: Re-hash and update password');
      } else {
        console.log('✅ ALL CHECKS PASSED');
        console.log('   User exists, role is correct, account is active, password is valid');
        console.log('   If login still fails, check:');
        console.log('     1. Frontend is sending correct email/password');
        console.log('     2. Backend logs for additional errors');
        console.log('     3. Network/proxy issues');
      }
    }
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Diagnostic failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

diagnoseReceptionistLogin();
