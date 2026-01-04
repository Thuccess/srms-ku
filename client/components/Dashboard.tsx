import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';
import { Student, RiskLevel, SystemSettings } from '../types';
import { Users, AlertTriangle, CheckCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Bell, Clock, Calendar, Filter, ExternalLink, FileText, History, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStudents, mapStudentFromServer } from '../services/apiService';
import { MOCK_STUDENTS } from '../constants';
import { useToast } from '../context/ToastContext';
import { socketService } from '../services/socketService';

interface DashboardProps {
  students: Student[];
  settings: SystemSettings;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  subtext: string;
  time: string;
  link: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  trend?: string;
  trendLabel?: string;
  trendUp?: boolean;
  subValue?: string;
}

const COLORS = {
  [RiskLevel.LOW]: '#10b981',   // Emerald 500
  [RiskLevel.MEDIUM]: '#f59e0b', // Amber 500
  [RiskLevel.HIGH]: '#ef4444',   // Red 500
} as const;

// Mock Data for Historical View
const HISTORICAL_DATA = [
  { semester: 'Sem 1 2022', High: 15, Medium: 35, Low: 50, Retention: 78, AvgGPA: 2.8 },
  { semester: 'Sem 2 2022', High: 12, Medium: 30, Low: 58, Retention: 82, AvgGPA: 3.1 },
  { semester: 'Sem 1 2023', High: 18, Medium: 25, Low: 57, Retention: 80, AvgGPA: 2.9 },
  { semester: 'Sem 2 2023', High: 10, Medium: 20, Low: 70, Retention: 88, AvgGPA: 3.4 },
  { semester: 'Sem 1 2024', High: 5, Medium: 15, Low: 80, Retention: 92, AvgGPA: 3.8 },
];

const Dashboard: React.FC<DashboardProps> = ({ students: propStudents, settings }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [timeRange, setTimeRange] = useState<'Current' | 'History'>('Current');
  const [students, setStudents] = useState<Student[]>(propStudents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Memoized fetch function with error handling
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Performance Optimization: Load all students (backward compatible)
      const data = await getStudents();
      
      // Handle both array response (backward compatible) and paginated response
      const studentsArray = Array.isArray(data) 
        ? data 
        : (data as any).students || [];
      
      if (studentsArray.length > 0) {
        setStudents(studentsArray);
        setLastRefresh(new Date());
      } else {
        // Server connected but no data
        setStudents(MOCK_STUDENTS);
        setError('No students in database');
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch students';
      console.error('Failed to fetch students from API:', err);
      
      // Only show error if it's a connection issue
      if (err?.isConnectionError || errorMessage.includes('Cannot connect') || errorMessage.includes('timeout')) {
        setError('Server unavailable - using demo data');
        setStudents(MOCK_STUDENTS);
        // Don't show toast here as App.tsx already handles it
      } else {
        setError(errorMessage);
        setStudents(MOCK_STUDENTS);
        addToast(`Error loading students: ${errorMessage}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Sync with propStudents when they change (from App.tsx real-time updates)
  useEffect(() => {
    setStudents(propStudents);
  }, [propStudents]);

  // Real-time Socket.io updates for dashboard
  useEffect(() => {
    // Handle risk updates
    const handleRiskUpdated = (data: { studentNumber: string; riskScore: number; riskLevel: string }) => {
      setStudents(prev => prev.map(s => {
        if (s.studentNumber === data.studentNumber) {
          return {
            ...s,
            riskScore: data.riskScore,
            riskLevel: data.riskLevel as RiskLevel,
            riskProfile: {
              ...(s as any).riskProfile,
              riskScore: data.riskScore,
              riskLevel: data.riskLevel as RiskLevel,
              lastAnalyzed: new Date().toISOString(),
            },
          };
        }
        return s;
      }));
      setLastRefresh(new Date());
    };

    // Handle student updates
    const handleStudentUpdated = (data: { student: any }) => {
      const updatedStudent = mapStudentFromServer(data.student);
      setStudents(prev => prev.map(s => 
        s.studentNumber === updatedStudent.studentNumber ? updatedStudent : s
      ));
      setLastRefresh(new Date());
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
      setLastRefresh(new Date());
    };

    // Handle student deleted
    const handleStudentDeleted = (data: { studentNumber: string }) => {
      setStudents(prev => prev.filter(s => s.studentNumber !== data.studentNumber));
      setLastRefresh(new Date());
    };

    // Handle stats updates (from server)
    const handleStatsUpdated = (data: { stats: any }) => {
      // Stats are computed from students, so we don't need to do anything here
      // But we can update lastRefresh to show the dashboard is live
      setLastRefresh(new Date());
    };

    // Register listeners
    socketService.onRiskUpdated(handleRiskUpdated);
    socketService.onStudentUpdated(handleStudentUpdated);
    socketService.onStudentCreated(handleStudentCreated);
    socketService.onStudentDeleted(handleStudentDeleted);
    socketService.onStatsUpdated(handleStatsUpdated);

    // Cleanup
    return () => {
      socketService.offRiskUpdated(handleRiskUpdated);
      socketService.offStudentUpdated(handleStudentUpdated);
      socketService.offStudentCreated(handleStudentCreated);
      socketService.offStudentDeleted(handleStudentDeleted);
      socketService.offStatsUpdated(handleStatsUpdated);
    };
  }, []);

  // Compute stats dynamically with proper error handling
  const stats = useMemo(() => {
    if (!students || students.length === 0) {
      return { total: 0, high: 0, medium: 0, low: 0, avgAtt: 0, retention: 0 };
    }

    const total = students.length;
    const high = students.filter(s => (s as any).riskProfile?.riskLevel === RiskLevel.HIGH).length;
    const medium = students.filter(s => (s as any).riskProfile?.riskLevel === RiskLevel.MEDIUM).length;
    const low = students.filter(s => (s as any).riskProfile?.riskLevel === RiskLevel.LOW).length;
    
    const validAttendance = students.filter(s => typeof s.attendance === 'number' && !isNaN(s.attendance));
    const avgAtt = validAttendance.length > 0 
      ? Math.round(validAttendance.reduce((acc, s) => acc + s.attendance, 0) / validAttendance.length) 
      : 0;
    
    // Calculate retention based on students with GPA > configured critical threshold
    const validGpa = students.filter(s => typeof (s as any).gpa === 'number' && !isNaN((s as any).gpa));
    const retention = validGpa.length > 0 
      ? Math.round((validGpa.filter(s => (s as any).gpa >= settings.thresholds.criticalGpa).length / validGpa.length) * 100) 
      : 0;

    return { total, high, medium, low, avgAtt, retention };
  }, [students, settings.thresholds.criticalGpa]);

  // Compute Department Data with improved error handling
  const deptData = useMemo(() => {
    if (!students || students.length === 0) return [];
    
    const data: Record<string, { name: string; High: number; Medium: number; Low: number }> = {};
    
    students.forEach(s => {
      if (!s.course || !(s as any).riskProfile?.riskLevel) return;
      
      // Group programs by category for better chart visualization
      let prog = s.course;
      
      // Health Sciences
      if (prog.includes('Nursing') || prog.includes('Midwifery') || prog.includes('Health')) {
        prog = 'Health Sciences';
      }
      // Computer & IT
      else if (prog.includes('Computer') || prog.includes('CISCO') || prog.includes('Inf Techn')) {
        prog = 'Computer & IT';
      }
      // Business & Management
      else if (prog.includes('Business') || prog.includes('Economics') || prog.includes('Human Resource') || 
               prog.includes('Credit Management') || prog.includes('Procurement') || prog.includes('Islamic Banking')) {
        prog = 'Business & Mgt';
      }
      // Sciences
      else if (prog.includes('Science') || prog.includes('Agriculture') || prog.includes('Environmental') || 
               prog.includes('Oil & Gas')) {
        prog = 'Sciences';
      }
      // Arts & Design
      else if (prog.includes('Design') || prog.includes('Fashion') || prog.includes('Art') || 
               prog.includes('Film Making') || prog.includes('Filming')) {
        prog = 'Arts & Design';
      }
      // Social Sciences
      else if (prog.includes('Journalism') || prog.includes('Social Work') || prog.includes('Public Admin') || 
               prog.includes('Political') || prog.includes('International') || prog.includes('Development') || 
               prog.includes('Guidance') || prog.includes('Leisure')) {
        prog = 'Social Sciences';
      }
      // Education
      else if (prog.includes('Education') || prog.includes('Early Childhood') || prog.includes('Special Needs')) {
        prog = 'Education';
      }
      // Other
      else if (prog.includes('Administrative') || prog.includes('Library') || prog.includes('English')) {
        prog = 'Other Programs';
      }
      // Keep original if no match (for short courses, etc.)
      else {
        prog = prog.length > 25 ? prog.substring(0, 22) + '...' : prog;
      }
      
      if (!data[prog]) {
        data[prog] = { name: prog, High: 0, Medium: 0, Low: 0 };
      }
      
      const level = (s as any).riskProfile.riskLevel;
      if (level === RiskLevel.HIGH) data[prog].High++;
      else if (level === RiskLevel.MEDIUM) data[prog].Medium++;
      else if (level === RiskLevel.LOW) data[prog].Low++;
    });

    return Object.values(data);
  }, [students]);

  const riskDistribution = useMemo(() => [
    { name: 'Low Risk', value: stats.low, color: COLORS[RiskLevel.LOW] },
    { name: 'Medium Risk', value: stats.medium, color: COLORS[RiskLevel.MEDIUM] },
    { name: 'High Risk', value: stats.high, color: COLORS[RiskLevel.HIGH] },
  ], [stats.low, stats.medium, stats.high]);

  // Generate Alerts with improved logic and type safety
  const alerts = useMemo((): Alert[] => {
    if (!students || students.length === 0) return [];
    
    const list: Alert[] = [];
    const now = new Date();
    
    // High Risk Alerts
    students
      .filter(s => (s as any).riskProfile?.riskLevel === RiskLevel.HIGH && s.studentNumber && s.id)
      .forEach(s => {
        list.push({
            id: s.id as string,
          type: 'critical',
          message: `High dropout risk: ${s.studentNumber}`,
          subtext: `GPA: ${s.gpa?.toFixed(1) || 'N/A'} | Att: ${s.attendance || 0}%`,
          time: 'Active now',
          link: `/students/${s.id as string}`
        });
      });

    // Attendance Alerts using configurable threshold
    students
      .filter(s => 
        s.attendance < settings.thresholds.warningAttendance && 
        (s as any).riskProfile?.riskLevel !== RiskLevel.HIGH &&
        s.studentNumber && s.id
      )
      .forEach(s => {
        list.push({
          id: s.id as string,
          type: 'warning',
          message: `Attendance Alert: ${s.studentNumber}`,
          subtext: `Dropped to ${s.attendance}%`,
          time: '2h ago',
          link: `/students/${s.id as string}`
        });
      });

    // Financial Alerts: Students with balance exceeding Financial Hold threshold
    students
      .filter(s => {
        const balanceExceedsThreshold = s.balance != null && 
          s.balance > settings.thresholds.financialLimit;
        return balanceExceedsThreshold && s.studentNumber && s.id;
      })
      .forEach(s => {
        list.push({
          id: s.id as string,
          type: 'info',
          message: `Financial Hold: ${s.studentNumber}`,
          subtext: `Balance: ${s.balance.toLocaleString()} UGX (Threshold: ${settings.thresholds.financialLimit.toLocaleString()} UGX)`,
          time: '5h ago',
          link: `/students/${s.id as string}`
        });
      });

    // Sort by priority (critical > warning > info) and limit to 6
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    return list
      .sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type])
      .slice(0, 6);
  }, [students, settings.thresholds]);

  const StatCard: React.FC<StatCardProps> = React.memo(({ title, value, icon: Icon, color, trend, trendLabel, trendUp, subValue }) => (
    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-slate-200/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group card-hover relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50/50 to-transparent rounded-full -mr-16 -mt-16"></div>
      <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
          <div className={`p-3.5 rounded-xl ${color} bg-opacity-10 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h3>
          {subValue && <span className="text-sm font-medium text-slate-400">{subValue}</span>}
        </div>
        {trendLabel && <p className="text-xs text-slate-400 mt-2 font-medium">{trendLabel}</p>}
        </div>
      </div>
    </div>
  ));

  StatCard.displayName = 'StatCard';

  const handleRefresh = useCallback(() => {
    fetchStudents();
  }, [fetchStudents]);

  if (loading && students.length === 0) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto flex items-center justify-center min-h-screen" role="status" aria-live="polite">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-slate-900 mx-auto mb-4" aria-hidden="true"></div>
          <p className="text-slate-600 font-semibold">Loading dashboard...</p>
          <p className="text-slate-400 text-sm mt-2">Please wait while we fetch student data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-500 mt-1 font-medium">Overview of student performance and risk metrics.</p>
          {error && error.includes('Server unavailable') && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">Server Connection Issue</p>
                <p className="text-xs text-amber-700 mt-1">
                  The backend server is not running. To start it, run: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">cd server && npm run dev</code>
                </p>
                <p className="text-xs text-amber-600 mt-1">Currently using demo data for preview.</p>
              </div>
            </div>
          )}
          {error && !error.includes('Server unavailable') && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle size={16} />
              <span>Using cached data. {error}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
            aria-label="Refresh dashboard data"
            aria-busy={loading}
          >
            <RefreshCw size={18} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setTimeRange('Current')}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                timeRange === 'Current' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
              }`}
              aria-pressed={timeRange === 'Current'}
              aria-label="View current semester data"
            >
              Current Semester
            </button>
            <button 
              onClick={() => setTimeRange('History')}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                timeRange === 'History' 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-50 active:bg-slate-100'
              }`}
              aria-pressed={timeRange === 'History'}
              aria-label="View historical trends"
            >
              Historical Trends
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Enrollment"
          value={stats.total}
          subValue="Students"
          icon={Users}
          color="bg-ku-500"
          trend="12%"
          trendLabel="vs previous semester"
          trendUp={true}
        />
        <StatCard
          title="Critical Risk"
          value={stats.high}
          subValue="Students"
          icon={AlertTriangle}
          color="bg-red-500"
          trend="5%"
          trendLabel="Require immediate attention"
          trendUp={false}
        />
        <StatCard
          title="Avg Attendance"
          value={`${stats.avgAtt}%`}
          icon={CheckCircle}
          color="bg-emerald-500"
          trend="2.4%"
          trendLabel="Campus-wide average"
          trendUp={true}
        />
        <StatCard
          title="Retention Projection"
          value={`${stats.retention}%`}
          icon={TrendingUp}
          color="bg-indigo-500"
          trend="0.8%"
          trendLabel="Predicted year-end rate"
          trendUp={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Conditional Main Chart Area */}
          {timeRange === 'Current' ? (
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-lg border border-slate-200/50 card-hover">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Faculty Risk Analysis</h3>
                  <p className="text-sm text-slate-500">Risk distribution across academic departments</p>
                </div>
                <button 
                  className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
                  aria-label="Filter chart data"
                >
                  <Filter size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="h-80 w-full">
                {deptData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptData} barSize={48} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} 
                        dy={10} 
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                          padding: '12px 16px',
                          fontFamily: 'Inter',
                          fontSize: '13px'
                        }}
                      />
                      <Legend 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{paddingTop: '20px', fontWeight: 600, fontSize: '13px', color: '#64748b'}} 
                      />
                      <Bar dataKey="High" stackId="a" fill={COLORS[RiskLevel.HIGH]} radius={[0, 0, 4, 4]} name="High Risk" />
                      <Bar dataKey="Medium" stackId="a" fill={COLORS[RiskLevel.MEDIUM]} name="Medium Risk" />
                      <Bar dataKey="Low" stackId="a" fill={COLORS[RiskLevel.LOW]} radius={[4, 4, 0, 0]} name="Low Risk" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    <p>No department data available</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-lg border border-slate-200/50 animate-fade-in card-hover">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-500 rounded-lg"><History size={20} /></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Longitudinal Risk Trends</h3>
                    <p className="text-sm text-slate-500">Risk profile evolution over past 5 semesters</p>
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={HISTORICAL_DATA} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="semester" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} 
                      dy={10} 
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      }}
                    />
                    <Legend iconType="plainline" wrapperStyle={{paddingTop: '20px', fontWeight: 600, fontSize: '13px', color: '#64748b'}} />
                    <Line type="monotone" dataKey="High" stroke={COLORS[RiskLevel.HIGH]} strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="High Risk %" />
                    <Line type="monotone" dataKey="Medium" stroke={COLORS[RiskLevel.MEDIUM]} strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Medium Risk %" />
                    <Line type="monotone" dataKey="Low" stroke={COLORS[RiskLevel.LOW]} strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Low Risk %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Additional Analytics / Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {timeRange === 'Current' ? (
              <>
                {/* CURRENT: Pie Chart */}
                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-slate-200/50 flex flex-col card-hover">
                  <h3 className="font-bold text-slate-900 mb-2">Overall Risk Profile</h3>
                  <p className="text-sm text-slate-500 mb-6">Total student population breakdown</p>
                  <div className="flex-1 min-h-[200px] relative">
                    {riskDistribution.some(r => r.value > 0) ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={riskDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                              cornerRadius={6}
                            >
                              {riskDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold'}} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-3xl font-black text-slate-800">{stats.total}</span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Students</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <p>No data available</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                    {riskDistribution.map(item => (
                      <div key={item.name}>
                        <div className="text-lg font-bold" style={{color: item.color}}>{item.value}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{item.name.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CURRENT: Tasks Widget */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl shadow-2xl text-white flex flex-col relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                        <Calendar size={20} className="text-indigo-300" />
                      </div>
                      <h3 className="font-bold text-lg">Upcoming Tasks</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2"></div>
                        <div>
                          <p className="text-sm font-semibold">Review High Risk Cases</p>
                          <p className="text-xs text-slate-400 mt-1">{stats.high} students flagged this week</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2"></div>
                        <div>
                          <p className="text-sm font-semibold">Department Meeting</p>
                          <p className="text-xs text-slate-400 mt-1">Tomorrow, 10:00 AM</p>
                        </div>
                      </div>
                    </div>
                    <button className="mt-6 w-full py-3 bg-white text-slate-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">
                      View Calendar
                    </button>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-ku-500/20 rounded-full blur-3xl -ml-10 -mb-10"></div>
                </div>
              </>
            ) : (
              <>
                {/* HISTORY: Retention Area Chart */}
                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-slate-200/50 flex flex-col animate-fade-in card-hover">
                  <h3 className="font-bold text-slate-900 mb-2">Retention Growth</h3>
                  <p className="text-sm text-slate-500 mb-6">Percentage of students retained per semester</p>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HISTORICAL_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRetention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="semester" hide />
                        <YAxis hide domain={[60, 100]} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Area type="monotone" dataKey="Retention" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorRetention)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* HISTORY: Avg GPA Bar Chart */}
                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-slate-200/50 flex flex-col animate-fade-in card-hover">
                  <h3 className="font-bold text-slate-900 mb-2">Academic Performance</h3>
                  <p className="text-sm text-slate-500 mb-6">Average GPA trend</p>
                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={HISTORICAL_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="semester" hide />
                        <YAxis hide domain={[0, 5]} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="AvgGPA" fill="#0ea5e9" radius={[4, 4, 4, 4]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="flex flex-col h-full space-y-6">
          <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl shadow-lg border border-slate-200/50 flex-1 flex flex-col card-hover">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Live Activity Feed
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Real-time system alerts</p>
              </div>
              <div className="relative">
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <Bell size={20} className="text-slate-400" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar max-h-[600px]">
              {alerts.length > 0 ? alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  onClick={() => navigate(alert.link)}
                  className="group p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/50 hover:bg-white hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden card-hover"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(alert.link);
                    }
                  }}
                  aria-label={`${alert.type} alert: ${alert.message}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    alert.type === 'critical' ? 'bg-red-500' : 
                    alert.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}></div>
                  
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      alert.type === 'critical' ? 'bg-red-100 text-red-700' : 
                      alert.type === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.type}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <Clock size={10} /> {alert.time}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-ku-700 transition-colors">
                    {alert.message}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {alert.subtext}
                  </p>

                  <div className="mt-3 flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-ku-600 transition-colors">
                    <span>Take Action</span>
                    <ArrowUpRight size={12} />
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-400">
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p>All clear. No new alerts.</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => navigate('/students')}
              className="w-full mt-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
              aria-label="Navigate to students directory"
            >
              View All Students <ExternalLink size={16} aria-hidden="true" />
            </button>
          </div>
          
          {/* Quick Action Widget */}
          <div className="bg-gradient-to-br from-ku-600 via-ku-700 to-ku-600 p-6 rounded-3xl shadow-2xl text-white relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-1">Generate Report</h3>
              <p className="text-indigo-100 text-xs mb-4">Export weekly risk analysis PDF</p>
              <button className="bg-white text-ku-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-emerald-50 transition-colors w-full flex items-center justify-center gap-2">
                <FileText size={16} /> Download PDF
              </button>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform pointer-events-none">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
