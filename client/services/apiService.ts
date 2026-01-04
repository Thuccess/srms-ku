
import axios from 'axios';
import { Student, RiskLevel } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5 second timeout
});

// Add request interceptor to include JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ku_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401, clear auth and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('ku_token');
      localStorage.removeItem('ku_user');
      // Optionally redirect to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Transform server risk level (UPPERCASE) to client format (PascalCase)
const normalizeRiskLevel = (level: string): RiskLevel => {
  const upper = level.toUpperCase();
  if (upper === 'LOW') return RiskLevel.LOW;
  if (upper === 'MEDIUM') return RiskLevel.MEDIUM;
  if (upper === 'HIGH') return RiskLevel.HIGH;
  return RiskLevel.LOW; // fallback
};

// Transform client risk level (PascalCase) to server format (UPPERCASE)
const toServerRiskLevel = (level: RiskLevel | string): string => {
  if (typeof level === 'string') {
    const normalized = normalizeRiskLevel(level);
    return normalized === RiskLevel.LOW ? 'LOW' : normalized === RiskLevel.MEDIUM ? 'MEDIUM' : 'HIGH';
  }
  return level === RiskLevel.LOW ? 'LOW' : level === RiskLevel.MEDIUM ? 'MEDIUM' : 'HIGH';
};

// Map server student response to client Student type
export const mapStudentFromServer = (serverStudent: any): Student => {
  // Prefer explicit `id`, then Mongo `_id`, then studentNumber as a last fallback
  const id: string =
    serverStudent.id ?? serverStudent._id ?? serverStudent.studentNumber;

  // Map only allowed fields
  const student: Student = {
    id,
    studentNumber: serverStudent.studentNumber || '',
    studentRegistrationNumber: serverStudent.studentRegistrationNumber || '',
    course: serverStudent.course || '',
    yearOfStudy: serverStudent.yearOfStudy || 1,
    semesterOfStudy: (serverStudent.semesterOfStudy === '1' || serverStudent.semesterOfStudy === '2') 
      ? serverStudent.semesterOfStudy 
      : '1',
    gpa: serverStudent.gpa || 0,
    attendance: serverStudent.attendance || 0,
    balance: serverStudent.balance || 0,
  };

  return student;
};

// Map client student to server format (only allowed fields)
const mapStudentToServer = (student: Partial<Student>): any => {
  const mapped: any = {};
  
  // Only include allowed fields
  if (student.studentNumber !== undefined) mapped.studentNumber = student.studentNumber;
  if (student.studentRegistrationNumber !== undefined) mapped.studentRegistrationNumber = student.studentRegistrationNumber;
  if (student.course !== undefined) mapped.course = student.course;
  if (student.yearOfStudy !== undefined) mapped.yearOfStudy = student.yearOfStudy;
  if (student.semesterOfStudy !== undefined) mapped.semesterOfStudy = student.semesterOfStudy;
  if (student.gpa !== undefined) mapped.gpa = student.gpa;
  if (student.attendance !== undefined) mapped.attendance = student.attendance;
  if (student.balance !== undefined) mapped.balance = student.balance;

  return mapped;
};

// Health check function
export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const healthUrl = API_BASE_URL.replace('/api', '') || 'http://localhost:5000';
    const response = await axios.get(`${healthUrl}/health`, {
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * Get students with optional pagination support
 * 
 * Performance Optimization: Added pagination support for handling large datasets
 * - Backward compatible: If no pagination params, returns all students (existing behavior)
 * - Pagination mode: Returns { students, pagination } object
 * 
 * @param options - Optional pagination parameters
 * @returns Array of students (backward compatible) or paginated result
 */
export const getStudents = async (options?: {
  page?: number;
  limit?: number;
}): Promise<Student[] | { students: Student[]; pagination: any }> => {
  try {
    const params: any = {};
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;
    
    const response = await api.get('/students', { params });
    
    // Backward compatibility: If response is array, return as before
    if (Array.isArray(response.data)) {
      return response.data.map(mapStudentFromServer);
    }
    
    // Pagination mode: Response has { students, pagination } structure
    if (response.data.students && Array.isArray(response.data.students)) {
      return {
        students: response.data.students.map(mapStudentFromServer),
        pagination: response.data.pagination
      };
    }
    
    return [];
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    console.error('Error fetching students:', errorMessage);
    
    // Provide more specific error information
    if (errorMessage.includes('Cannot connect') || errorMessage.includes('timeout')) {
      const customError = new Error(errorMessage);
      (customError as any).isConnectionError = true;
      throw customError;
    }
    
    throw error;
  }
};

export const addStudent = async (student: Partial<Student>): Promise<Student> => {
  try {
    const serverStudent = mapStudentToServer(student);
    const response = await api.post('/students', serverStudent);
    const savedStudent = mapStudentFromServer(response.data);
    
    // Update localStorage cache
    try {
      const cached = localStorage.getItem('ku_students_cache');
      if (cached) {
        const students = JSON.parse(cached);
        if (Array.isArray(students)) {
          students.unshift(savedStudent);
          localStorage.setItem('ku_students_cache', JSON.stringify(students));
        }
      }
    } catch (cacheError) {
      console.warn('Failed to update cache:', cacheError);
    }
    
    return savedStudent;
  } catch (error) {
    console.error('Error adding student:', error);
    throw error;
  }
};

export const updateStudent = async (studentNumber: string, student: Partial<Student>): Promise<Student> => {
  try {
    const serverStudent = mapStudentToServer(student);
    const response = await api.put(`/students/${studentNumber}`, serverStudent);
    const updatedStudent = mapStudentFromServer(response.data);
    
    // Update localStorage cache
    try {
      const cached = localStorage.getItem('ku_students_cache');
      if (cached) {
        const students = JSON.parse(cached);
        if (Array.isArray(students)) {
          const index = students.findIndex(s => s.studentNumber === studentNumber || s.id === updatedStudent.id);
          if (index >= 0) {
            students[index] = updatedStudent;
          } else {
            students.push(updatedStudent);
          }
          localStorage.setItem('ku_students_cache', JSON.stringify(students));
        }
      }
    } catch (cacheError) {
      console.warn('Failed to update cache:', cacheError);
    }
    
    return updatedStudent;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

export const deleteStudent = async (studentNumber: string): Promise<void> => {
  try {
    await api.delete(`/students/${studentNumber}`);
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

export const predictRisk = async (studentData: {
  studentId: string;
  gpa: number;
  attendanceRate: number;
  year: number;
}): Promise<{ 
  riskScore: number; 
  riskLevel: string;
  riskFactors?: string[];
}> => {
  try {
    const response = await api.post('/risk/predict-risk', {
      ...studentData,
    });
    return {
      riskScore: response.data.riskScore,
      riskLevel: normalizeRiskLevel(response.data.riskLevel),
      riskFactors: response.data.riskFactors,
    };
  } catch (error) {
    console.error('Error predicting risk:', error);
    throw error;
  }
};

/**
 * Upload CSV file to server with intelligent identity resolution
 * Automatically updates the database and exports/students.csv file
 * 
 * Returns comprehensive statistics including:
 * - Total rows processed
 * - Students created
 * - Students updated
 * - Duplicates merged
 * - Rows skipped
 */
export const uploadCsvFile = async (csvContent: string): Promise<{
  message: string;
  summary: {
    totalRows: number;
    totalProcessed: number;
    studentsCreated: number;
    studentsUpdated: number;
    duplicatesMerged: number;
    rowsSkipped: number;
  };
  details: {
  created: number;
  updated: number;
    merged: number;
    skipped: number;
    mergeDetails?: Array<{ row: number; reason: string; matchedBy: string }>;
  };
  errors?: string[];
}> => {
  try {
    const response = await api.post('/students/import/csv', csvContent, {
      headers: {
        'Content-Type': 'text/csv',
      },
      timeout: 60000, // 60 seconds for large files with identity resolution
    });
    return response.data;
  } catch (error: any) {
    console.error('Error uploading CSV file:', error);
    throw error;
  }
};

/**
 * Download CSV file from server
 * Returns a blob that can be downloaded
 */
export const downloadCsvFile = async (): Promise<void> => {
  try {
    const token = localStorage.getItem('ku_token');
    const response = await axios.get(`${API_BASE_URL}/students/export/csv`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: 'blob',
      timeout: 60000, // 60 seconds for large files
    });

    // Create a blob from the response
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'students_export.csv';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error: any) {
    console.error('Error downloading CSV file:', error);
    throw error;
  }
};

/**
 * Get analytics based on user role
 */
export const getAnalytics = async (): Promise<any> => {
  try {
    const response = await api.get('/analytics');
    return response.data;
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
};

/**
 * Get data integrity alerts - students with issues requiring immediate attention
 * Queries the database directly using risk thresholds for 100% accuracy
 * 
 * @param thresholds - Risk thresholds to use for filtering (optional, uses defaults if not provided)
 * @returns Object containing categorized lists of students with risk classifications
 */
export const getDataIntegrityAlerts = async (thresholds?: {
  criticalGpa?: number;
  warningAttendance?: number;
  financialLimit?: number;
}): Promise<{
  thresholds: {
    criticalGpa: number;
    warningAttendance: number;
    financialLimit: number;
  };
  summary: {
    totalStudents: number;
    withFinancialRisk: number;
    withAttendanceRisk: number;
    withAcademicRisk: number;
    incompleteRecords: number;
    withNoIssues: number;
  };
  students: {
    financialRisk: Array<Student & { riskLabels?: string[] }>;
    attendanceRisk: Array<Student & { riskLabels?: string[] }>;
    academicRisk: Array<Student & { riskLabels?: string[] }>;
    incompleteRecords: Array<Student & { riskLabels?: string[] }>;
    noIssues: Array<Student & { riskLabels?: string[] }>;
  };
}> => {
  try {
    const params = new URLSearchParams();
    if (thresholds?.criticalGpa !== undefined) {
      params.append('criticalGpa', thresholds.criticalGpa.toString());
    }
    if (thresholds?.warningAttendance !== undefined) {
      params.append('warningAttendance', thresholds.warningAttendance.toString());
    }
    if (thresholds?.financialLimit !== undefined) {
      params.append('financialLimit', thresholds.financialLimit.toString());
    }

    const queryString = params.toString();
    const url = `/students/data-integrity-alerts${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url);
    
    // Map students from server format to client format, preserving risk labels
    const mapStudentWithLabels = (serverStudent: any): Student & { riskLabels?: string[] } => {
      const student = mapStudentFromServer(serverStudent);
      return {
        ...student,
        riskLabels: serverStudent.riskLabels || [],
      };
    };
    
    return {
      thresholds: response.data.thresholds,
      summary: response.data.summary,
      students: {
        financialRisk: response.data.students.financialRisk.map(mapStudentWithLabels),
        attendanceRisk: response.data.students.attendanceRisk.map(mapStudentWithLabels),
        academicRisk: response.data.students.academicRisk.map(mapStudentWithLabels),
        incompleteRecords: response.data.students.incompleteRecords.map(mapStudentWithLabels),
        noIssues: (response.data.students.noIssues || []).map(mapStudentWithLabels), // 100% accurate from database
      },
    };
  } catch (error) {
    console.error('Error fetching data integrity alerts:', error);
    throw error;
  }
};

