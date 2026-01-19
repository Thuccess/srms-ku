import { Server, Socket } from 'socket.io';
import Student from '../models/Student.js';
import logger from '../utils/logger.js';

// Store the io instance to emit events from controllers
let ioInstance: Server | null = null;

export const setupSocketIO = (io: Server): void => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Handle client joining rooms (for filtering if needed)
    socket.on('join:room', (room: string) => {
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
    });

    // Handle client leaving rooms
    socket.on('leave:room', (room: string) => {
      socket.leave(room);
      console.log(`Client ${socket.id} left room: ${room}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};

// Helper function to emit events from controllers
export const emitToAll = (event: string, data: any): void => {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
};

// Helper function to emit to a specific room
export const emitToRoom = (room: string, event: string, data: any): void => {
  if (ioInstance) {
    ioInstance.to(room).emit(event, data);
  }
};

// Helper function to calculate and emit dashboard stats
export const emitDashboardStats = async (): Promise<void> => {
  if (!ioInstance) return;

  try {
    const students = await Student.find();
    const totalStudents = students.length;

    const stats = {
      totalStudents,
      averageGPA: students.length > 0
        ? students.reduce((sum, s) => sum + (s.gpa || 0), 0) / students.length
        : 0,
      averageAttendance: students.length > 0
        ? students.reduce((sum, s) => sum + (s.attendance || 0), 0) / students.length
        : 0,
      totalBalance: students.reduce((sum, s) => sum + (s.balance || 0), 0),
    };

    emitToAll('stats:updated', { stats });
  } catch (error: any) {
    logger.error('Error calculating dashboard stats:', { error: error.message, stack: error.stack });
  }
};

