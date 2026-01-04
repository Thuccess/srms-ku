import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async (): Promise<void> => {
  try {
    let mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/student-risk-system';
    
    // Validate connection string format
    if (mongoURI && (mongoURI.includes('<your-mongodb-uri>') || mongoURI.trim() === '')) {
      logger.warn('MONGO_URI is not set or contains placeholder. Using default local MongoDB.');
      console.warn('⚠️  MONGO_URI is not set or contains placeholder. Using default local MongoDB.');
      mongoURI = 'mongodb://localhost:27017/student-risk-system';
    }
    
    // Ensure connection string starts with valid scheme
    if (!mongoURI.startsWith('mongodb://') && !mongoURI.startsWith('mongodb+srv://')) {
      throw new Error(
        `Invalid MONGO_URI format. Must start with "mongodb://" or "mongodb+srv://". ` +
        `Current value: ${mongoURI.substring(0, 50)}${mongoURI.length > 50 ? '...' : ''}`
      );
    }
    
    // Log connection attempt (without password)
    const maskedURI = mongoURI.replace(/:([^:@]+)@/, ':****@');
    logger.info('Attempting to connect to MongoDB', { maskedURI });
    console.log(`🔌 Attempting to connect to MongoDB...`);
    console.log(`   Connection string: ${maskedURI}`);
    
    // MongoDB Atlas connection options
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    });
    
    logger.info('MongoDB connected successfully');
    console.log('✅ MongoDB connected successfully');
  } catch (error: any) {
    // Log error to logger
    logger.error('MongoDB connection error:', {
      code: error?.code,
      codeName: error?.codeName,
      message: error?.message,
    });
    
    // Provide helpful error messages for common issues
    if (error?.code === 8000 || error?.codeName === 'AtlasError' || error?.message?.includes('authentication failed')) {
      console.error('❌ MongoDB Authentication Failed!');
      console.error('   Error Code: 8000 (AtlasError)');
      console.error('');
      console.error('   Possible causes:');
      console.error('   1. ❌ Database user does NOT exist in MongoDB Atlas');
      console.error('   2. ❌ Incorrect username or password in MONGO_URI');
      console.error('   3. ❌ Password contains special characters that need URL encoding');
      console.error('   4. ❌ Database user was deleted or password was changed');
      console.error('');
      console.error('   ✅ SOLUTION - Create the database user in MongoDB Atlas:');
      console.error('   1. Go to https://cloud.mongodb.com → Sign in');
      console.error('   2. Select your cluster → Click "Database Access" (left sidebar)');
      console.error('   3. Click "Add New Database User"');
      console.error('   4. Authentication Method: Password');
      console.error('   5. Username: ruotmaliah654_db_user');
      console.error('   6. Password: us3yhahUFXJzaDVI');
      console.error('   7. Database User Privileges: "Atlas Admin" or "Read and write to any database"');
      console.error('   8. Click "Add User"');
      console.error('');
      console.error('   ⚠️  IMPORTANT: The user must be CREATED in Atlas before connecting!');
      console.error('      Just having credentials is not enough - you must click "Add User".');
      console.error('');
      console.error('   If password has special characters (@, #, $, etc.), URL-encode them:');
      console.error('   Example: If password is "p@ss#word", use "p%40ss%23word"');
    } else if (error?.message?.includes('ECONNREFUSED')) {
      console.error('❌ Cannot connect to MongoDB server');
      console.error('   Check if MongoDB is running or MONGO_URI is correct');
    } else {
      console.error('❌ MongoDB connection error:', error?.message || error);
    }
    throw error;
  }
};

export default connectDB;

