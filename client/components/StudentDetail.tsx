import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Student, RiskLevel, Intervention, InterventionType, SystemSettings } from '../types';
import { ArrowLeft, Send, AlertTriangle, CheckCircle, Mail, DollarSign, BookOpen, Clock, Calendar, MessageSquare, ChevronDown, Sparkles, Phone, User, GraduationCap, Hash, Building2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socketService';
import { mapStudentFromServer, predictRisk, updateStudent as updateStudentAPI } from '../services/apiService';

interface StudentDetailProps {
  students: Student[];
  updateStudent: (updatedStudent: Student) => void;
  settings: SystemSettings;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ students, updateStudent, settings }) => {
  const { id } = useParams<{ id: string }>();
  const student = students.find(s => s.id === id);
  const [interventionNote, setInterventionNote] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);
  const { addToast } = useToast();
  const { canViewRiskScores } = useAuth();
  
  // Check if user can view risk scores (with system settings for REGISTRY)
  const canViewRisk = canViewRiskScores(settings.registryCanViewRiskScores || false);

  // Real-time Socket.io updates for this specific student
  useEffect(() => {
    if (!student) return;

    // Handle risk updates for this student
    const handleRiskUpdated = (data: { studentNumber: string; riskScore: number; riskLevel: string }) => {
      if (student.studentNumber === data.studentNumber) {
        const currentRiskProfile = (student as any).riskProfile || {
          riskScore: 0,
          riskLevel: RiskLevel.LOW,
          riskFactors: [],
          recommendation: '',
          lastAnalyzed: new Date().toISOString(),
        };
        const updatedStudent = {
          ...student,
          riskScore: data.riskScore,
          riskLevel: data.riskLevel as RiskLevel,
          riskProfile: {
            ...currentRiskProfile,
            riskScore: data.riskScore,
            riskLevel: data.riskLevel as RiskLevel,
            lastAnalyzed: new Date().toISOString(),
          },
        } as any;
        updateStudent(updatedStudent);
        addToast('Risk score updated in real-time', 'info');
      }
    };

    // Handle student updates
    const handleStudentUpdated = (data: { student: any }) => {
      const updatedStudent = mapStudentFromServer(data.student);
      if (student.studentNumber === updatedStudent.studentNumber || student.id === updatedStudent.id) {
        updateStudent(updatedStudent);
        addToast('Student information updated', 'info');
      }
    };

    // Register listeners
    socketService.onRiskUpdated(handleRiskUpdated);
    socketService.onStudentUpdated(handleStudentUpdated);

    // Cleanup
    return () => {
      socketService.offRiskUpdated(handleRiskUpdated);
      socketService.offStudentUpdated(handleStudentUpdated);
    };
  }, [student, updateStudent, addToast]);

  if (!student) return <div className="p-10 text-center text-slate-500">Student not found</div>;

  // Initialize risk profile and interventions if they don't exist (for backward compatibility)
  const riskProfile = (student as any).riskProfile || {
    riskScore: 0,
    riskLevel: RiskLevel.LOW,
    riskFactors: [],
    recommendation: 'No risk analysis performed yet.',
    lastAnalyzed: new Date().toISOString(),
  };
  const interventions = (student as any).interventions || [];


  // Helper function to normalize risk level
  const normalizeRiskLevel = (level: string | RiskLevel): RiskLevel => {
    const upper = level.toString().toUpperCase();
    if (upper === 'LOW') return RiskLevel.LOW;
    if (upper === 'MEDIUM') return RiskLevel.MEDIUM;
    if (upper === 'HIGH') return RiskLevel.HIGH;
    return RiskLevel.LOW;
  };

  // Helper function to generate risk factors based on prediction
  const generateRiskFactors = (riskLevel: RiskLevel | string, student: Student): string[] => {
    const factors: string[] = [];
    if (student.gpa && student.gpa < 2.5) {
      factors.push('Low GPA - Academic Performance Below Threshold');
    }
    if ((student.attendance || 0) < 75) {
      factors.push('Poor Attendance - Below 75% Threshold');
    }
    if (student.balance != null && student.balance > settings.thresholds.financialLimit) {
      factors.push(`Financial Hold - Balance exceeds threshold (${settings.thresholds.financialLimit.toLocaleString()} UGX)`);
    }
    if (riskLevel === 'HIGH' && factors.length === 0) {
      factors.push('Multiple Risk Indicators Detected');
    }
    return factors.length > 0 ? factors : ['No significant risk factors identified'];
  };

  // Helper function to generate recommendations
  const generateRecommendation = (riskLevel: RiskLevel | string, student: Student): string => {
    if (riskLevel === 'HIGH') {
      return 'Immediate intervention required. Schedule counseling session and financial aid review. Consider academic support programs.';
    } else if (riskLevel === 'MEDIUM') {
      return 'Monitor closely. Schedule check-in meeting within 2 weeks. Provide academic resources and support.';
    } else {
      return 'Student is performing well. Continue regular monitoring and maintain current support level.';
    }
  };

  const handleAddIntervention = () => {
    if (!interventionNote) return;
    const newIntervention: Intervention = {
      id: Date.now().toString(),
      type: InterventionType.COUNSELING,
      date: new Date().toISOString().split('T')[0],
      notes: interventionNote,
      status: 'Pending'
    };
    const updatedStudent = {
      ...student,
      interventions: [newIntervention, ...interventions]
    } as any;
    updateStudent(updatedStudent);
    setInterventionNote('');
    addToast('Intervention record saved', 'success');
  };

  const toggleInterventionStatus = (interventionId: string) => {
    const updatedInterventions = interventions.map(int => {
      if (int.id === interventionId) {
        const newStatus = int.status === 'Pending' ? 'Completed' : 'Pending';
        addToast(`Marked intervention as ${newStatus}`, 'success');
        return { ...int, status: newStatus as 'Pending' | 'Completed' };
      }
      return int;
    });
    updateStudent({ ...student, interventions: updatedInterventions } as any);
  };

  const sendAlert = () => {
    setNotificationSent(true);
    addToast(`Alert sent to student ${student.studentNumber}`, 'success');
    setTimeout(() => setNotificationSent(false), 3000);
  };

  const getRiskColor = (level: RiskLevel) => {
    switch (level) {
      case RiskLevel.HIGH: return 'text-red-700 bg-red-50 border-red-200 ring-4 ring-red-50/50';
      case RiskLevel.MEDIUM: return 'text-amber-700 bg-amber-50 border-amber-200 ring-4 ring-amber-50/50';
      case RiskLevel.LOW: return 'text-emerald-700 bg-emerald-50 border-emerald-200 ring-4 ring-emerald-50/50';
    }
  };

  return (
    <div className="p-10 max-w-[1600px] mx-auto animate-fade-in font-sans">
      <Link 
        to="/students" 
        className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-8 transition-colors group font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 rounded"
        aria-label="Return to students directory"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" aria-hidden="true" /> BACK TO DIRECTORY
      </Link>

      {/* Hero Header */}
      <div className="bg-gradient-to-br from-white via-slate-50/30 to-white rounded-[2rem] shadow-2xl border border-slate-200/50 p-8 lg:p-10 mb-10 relative overflow-hidden group card-hover">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-ku-100/30 via-emerald-100/20 to-transparent rounded-full -mr-32 -mt-32 z-0 pointer-events-none blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-100/20 to-transparent rounded-full -ml-24 -mb-24 z-0 pointer-events-none blur-3xl"></div>
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
          <div className="flex items-center gap-8">
              <div className="relative group-hover:scale-105 transition-transform duration-500">
              <div className="relative">
                <div className="w-36 h-36 rounded-[2rem] bg-gradient-to-br from-white to-slate-100 shadow-2xl shadow-slate-300/50 border-4 border-white flex items-center justify-center ring-4 ring-slate-100/50">
                  <span className="text-5xl font-black text-slate-600">{(student.studentNumber || 'S').charAt(0).toUpperCase()}</span>
                </div>
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className={`absolute -bottom-3 -right-3 p-3 rounded-2xl border-4 border-white shadow-xl ring-4 ring-slate-100/50 ${
                riskProfile.riskLevel === RiskLevel.HIGH 
                  ? 'bg-gradient-to-br from-red-500 to-red-600' 
                  : riskProfile.riskLevel === RiskLevel.MEDIUM 
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600' 
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
              }`}>
                {riskProfile.riskLevel === RiskLevel.HIGH ? (
                  <AlertTriangle size={22} className="text-white" fill="currentColor" />
                ) : (
                  <CheckCircle size={22} className="text-white" strokeWidth={3} />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent tracking-tighter mb-3">{student.studentNumber}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-600 text-sm font-bold">
                <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>{student.course}</span>
                <span className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">Year {student.yearOfStudy}</span>
                {student.semesterOfStudy && (
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 text-blue-700 shadow-sm">
                    <Calendar size={14} className="text-blue-600" />
                    Semester {student.semesterOfStudy}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {canViewRisk && riskProfile && (
            <div className="flex flex-col items-end gap-3">
              <div className={`px-6 py-3 rounded-2xl border font-black flex items-center gap-2 shadow-sm ${getRiskColor(riskProfile.riskLevel)}`}>
                {riskProfile.riskLevel} Risk Profile
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Risk Score: <span className="text-slate-700">{riskProfile.riskScore}/100</span></p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Stats */}
        <div className="lg:col-span-4 space-y-8">

          {/* Academic Details */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 transition-all hover:shadow-2xl card-hover">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-3 text-lg">
              <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-200"><GraduationCap size={22} /></div>
              Academic Details
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <Hash size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Student Number</p>
                  <p className="text-sm font-mono font-semibold text-slate-900">
                    {student.studentNumber || 'Not provided'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <BookOpen size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Course</p>
                  <p className="text-sm font-semibold text-slate-900">{student.course || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <Calendar size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Year of Study</p>
                  <p className="text-sm font-semibold text-slate-900">Year {student.yearOfStudy || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <Calendar size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Semester of Study</p>
                  <p className="text-sm font-semibold text-slate-900">{student.semesterOfStudy ? `Semester ${student.semesterOfStudy}` : 'Not specified'}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <BookOpen size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GPA</p>
                  <p className="text-lg font-black text-slate-900">{(student.gpa || 0).toFixed(2)} / 5.0</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <Clock size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Attendance</p>
                  <p className="text-lg font-black text-slate-900">{student.attendance || 0}%</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                <DollarSign size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                  <p className="text-lg font-black text-slate-900">
                    {(student.balance || 0).toLocaleString()} <span className="text-xs font-semibold text-slate-500">UGX</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 transition-all hover:shadow-2xl card-hover">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-3 text-lg">
              <div className="p-3 bg-gradient-to-br from-ku-100 to-ku-50 text-ku-600 rounded-xl shadow-sm border border-ku-200"><BookOpen size={22} /></div>
              Academic Pulse
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                    <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">GPA</span>
                    <span className="text-3xl font-black text-slate-900">{student.gpa || 0}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all duration-1000 ${(student.gpa || 0) < 2.5 ? 'bg-red-500' : 'bg-ku-600'}`} style={{ width: `${((student.gpa || 0) / 5) * 100}%` }}></div>
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-50">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Attendance</span>
                    <span className="text-3xl font-black text-slate-900">{student.attendance || 0}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all duration-1000 ${(student.attendance || 0) < 75 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${student.attendance || 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 transition-all hover:shadow-2xl card-hover">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-3 text-lg">
              <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 rounded-xl shadow-sm border border-emerald-200"><DollarSign size={22} /></div>
              Financial Health
            </h3>
            <div>
               <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Outstanding Balance</p>
               <p className="text-3xl font-black text-slate-900 tracking-tight">{(student.balance || 0).toLocaleString()} <span className="text-sm font-bold text-slate-400">UGX</span></p>
            </div>
          </div>
        </div>

        {/* Middle Column: Actions */}
        <div className="lg:col-span-8 space-y-8">
           {/* Actions Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Communication */}
               <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 card-hover">
                  <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl text-slate-600 shadow-sm border border-slate-200"><MessageSquare size={20} /></div> Quick Actions
                  </h4>
                  
                  <div className="space-y-4">
                     <button 
                       onClick={sendAlert}
                       aria-label="Send email warning to student"
                       className="w-full group flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-ku-500 hover:bg-ku-50 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
                     >
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-600 group-hover:text-ku-600 transition-colors">
                            <Mail size={18} aria-hidden="true" />
                         </div>
                         <div className="text-left">
                           <span className="block text-sm font-bold text-slate-900 group-hover:text-ku-800">Email Warning</span>
                           <span className="text-xs text-slate-500">Official template</span>
                         </div>
                       </div>
                       <ChevronDown size={16} className="text-slate-300 -rotate-90 group-hover:text-ku-400" aria-hidden="true" />
                     </button>
                     
                     <button 
                       onClick={sendAlert}
                       aria-label="Send SMS alert to student"
                       className="w-full group flex items-center justify-between p-4 rounded-2xl border border-slate-200 hover:border-ku-500 hover:bg-ku-50 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2"
                     >
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-600 group-hover:text-ku-600 transition-colors">
                            <Clock size={18} aria-hidden="true" />
                         </div>
                         <div className="text-left">
                           <span className="block text-sm font-bold text-slate-900 group-hover:text-ku-800">SMS Alert</span>
                           <span className="text-xs text-slate-500">Immediate delivery</span>
                         </div>
                       </div>
                       <ChevronDown size={16} className="text-slate-300 -rotate-90 group-hover:text-ku-400" aria-hidden="true" />
                     </button>
                  </div>
                  {notificationSent && (
                    <div className="mt-4 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                      <CheckCircle size={16} /> Alert dispatched successfully.
                    </div>
                  )}
               </div>

               {/* Log Intervention */}
               <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-8 card-hover">
                  <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
                     <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl text-slate-600 shadow-sm border border-slate-200"><Calendar size={20} /></div> Log Intervention
                  </h4>
                  <div className="space-y-4">
                    <label htmlFor="intervention-note" className="sr-only">
                      Intervention notes
                    </label>
                    <textarea
                      id="intervention-note"
                      value={interventionNote}
                      onChange={(e) => setInterventionNote(e.target.value)}
                      placeholder="Record counseling details, meeting notes, or academic plans..."
                      aria-label="Intervention notes"
                      className="w-full p-4 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 outline-none resize-none transition-all placeholder:text-slate-400"
                      rows={5}
                    />
                    <button 
                      onClick={handleAddIntervention}
                      disabled={!interventionNote}
                      aria-label="Save intervention record"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 hover:shadow-lg transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 active:translate-y-0"
                    >
                      <Send size={16} aria-hidden="true" /> Save Record
                    </button>
                  </div>
               </div>
           </div>

           {/* Timeline History */}
           <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 p-10 card-hover">
             <h3 className="font-bold text-slate-800 mb-8 text-xl">Case History</h3>
             
             {interventions && interventions.length > 0 ? (
               <div className="relative space-y-0 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100">
                 {interventions.map((int) => (
                   <div key={int.id} className="relative flex gap-8 pb-10 last:pb-0">
                     <div className="absolute left-0 top-0 mt-1.5 ml-3 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-[3px] border-ku-500 z-10 shadow-[0_0_0_4px_white]"></div>
                     <div className="flex-1 bg-slate-50/50 rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
                       <div className="flex justify-between items-start mb-3">
                         <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 uppercase tracking-wide shadow-sm">
                            {int.type}
                         </span>
                         <span className="text-xs text-slate-400 font-mono font-medium">{int.date}</span>
                       </div>
                       <p className="text-slate-700 leading-relaxed text-sm">{int.notes}</p>
                       <button 
                         onClick={() => toggleInterventionStatus(int.id)}
                         aria-label={`Mark intervention as ${int.status === 'Pending' ? 'completed' : 'pending'}`}
                         className="mt-4 flex items-center gap-2 pt-4 border-t border-slate-200/50 group cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ku-500 focus:ring-offset-2 rounded"
                       >
                          <span className="flex h-2 w-2 relative">
                            {int.status === 'Pending' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${int.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                          </span>
                          <span className={`text-xs font-bold uppercase tracking-wide transition-colors ${int.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {int.status} <span className="text-slate-400 font-medium ml-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">(Click to toggle)</span>
                          </span>
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-16 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                 <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <Clock size={32} />
                 </div>
                 <p className="text-slate-600 font-bold text-lg">No history recorded</p>
                 <p className="text-sm text-slate-400 mt-1">Interventions and notes will appear here.</p>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;