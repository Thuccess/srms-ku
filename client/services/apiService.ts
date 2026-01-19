
import axios from 'axios';
import { Student, RiskLevel } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 50000, // 50 second timeout for database queries
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

// Retry utility function with exponential backoff
const retryRequest = async (
  requestFn: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on 429 (rate limit) or 503 (service unavailable) errors
      const shouldRetry = error.response?.status === 429 || error.response?.status === 503;
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay: baseDelay * 2^attempt
      const delay = baseDelay * Math.pow(2, attempt);
      
      // Get retry-after header if available (in seconds, convert to ms)
      const retryAfter = error.response?.headers?.['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};

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
  // Support both 'program' (new) and 'course' (backward compatibility) for course field
  const student: Student = {
    id,
    studentNumber: serverStudent.studentNumber || '',
    course: serverStudent.course || serverStudent.program || '',
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
    
    // Validate response exists
    if (!response.data) {
      return [];
    }
    
    // Backward compatibility: If response is array, return as before
    if (Array.isArray(response.data)) {
      return response.data.map(mapStudentFromServer);
    }
    
    // Pagination mode: Response has { students, pagination } structure
    if (response.data.students && Array.isArray(response.data.students)) {
      return {
        students: response.data.students.map(mapStudentFromServer),
        pagination: response.data.pagination || {}
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
    
    // Validate response
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
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
    if (!studentNumber) {
      throw new Error('Student number is required');
    }
    
    const serverStudent = mapStudentToServer(student);
    const response = await api.put(`/students/${studentNumber}`, serverStudent);
    
    // Validate response
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
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
    if (!studentNumber) {
      throw new Error('Student number is required');
    }
    
    // Use retry logic for delete operations to handle rate limiting
    await retryRequest(
      () => api.delete(`/students/${studentNumber}`),
      3, // max 3 retries
      1000 // base delay of 1 second
    );
    
    // Remove from localStorage cache
    try {
      const cached = localStorage.getItem('ku_students_cache');
      if (cached) {
        const students = JSON.parse(cached);
        if (Array.isArray(students)) {
          const filtered = students.filter(s => s.studentNumber !== studentNumber);
          localStorage.setItem('ku_students_cache', JSON.stringify(filtered));
        }
      }
    } catch (cacheError) {
      console.warn('Failed to update cache:', cacheError);
    }
  } catch (error: any) {
    console.error('Error deleting student:', error);
    
    // Provide user-friendly error messages
    if (error.response?.status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'];
      const waitTime = retryAfter ? `${retryAfter} seconds` : 'a few moments';
      throw new Error(`Rate limit exceeded. Please wait ${waitTime} and try again.`);
    }
    
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
    
    // Validate response structure
    if (!response.data || typeof response.data.riskScore !== 'number') {
      throw new Error('Invalid response from risk prediction endpoint');
    }
    
    return {
      riskScore: response.data.riskScore || 0,
      riskLevel: normalizeRiskLevel(response.data.riskLevel || 'LOW'),
      riskFactors: Array.isArray(response.data.riskFactors) ? response.data.riskFactors : [],
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
    if (!csvContent || typeof csvContent !== 'string') {
      throw new Error('CSV content is required and must be a string');
    }
    
    const response = await api.post('/students/import/csv', csvContent, {
      headers: {
        'Content-Type': 'text/csv',
      },
      timeout: 60000, // 60 seconds for large files with identity resolution
    });
    
    // Validate response structure
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
    return {
      message: response.data.message || 'CSV import completed',
      summary: response.data.summary || {
        totalRows: 0,
        totalProcessed: 0,
        studentsCreated: 0,
        studentsUpdated: 0,
        duplicatesMerged: 0,
        rowsSkipped: 0,
      },
      details: response.data.details || {
        created: 0,
        updated: 0,
        merged: 0,
        skipped: 0,
      },
      errors: Array.isArray(response.data.errors) ? response.data.errors : [],
    };
  } catch (error: any) {
    console.error('Error uploading CSV file:', error);
    throw error;
  }
};

/**
 * Import from server CSV file (server/exports/students.csv)
 * Reads the CSV file from the server and imports it into the database
 * Automatically updates the entire client site
 */
export const importFromServerCsv = async (): Promise<{
  message: string;
  summary: {
    totalRows: number;
    totalProcessed: number;
    studentsCreated: number;
    studentsUpdated: number;
    rowsSkipped: number;
  };
  details: {
    created: number;
    updated: number;
    skipped: number;
  };
  errors?: string[];
}> => {
  try {
    const response = await api.post('/students/import/server-csv');
    
    // Validate response structure
    if (!response.data) {
      throw new Error('Invalid response from server');
    }
    
    return {
      message: response.data.message || 'Server CSV import completed',
      summary: response.data.summary || {
        totalRows: 0,
        totalProcessed: 0,
        studentsCreated: 0,
        studentsUpdated: 0,
        rowsSkipped: 0,
      },
      details: response.data.details || {
        created: 0,
        updated: 0,
        skipped: 0,
      },
      errors: Array.isArray(response.data.errors) ? response.data.errors : [],
    };
  } catch (error: any) {
    console.error('Error importing from server CSV file:', error);
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
    
    // Validate response
    if (!response.data) {
      throw new Error('Invalid response from analytics endpoint');
    }
    
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
    
    // Validate response structure
    if (!response.data || !response.data.students) {
      throw new Error('Invalid response structure from server');
    }
    
    // Map students from server format to client format, preserving risk labels
    const mapStudentWithLabels = (serverStudent: any): Student & { riskLabels?: string[] } => {
      const student = mapStudentFromServer(serverStudent);
      return {
        ...student,
        riskLabels: serverStudent.riskLabels || [],
      };
    };
    
    // Safely access nested arrays with fallbacks
    const studentsData = response.data.students || {};
    
    return {
      thresholds: response.data.thresholds || {
        criticalGpa: 2.0,
        warningAttendance: 75,
        financialLimit: 1000000,
      },
      summary: response.data.summary || {
        totalStudents: 0,
        withFinancialRisk: 0,
        withAttendanceRisk: 0,
        withAcademicRisk: 0,
        incompleteRecords: 0,
        withNoIssues: 0,
      },
      students: {
        financialRisk: Array.isArray(studentsData.financialRisk) 
          ? studentsData.financialRisk.map(mapStudentWithLabels) 
          : [],
        attendanceRisk: Array.isArray(studentsData.attendanceRisk) 
          ? studentsData.attendanceRisk.map(mapStudentWithLabels) 
          : [],
        academicRisk: Array.isArray(studentsData.academicRisk) 
          ? studentsData.academicRisk.map(mapStudentWithLabels) 
          : [],
        incompleteRecords: Array.isArray(studentsData.incompleteRecords) 
          ? studentsData.incompleteRecords.map(mapStudentWithLabels) 
          : [],
        noIssues: Array.isArray(studentsData.noIssues) 
          ? studentsData.noIssues.map(mapStudentWithLabels) 
          : [],
      },
    };
  } catch (error) {
    console.error('Error fetching data integrity alerts:', error);
    throw error;
  }
};

/**
 * Get all active courses (for attendance selection)
 * RECEPTIONIST only
 */
export const getCourses = async (): Promise<Array<{ _id: string; code: string; name: string; credits: number }>> => {
  try {
    const response = await api.get('/attendance/courses');
    return response.data;
  } catch (error) {
    console.error('Error fetching courses:', error);
    throw error;
  }
};

/**
 * Get enrolled students for a course
 * RECEPTIONIST only
 */
export const getEnrolledStudents = async (
  courseId: string,
  options?: { semester?: string; academicYear?: number }
): Promise<Array<{ id: string; studentId: string; studentName: string }>> => {
  try {
    const params: any = {};
    if (options?.semester) params.semester = options.semester;
    if (options?.academicYear) params.academicYear = options.academicYear;

    const response = await api.get(`/attendance/courses/${courseId}/students`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    throw error;
  }
};

/**
 * Submit attendance records
 * RECEPTIONIST only
 */
export const submitAttendance = async (data: {
  courseId: string;
  courseUnit?: string;
  lectureDate: string;
  lecturerName: string;
  attendanceRecords: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' }>;
}): Promise<{ message: string; recordsCreated: number; errors?: string[] }> => {
  try {
    const response = await api.post('/attendance/submit', data);
    return response.data;
  } catch (error) {
    console.error('Error submitting attendance:', error);
    throw error;
  }
};

/**
 * Get attendance submissions
 * RECEPTIONIST only - view own submissions
 */
export const getAttendanceSubmissions = async (options?: {
  courseId?: string;
  lectureDate?: string;
}): Promise<Array<{
  id: string;
  course: { id: string; code: string; name: string };
  courseUnit?: string;
  lectureDate: string;
  lecturerName: string;
  student: { id: string; studentId: string };
  status: 'PRESENT' | 'ABSENT';
  submittedAt: string;
  isFinalized: boolean;
}>> => {
  try {
    const params: any = {};
    if (options?.courseId) params.courseId = options.courseId;
    if (options?.lectureDate) params.lectureDate = options.lectureDate;

    const response = await api.get('/attendance/submissions', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance submissions:', error);
    throw error;
  }
};

/**
 * Get comprehensive attendance reports with filters
 * RECEPTIONIST only
 */
export const getAttendanceReports = async (options?: {
  courseId?: string;
  studentId?: string;
  lecturerName?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  summary: {
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    attendanceRate: number;
  };
  courseStats: Array<{
    course: { id: string; code: string; name: string };
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
  }>;
  records: Array<{
    id: string;
    course: { id: string; code: string; name: string };
    student: { id: string; studentId: string };
    lectureDate: string;
    lecturerName: string;
    status: 'PRESENT' | 'ABSENT';
    courseUnit?: string;
  }>;
}> => {
  try {
    const params: any = {};
    if (options?.courseId) params.courseId = options.courseId;
    if (options?.studentId) params.studentId = options.studentId;
    if (options?.lecturerName) params.lecturerName = options.lecturerName;
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const response = await api.get('/attendance/reports', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance reports:', error);
    throw error;
  }
};

/**
 * Get attendance statistics by course
 * RECEPTIONIST only
 */
export const getCourseAttendanceSummary = async (options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Array<{
  course: { id: string; code: string; name: string; credits: number } | null;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  uniqueStudentCount: number;
  uniqueLectureCount: number;
  attendanceRate: number;
}>> => {
  try {
    const params: any = {};
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const response = await api.get('/attendance/reports/course-summary', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching course attendance summary:', error);
    throw error;
  }
};

/**
 * Get attendance statistics by student
 * RECEPTIONIST only
 */
export const getStudentAttendanceSummary = async (options?: {
  courseId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Array<{
  student: {
    id: string;
    studentId: string;
    program: string;
    yearOfStudy: number;
  } | null;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  uniqueCourseCount: number;
  uniqueLectureCount: number;
  attendanceRate: number;
}>> => {
  try {
    const params: any = {};
    if (options?.courseId) params.courseId = options.courseId;
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const response = await api.get('/attendance/reports/student-summary', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching student attendance summary:', error);
    throw error;
  }
};

/**
 * Get attendance trends over time
 * RECEPTIONIST only - time-based trend analysis (daily/weekly/monthly)
 */
export const getAttendanceTrends = async (options?: {
  courseId?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
}): Promise<{
  period: string;
  trends: Array<{
    period: any;
    date: string;
    totalRecords: number;
    presentCount: number;
    absentCount: number;
    attendanceRate: number;
  }>;
}> => {
  try {
    const params: any = {};
    if (options?.courseId) params.courseId = options.courseId;
    if (options?.period) params.period = options.period;
    if (options?.startDate) params.startDate = options.startDate;
    if (options?.endDate) params.endDate = options.endDate;

    const response = await api.get('/attendance/reports/trends', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance trends:', error);
    throw error;
  }
};
