import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Student, RiskLevel, Intervention, InterventionType, SystemSettings } from '../types';
import { Search, Filter, Eye, MoreHorizontal, Download, Mail, FileText, CheckSquare, Square, X, Settings, DollarSign, BookOpen, Clock, AlertCircle, CheckCircle2, ChevronDown, MessageSquare, Smartphone, Loader2, Calendar, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socketService';
import { mapStudentFromServer, deleteStudent, getStudents } from '../services/apiService';
import { UserRole } from '../types';

interface StudentListProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  settings: SystemSettings;
}

// Debounce hook
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// CSV escaping helper
const escapeCsvField = (field: string | number | undefined | null): string => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const StudentList: React.FC<StudentListProps> = ({ students, setStudents, settings }) => {
  const { addToast } = useToast();
  const { user, hasRole, canViewIndividualStudents } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Check if user can view individual students
  if (!canViewIndividualStudents()) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-900 mb-2">Access Restricted</h2>
              <p className="text-slate-700 mb-4">
                Your role ({user?.role}) does not have permission to view individual student data.
              </p>
              <p className="text-slate-600 text-sm mb-4">
                As {user?.role === 'VC' ? 'Vice Chancellor' : user?.role === 'DVC_ACADEMIC' ? 'Deputy Vice Chancellor (Academic)' : 'IT Administrator'}, you have access to aggregated analytics and university-wide metrics only, not individual student records.
              </p>
              <div className="mt-6">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
                >
                  <ArrowRight className="w-5 h-5" />
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Removed debug logging for production

  // Auto-refresh from database when component mounts or route changes
  useEffect(() => {
    // Refresh data from database when Student Directory is opened or route changes
    // This ensures we always have the latest data from the database
    const refreshOnMount = async () => {
      try {
        await refreshStudentsFromDatabase(false); // Silent refresh on mount/route change
      } catch (error) {
        // Silently fail on mount - don't show error toast
        console.log('Auto-refresh on mount/route change completed (may have used cached data)');
      }
    };

    refreshOnMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]); // Refresh when route or query params change

  // Get issue filter from URL query parameter
  const issueFilter = searchParams.get('issue') || null;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [programFilter, setProgramFilter] = useState<string>('All');
  const [semesterFilter, setSemesterFilter] = useState<string>('All');
  
  // Performance Optimization: Pagination for large student lists
  // Only activates when there are more than 50 students to maintain backward compatibility
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 50; // Configurable page size

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showBulkIntervention, setShowBulkIntervention] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  
  // Modal State
  const [bulkNote, setBulkNote] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  // Initialize bulk settings based on global preferences
  const [notificationSettings] = useState({
    channels: { email: settings.preferences.emailAlerts, sms: settings.preferences.smsAlerts },
    priority: 'Normal' as const
  });
  const [processing, setProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extract unique courses for filter dropdown
  const uniqueCourses = useMemo(() => {
    const courses = new Set<string>();
    students.forEach(s => {
      if (s.course) {
        courses.add(s.course);
      }
    });
    return Array.from(courses).sort();
  }, [students]);

  // Semester options - only 1 and 2
  const semesterOptions = useMemo(() => {
    return ['1', '2'];
  }, []);

  // Apply issue filter based on URL parameter
  const issueFilteredStudents = useMemo(() => {
    if (!issueFilter) return students;
    
    switch (issueFilter) {
      case 'incomplete':
        return students.filter(s => !s.studentNumber || !s.course);
      case 'financial':
        // Financial Issues: Only students whose balance exceeds Financial Hold threshold
        // AND who do NOT have academic issues (low GPA or low attendance)
        return students.filter(s => {
          const balanceExceedsThreshold = s.balance != null && 
            s.balance > settings.thresholds.financialLimit;
          if (!balanceExceedsThreshold) return false;
          const hasLowGPA = s.gpa != null && s.gpa < settings.thresholds.criticalGpa;
          const hasLowAttendance = s.attendance != null && s.attendance < settings.thresholds.warningAttendance;
          return !hasLowGPA && !hasLowAttendance;
        });
      case 'all-financial':
        // All Financial Issues: ALL students whose balance exceeds Financial Alert Threshold
        return students.filter(s => {
          const balanceExceedsThreshold = s.balance != null && 
            s.balance > settings.thresholds.financialLimit;
          return balanceExceedsThreshold;
        });
      case 'attendance':
        // Low Attendance: Only students with low attendance ONLY (no financial issues or low GPA)
        return students.filter(s => {
          const hasLowAttendance = s.attendance != null && s.attendance < settings.thresholds.warningAttendance;
          if (!hasLowAttendance) return false;
          const hasFinancialIssue = s.balance != null && 
            s.balance > settings.thresholds.financialLimit;
          const hasLowGPA = s.gpa != null && s.gpa < settings.thresholds.criticalGpa;
          return !hasFinancialIssue && !hasLowGPA;
        });
      case 'all-attendance':
        // All Attendance Risk: ALL students whose attendance is below threshold (matches Data Integrity Alerts)
        return students.filter(s => {
          return s.attendance != null && s.attendance < settings.thresholds.warningAttendance;
        });
      case 'gpa':
        // All Academic Risk: ALL students whose GPA is below threshold (matches Data Integrity Alerts)
        return students.filter(s => {
          return s.gpa != null && s.gpa < settings.thresholds.criticalGpa;
        });
      case 'academic':
        // Academic Issues: Only students with low GPA ONLY (no low attendance or financial issues)
        return students.filter(s => {
          const hasLowGPA = s.gpa != null && s.gpa < settings.thresholds.criticalGpa;
          if (!hasLowGPA) return false;
          const hasLowAttendance = s.attendance != null && s.attendance < settings.thresholds.warningAttendance;
          const hasFinancialIssue = s.balance != null && 
            s.balance > settings.thresholds.financialLimit;
          return !hasLowAttendance && !hasFinancialIssue;
        });
      case 'none':
        // Students with No Issues: No financial, attendance, or academic risk issues
        // 100% accurate - matches Data Integrity Alerts logic
        return students.filter(s => {
          // Must have complete records
          if (!s.studentNumber || !s.course) return false;
          
          // No financial issues (balance <= threshold)
          const hasFinancialIssue = s.balance != null && 
            s.balance > settings.thresholds.financialLimit;
          if (hasFinancialIssue) return false;
          
          // No attendance issues (attendance >= threshold)
          const hasAttendanceIssue = s.attendance != null && 
            s.attendance < settings.thresholds.warningAttendance;
          if (hasAttendanceIssue) return false;
          
          // No academic issues (GPA >= threshold)
          const hasAcademicIssue = s.gpa != null && 
            s.gpa < settings.thresholds.criticalGpa;
          if (hasAcademicIssue) return false;
          
          // All checks passed - student has no issues
          return true;
        });
      default:
        return students;
    }
  }, [students, issueFilter, settings]);

  // Memoized Filter Logic with improved error handling
  const filteredStudents = useMemo(() => {
    if (!issueFilteredStudents || issueFilteredStudents.length === 0) return [];
    
    return issueFilteredStudents.filter(s => {
      if (!s || !s.studentNumber || !s.course) return false;
      
      const term = debouncedSearchTerm.toLowerCase().trim();

      const matchesSearch = term === '' ||
        s.studentNumber?.toLowerCase().includes(term) ||
        s.course?.toLowerCase().includes(term) ||
        String(s.semesterOfStudy || '').toLowerCase().includes(term);

      const matchesYear = yearFilter === 'All' || (s.yearOfStudy && s.yearOfStudy.toString() === yearFilter);
      const matchesProgram = programFilter === 'All' || s.course === programFilter;
      const matchesSemester = semesterFilter === 'All' || s.semesterOfStudy === semesterFilter;
      
      return matchesSearch && matchesYear && matchesProgram && matchesSemester;
    });
  }, [issueFilteredStudents, debouncedSearchTerm, yearFilter, programFilter, semesterFilter]);

  // Safety check for filteredStudents
  const safeFilteredStudents = Array.isArray(filteredStudents) ? filteredStudents : [];
  
  // Performance Optimization: Pagination logic
  // Only paginate if there are more than 50 students (maintains backward compatibility)
  const shouldPaginate = safeFilteredStudents.length > studentsPerPage;
  const totalPages = Math.ceil(safeFilteredStudents.length / studentsPerPage);
  const startIndex = shouldPaginate ? (currentPage - 1) * studentsPerPage : 0;
  const endIndex = shouldPaginate ? startIndex + studentsPerPage : safeFilteredStudents.length;
  const paginatedStudents = safeFilteredStudents.slice(startIndex, endIndex);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, yearFilter, programFilter, semesterFilter, issueFilter]);

  // Export CSV with improved error handling and proper escaping
  // Export ALL students, not just filtered ones
  const handleExportCSV = useCallback(() => {
    try {
      // Use all students instead of filteredStudents
      const studentsToExport = students;
      
      if (studentsToExport.length === 0) {
        addToast('No students to export', 'warning');
        return;
      }

      // Only allowed fields in exact order
      const headers = [
        'Student Number',
        'Course',
        'Year of Study',
        'Semester of Study',
        'GPA',
        'Attendance',
        'Balance',
      ];
      const rows = studentsToExport.map(s => {
        return [
          escapeCsvField(s.studentNumber),
          escapeCsvField(s.course),
          escapeCsvField(s.yearOfStudy),
          escapeCsvField(s.semesterOfStudy),
          escapeCsvField(s.gpa),
          escapeCsvField(s.attendance),
          escapeCsvField(s.balance),
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Add BOM for Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `students_export_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      addToast(`CSV export downloaded successfully (${studentsToExport.length} students)`, 'success');
    } catch (error) {
      console.error('CSV export error:', error);
      addToast('Failed to export CSV. Please try again.', 'error');
    }
  }, [students, addToast]);

  // Selection Logic with useCallback
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Performance Optimization: Updated to work with pagination
  // Selects/deselects only students on the current page
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      // Calculate current page students from filteredStudents
      const safeFiltered = Array.isArray(filteredStudents) ? filteredStudents : [];
      const shouldPaginate = safeFiltered.length > studentsPerPage;
      const startIdx = shouldPaginate ? (currentPage - 1) * studentsPerPage : 0;
      const endIdx = shouldPaginate ? startIdx + studentsPerPage : safeFiltered.length;
      const currentPageStudents = safeFiltered.slice(startIdx, endIdx);
      const currentPageIds = currentPageStudents.map(s => s?.id).filter(Boolean) as string[];
      const allSelectedOnPage = currentPageIds.length > 0 && currentPageIds.every(id => prev.has(id));
      
      if (allSelectedOnPage) {
        // Deselect all on current page
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.delete(id));
        return newSet;
      } else {
        // Select all on current page
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.add(id));
        return newSet;
      }
    });
  }, [filteredStudents, currentPage, studentsPerPage]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Real-time Socket.io updates
  useEffect(() => {
    // Note: Risk updates are no longer stored in student profile
    // Risk data is only returned from API calls, not stored

    // Handle student updates
    const handleStudentUpdated = (data: { student: any }) => {
      const updatedStudent = mapStudentFromServer(data.student);
      setStudents(prev => prev.map(s => 
        s.studentNumber === updatedStudent.studentNumber ? updatedStudent : s
      ));
    };

    // Handle student created
    const handleStudentCreated = (data: { student: any }) => {
      const newStudent = mapStudentFromServer(data.student);
      setStudents(prev => {
        const exists = prev.some(s => s.studentNumber === newStudent.studentNumber);
        if (exists) {
          return prev.map(s => s.studentNumber === newStudent.studentNumber ? newStudent : s);
        }
        return [newStudent, ...prev];
      });
    };

    // Handle student deleted
    const handleStudentDeleted = (data: { studentNumber: string }) => {
      setStudents(prev => prev.filter(s => s.studentNumber !== data.studentNumber));
      // Clear selection if deleted student was selected
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        const deletedStudent = students.find(s => s.studentNumber === data.studentNumber);
        if (deletedStudent?.id) {
          newSet.delete(deletedStudent.id);
        }
        return newSet;
      });
    };

    // Register listeners
    socketService.onStudentUpdated(handleStudentUpdated);
    socketService.onStudentCreated(handleStudentCreated);
    socketService.onStudentDeleted(handleStudentDeleted);

    // Cleanup
    return () => {
      socketService.offStudentUpdated(handleStudentUpdated);
      socketService.offStudentCreated(handleStudentCreated);
      socketService.offStudentDeleted(handleStudentDeleted);
    };
  }, [students, setStudents]);

  // Bulk Actions with improved error handling
  const handleBulkIntervention = useCallback(async () => {
    if (!bulkNote.trim()) {
      addToast('Please enter intervention notes', 'warning');
      return;
    }

    if (selectedIds.size === 0) {
      addToast('Please select at least one student', 'warning');
      return;
    }

    setProcessing(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setStudents(prev => prev.map(s => {
        if (selectedIds.has(s.id)) {
          const newIntervention: Intervention = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: InterventionType.ACADEMIC_SUPPORT,
            date: new Date().toISOString().split('T')[0],
            notes: `[Bulk Action] ${bulkNote.trim()}`,
            status: 'Pending' as const
          };
          return { 
            ...s, 
            interventions: [newIntervention, ...((s as any).interventions || [])] as any as Intervention[]
          };
        }
        return s;
      }));
      
      const count = selectedIds.size;
      setShowBulkIntervention(false);
      setBulkNote('');
      setSelectedIds(new Set());
      addToast(`Logged interventions for ${count} student${count !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      console.error('Bulk intervention error:', error);
      addToast('Failed to log interventions. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [bulkNote, selectedIds, setStudents, addToast]);

  const handleBulkEmail = useCallback(async () => {
    if (!notificationMessage.trim()) {
      addToast('Please enter a message', 'warning');
      return;
    }

    if (selectedIds.size === 0) {
      addToast('Please select at least one student', 'warning');
      return;
    }

    setProcessing(true);
    try {
      // Simulate API Call using configured channels
      console.log('Dispatching notifications:', {
        recipients: Array.from(selectedIds),
        message: notificationMessage,
        channels: notificationSettings.channels
      });

      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const channels: string[] = [];
      if (notificationSettings.channels.email) channels.push('Email');
      if (notificationSettings.channels.sms) channels.push('SMS');
      
      const count = selectedIds.size;
      setShowBulkEmail(false);
      setNotificationMessage('');
      setSelectedIds(new Set());
      
      if (channels.length === 0) {
        addToast('No notification channels enabled. Please enable Email or SMS in settings.', 'warning');
      } else {
        addToast(`Queued ${channels.join(' & ')} notifications for ${count} student${count !== 1 ? 's' : ''}`, 'success');
      }
    } catch (error) {
      console.error('Bulk email error:', error);
      addToast('Failed to send notifications. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [notificationMessage, selectedIds, notificationSettings.channels, addToast]);

  // Refresh students from database
  const refreshStudentsFromDatabase = useCallback(async (showToast = false) => {
    try {
      const data = await getStudents();
      const studentsArray = Array.isArray(data) 
        ? data 
        : (data as any).students || [];
      
      if (studentsArray.length > 0) {
        setStudents(studentsArray);
        // Update cache with fresh data from server
        localStorage.setItem('ku_students_cache', JSON.stringify(studentsArray));
        localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
        
        if (showToast) {
          addToast(`Refreshed ${studentsArray.length} student${studentsArray.length !== 1 ? 's' : ''} from database`, 'success');
        }
      } else {
        if (showToast) {
          addToast('No students found in database', 'info');
        }
      }
    } catch (error: any) {
      console.error('Failed to refresh students from database:', error);
      
      // Handle 403 (Access Denied) gracefully - don't show error toast
      // The component will show the access restricted message instead
      if (error?.response?.status === 403) {
        // User doesn't have permission - component will handle this with the access check
        return;
      }
      
      if (showToast) {
        const errorMessage = error?.response?.data?.error || error?.message || 'Failed to refresh students';
        addToast(errorMessage, 'error');
      }
    }
  }, [setStudents, addToast]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshStudentsFromDatabase(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStudentsFromDatabase]);

  // Delete single student
  const handleDeleteStudent = useCallback(async (student: Student) => {
    if (!student.studentNumber) {
      addToast('Invalid student record', 'error');
      return;
    }

    setProcessing(true);
    try {
      await deleteStudent(student.studentNumber);
      
      // Optimistically update local state
      setStudents(prev => prev.filter(s => s.studentNumber !== student.studentNumber));
      
      // Refresh from database to ensure we have the latest state
      await refreshStudentsFromDatabase();
      
      setShowDeleteConfirm(false);
      setStudentToDelete(null);
      addToast(`Student ${student.studentNumber} deleted successfully`, 'success');
    } catch (error: any) {
      console.error('Delete student error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to delete student';
      addToast(errorMessage, 'error');
    } finally {
      setProcessing(false);
    }
  }, [setStudents, addToast, refreshStudentsFromDatabase]);

  // Bulk delete students
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      addToast('Please select at least one student', 'warning');
      return;
    }

    const studentsToDelete = students.filter(s => selectedIds.has(s.id));
    if (studentsToDelete.length === 0) {
      addToast('No valid students selected', 'warning');
      return;
    }

    setProcessing(true);
    try {
      // Delete all selected students
      const deletePromises = studentsToDelete.map(student => 
        deleteStudent(student.studentNumber).catch(error => {
          console.error(`Failed to delete ${student.studentNumber}:`, error);
          return { error: student.studentNumber, message: error?.response?.data?.error || 'Delete failed' };
        })
      );

      const results = await Promise.allSettled(deletePromises);
      
      // Filter out successfully deleted students
      const deletedNumbers = new Set<string>();
      const errors: string[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && !(result.value as any).error) {
          deletedNumbers.add(studentsToDelete[index].studentNumber);
        } else {
          const errorMsg = result.status === 'rejected' 
            ? result.reason?.response?.data?.error || 'Delete failed'
            : (result.value as any)?.message || 'Delete failed';
          errors.push(`${studentsToDelete[index].studentNumber}: ${errorMsg}`);
        }
      });

      // Optimistically update students list
      setStudents(prev => prev.filter(s => !deletedNumbers.has(s.studentNumber)));
      
      // Refresh from database to ensure we have the latest state
      if (deletedNumbers.size > 0) {
        await refreshStudentsFromDatabase();
      }
      
      // Clear selection
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);

      const successCount = deletedNumbers.size;
      const failCount = errors.length;

      if (successCount > 0 && failCount === 0) {
        addToast(`Successfully deleted ${successCount} student${successCount !== 1 ? 's' : ''}`, 'success');
      } else if (successCount > 0 && failCount > 0) {
        addToast(`Deleted ${successCount} student${successCount !== 1 ? 's' : ''}, ${failCount} failed`, 'warning');
        console.error('Delete errors:', errors);
      } else {
        addToast(`Failed to delete students`, 'error');
        console.error('Delete errors:', errors);
      }
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      addToast('Failed to delete students. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  }, [selectedIds, students, setStudents, addToast, refreshStudentsFromDatabase]);

  // UI Helpers with improved type safety
  const getRiskBadge = useCallback((student: Student) => {
    // Risk data is no longer stored in student profile
    // Return a placeholder badge
    return (
      <div className="flex flex-col gap-1.5 w-24">
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm bg-slate-100 text-slate-600 border-slate-200">
          N/A
        </span>
      </div>
    );
  }, []);

  const renderRiskFactors = useCallback((student: Student) => {
    // Risk data is no longer stored in student profile
    // Auto-detect risk factors from allowed fields only
    const displayFactors: string[] = [];
    
    if (displayFactors.length === 0) {
      if (typeof student.gpa === 'number' && student.gpa < settings.thresholds.criticalGpa) {
        displayFactors.push('Low GPA');
      }
      if (typeof student.attendance === 'number' && student.attendance < settings.thresholds.warningAttendance) {
        displayFactors.push('Poor Attendance');
      }
      if (student.balance != null && student.balance > settings.thresholds.financialLimit) {
        displayFactors.push('Financial Hold');
      }
    }

    if (displayFactors.length === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100">
          <CheckCircle2 size={12} /> Stable
        </span>
      );
    }

    const getFactorStyle = (factor: string): { style: string; Icon: React.ComponentType<{ size?: number; className?: string }> } => {
      const lower = factor.toLowerCase();
      if (lower.includes('gpa') || lower.includes('academic') || lower.includes('grade')) {
        return { style: "bg-rose-50 text-rose-700 border-rose-100", Icon: BookOpen };
      } else if (lower.includes('attendance') || lower.includes('absent')) {
        return { style: "bg-amber-50 text-amber-700 border-amber-100", Icon: Clock };
      } else if (lower.includes('financial') || lower.includes('tuition') || lower.includes('balance')) {
        return { style: "bg-blue-50 text-blue-700 border-blue-100", Icon: DollarSign };
      }
      return { style: "bg-slate-50 text-slate-600 border-slate-200", Icon: AlertCircle };
    };

    return (
      <div className="flex flex-col gap-1.5 items-start">
        {displayFactors.slice(0, 2).map((factor, i) => {
          const { style, Icon } = getFactorStyle(factor);
          return (
            <span key={`${factor}-${i}`} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold border ${style} max-w-[150px]`}>
              <Icon size={12} className="flex-shrink-0" />
              <span className="truncate">{factor}</span>
            </span>
          );
        })}
        {displayFactors.length > 2 && (
          <span className="text-[10px] font-bold text-slate-400 pl-1 hover:text-slate-600 cursor-default">
            +{displayFactors.length - 2} other risks
          </span>
        )}
      </div>
    );
  }, [settings.thresholds]);

  // Safety check - ensure students is an array
  if (!Array.isArray(students)) {
    console.error('Students is not an array:', students);
    return (
      <div className="p-10 max-w-[1600px] mx-auto relative font-sans">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Students</h2>
          <p className="text-red-600">Students data is invalid. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  // Ensure pagination variables are available for JSX
  // These are calculated from filteredStudents which is already memoized above
  const safeFilteredStudentsForRender = Array.isArray(filteredStudents) ? filteredStudents : [];
  const shouldPaginateForRender = safeFilteredStudentsForRender.length > studentsPerPage;
  const totalPagesForRender = Math.ceil(safeFilteredStudentsForRender.length / studentsPerPage);
  const startIndexForRender = shouldPaginateForRender ? (currentPage - 1) * studentsPerPage : 0;
  const endIndexForRender = shouldPaginateForRender ? startIndexForRender + studentsPerPage : safeFilteredStudentsForRender.length;
  const paginatedStudentsForRender = safeFilteredStudentsForRender.slice(startIndexForRender, endIndexForRender);

  return (
    <div className="p-10 max-w-[1600px] mx-auto relative font-sans animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <div>
            <h2 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight">
              Student Directory
              {issueFilter && (
                <span className="ml-3 text-lg text-slate-500 font-normal">
                  {issueFilter === 'incomplete' && '• Incomplete Records'}
                  {issueFilter === 'financial' && '• Financial Issues'}
                  {issueFilter === 'all-financial' && '• Students Exceeding Financial Alert Threshold'}
                  {issueFilter === 'attendance' && '• Low Attendance'}
                  {issueFilter === 'gpa' && '• Low GPA'}
                  {issueFilter === 'academic' && '• Academic Issues'}
                  {issueFilter === 'none' && '• Students with No Issues'}
                </span>
              )}
            </h2>
            <p className="text-slate-600 mt-2 text-lg font-semibold">
              {issueFilter 
                ? `${shouldPaginateForRender ? `Showing ${startIndexForRender + 1}-${Math.min(endIndexForRender, safeFilteredStudentsForRender.length)} of ` : ''}${safeFilteredStudentsForRender.length} student${safeFilteredStudentsForRender.length !== 1 ? 's' : ''} with ${issueFilter === 'incomplete' ? 'incomplete records' : issueFilter === 'financial' ? 'financial issues' : issueFilter === 'all-financial' ? 'exceeding financial alert threshold' : issueFilter === 'attendance' ? 'low attendance' : issueFilter === 'gpa' ? 'low GPA' : issueFilter === 'academic' ? 'academic issues' : issueFilter === 'none' ? 'no issues' : 'issues'}`
                : shouldPaginateForRender 
                  ? `Showing ${startIndexForRender + 1}-${Math.min(endIndexForRender, safeFilteredStudentsForRender.length)} of ${safeFilteredStudentsForRender.length} students`
                  : safeFilteredStudentsForRender.length > 0 
                    ? `Showing ${safeFilteredStudentsForRender.length} student${safeFilteredStudentsForRender.length !== 1 ? 's' : ''}`
                    : 'Manage enrollments and monitor student data'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-5 py-3 bg-white/90 backdrop-blur-sm border border-slate-200/50 text-slate-700 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all shadow-sm text-sm font-bold active:scale-95 card-hover disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh data from database"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} /> 
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-3 bg-white/90 backdrop-blur-sm border border-slate-200/50 text-slate-700 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all shadow-sm text-sm font-bold active:scale-95 card-hover"
          >
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden flex flex-col min-h-[600px] card-hover">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200/50 bg-gradient-to-r from-white to-slate-50/50 flex flex-col xl:flex-row gap-4 justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
          <div className="relative w-full xl:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-ku-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, ID, program, semester, 'm'/'f'..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search students"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 outline-none transition-all text-sm font-medium shadow-inner placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
             {/* Program Filter */}
             <div className="relative group">
               <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                 <BookOpen className="text-slate-400 w-4 h-4 group-hover:text-ku-600 transition-colors" />
               </div>
               <select
                 value={programFilter}
                 onChange={(e) => setProgramFilter(e.target.value)}
                 aria-label="Filter by academic program"
                 className="appearance-none pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 outline-none cursor-pointer text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors min-w-[180px]"
               >
                 <option value="All">All Courses</option>
                 {uniqueCourses.map(course => (
                   <option key={course} value={course}>{course}</option>
                 ))}
               </select>
               <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none group-hover:text-slate-600 transition-colors" />
             </div>

             {/* Semester Filter - Improved with predefined options */}
             <div className="relative group">
               <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                 <Calendar className={`w-4 h-4 transition-colors ${semesterFilter !== 'All' ? 'text-blue-600' : 'text-slate-400 group-hover:text-ku-600'}`} />
               </div>
               <select
                 value={semesterFilter}
                 onChange={(e) => setSemesterFilter(e.target.value)}
                 aria-label="Filter by semester"
                 className={`appearance-none pl-11 pr-10 py-3 bg-white border rounded-xl focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 outline-none cursor-pointer text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors min-w-[200px] ${
                   semesterFilter !== 'All' 
                     ? 'border-blue-300 bg-blue-50/50 text-blue-900' 
                     : 'border-slate-200 text-slate-700'
                 }`}
               >
                 <option value="All">📅 All Semesters</option>
                 {semesterOptions.map(semester => (
                   <option key={semester} value={semester}>Semester {semester}</option>
                     ))}
               </select>
               {semesterFilter !== 'All' && (
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     setSemesterFilter('All');
                   }}
                   className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700 p-1 rounded hover:bg-blue-100 transition-colors"
                   aria-label="Clear semester filter"
                   title="Clear semester filter"
                 >
                   <X size={14} />
                 </button>
               )}
               <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none group-hover:text-slate-600 transition-colors" />
             </div>

             {/* Year Filter */}
             <div className="relative group">
               <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                 <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Year:</span>
               </div>
               <select
                 value={yearFilter}
                 onChange={(e) => setYearFilter(e.target.value)}
                 aria-label="Filter by year"
                 className="appearance-none pl-14 pr-10 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 outline-none cursor-pointer text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
               >
                 <option value="All">All</option>
                 <option value="1">Year 1</option>
                 <option value="2">Year 2</option>
                 <option value="3">Year 3</option>
                 <option value="4">Year 4</option>
               </select>
               <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none group-hover:text-slate-600 transition-colors" />
             </div>

          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1" role="region" aria-label="Student data table" tabIndex={0}>
          <table className="w-full text-left text-sm text-slate-700" role="table">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 text-slate-600 font-bold border-b-2 border-slate-200/50 uppercase tracking-wider text-xs sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 w-16" scope="col">
                  <button 
                    onClick={toggleSelectAll} 
                    className="flex items-center text-slate-400 hover:text-ku-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1 rounded"
                    aria-label={selectedIds.size > 0 && paginatedStudentsForRender.every(s => selectedIds.has(s.id)) ? 'Deselect all students on this page' : 'Select all students on this page'}
                  >
                    {paginatedStudentsForRender.length > 0 && paginatedStudentsForRender.every(s => selectedIds.has(s.id)) ? (
                      <CheckSquare size={20} className="text-ku-600" aria-hidden="true" />
                    ) : (
                      <Square size={20} aria-hidden="true" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4" scope="col">Student Profile</th>
                <th className="px-6 py-4" scope="col">Academic</th>
                <th className="px-6 py-4" scope="col">Attendance</th>
                <th className="px-6 py-4" scope="col">Financial</th>
                <th className="px-6 py-4 text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudentsForRender.length > 0 ? paginatedStudentsForRender.map((student) => {
                // Safety check for each student
                if (!student || !student.id || !student.studentNumber) {
                  return null;
                }
                return (
                <tr 
                  key={student.id} 
                  className={`group transition-all duration-300 ${selectedIds.has(student.id) ? 'bg-gradient-to-r from-ku-50/80 to-emerald-50/50' : 'hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-blue-50/30'} focus-within:bg-ku-50/50`}
                  role="row"
                >
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleSelection(student.id)} 
                      className="flex items-center text-slate-400 hover:text-ku-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1 rounded"
                      aria-label={selectedIds.has(student.id) ? `Deselect ${student.studentNumber}` : `Select ${student.studentNumber}`}
                      aria-pressed={selectedIds.has(student.id)}
                    >
                      {selectedIds.has(student.id) ? (
                        <CheckSquare size={20} className="text-ku-600" aria-hidden="true" />
                      ) : (
                        <Square size={20} aria-hidden="true" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-bold text-lg shadow-md border-2 border-white group-hover:shadow-lg transition-all duration-300">
                            {(student.studentNumber || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                      </div>
                      <div>
                        <Link to={`/students/${student.id}`} className="font-black text-base text-slate-900 hover:text-ku-600 hover:underline decoration-2 underline-offset-2 transition-all group-hover:scale-[1.02] inline-block">{student.studentNumber}</Link>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                          <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Yr {student.yearOfStudy}</span>
                          {student.semesterOfStudy && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg border border-blue-200 font-bold shadow-sm">
                                <Calendar size={10} className="text-blue-600" />
                                Semester {student.semesterOfStudy}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-semibold truncate max-w-[200px]">{student.course}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${student.gpa < settings.thresholds.criticalGpa ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                          <span className={`font-black text-2xl tracking-tight ${student.gpa < settings.thresholds.criticalGpa ? 'text-red-600' : 'text-emerald-600'}`}>{student.gpa}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GPA</span>
                           <span className="text-[10px] text-slate-400 font-semibold">/ 5.0</span>
                        </div>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-32 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className={`px-2 py-0.5 rounded-lg ${student.attendance < settings.thresholds.warningAttendance ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                          {student.attendance}%
                        </span>
                        <span className="text-slate-400 text-[10px]">Target {settings.thresholds.warningAttendance}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gradient-to-r from-slate-100 to-slate-50 rounded-full overflow-hidden shadow-inner border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-700 shadow-sm ${student.attendance < (settings.thresholds.warningAttendance - 5) ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}`}
                          style={{ width: `${student.attendance}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2 min-w-[140px]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-slate-900">
                          {student.balance?.toLocaleString() || '0'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">UGX</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/students/${student.id}`}
                        className="inline-flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-ku-600 hover:to-ku-700 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1 shadow-sm hover:shadow-md group"
                        aria-label={`View details for ${student.studentNumber}`}
                      >
                        <Eye size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" aria-hidden="true" />
                      </Link>
                      {hasRole(UserRole.REGISTRY) && (
                        <button
                          onClick={() => {
                            setStudentToDelete(student);
                            setShowDeleteConfirm(true);
                          }}
                          className="inline-flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 shadow-sm hover:shadow-md group"
                          aria-label={`Delete ${student.studentNumber}`}
                          title="Delete student"
                        >
                          <Trash2 size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              }).filter(Boolean) : (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center animate-fade-in" role="status" aria-live="polite">
                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4" aria-hidden="true">
                         <Search className="w-8 h-8 text-slate-300" />
                       </div>
                       <p className="font-bold text-lg text-slate-700">No students found</p>
                       <p className="text-sm text-slate-400 max-w-xs mx-auto mt-1">
                         We couldn't find any students matching your current filters. Try adjusting your search criteria.
                       </p>
                       <button 
                         onClick={() => {
                           setSearchTerm('');
                           setYearFilter('All');
                           setProgramFilter('All');
                           setSemesterFilter('All');
                           clearSelection();
                         }} 
                         className="mt-4 px-4 py-2 text-ku-600 font-semibold hover:text-ku-700 hover:bg-ku-50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
                         aria-label="Clear all search filters"
                       >
                         Clear all filters
                       </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Performance Optimization: Pagination Controls */}
        {shouldPaginateForRender && (
          <div className="mt-6 flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200 rounded-b-xl">
            <div className="text-sm text-slate-600 font-semibold">
              Showing <span className="font-black text-slate-900">{startIndexForRender + 1}</span> to{' '}
              <span className="font-black text-slate-900">{Math.min(endIndexForRender, safeFilteredStudentsForRender.length)}</span> of{' '}
              <span className="font-black text-slate-900">{safeFilteredStudentsForRender.length}</span> students
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1"
                aria-label="Previous page"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPagesForRender) }, (_, i) => {
                  let pageNum;
                  if (totalPagesForRender <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPagesForRender - 2) {
                    pageNum = totalPagesForRender - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1 ${
                        currentPage === pageNum
                          ? 'bg-gradient-to-r from-ku-600 to-ku-700 text-white shadow-md'
                          : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
                      }`}
                      aria-label={`Go to page ${pageNum}`}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPagesForRender, prev + 1))}
                disabled={currentPage === totalPagesForRender}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-1"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 ml-40 bg-slate-900/95 backdrop-blur-md text-white px-8 py-4 rounded-full shadow-2xl z-30 flex items-center gap-8 animate-slide-up border border-slate-700/50 ring-1 ring-white/10">
           <div className="flex items-center gap-4 pr-8 border-r border-slate-700/50">
             <div className="bg-gradient-to-tr from-ku-500 to-ku-400 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg shadow-ku-500/30">
               {selectedIds.size}
             </div>
             <div>
               <p className="font-bold text-sm leading-tight">Selected</p>
               <p className="text-xs text-slate-400">Students</p>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
             <button 
               onClick={() => setShowBulkEmail(true)}
               className="flex items-center gap-2.5 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
             >
               <Mail size={18} /> Send Notification
             </button>
             <button 
               onClick={() => setShowBulkIntervention(true)}
               className="flex items-center gap-2.5 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
             >
               <FileText size={18} /> Log Intervention
             </button>
             {hasRole(UserRole.REGISTRY) && (
               <button 
                 onClick={() => setShowBulkDeleteConfirm(true)}
                 className="flex items-center gap-2.5 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95 border border-red-400/30"
               >
                 <Trash2 size={18} /> Delete Selected
               </button>
             )}
             <button 
               onClick={clearSelection}
               className="w-10 h-10 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 rounded-full text-slate-400 transition-colors ml-2"
               aria-label="Clear selection"
             >
               <X size={20} />
             </button>
           </div>
        </div>
      )}

      {/* Modals remain unchanged for brevity, as logic is handled above */}
      {showBulkEmail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-email-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 id="bulk-email-title" className="font-bold text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-ku-100 rounded-lg text-ku-600"><Mail size={22} aria-hidden="true" /></div>
                Send Mass Notification
              </h3>
              <button 
                onClick={() => setShowBulkEmail(false)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                aria-label="Close dialog"
              >
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <div className="p-8 space-y-6">
               {/* Modal Content - Same as before */}
               <div className="p-4 bg-indigo-50 text-indigo-800 rounded-2xl text-sm flex items-start gap-3 border border-indigo-100">
                <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-indigo-600" />
                <p className="leading-relaxed">You are targeting <strong>{selectedIds.size} students</strong>. This action will queue messages via enabled channels ({Object.keys(notificationSettings.channels).filter(k => notificationSettings.channels[k as keyof typeof notificationSettings.channels]).join(', ')}).</p>
              </div>
              
              <div className="space-y-4">
                 <label className="text-sm font-bold text-slate-900 block uppercase tracking-wide">Message Content</label>
                 <textarea 
                   value={notificationMessage}
                   onChange={(e) => setNotificationMessage(e.target.value)}
                   className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-ku-100 focus:border-ku-500 outline-none resize-none h-32"
                   placeholder="Type your announcement here..."
                 />
              </div>

              <div className="pt-2">
                 <button 
                   onClick={handleBulkEmail}
                   disabled={processing || !notificationMessage.trim()}
                   aria-busy={processing}
                   className="w-full py-4 bg-ku-600 hover:bg-ku-700 text-white rounded-2xl font-bold text-lg transition-all shadow-xl disabled:opacity-70 flex justify-center items-center gap-3 focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
                 >
                   {processing ? (
                     <>
                       <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                       Processing...
                     </>
                   ) : (
                     'Send Notification'
                   )}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkIntervention && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-intervention-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-slate-100">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 id="bulk-intervention-title" className="font-bold text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><FileText size={22} aria-hidden="true" /></div>
                Log Mass Intervention
              </h3>
              <button 
                onClick={() => setShowBulkIntervention(false)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                aria-label="Close dialog"
              >
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-slate-600">Record intervention for <strong>{selectedIds.size} students</strong>.</p>
              <label htmlFor="bulk-intervention-note" className="sr-only">
                Intervention notes
              </label>
              <textarea
                id="bulk-intervention-note"
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Details..."
                aria-label="Intervention notes"
                className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none h-40 placeholder:text-slate-400"
              />
              <div className="pt-2">
                 <button 
                   onClick={handleBulkIntervention}
                   disabled={!bulkNote || processing}
                   aria-busy={processing}
                   className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg transition-all shadow-xl disabled:opacity-70 flex justify-center items-center gap-3 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                 >
                   {processing ? (
                     <>
                       <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                       Saving...
                     </>
                   ) : (
                     'Confirm'
                   )}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && studentToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <h3 id="delete-confirm-title" className="font-bold text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg text-red-600"><Trash2 size={22} aria-hidden="true" /></div>
                Delete Student
              </h3>
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setStudentToDelete(null);
                }} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                aria-label="Close dialog"
              >
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-sm flex items-start gap-3 border border-red-100">
                <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-600" />
                <p className="leading-relaxed">
                  Are you sure you want to delete <strong>{studentToDelete.studentNumber}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setStudentToDelete(null);
                  }}
                  disabled={processing}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteStudent(studentToDelete)}
                  disabled={processing}
                  aria-busy={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-70 flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  {processing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} aria-hidden="true" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-confirm-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
              <h3 id="bulk-delete-confirm-title" className="font-bold text-xl text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg text-red-600"><Trash2 size={22} aria-hidden="true" /></div>
                Delete Selected Students
              </h3>
              <button 
                onClick={() => setShowBulkDeleteConfirm(false)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                aria-label="Close dialog"
              >
                <X size={20} aria-hidden="true"/>
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-sm flex items-start gap-3 border border-red-100">
                <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-600" />
                <p className="leading-relaxed">
                  Are you sure you want to delete <strong>{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <button 
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={processing}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkDelete}
                  disabled={processing}
                  aria-busy={processing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-70 flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  {processing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} aria-hidden="true" />
                      Delete {selectedIds.size} Student{selectedIds.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentList;