import { io, Socket } from 'socket.io-client';
import { Student, RiskLevel } from '../types';

const SERVER_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('✅ Socket.io connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('❌ Socket.io disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      this.isConnected = false;
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Student events
  onStudentCreated(callback: (data: { student: any }) => void): void {
    this.socket?.on('student:created', callback);
  }

  onStudentUpdated(callback: (data: { student: any }) => void): void {
    this.socket?.on('student:updated', callback);
  }

  onStudentDeleted(callback: (data: { studentNumber: string }) => void): void {
    this.socket?.on('student:deleted', callback);
  }

  onStudentsImported(callback: (data: { createdCount: number; updatedCount: number }) => void): void {
    this.socket?.on('students:imported', callback);
  }

  // Risk events
  onRiskUpdated(callback: (data: { studentNumber: string; riskScore: number; riskLevel: string }) => void): void {
    this.socket?.on('risk:updated', callback);
  }

  // Dashboard stats events
  onStatsUpdated(callback: (data: { stats: any }) => void): void {
    this.socket?.on('stats:updated', callback);
  }

  // Remove listeners
  offStudentCreated(callback?: (data: { student: any }) => void): void {
    this.socket?.off('student:created', callback);
  }

  offStudentUpdated(callback?: (data: { student: any }) => void): void {
    this.socket?.off('student:updated', callback);
  }

  offStudentDeleted(callback?: (data: { studentNumber: string }) => void): void {
    this.socket?.off('student:deleted', callback);
  }

  offStudentsImported(callback?: (data: { createdCount: number; updatedCount: number }) => void): void {
    this.socket?.off('students:imported', callback);
  }

  offRiskUpdated(callback?: (data: { studentNumber: string; riskScore: number; riskLevel: string }) => void): void {
    this.socket?.off('risk:updated', callback);
  }

  offStatsUpdated(callback?: (data: { stats: any }) => void): void {
    this.socket?.off('stats:updated', callback);
  }

  // Utility methods
  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Join/leave rooms (for future filtering)
  joinRoom(room: string): void {
    this.socket?.emit('join:room', room);
  }

  leaveRoom(room: string): void {
    this.socket?.emit('leave:room', room);
  }
}

// Export singleton instance
export const socketService = new SocketService();

