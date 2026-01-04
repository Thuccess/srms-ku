import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, Settings, LogOut, ChevronRight, PieChart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const { user } = useAuth();
  
  // Get role display name
  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      'VC': 'Vice Chancellor',
      'DVC_ACADEMIC': 'Deputy VC (Academic)',
      'DEAN': 'Faculty Dean',
      'HOD': 'Head of Department',
      'ADVISOR': 'Academic Advisor',
      'LECTURER': 'Course Lecturer',
      'REGISTRY': 'Registry Staff',
      'IT_ADMIN': 'IT Administrator',
    };
    return roleMap[role] || role;
  };
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 ease-out mx-4 focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 ${
      isActive
        ? 'bg-gradient-to-r from-ku-600 to-ku-700 text-white shadow-lg shadow-ku-500/30 transform scale-[1.02]'
        : 'text-slate-600 hover:bg-gradient-to-r hover:from-slate-50 hover:to-slate-100 hover:text-slate-900 active:bg-slate-100 hover:shadow-sm'
    }`;

  const iconClass = (isActive: boolean) => 
    `transition-colors duration-200 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-ku-600 group-focus:text-ku-600'}`;

  return (
    <div className="hidden lg:flex w-80 bg-white/95 backdrop-blur-xl h-screen border-r border-slate-200/50 flex-col fixed left-0 top-0 z-50 font-sans shadow-[4px_0_24px_-12px_rgba(0,0,0,0.08)]">
      <div className="pt-8 pb-6 px-8">
        <div className="flex items-center gap-3 mb-10">
           <div className="flex-shrink-0 transform transition-transform hover:scale-105 duration-300">
             <img 
               src="/logo.png" 
               alt="Kampala University Logo" 
               className="h-12 w-auto object-contain"
               onError={(e) => {
                 // Fallback to icon if logo not found
                 const target = e.target as HTMLImageElement;
                 target.style.display = 'none';
                 const fallback = target.nextElementSibling as HTMLElement;
                 if (fallback) fallback.style.display = 'flex';
               }}
             />
             <div className="w-12 h-12 bg-gradient-to-br from-ku-500 to-ku-700 rounded-xl items-center justify-center shadow-xl shadow-ku-200/50 text-white hidden">
               <GraduationCap className="w-7 h-7" strokeWidth={1.5} />
             </div>
           </div>
           <div>
             <h1 className="font-bold text-xl text-slate-900 tracking-tight leading-none">Kampala University</h1>
             <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-1.5">Risk Intelligence</p>
           </div>
        </div>

        <nav className="space-y-1.5" aria-label="Main navigation">
          <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2 opacity-80" aria-hidden="true">Analytics</p>
          <NavLink 
            to="/" 
            className={navClass}
            aria-label="Dashboard"
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3.5">
                  <LayoutDashboard size={22} strokeWidth={isActive ? 2.5 : 2} className={iconClass(isActive)} aria-hidden="true" />
                  <span className="font-semibold tracking-tight">Dashboard</span>
                </div>
                {isActive && (
                  <div 
                    className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" 
                    aria-hidden="true"
                    aria-label="Current page"
                  />
                )}
              </>
            )}
          </NavLink>
          
          {/* Students Directory - Only show if user can view individual students */}
          {user && (user.role !== 'VC' && user.role !== 'DVC_ACADEMIC' && user.role !== 'IT_ADMIN') && (
            <>
              <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-8 opacity-80" aria-hidden="true">Academic</p>
              <NavLink 
                to="/students" 
                className={navClass}
                aria-label="Students Directory"
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3.5">
                      <Users size={22} strokeWidth={isActive ? 2.5 : 2} className={iconClass(isActive)} aria-hidden="true" />
                      <span className="font-semibold tracking-tight">Students Directory</span>
                    </div>
                    {isActive && (
                      <div 
                        className="w-1.5 h-1.5 rounded-full bg-white" 
                        aria-hidden="true"
                        aria-label="Current page"
                      />
                    )}
                  </>
                )}
              </NavLink>
            </>
          )}
          
          {/* System Settings - Only show for REGISTRY and IT_ADMIN */}
          {user && (user.role === 'REGISTRY' || user.role === 'IT_ADMIN') && (
            <>
              <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-8 opacity-80" aria-hidden="true">Configuration</p>
              <NavLink 
                to="/settings" 
                className={navClass}
                aria-label="System Settings"
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3.5">
                      <Settings size={22} strokeWidth={isActive ? 2.5 : 2} className={iconClass(isActive)} aria-hidden="true" />
                      <span className="font-semibold tracking-tight">System Settings</span>
                    </div>
                    {isActive && (
                      <div 
                        className="w-1.5 h-1.5 rounded-full bg-white" 
                        aria-hidden="true"
                        aria-label="Current page"
                      />
                    )}
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-200/50 bg-gradient-to-t from-slate-50/50 to-transparent">
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 border border-slate-200/50 flex items-center gap-3.5 mb-4 group hover:shadow-lg hover:border-slate-300 transition-all duration-300 card-hover">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-ku-500 via-ku-600 to-ku-700 shadow-md flex items-center justify-center text-white font-bold text-sm border-2 border-white ring-2 ring-ku-100">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm animate-pulse"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-ku-600 transition-colors">
              {user?.fullName || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user ? getRoleDisplayName(user.role) : 'Loading...'}
            </p>
          </div>
        </div>
        
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-slate-600 hover:text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 rounded-xl transition-all duration-300 text-sm font-semibold group focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:bg-red-100 hover:shadow-sm"
          aria-label="Sign out"
        >
          <LogOut size={18} className="group-hover:-translate-x-1 transition-transform duration-300" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;