import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Student, SystemSettings } from '../../types';
import { useToast } from '../../context/ToastContext';
import { getDataIntegrityAlerts } from '../../services/apiService';
import {
  Users,
  FileCheck,
  Database,
  Shield,
  Download,
  RefreshCw,
  ExternalLink,
  DollarSign,
  TrendingDown,
  GraduationCap,
  FileText,
} from 'lucide-react';

interface RegistryDashboardProps {
  students: Student[];
  settings: SystemSettings;
}

const RegistryDashboard: React.FC<RegistryDashboardProps> = ({ students, settings }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [activeTab] = useState<'overview'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [dataIntegrityData, setDataIntegrityData] = useState<{
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
  } | null>(null);

  // Fetch data integrity alerts from backend (100% accurate, queries database directly)
  const fetchDataIntegrityAlerts = useCallback(async () => {
    if (!settings?.thresholds) {
      setIsLoadingAlerts(false);
      return;
    }

    try {
      setIsLoadingAlerts(true);
      const data = await getDataIntegrityAlerts({
        criticalGpa: settings.thresholds.criticalGpa,
        warningAttendance: settings.thresholds.warningAttendance,
        financialLimit: settings.thresholds.financialLimit,
      });
      setDataIntegrityData(data);
    } catch (error: any) {
      console.error('Error fetching data integrity alerts:', error);
      addToast('Failed to load data integrity alerts. Please try again.', 'error');
      // Fallback to empty data structure
      setDataIntegrityData({
        thresholds: settings.thresholds,
        summary: {
          totalStudents: 0,
          withFinancialRisk: 0,
          withAttendanceRisk: 0,
          withAcademicRisk: 0,
          incompleteRecords: 0,
          withNoIssues: 0,
        },
        students: {
          financialRisk: [],
          attendanceRisk: [],
          academicRisk: [],
          incompleteRecords: [],
          noIssues: [],
        },
      });
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [settings, addToast]);

  useEffect(() => {
    fetchDataIntegrityAlerts();
  }, [fetchDataIntegrityAlerts]);

  // Manual refresh handler (shows success toast)
  const handleRefreshAlerts = useCallback(async () => {
    if (!settings?.thresholds) return;
    
    try {
      setIsLoadingAlerts(true);
      const data = await getDataIntegrityAlerts({
        criticalGpa: settings.thresholds.criticalGpa,
        warningAttendance: settings.thresholds.warningAttendance,
        financialLimit: settings.thresholds.financialLimit,
      });
      setDataIntegrityData(data);
      addToast('Data integrity alerts refreshed', 'success');
    } catch (error: any) {
      console.error('Error refreshing data integrity alerts:', error);
      addToast('Failed to refresh data integrity alerts', 'error');
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [settings, addToast]);

  // Calculate registry metrics from backend data (100% accurate)
  const metrics = useMemo(() => {
    if (!dataIntegrityData) {
      return {
        total: 0,
        withFinancialRisk: 0,
        withAttendanceRisk: 0,
        withAcademicRisk: 0,
        withNoIssues: 0,
        incompleteRecords: 0,
        incompleteRecordsList: [],
        financialRiskList: [],
        attendanceRiskList: [],
        academicRiskList: [],
        noIssuesList: [],
      };
    }

    return {
      total: dataIntegrityData.summary.totalStudents,
      withFinancialRisk: dataIntegrityData.summary.withFinancialRisk,
      withAttendanceRisk: dataIntegrityData.summary.withAttendanceRisk,
      withAcademicRisk: dataIntegrityData.summary.withAcademicRisk,
      withNoIssues: dataIntegrityData.summary.withNoIssues || 0,
      incompleteRecords: dataIntegrityData.summary.incompleteRecords,
      incompleteRecordsList: dataIntegrityData.students.incompleteRecords,
      financialRiskList: dataIntegrityData.students.financialRisk,
      attendanceRiskList: dataIntegrityData.students.attendanceRisk,
      academicRiskList: dataIntegrityData.students.academicRisk,
      noIssuesList: dataIntegrityData.students.noIssues || [],
    };
  }, [dataIntegrityData]);

  // Get all students with issues from Data Integrity Alerts (all risk categories)
  const studentsWithIssues = useMemo(() => {
    if (!dataIntegrityData) return [];
    
    // Collect all students from all risk categories
    const allIssueStudents = [
      ...dataIntegrityData.students.financialRisk,
      ...dataIntegrityData.students.attendanceRisk,
      ...dataIntegrityData.students.academicRisk,
    ];
    
    // Remove duplicates by ID
    const uniqueStudents = new Map<string, Student & { riskLabels?: string[] }>();
    allIssueStudents.forEach(s => {
      if (s.id) {
        const existing = uniqueStudents.get(s.id);
        if (existing) {
          // Merge risk labels if student appears in multiple categories
          const allLabels = new Set([...(existing.riskLabels || []), ...(s.riskLabels || [])]);
          uniqueStudents.set(s.id, { ...existing, riskLabels: Array.from(allLabels) });
        } else {
          uniqueStudents.set(s.id, s);
        }
      }
    });
    
    return Array.from(uniqueStudents.values());
  }, [dataIntegrityData]);

  // Get all students with no issues - 100% accurate from database
  // Now using metrics.noIssuesList for consistency with other sections

  // CSV escaping helper
  const escapeCsvField = (field: string | number | undefined | null): string => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Generic export function for specific student lists
  const exportStudentList = (studentList: Student[], filename: string) => {
    try {
      if (studentList.length === 0) {
        addToast('No students to export', 'warning');
        return;
      }

      // Only allowed fields in exact order
      const headers = [
        'Student Number',
        'Student Registration Number',
        'Course',
        'Year of Study',
        'Semester of Study',
        'GPA',
        'Attendance',
        'Balance',
      ];

      // Generate CSV rows - only allowed fields
      const rows = studentList.map((student) => {
        return [
          escapeCsvField(student.studentNumber || ''),
          escapeCsvField(student.studentRegistrationNumber || ''),
          escapeCsvField(student.course || ''),
          escapeCsvField(student.yearOfStudy || ''),
          escapeCsvField(student.semesterOfStudy || ''),
          escapeCsvField(student.gpa || 0),
          escapeCsvField(student.attendance || 0),
          escapeCsvField(student.balance || 0),
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Add BOM for Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      addToast(`Exported ${studentList.length} students successfully`, 'success');
    } catch (error: any) {
      console.error('Export error:', error);
      addToast('Failed to export students', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      
      // Export only students with issues using the existing export function
      if (studentsWithIssues.length === 0) {
        addToast('No students with issues to export', 'warning');
        return;
      }

      exportStudentList(studentsWithIssues, 'students_with_issues');
    } catch (error: any) {
      console.error('Export error:', error);
      addToast(
        error.response?.data?.error || 'Failed to export student records',
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight mb-2">
            Registry Dashboard
          </h2>
          <p className="text-slate-600 font-medium text-base">
            Student records management and data integrity monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="p-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh data"
          >
            <RefreshCw size={20} strokeWidth={2} className="text-slate-600" />
          </button>
          <button 
            onClick={handleExportData}
            disabled={isExporting}
            className="px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl font-bold text-sm hover:from-slate-800 hover:to-slate-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isExporting ? (
              <>
                <RefreshCw size={18} strokeWidth={2} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={18} strokeWidth={2} />
                Export Data
              </>
            )}
          </button>
        </div>
      </div>


      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
            {/* Total Students */}
            <div className="group relative bg-gradient-to-br from-white via-indigo-50/30 to-white p-6 rounded-2xl shadow-lg border-2 border-indigo-100/50 hover:border-indigo-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Total Students
                  </p>
                  <p className="text-3xl font-black text-slate-900">{metrics.total}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                  <Users size={24} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Financial Risk */}
            <div className="group relative bg-gradient-to-br from-white via-amber-50/30 to-white p-6 rounded-2xl shadow-lg border-2 border-amber-100/50 hover:border-amber-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Financial Risk
                  </p>
                  <p className="text-3xl font-black text-amber-700">
                    {metrics.withFinancialRisk}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg">
                  <DollarSign size={24} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Attendance Risk */}
            <div className="group relative bg-gradient-to-br from-white via-orange-50/30 to-white p-6 rounded-2xl shadow-lg border-2 border-orange-100/50 hover:border-orange-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Attendance Risk
                  </p>
                  <p className="text-3xl font-black text-orange-700">
                    {metrics.withAttendanceRisk}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                  <TrendingDown size={24} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Academic Risk */}
            <div className="group relative bg-gradient-to-br from-white via-purple-50/30 to-white p-6 rounded-2xl shadow-lg border-2 border-purple-100/50 hover:border-purple-200 hover:shadow-xl transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Academic Risk
                  </p>
                  <p className="text-3xl font-black text-purple-700">
                    {metrics.withAcademicRisk}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                  <GraduationCap size={24} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* No Issues */}
            <button
              onClick={() => {
                navigate('/students?issue=none');
              }}
              className="group relative bg-gradient-to-br from-white via-emerald-50/30 to-white p-6 rounded-2xl shadow-lg border-2 border-emerald-100/50 hover:border-emerald-200 hover:shadow-xl transition-all duration-300 overflow-hidden text-left cursor-pointer w-full"
              title="View students with no issues"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/20 rounded-full -mr-12 -mt-12 blur-2xl"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    No Issues
                  </p>
                  <p className="text-3xl font-black text-emerald-700">
                    {metrics.withNoIssues}
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                  <FileCheck size={24} className="text-white" strokeWidth={2} />
                </div>
              </div>
            </button>
          </div>

          {/* Data Integrity Alerts - 100% Accurate Student Directory */}
          <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-8 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                  <Shield size={24} className="text-white" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Data Integrity Alerts</h3>
                  <p className="text-sm text-slate-500 font-semibold mt-1">Issues requiring immediate attention • 100% Accurate Student Directory</p>
                  {dataIntegrityData && (
                    <p className="text-xs text-slate-400 mt-1">
                      Data sourced directly from database • {dataIntegrityData.summary.totalStudents} total students analyzed • Real-time accuracy
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleRefreshAlerts}
                disabled={isLoadingAlerts}
                className="p-2 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data integrity alerts"
              >
                <RefreshCw size={18} strokeWidth={2} className={`text-slate-600 ${isLoadingAlerts ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isLoadingAlerts ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={32} className="text-slate-400 animate-spin" strokeWidth={2} />
                  <p className="text-sm text-slate-500 font-medium">Loading data integrity alerts from database...</p>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              {/* Students with Financial Risk */}
              {metrics.withFinancialRisk > 0 && (
                <div className="group relative p-5 bg-gradient-to-br from-amber-50/60 via-amber-50/40 to-white border-2 border-amber-200/50 rounded-2xl hover:border-amber-300 hover:shadow-md hover:shadow-amber-100/30 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/20 rounded-full -mr-12 -mt-12 blur-xl"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-md">
                      <DollarSign size={20} className="text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-base text-amber-900">
                            {metrics.withFinancialRisk} Student{metrics.withFinancialRisk !== 1 ? 's' : ''} with Financial Risk
                          </p>
                          <p className="text-xs text-amber-600 mt-1">Balance &gt; {settings?.thresholds?.financialLimit?.toLocaleString() || '0'} UGX</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              exportStudentList(metrics.financialRiskList, 'financial_risk');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-amber-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="Download CSV"
                          >
                            <Download size={16} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => {
                              navigate('/students?issue=all-financial');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-amber-200 hover:bg-amber-50 hover:border-amber-300 text-amber-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="View students with financial risk"
                          >
                            <ExternalLink size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-amber-700/90 leading-relaxed mb-3">
                        Students classified as Financial Risk based on balance exceeding threshold. Review financial clearance status.
                      </p>
                      {metrics.financialRiskList.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {metrics.financialRiskList.slice(0, 3).map((student) => (
                            <button
                              key={student.id}
                              onClick={() => {
                                navigate(`/students/${student.id}`);
                              }}
                              className="text-xs px-3 py-1.5 bg-white/80 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-50 hover:border-amber-300 cursor-pointer font-medium transition-all duration-200 shadow-sm flex items-center gap-2"
                            >
                              {student.studentNumber}
                              {student.riskLabels && student.riskLabels.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">
                                  {student.riskLabels.length} risks
                                </span>
                              )}
                            </button>
                          ))}
                          {metrics.financialRiskList.length > 3 && (
                            <button
                              onClick={() => {
                                navigate('/students?issue=all-financial');
                              }}
                              className="text-xs px-3 py-1.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-200 cursor-pointer font-bold transition-all duration-200 shadow-sm"
                            >
                              +{metrics.financialRiskList.length - 3} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Students with Attendance Risk */}
              {metrics.withAttendanceRisk > 0 && (
                <div className="group relative p-5 bg-gradient-to-br from-orange-50 via-orange-50/80 to-white border-2 border-orange-200/60 rounded-2xl hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100/50 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-md">
                      <TrendingDown size={20} className="text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-base text-orange-900">
                            {metrics.withAttendanceRisk} Student{metrics.withAttendanceRisk !== 1 ? 's' : ''} with Attendance Risk
                          </p>
                          <p className="text-xs text-orange-600 mt-1">Attendance &lt; {settings?.thresholds?.warningAttendance || 0}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              exportStudentList(metrics.attendanceRiskList, 'attendance_risk');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 text-orange-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="Download CSV"
                          >
                            <Download size={16} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => {
                              navigate('/students?issue=all-attendance');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 text-orange-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="View students with attendance risk"
                          >
                            <ExternalLink size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-orange-700/90 leading-relaxed mb-3">
                        Students classified as Attendance Risk based on attendance below threshold. Review progression eligibility.
                      </p>
                      {metrics.attendanceRiskList.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {metrics.attendanceRiskList.slice(0, 3).map((student) => (
                            <button
                              key={student.id}
                              onClick={() => {
                                navigate(`/students/${student.id}`);
                              }}
                              className="text-xs px-3 py-1.5 bg-white/80 border border-orange-200 text-orange-800 rounded-lg hover:bg-orange-50 hover:border-orange-300 cursor-pointer font-medium transition-all duration-200 shadow-sm flex items-center gap-2"
                            >
                              {student.studentNumber}
                              {student.riskLabels && student.riskLabels.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">
                                  {student.riskLabels.length} risks
                                </span>
                              )}
                            </button>
                          ))}
                          {metrics.attendanceRiskList.length > 3 && (
                            <button
                              onClick={() => {
                                navigate('/students?issue=all-attendance');
                              }}
                              className="text-xs px-3 py-1.5 bg-orange-100 border border-orange-300 text-orange-900 rounded-lg hover:bg-orange-200 cursor-pointer font-bold transition-all duration-200 shadow-sm"
                            >
                              +{metrics.attendanceRiskList.length - 3} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Students with Academic Risk */}
              {metrics.withAcademicRisk > 0 && (
                <div className="group relative p-5 bg-gradient-to-br from-purple-50 via-purple-50/80 to-white border-2 border-purple-200/60 rounded-2xl hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/50 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                      <GraduationCap size={20} className="text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-base text-purple-900">
                            {metrics.withAcademicRisk} Student{metrics.withAcademicRisk !== 1 ? 's' : ''} with Academic Risk
                          </p>
                          <p className="text-xs text-purple-600 mt-1">GPA &lt; {settings?.thresholds?.criticalGpa || 0}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              exportStudentList(metrics.academicRiskList, 'academic_risk');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="Download CSV"
                          >
                            <Download size={16} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => {
                              navigate('/students?issue=gpa');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="View students with academic risk"
                          >
                            <ExternalLink size={16} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-purple-700/90 leading-relaxed mb-3">
                        Students classified as Academic Risk based on GPA below threshold. Review academic performance and progression eligibility.
                      </p>
                      {metrics.academicRiskList.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {metrics.academicRiskList.slice(0, 3).map((student) => (
                            <button
                              key={student.id}
                              onClick={() => {
                                navigate(`/students/${student.id}`);
                              }}
                              className="text-xs px-3 py-1.5 bg-white/80 border border-purple-200 text-purple-800 rounded-lg hover:bg-purple-50 hover:border-purple-300 cursor-pointer font-medium transition-all duration-200 shadow-sm flex items-center gap-2"
                            >
                              {student.studentNumber}
                              {student.riskLabels && student.riskLabels.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-bold">
                                  {student.riskLabels.length} risks
                                </span>
                              )}
                            </button>
                          ))}
                          {metrics.academicRiskList.length > 3 && (
                            <button
                              onClick={() => {
                                navigate('/students?issue=gpa');
                              }}
                              className="text-xs px-3 py-1.5 bg-purple-100 border border-purple-300 text-purple-900 rounded-lg hover:bg-purple-200 cursor-pointer font-bold transition-all duration-200 shadow-sm"
                            >
                              +{metrics.academicRiskList.length - 3} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Students with No Issues */}
              {metrics.withNoIssues > 0 && (
                <div className="group relative p-5 bg-gradient-to-br from-emerald-50/60 via-emerald-50/40 to-white border-2 border-emerald-200/50 rounded-2xl hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/30 transition-all duration-300 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/20 rounded-full -mr-12 -mt-12 blur-xl"></div>
                  <div className="relative flex items-start gap-4">
                    <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md">
                      <FileCheck size={20} className="text-white" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-base text-emerald-900">
                            {metrics.withNoIssues} Student{metrics.withNoIssues !== 1 ? 's' : ''} with No Issues
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">All records in good standing</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              exportStudentList(metrics.noIssuesList, 'students_no_issues');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="Download CSV"
                          >
                            <Download size={16} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => {
                              navigate('/students?issue=none');
                            }}
                            className="p-2 rounded-lg bg-white/80 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 transition-all duration-200 shadow-sm cursor-pointer"
                            title="View students with no issues"
                          >
                            <ExternalLink size={18} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-emerald-700/90 leading-relaxed mb-3">
                        Students with no financial, attendance, or academic risk issues. All records are in good standing.
                      </p>
                      {metrics.noIssuesList.length > 1 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {metrics.noIssuesList.slice(0, 3).map((student) => (
                            <button
                              key={student.id}
                              onClick={() => {
                                navigate(`/students/${student.id}`);
                              }}
                              className="text-xs px-3 py-1.5 bg-white/80 border border-emerald-200 text-emerald-800 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer font-medium transition-all duration-200 shadow-sm flex items-center gap-2"
                            >
                              {student.studentNumber}
                            </button>
                          ))}
                          {metrics.noIssuesList.length > 3 && (
                            <button
                              onClick={() => {
                                navigate('/students?issue=none');
                              }}
                              className="text-xs px-3 py-1.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg hover:bg-emerald-200 cursor-pointer font-bold transition-all duration-200 shadow-sm"
                            >
                              +{metrics.noIssuesList.length - 3} more
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* All Clear - Check all risk categories */}
              {metrics.withFinancialRisk === 0 &&
                metrics.withAttendanceRisk === 0 &&
                metrics.withAcademicRisk === 0 && (
                  <div className="relative p-6 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-white border-2 border-emerald-200/60 rounded-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="relative flex items-start gap-4">
                      <div className="flex-shrink-0 p-2.5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md">
                        <FileCheck size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-base text-emerald-900">All Clear</p>
                        <p className="text-sm text-emerald-700/90 mt-1 leading-relaxed">
                          No critical data integrity issues detected. All student records are in good standing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button className="group relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-7 rounded-2xl text-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative flex items-center gap-4 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                  <Database size={28} className="text-white" strokeWidth={2} />
                </div>
                <h3 className="font-black text-xl">Bulk Operations</h3>
              </div>
              <p className="text-sm text-emerald-100 leading-relaxed">
                Perform bulk updates, exports, and data corrections
              </p>
            </button>

            <button className="group relative bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-600 p-7 rounded-2xl text-white hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="relative flex items-center gap-4 mb-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                  <FileText size={28} className="text-white" strokeWidth={2} />
                </div>
                <h3 className="font-black text-xl">Data Quality Report</h3>
              </div>
              <p className="text-sm text-blue-100 leading-relaxed">
                Generate comprehensive data quality and compliance reports
              </p>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default RegistryDashboard;

