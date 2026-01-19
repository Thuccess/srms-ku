import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import RoleBasedDashboard from './components/RoleBasedDashboard';
import StudentList from './components/StudentList';
import StudentDetail from './components/StudentDetail';
import Settings from './components/Settings';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Breadcrumbs from './components/Breadcrumbs';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MOCK_STUDENTS } from './constants';
import { Student, SystemSettings, UserRole } from './types';
import { getStudents, addStudent as apiAddStudent, updateStudent as apiUpdateStudent } from './services/apiService';
import { socketService } from './services/socketService';
import { mapStudentFromServer } from './services/apiService';

const DEFAULT_SETTINGS: SystemSettings = {
  thresholds: {
    criticalGpa: 2.0,
    warningAttendance: 75,
    financialLimit: 1000000
  },
  preferences: {
    dailyDigest: true,
    smsAlerts: false,
    emailAlerts: true,
    notificationThreshold: 85,
    autoAnalysis: true
  }
};

const AppContent: React.FC = () => {
  const { addToast } = useToast();
  const { isAuthenticated, logout, user } = useAuth();

  // Students are sourced from the backend (MongoDB) where possible.
  const [students, setStudents] = useState<Student[]>([]);

  // Persistence State: Settings
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('ku_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // Helper function to get cached students from localStorage
  const getCachedStudents = (): Student[] | null => {
    try {
      const cached = localStorage.getItem('ku_students_cache');
      if (cached) {
        const students = JSON.parse(cached);
        if (Array.isArray(students) && students.length > 0) {
          return students;
        }
      }
    } catch (error) {
      console.warn('Failed to parse cached students:', error);
    }
    return null;
  };

  // Effects
  useEffect(() => {
    const loadStudents = async () => {
      try {
        // Performance Optimization: Load all students (backward compatible - no pagination params)
        // For large datasets, this will still work but may be slower
        // Future enhancement: Implement pagination in UI for very large datasets
        const data = await getStudents();
        
        // Handle both array response (backward compatible) and paginated response
        const studentsArray = Array.isArray(data) 
          ? data 
          : (data as any).students || [];
        
        if (studentsArray.length > 0) {
          setStudents(studentsArray);
          // Update cache with fresh data from server
          localStorage.setItem('ku_students_cache', JSON.stringify(studentsArray));
          localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
        } else {
          // Server is connected but no students in database - start empty
          setStudents([]);
          // Clear cache to ensure fresh start
          localStorage.removeItem('ku_students_cache');
          localStorage.removeItem('ku_students_cache_timestamp');
        }
      } catch (error: any) {
        console.error('Failed to load students from API:', error);
        
        // Check if it's a connection error
        if (error?.isConnectionError || error?.message?.includes('Cannot connect') || error?.message?.includes('timeout')) {
          // Try to use cached students if available, otherwise start empty
          const cached = getCachedStudents();
          if (cached && cached.length > 0) {
            setStudents(cached);
            addToast(
              'Server connection failed. Using cached data from last CSV import.',
              'warning'
            );
          } else {
            setStudents([]);
            addToast(
              'Server connection failed. Please start the server with: cd server && npm run dev',
              'warning'
            );
          }
        } else {
          // Other error (e.g., 500, 404)
          // Try to use cached students if available, otherwise start empty
          const cached = getCachedStudents();
          if (cached && cached.length > 0) {
            setStudents(cached);
            addToast('Server error. Using cached data from last CSV import.', 'warning');
          } else {
            setStudents([]);
            addToast(
              `Server error: ${error?.message || 'Unknown error'}. Student Directory is empty.`,
              'error'
            );
          }
        }
      }
    };

    // Only load if authenticated
    if (isAuthenticated) {
      loadStudents();
    }
  }, [addToast, isAuthenticated]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!isAuthenticated) {
      socketService.disconnect();
      return;
    }

    // Connect to Socket.io
    socketService.connect();

    // Handle student created
    const handleStudentCreated = (data: { student: any }) => {
      const newStudent = mapStudentFromServer(data.student);
      setStudents(prev => {
        // Check if student already exists (avoid duplicates)
        const exists = prev.some(s => s.studentNumber === newStudent.studentNumber);
        if (exists) {
          return prev.map(s => s.studentNumber === newStudent.studentNumber ? newStudent : s);
        }
        return [newStudent, ...prev];
      });
      addToast(`New student added: ${newStudent.studentNumber}`, 'success');
    };

    // Handle student updated
    const handleStudentUpdated = (data: { student: any }) => {
      const updatedStudent = mapStudentFromServer(data.student);
      setStudents(prev => prev.map(s => 
        s.studentNumber === updatedStudent.studentNumber ? updatedStudent : s
      ));
    };

    // Handle student deleted
    const handleStudentDeleted = (data: { studentNumber: string }) => {
      setStudents(prev => prev.filter(s => s.studentNumber !== data.studentNumber));
      addToast('Student deleted', 'info');
    };

    // Handle students imported (bulk CSV upload)
    const handleStudentsImported = async (data: { createdCount: number; updatedCount: number }) => {
      // Refresh students from database after CSV import
      try {
        const { getStudents } = await import('./services/apiService');
        const studentsData = await getStudents();
        const studentsArray = Array.isArray(studentsData) 
          ? studentsData 
          : (studentsData as any).students || [];
        
        setStudents(studentsArray);
        // Update cache with fresh data from server
        if (studentsArray.length > 0) {
          localStorage.setItem('ku_students_cache', JSON.stringify(studentsArray));
          localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
        }
        addToast(`Student Directory updated: ${studentsArray.length} student${studentsArray.length !== 1 ? 's' : ''} loaded`, 'success');
      } catch (error) {
        console.error('Failed to refresh students after CSV import:', error);
        addToast('Failed to refresh Student Directory. Please refresh the page.', 'warning');
      }
    };

    // Handle risk updated (risk data is no longer stored in student profile)
    // This handler is kept for backward compatibility but risk data is not persisted
    const handleRiskUpdated = (data: { studentNumber: string; riskScore: number; riskLevel: string }) => {
      // Risk updates are handled by the risk prediction API, not stored in student profile
      // This is a no-op for now as risk data is not part of the student schema
      console.log('Risk updated for student:', data.studentNumber, 'Risk data is not stored in profile');
    };

    // Register event listeners
    socketService.onStudentCreated(handleStudentCreated);
    socketService.onStudentUpdated(handleStudentUpdated);
    socketService.onStudentDeleted(handleStudentDeleted);
    socketService.onStudentsImported(handleStudentsImported);
    socketService.onRiskUpdated(handleRiskUpdated);

    // Cleanup on unmount or logout
    return () => {
      socketService.offStudentCreated(handleStudentCreated);
      socketService.offStudentUpdated(handleStudentUpdated);
      socketService.offStudentDeleted(handleStudentDeleted);
      socketService.offStudentsImported(handleStudentsImported);
      socketService.offRiskUpdated(handleRiskUpdated);
    };
  }, [isAuthenticated, addToast]);

  useEffect(() => {
    localStorage.setItem('ku_settings', JSON.stringify(settings));
  }, [settings]);

  const handleLogin = () => {
    // Auth is handled by AuthContext
    // The isAuthenticated state from useAuth will update automatically
    // This callback is just to trigger a re-render if needed
    // The component will re-render when isAuthenticated changes
  };

  const handleLogout = () => {
    socketService.disconnect();
    logout();
  };

  const updateStudent = (updatedStudent: Student) => {
    // Optimistically update local state
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));

    // Persist change to backend - use studentNumber as the identifier
    const identifier = updatedStudent.studentNumber || updatedStudent.id;
    apiUpdateStudent(identifier, updatedStudent).catch((error) => {
      console.error('Failed to update student on server:', error);
      const errorMsg = error?.message?.includes('Cannot connect') 
        ? 'Server is unavailable. Changes saved locally only.'
        : 'Failed to sync student update to the server.';
      addToast(errorMsg, 'error');
    });
  };

  const addStudent = (newStudent: Student) => {
    // Optimistically add to local state
    setStudents(prev => [newStudent, ...prev]);

    // Persist to backend and reconcile with server representation
    apiAddStudent(newStudent).then((saved) => {
      setStudents(prev =>
        prev.map(s => (s === newStudent || s.id === newStudent.id ? saved : s))
      );
    }).catch((error) => {
      console.error('Failed to create student on server:', error);
      addToast('Failed to create student on the server.', 'error');
    });
  };

  const addStudents = (newStudents: Student[]) => {
    // Validate input
    if (!Array.isArray(newStudents) || newStudents.length === 0) {
      console.warn('addStudents called with invalid or empty array');
      return;
    }
    
    // Check if this is a full refresh (from server CSV import or getStudents)
    // Full refresh: All students have proper IDs and come from server
    // Partial add: New students to be added to existing list
    const isFullRefresh = newStudents.length > 0 && 
      newStudents.every(s => s && s.id && s.studentNumber) &&
      (students.length === 0 || newStudents.length >= students.length * 0.5); // If more than 50% of current, likely a refresh
    
    if (isFullRefresh) {
      // This is a full refresh from server - replace all students
      setStudents(newStudents);
      
      // Update cache
      try {
        localStorage.setItem('ku_students_cache', JSON.stringify(newStudents));
        localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
      } catch (cacheError) {
        console.warn('Failed to update cache:', cacheError);
      }
    } else {
      // Optimistic UI update for new students
      setStudents(prev => {
        // Filter out any duplicates before adding
        const existingIds = new Set(prev.map(s => s.id));
        const uniqueNewStudents = newStudents.filter(s => s && s.id && !existingIds.has(s.id));
        return [...uniqueNewStudents, ...prev];
      });

      // Persist each new student to backend
      const validStudents = newStudents.filter(s => s && s.id && s.studentNumber);
      if (validStudents.length > 0) {
        Promise.all(validStudents.map(s => apiAddStudent(s))).then((savedStudents) => {
          setStudents(prev => {
            // Replace optimistic entries with saved ones where possible
            const remaining = prev.filter(s => !validStudents.some(ns => ns.id === s.id));
            return [...savedStudents.filter(s => s), ...remaining];
          });
        }).catch((error) => {
          console.error('Failed to bulk-create students on server:', error);
          addToast('Failed to import some students to the server.', 'error');
        });
      }
    }
  };

  return (
    <Router>
        {!isAuthenticated ? (
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-emerald-50/20">
            <Sidebar onLogout={handleLogout} />
            <main className="flex-1 lg:ml-80 transition-all duration-300">
              {/* Mobile top navigation */}
              <div className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <img 
                    src="/logo.png" 
                    alt="Kampala University" 
                    className="h-8 w-auto object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Kampala University</span>
                    <span className="text-sm font-semibold text-slate-800">Risk Intelligence</span>
                  </div>
                </div>
                <nav className="flex items-center gap-1.5 text-xs font-semibold" aria-label="Mobile navigation">
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`
                    }
                    aria-label="Dashboard"
                  >
                    Home
                  </NavLink>
                  {user && user.role !== UserRole.RECEPTIONIST && (
                    <NavLink
                      to="/students"
                      className={({ isActive }) =>
                        `px-3 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`
                      }
                      aria-label="Students Directory"
                    >
                      Students
                    </NavLink>
                  )}
                  {user && (user.role === 'REGISTRY' || user.role === 'IT_ADMIN') && (
                    <NavLink
                      to="/settings"
                      className={({ isActive }) =>
                        `px-3 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`
                      }
                      aria-label="System Settings"
                    >
                      Settings
                    </NavLink>
                  )}
                </nav>
              </div>
              {/* Breadcrumbs for desktop */}
              <div className="hidden lg:block">
                <Breadcrumbs />
              </div>
              <Routes>
                <Route 
                  path="/" 
                  element={<RoleBasedDashboard students={students} settings={settings} />} 
                />
                <Route 
                  path="/students" 
                  element={
                    user?.role === UserRole.RECEPTIONIST ? (
                      <Navigate to="/" replace />
                    ) : (
                      <StudentList students={students} setStudents={setStudents} settings={settings} />
                    )
                  } 
                />
                <Route 
                  path="/students/:id" 
                  element={
                    user?.role === UserRole.RECEPTIONIST ? (
                      <Navigate to="/" replace />
                    ) : (
                      <StudentDetail students={students} updateStudent={updateStudent} settings={settings} />
                    )
                  } 
                />
                <Route 
                  path="/settings" 
                  element={
                    user?.role === UserRole.RECEPTIONIST ? (
                      <Navigate to="/" replace />
                    ) : (
                      <Settings 
                        onAddStudent={addStudent} 
                        onAddStudents={addStudents} 
                        settings={settings}
                        onUpdateSettings={setSettings}
                      />
                    )
                  } 
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </Router>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AuthProvider>
    <AppContent />
    </AuthProvider>
  </ToastProvider>
);

export default App;