import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getCourses,
  getEnrolledStudents,
  submitAttendance,
  getAttendanceSubmissions,
  getAttendanceReports,
  getCourseAttendanceSummary,
  getStudentAttendanceSummary,
  getAttendanceTrends,
} from '../../services/apiService';
import { CheckCircle, XCircle, Calendar, BookOpen, User, Clock, Send, RefreshCw, BarChart3, TrendingUp, FileText } from 'lucide-react';

interface Course {
  _id: string;
  code: string;
  name: string;
  credits: number;
}

interface Student {
  id: string;
  studentId: string;
  studentName: string;
}

interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT';
}

const ReceptionistDashboard: React.FC = () => {
  const { addToast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseUnit, setCourseUnit] = useState<string>('');
  const [lectureDate, setLectureDate] = useState<string>('');
  const [lecturerName, setLecturerName] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'PRESENT' | 'ABSENT'>>({});
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  // Reports and Analytics state
  const [activeTab, setActiveTab] = useState<'record' | 'reports'>('record');
  const [reportFilters, setReportFilters] = useState({
    courseId: '',
    studentId: '',
    lecturerName: '',
    startDate: '',
    endDate: '',
    period: 'daily' as 'daily' | 'weekly' | 'monthly',
  });
  const [reports, setReports] = useState<any>(null);
  const [courseSummary, setCourseSummary] = useState<any[]>([]);
  const [studentSummary, setStudentSummary] = useState<any[]>([]);
  const [trends, setTrends] = useState<any>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Load courses on mount
  useEffect(() => {
    loadCourses();
    loadSubmissions();
  }, []);

  // Load students when course is selected
  useEffect(() => {
    if (selectedCourseId) {
      loadStudents(selectedCourseId);
    } else {
      setStudents([]);
      setAttendanceRecords({});
    }
  }, [selectedCourseId]);

  const loadCourses = async () => {
    try {
      setIsLoadingCourses(true);
      const data = await getCourses();
      setCourses(data);
    } catch (error: any) {
      console.error('Error loading courses:', error);
      addToast('Failed to load courses', 'error');
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const loadStudents = async (courseId: string) => {
    try {
      setIsLoadingStudents(true);
      const data = await getEnrolledStudents(courseId);
      setStudents(data);
      // Initialize attendance records with PRESENT as default
      const initialRecords: Record<string, 'PRESENT' | 'ABSENT'> = {};
      data.forEach((student: Student) => {
        initialRecords[student.id] = 'PRESENT';
      });
      setAttendanceRecords(initialRecords);
    } catch (error: any) {
      console.error('Error loading students:', error);
      addToast('Failed to load enrolled students', 'error');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadSubmissions = async () => {
    try {
      setIsLoadingSubmissions(true);
      const data = await getAttendanceSubmissions();
      setSubmissions(data);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      addToast('Failed to load attendance submissions', 'error');
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleAttendanceChange = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedCourseId) {
      addToast('Please select a course', 'error');
      return;
    }
    if (!lectureDate) {
      addToast('Please select a lecture date', 'error');
      return;
    }
    if (!lecturerName.trim()) {
      addToast('Please enter lecturer name', 'error');
      return;
    }
    if (students.length === 0) {
      addToast('No students enrolled in this course', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare attendance records
      const records: AttendanceRecord[] = students.map(student => ({
        studentId: student.id,
        status: attendanceRecords[student.id] || 'PRESENT',
      }));

      await submitAttendance({
        courseId: selectedCourseId,
        courseUnit: courseUnit.trim() || undefined,
        lectureDate,
        lecturerName: lecturerName.trim(),
        attendanceRecords: records,
      });

      addToast('Attendance submitted successfully', 'success');
      
      // Reset form
      setSelectedCourseId('');
      setCourseUnit('');
      setLectureDate('');
      setLecturerName('');
      setStudents([]);
      setAttendanceRecords({});
      
      // Reload submissions
      loadSubmissions();
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      addToast(error.response?.data?.error || 'Failed to submit attendance', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadReports = async () => {
    try {
      setIsLoadingReports(true);
      const [reportsData, courseData, studentData, trendsData] = await Promise.all([
        getAttendanceReports({
          courseId: reportFilters.courseId || undefined,
          startDate: reportFilters.startDate || undefined,
          endDate: reportFilters.endDate || undefined,
        }),
        getCourseAttendanceSummary({
          startDate: reportFilters.startDate || undefined,
          endDate: reportFilters.endDate || undefined,
        }),
        getStudentAttendanceSummary({
          courseId: reportFilters.courseId || undefined,
          startDate: reportFilters.startDate || undefined,
          endDate: reportFilters.endDate || undefined,
        }),
        getAttendanceTrends({
          courseId: reportFilters.courseId || undefined,
          period: reportFilters.period,
          startDate: reportFilters.startDate || undefined,
          endDate: reportFilters.endDate || undefined,
        }),
      ]);
      setReports(reportsData);
      setCourseSummary(courseData);
      setStudentSummary(studentData);
      setTrends(trendsData);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      addToast('Failed to load attendance reports', 'error');
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, reportFilters.courseId, reportFilters.studentId, reportFilters.lecturerName, reportFilters.startDate, reportFilters.endDate, reportFilters.period]);

  const selectedCourse = courses.find(c => c._id === selectedCourseId);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-4xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tight mb-2">
          Attendance Digitization
        </h2>
        <p className="text-slate-600 font-medium text-base">
          Record and submit student attendance for lectures
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b-2 border-slate-200">
        <button
          onClick={() => setActiveTab('record')}
          className={`px-6 py-3 font-bold text-sm uppercase tracking-wide transition-all ${
            activeTab === 'record'
              ? 'text-slate-900 border-b-2 border-slate-900 -mb-[2px]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={18} className="inline mr-2" />
          Record Attendance
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 font-bold text-sm uppercase tracking-wide transition-all ${
            activeTab === 'reports'
              ? 'text-slate-900 border-b-2 border-slate-900 -mb-[2px]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 size={18} className="inline mr-2" />
          Reports & Analytics
        </button>
      </div>

      {activeTab === 'record' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Attendance Form */}
        <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-8">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Record Attendance</h3>

          <div className="space-y-6">
            {/* Course Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                <BookOpen size={16} className="inline mr-2" />
                Course
              </label>
              {isLoadingCourses ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <RefreshCw size={16} className="animate-spin" />
                  Loading courses...
                </div>
              ) : (
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Course Unit (Optional) */}
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                Course Unit (Optional)
              </label>
              <input
                type="text"
                value={courseUnit}
                onChange={(e) => setCourseUnit(e.target.value)}
                placeholder="e.g., Unit 1, Chapter 3"
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
              />
            </div>

            {/* Lecture Date */}
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                <Calendar size={16} className="inline mr-2" />
                Lecture Date
              </label>
              <input
                type="date"
                value={lectureDate}
                onChange={(e) => setLectureDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
              />
            </div>

            {/* Lecturer Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                <User size={16} className="inline mr-2" />
                Lecturer Name
              </label>
              <input
                type="text"
                value={lecturerName}
                onChange={(e) => setLecturerName(e.target.value)}
                placeholder="Enter lecturer name"
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
              />
            </div>

            {/* Students List */}
            {selectedCourseId && (
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                  Enrolled Students ({students.length})
                </label>
                {isLoadingStudents ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw size={24} className="animate-spin text-slate-400" />
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No students enrolled in this course
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2 border-2 border-slate-200 rounded-xl p-4">
                    {students.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{student.studentId}</p>
                          <p className="text-sm text-slate-500">{student.studentName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAttendanceChange(student.id, 'PRESENT')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                              attendanceRecords[student.id] === 'PRESENT'
                                ? 'bg-emerald-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <CheckCircle size={16} />
                            Present
                          </button>
                          <button
                            onClick={() => handleAttendanceChange(student.id, 'ABSENT')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                              attendanceRecords[student.id] === 'ABSENT'
                                ? 'bg-red-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            <XCircle size={16} />
                            Absent
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedCourseId || !lectureDate || !lecturerName.trim() || students.length === 0}
              className="w-full py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit Attendance
                </>
              )}
            </button>
          </div>
        </div>

        {/* Submissions History */}
        <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Recent Submissions</h3>
            <button
              onClick={loadSubmissions}
              disabled={isLoadingSubmissions}
              className="p-2 rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={18} className={`text-slate-600 ${isLoadingSubmissions ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoadingSubmissions ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={32} className="animate-spin text-slate-400" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="font-semibold">No submissions yet</p>
              <p className="text-sm mt-2">Your attendance submissions will appear here</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {submission.course?.code} - {submission.course?.name}
                      </p>
                      {submission.courseUnit && (
                        <p className="text-sm text-slate-500">Unit: {submission.courseUnit}</p>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        submission.status === 'PRESENT'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>
                      <span className="font-semibold">Student:</span> {submission.student?.studentId}
                    </p>
                    <p>
                      <span className="font-semibold">Lecturer:</span> {submission.lecturerName}
                    </p>
                    <p>
                      <span className="font-semibold">Date:</span>{' '}
                      {new Date(submission.lectureDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      Submitted: {new Date(submission.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-8">
          {/* Filters */}
          <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-6">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-4">Report Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Course
                </label>
                <select
                  value={reportFilters.courseId}
                  onChange={(e) => setReportFilters({ ...reportFilters, courseId: e.target.value })}
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                >
                  <option value="">All Courses</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Student ID
                </label>
                <input
                  type="text"
                  value={reportFilters.studentId}
                  onChange={(e) => setReportFilters({ ...reportFilters, studentId: e.target.value })}
                  placeholder="Filter by student ID"
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Lecturer Name
                </label>
                <input
                  type="text"
                  value={reportFilters.lecturerName}
                  onChange={(e) => setReportFilters({ ...reportFilters, lecturerName: e.target.value })}
                  placeholder="Filter by lecturer"
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={reportFilters.startDate}
                  onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={reportFilters.endDate}
                  onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Period
                </label>
                <select
                  value={reportFilters.period}
                  onChange={(e) => setReportFilters({ ...reportFilters, period: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all font-medium"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <button
              onClick={loadReports}
              disabled={isLoadingReports}
              className="mt-4 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoadingReports ? 'animate-spin' : ''} />
              Refresh Reports
            </button>
          </div>

          {isLoadingReports ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={32} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Summary Statistics */}
              {reports && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-6 border-2 border-emerald-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-emerald-700 uppercase">Total Records</span>
                      <FileText size={20} className="text-emerald-600" />
                    </div>
                    <p className="text-3xl font-black text-emerald-900">{reports.summary.totalRecords}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border-2 border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-blue-700 uppercase">Present</span>
                      <CheckCircle size={20} className="text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-blue-900">{reports.summary.presentCount}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border-2 border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-red-700 uppercase">Absent</span>
                      <XCircle size={20} className="text-red-600" />
                    </div>
                    <p className="text-3xl font-black text-red-900">{reports.summary.absentCount}</p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border-2 border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700 uppercase">Attendance Rate</span>
                      <TrendingUp size={20} className="text-slate-600" />
                    </div>
                    <p className="text-3xl font-black text-slate-900">{reports.summary.attendanceRate.toFixed(1)}%</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Course Summary */}
                <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">Course Summary</h3>
                  {courseSummary.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No course data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {courseSummary.map((item, index) => (
                        <div
                          key={index}
                          className="p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
                        >
                          {item.course ? (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-bold text-slate-900">{item.course.code}</p>
                                  <p className="text-sm text-slate-500">{item.course.name}</p>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm">
                                  {item.attendanceRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mt-2">
                                <div>
                                  <span className="font-semibold">Total:</span> {item.totalRecords}
                                </div>
                                <div>
                                  <span className="font-semibold">Present:</span> {item.presentCount}
                                </div>
                                <div>
                                  <span className="font-semibold">Absent:</span> {item.absentCount}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-slate-500">Course not found</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Student Summary */}
                <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">Student Summary</h3>
                  {studentSummary.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <p>No student data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {studentSummary.slice(0, 20).map((item, index) => (
                        <div
                          key={index}
                          className="p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-all"
                        >
                          {item.student ? (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-bold text-slate-900">{item.student.studentId}</p>
                                  <p className="text-sm text-slate-500">
                                    {item.student.program} - Year {item.student.yearOfStudy}
                                  </p>
                                </div>
                                <span
                                  className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                    item.attendanceRate >= 80
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : item.attendanceRate >= 60
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {item.attendanceRate.toFixed(1)}%
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mt-2">
                                <div>
                                  <span className="font-semibold">Total:</span> {item.totalRecords}
                                </div>
                                <div>
                                  <span className="font-semibold">Present:</span> {item.presentCount}
                                </div>
                                <div>
                                  <span className="font-semibold">Absent:</span> {item.absentCount}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-slate-500">Student not found</p>
                          )}
                        </div>
                      ))}
                      {studentSummary.length > 20 && (
                        <p className="text-center text-sm text-slate-500 mt-2">
                          Showing top 20 students (lowest attendance first)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Trends Chart */}
              {trends && trends.trends.length > 0 && (
                <div className="bg-gradient-to-br from-white via-slate-50/50 to-white rounded-3xl shadow-xl border-2 border-slate-200/60 p-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
                    Attendance Trends ({trends.period})
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {trends.trends.map((trend: any, index: number) => (
                      <div key={index} className="p-4 bg-white rounded-xl border-2 border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-bold text-slate-900">
                            {new Date(trend.date).toLocaleDateString()}
                          </p>
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm">
                            {trend.attendanceRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-4 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all"
                              style={{ width: `${trend.attendanceRate}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-600 min-w-[120px] text-right">
                            {trend.presentCount}/{trend.totalRecords}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceptionistDashboard;
