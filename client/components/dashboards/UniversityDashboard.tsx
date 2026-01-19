import React from 'react';
import { Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAnalytics } from '../../services/apiService';

/**
 * University-wide Analytics Dashboard
 * For VC and DVC_ACADEMIC roles
 * 
 * Access Rules:
 * - University-wide aggregated analytics ONLY
 * - NO individual student data
 */
const UniversityDashboard: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await getAnalytics();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch university analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading university analytics...</p>
        </div>
      </div>
    );
  }

  const metrics = analytics?.metrics || {};

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          University-Wide Analytics
        </h2>
        <p className="text-slate-500 mt-1 font-medium">
          Aggregated overview of student performance and risk metrics across all faculties.
        </p>
        <p className="text-xs text-amber-600 mt-2 font-semibold">
          ⚠️ Individual student data is not available at this access level.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-ku-500 bg-opacity-10">
              <Users size={24} className="text-ku-500" />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Total Enrollment
          </p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">
            {metrics.totalStudents || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-red-500 bg-opacity-10">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            High Risk
          </p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">
            {metrics.riskDistribution?.high || 0}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-emerald-500 bg-opacity-10">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Avg Attendance
          </p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">
            {metrics.averageAttendance?.toFixed(1) || 0}%
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-indigo-500 bg-opacity-10">
              <TrendingUp size={24} className="text-indigo-500" />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Avg GPA
          </p>
          <h3 className="text-3xl font-black text-slate-800 tracking-tight">
            {metrics.averageGPA?.toFixed(2) || 0}
          </h3>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Risk Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-xl">
            <div className="text-2xl font-black text-red-600">{metrics.riskDistribution?.high || 0}</div>
            <div className="text-xs font-bold text-red-700 uppercase mt-1">High Risk</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-xl">
            <div className="text-2xl font-black text-amber-600">{metrics.riskDistribution?.medium || 0}</div>
            <div className="text-xs font-bold text-amber-700 uppercase mt-1">Medium Risk</div>
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <div className="text-2xl font-black text-emerald-600">{metrics.riskDistribution?.low || 0}</div>
            <div className="text-xs font-bold text-emerald-700 uppercase mt-1">Low Risk</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversityDashboard;

