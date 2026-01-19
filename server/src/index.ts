import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connectDB from './config/database.js';
import { setupSocketIO } from './socket/socket.js';
import { initializeCsvFile } from './services/csvService.js';
import logger from './utils/logger.js';
import { initializeErrorTracking } from './utils/errorTracker.js';

const PORT = Number(process.env.PORT) || 5000;

/**
 * Validate required environment variables on startup
 */
const validateEnvironment = (): void => {
  const required = ['JWT_SECRET', 'MONGO_URI'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', { missing });
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these in your .env file.');
    process.exit(1);
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET validation failed', { length: process.env.JWT_SECRET.length });
    console.error('❌ JWT_SECRET must be at least 32 characters long.');
    console.error(`   Current length: ${process.env.JWT_SECRET.length}`);
    console.error('   Generate a strong secret with: openssl rand -base64 32');
    process.exit(1);
  }

  logger.info('Environment variables validated');
  console.log('✅ Environment variables validated');
};

const startServer = async () => {
  try {
    // Initialize error tracking first
    initializeErrorTracking();
    
    // Validate environment variables before starting
    validateEnvironment();
    
    await connectDB();
    
    // Initialize CSV file on startup
    await initializeCsvFile();
    
    // Create HTTP server
    const httpServer = http.createServer(app);
    
    // Initialize Socket.io
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    
    // Setup Socket.io event handlers
    setupSocketIO(io);
    
    // Start server - bind to 0.0.0.0 for container compatibility
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info('Server started successfully', { port: PORT, environment: process.env.NODE_ENV });
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Socket.io server initialized`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

