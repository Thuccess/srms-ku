import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '../types';

/**
 * User interface matching backend User model
 */
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  facultyId?: string;
  departmentId?: string;
  assignedCourses?: string[];
  assignedStudents?: string[];
  lastLogin?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  // Permission helpers
  canViewStudent: (studentId?: string) => boolean;
  canViewIndividualStudents: () => boolean;
  canViewRiskScores: (registryCanViewRiskScores?: boolean) => boolean;
  canViewAggregatedData: () => boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('ku_token');
    const savedUser = localStorage.getItem('ku_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user data:', error);
        localStorage.removeItem('ku_token');
        localStorage.removeItem('ku_user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Login function - authenticates with backend
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const loginUrl = `${API_BASE_URL}/auth/login`;
      
      // Remove trailing slash if present
      const cleanUrl = loginUrl.replace(/\/$/, '');
      
      console.log('Attempting login to:', loginUrl);
      console.log('Email:', email);
      
      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login response status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: `Server error: ${response.status} ${response.statusText}` };
        }
        
        const errorMessage = errorData.error || errorData.details || `Login failed (${response.status})`;
        console.error('Login API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful, user:', data.user?.email);
      
      // Store token and user
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('ku_token', data.token);
      localStorage.setItem('ku_user', JSON.stringify(data.user));
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide more helpful error messages
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        throw new Error('Cannot connect to server. Please ensure the backend is running on port 5000.');
      }
      
      throw error;
    }
  };

  /**
   * Logout function
   */
  const logout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('ku_token');
    localStorage.removeItem('ku_user');
  };

  /**
   * Permission helper: Check if user can view a specific student
   * Note: This is a frontend check for UX. Backend is authoritative.
   */
  const canViewStudent = (studentId?: string): boolean => {
    if (!user) return false;

    // VC and DVC_ACADEMIC cannot view individual students
    if ([UserRole.VC, UserRole.DVC_ACADEMIC, UserRole.IT_ADMIN].includes(user.role)) {
      return false;
    }

    // ADVISOR can only view assigned students
    if (user.role === UserRole.ADVISOR) {
      if (!studentId || !user.assignedStudents) return false;
      return user.assignedStudents.includes(studentId);
    }

    // Other roles can view students within their scope (backend will enforce)
    return true;
  };

  /**
   * Permission helper: Check if user can view individual students
   */
  const canViewIndividualStudents = (): boolean => {
    if (!user) return false;
    return ![
      UserRole.VC,
      UserRole.DVC_ACADEMIC,
      UserRole.IT_ADMIN,
    ].includes(user.role);
  };

  /**
   * Permission helper: Check if user can view risk scores
   * Note: For REGISTRY, this depends on system settings (registryCanViewRiskScores)
   * The actual check should be done with system settings from the backend
   */
  const canViewRiskScores = (registryCanViewRiskScores: boolean = false): boolean => {
    if (!user) return false;
    
    // IT_ADMIN cannot view any student data
    if (user.role === UserRole.IT_ADMIN) {
      return false;
    }
    
    // REGISTRY can view risk scores only if explicitly enabled in system settings
    if (user.role === UserRole.REGISTRY) {
      return registryCanViewRiskScores;
    }
    
    return true;
  };

  /**
   * Permission helper: Check if user can view aggregated data
   */
  const canViewAggregatedData = (): boolean => {
    if (!user) return false;
    return [
      UserRole.VC,
      UserRole.DVC_ACADEMIC,
      UserRole.DEAN,
      UserRole.HOD,
      UserRole.REGISTRY,
    ].includes(user.role);
  };

  /**
   * Permission helper: Check if user has any of the specified roles
   */
  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    loading,
    canViewStudent,
    canViewIndividualStudents,
    canViewRiskScores,
    canViewAggregatedData,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

