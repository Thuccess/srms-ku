import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Student, SystemSettings } from '../types';
import UniversityDashboard from './dashboards/UniversityDashboard';
import RegistryDashboard from './dashboards/RegistryDashboard';
import Dashboard from './Dashboard'; // Keep existing dashboard for HOD, ADVISOR, LECTURER

interface RoleBasedDashboardProps {
  students: Student[];
  settings: SystemSettings;
}

/**
 * Role-Based Dashboard Router
 * 
 * Routes to appropriate dashboard based on user role:
 * - VC/DVC_ACADEMIC: University-wide aggregated analytics (no individual students)
 * - DEAN: Faculty dashboard (aggregated + program-level)
 * - HOD: Department dashboard (can view individual students)
 * - ADVISOR: Assigned students dashboard
 * - LECTURER: Course dashboard (risk indicators for enrolled students)
 * - REGISTRY: Records dashboard (data integrity, no AI risk scores)
 * - IT_ADMIN: System health dashboard (no academic data)
 */
const RoleBasedDashboard: React.FC<RoleBasedDashboardProps> = ({ students, settings }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-slate-600 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Route based on role
  switch (user.role) {
    case UserRole.VC:
    case UserRole.DVC_ACADEMIC:
      // University-wide aggregated analytics only
      return <UniversityDashboard />;

    case UserRole.DEAN:
      // Faculty-level dashboard (similar to university but faculty-scoped)
      // For now, use existing dashboard but filter by faculty
      return <Dashboard students={students} settings={settings} />;

    case UserRole.HOD:
      // Department dashboard - can view individual students
      return <Dashboard students={students} settings={settings} />;

    case UserRole.ADVISOR:
      // Assigned students dashboard
      return <Dashboard students={students} settings={settings} />;

    case UserRole.LECTURER:
      // Course-scoped dashboard
      return <Dashboard students={students} settings={settings} />;

    case UserRole.REGISTRY:
      // Registry dashboard with AI decision support
      return <RegistryDashboard students={students} settings={settings} />;

    case UserRole.IT_ADMIN:
      // System health dashboard (no academic data)
      return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              System Health Dashboard
            </h2>
            <p className="text-slate-500 mt-1 font-medium">
              System monitoring and health metrics. Academic data is not accessible.
            </p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-slate-600">
              System health monitoring features will be available here.
              Academic and student data access is restricted for IT Admin role.
            </p>
          </div>
        </div>
      );

    default:
      return (
        <div className="p-8 max-w-[1600px] mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-900 font-semibold">
              Unknown role. Please contact administrator.
            </p>
          </div>
        </div>
      );
  }
};

export default RoleBasedDashboard;

