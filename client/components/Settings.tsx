import React, { useState, useRef } from 'react';
import { Student, RiskLevel, SystemSettings } from '../types';
import { UserPlus, Save, CheckCircle, Upload, FileText, Loader2, CloudUpload, ArrowRight, Settings as SettingsIcon, ShieldAlert, Bell, Database, Mail, Smartphone, DollarSign, RefreshCw, Server } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface SettingsProps {
  onAddStudent: (student: Student) => void;
  onAddStudents: (students: Student[]) => void;
  settings: SystemSettings;
  onUpdateSettings: (settings: SystemSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ onAddStudent, onAddStudents, settings, onUpdateSettings }) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'enrollment' | 'thresholds' | 'preferences'>('enrollment');
  
  // Local state for editing to prevent excessive re-renders, sync on save/change
  const [localThresholds, setLocalThresholds] = useState(settings.thresholds);
  const [localPreferences, setLocalPreferences] = useState(settings.preferences);

  // Generate semester options - only 1 and 2
  const generateSemesterOptions = () => {
    return ['1', '2'];
  };

  const semesterOptions = generateSemesterOptions();

  // -- Enrollment State --
  const [formData, setFormData] = useState({
    studentId: '',
    program: '',
    year: '1',
    semester: (semesterOptions[0] || '1') as '1' | '2',
    gpa: '',
    attendanceRate: '',
    financialStatus: 'CLEAR',
    tuitionBalance: '0'
  });
  const [success, setSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingFromServer, setIsImportingFromServer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Official Kampala University Programs (as per university catalog)
  const programs = [
    // Health Sciences
    'Nursing',
    'Midwifery',
    
    // Sciences
    'Industrial Visual Comm Design',
    'Integrated Science',
    'Science in Agriculture',
    'Science in Agric with Educ',
    'Science with Education',
    'Environmental Scie & Tech',
    'Agriculture & Comm Dev\'t',
    'Science in Oil & Gas Mgt',
    
    // Computer & Technology
    'Computer Scie & Inf Techn',
    'CISCO-CCNA',
    
    // Business & Management
    'Business Administration',
    'Business Computing',
    'Economics',
    'Leisure, Tourism & Hotel Mgt',
    'Human Resource Mgt',
    'Credit Management',
    'Procurement & Supply Chn Mgt',
    'Islamic Banking',
    
    // Arts & Design
    'Industrial Art & Design',
    'Fashion Design',
    'Interior Design',
    'Interior & Landscape Design',
    
    // Social Sciences
    'Journalism & Mass Comm',
    'Social Work & Soc Admin',
    'Public Administration',
    'Political Science',
    'International Relations',
    'Development Studies',
    'Guidance & Counselling',
    'Arts with Education',
    
    // Education
    'Primary Education',
    'Education Secondary (Arts)',
    'Education Secondary (Sci)',
    'Early Childhood Dev\'t',
    'Early Childhood Educ',
    'Special Needs Educ',
    
    // Other Programs
    'Film Making',
    'English Course',
    'Administrative & Sec Studies',
    'Pre-University/ Bridge Course',
    'Higher Education Certificate',
    'Library, Archives & Records Mgt',
    
    // Short Courses
    'Industrial art and design (Short Course)',
    'Business management/marketing (Short Course)',
    'Agriculture and natural science (Short Course)',
    'Arts and social science (Short Course)',
    'Sports Science (Short Course)',
    'Nursing and healthcare science (Short Course)',
    'Filming (Short Course)'
  ];

  // -- Handlers --

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.name === 'studentId' ? e.target.value.toUpperCase() : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const studentIdTrimmed = formData.studentId.trim();
    if (!studentIdTrimmed) {
      addToast('Student number is required', 'error');
      return;
    }

    // Validate student number starts with "KU"
    if (!studentIdTrimmed.toUpperCase().startsWith('KU')) {
      addToast('Student number must start with "KU" (e.g., KU0099567890)', 'error');
      return;
    }

    if (!formData.program || formData.program.trim() === '') {
      addToast('Academic program is required', 'error');
      return;
    }

    // Validate GPA range
    const gpaValue = parseFloat(formData.gpa) || 0;
    if (gpaValue < 0 || gpaValue > 5) {
      addToast('GPA must be between 0 and 5', 'error');
      return;
    }

    // Validate attendance range
    const attendanceValue = parseInt(formData.attendanceRate) || 0;
    if (attendanceValue < 0 || attendanceValue > 100) {
      addToast('Attendance must be between 0 and 100', 'error');
      return;
    }

    setIsSubmitting(true);
    setSuccess(false);

    const studentNumber = studentIdTrimmed.toUpperCase();
    
    const newStudent: Student = {
      id: Date.now().toString(),
      // Only allowed fields
      studentNumber,
      course: formData.program.trim(),
      yearOfStudy: parseInt(formData.year) || 1,
      semesterOfStudy: (formData.semester === '1' || formData.semester === '2') ? formData.semester as '1' | '2' : '1',
      gpa: gpaValue,
      attendance: attendanceValue,
      balance: parseInt(formData.tuitionBalance) || 0,
    };

    // Call the parent handler which will make the API call
    // The parent handles errors internally, so we just show success here
    onAddStudent(newStudent);
    
    setSuccess(true);
    addToast('Student enrolled successfully', 'success');
    
    // Reset form
    setFormData({
      studentId: '',
      program: '',
      year: '1',
      semester: (semesterOptions[0] || '1') as '1' | '2',
      gpa: '',
      attendanceRate: '',
      financialStatus: 'CLEAR',
      tuitionBalance: '0'
    });
    
    // Reset loading state after a short delay
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccess(false);
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isCsv =
      file.type === 'text/csv' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.toLowerCase().endsWith('.csv');

    if (!isPdf && !isCsv) {
      addToast('Please upload a PDF or CSV file with student details.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    if (isPdf) {
      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setIsUploading(false);
        addToast('PDF file size exceeds 10MB limit. Please upload a smaller file.', 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      
      try {
        addToast('Scanning PDF document and extracting student data...', 'info');
        
        // Import PDF parser
        const { processPdfFile } = await import('../services/pdfParser');
        
        // Process PDF and extract student data
        const csvContent = await processPdfFile(file);
        
        if (!csvContent || csvContent.trim().length === 0) {
          throw new Error('No student data could be extracted from the PDF');
        }
        
        addToast('PDF processed successfully. Uploading extracted data...', 'success');
        
        // Import uploadCsvFile function
        const { uploadCsvFile } = await import('../services/apiService');
        
        // Upload extracted CSV data to server
        const result = await uploadCsvFile(csvContent);
        
        // Handle response (same as CSV upload)
        const summary = result.summary || {
          totalRows: (result as any).total || 0,
          totalProcessed: (result as any).total || 0,
          studentsCreated: (result as any).created || (result as any).inserted || 0,
          studentsUpdated: (result as any).updated || 0,
          duplicatesMerged: result.details?.merged || 0,
          rowsSkipped: (result as any).skipped || 0,
        };
        
        setUploadCount(summary.totalProcessed);
        setIsUploading(false);
        setUploadSuccess(true);
        
        // Fetch updated students from server and save to localStorage
        try {
          const { getStudents } = await import('../services/apiService');
          const updatedStudents = await getStudents();
          if ((updatedStudents as any).length > 0) {
            // Save to localStorage as cache (used as fallback)
            localStorage.setItem('ku_students_cache', JSON.stringify(updatedStudents));
            localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
            console.log(`✅ Saved ${(updatedStudents as any[]).length} students to localStorage cache`);
          }
        } catch (fetchError) {
          console.warn('Failed to fetch updated students after PDF import:', fetchError);
          // Continue anyway - server CSV is already updated
        }
        
        // Build comprehensive message
        let message = `PDF Import Complete: ${summary.totalProcessed} of ${summary.totalRows} students processed`;
        const parts: string[] = [];
        if (summary.studentsCreated > 0) {
          parts.push(`${summary.studentsCreated} new student${summary.studentsCreated !== 1 ? 's' : ''}`);
        }
        if (summary.studentsUpdated > 0) {
          parts.push(`${summary.studentsUpdated} updated`);
        }
        if (summary.duplicatesMerged > 0) {
          parts.push(`${summary.duplicatesMerged} duplicate${summary.duplicatesMerged !== 1 ? 's' : ''} merged`);
        }
        if (summary.rowsSkipped > 0) {
          parts.push(`${summary.rowsSkipped} skipped`);
        }
        
        if (parts.length > 0) {
          message += ` (${parts.join(', ')})`;
        }
        message += '. Student Directory and Registry Dashboard updated.';
        
        addToast(message, 'success');
        
        // Show detailed merge information if available
        if (result.details?.mergeDetails && result.details.mergeDetails.length > 0) {
          console.log('Duplicate merge details:', result.details.mergeDetails);
          if (result.details.mergeDetails.length <= 5) {
            addToast(`${result.details.mergeDetails.length} duplicate row(s) were merged into existing profiles`, 'info');
          } else {
            addToast(`${result.details.mergeDetails.length} duplicate rows were merged. Check console for details.`, 'info');
          }
        }
        
        if (result.errors && result.errors.length > 0) {
          console.warn('PDF import had some errors:', result.errors);
          addToast(`${result.errors.length} row(s) had errors. Check console for details.`, 'warning');
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setUploadSuccess(false), 5000);
        
        // Note: Student Directory and Registry Dashboard will automatically refresh via socket.io 'students:imported' event
        // No need to reload the page - the App.tsx socket handler will update the student list
      } catch (err: any) {
        console.error('PDF processing error', err);
        setIsUploading(false);
        const errorMessage = err?.message || 'Failed to process PDF file. Please ensure the PDF contains a readable class list.';
        addToast(errorMessage, 'error');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    if (isCsv) {
      addToast('Uploading CSV file to server...', 'info');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const csvContent = (reader.result as string) || '';
          
          if (!csvContent.trim()) {
            throw new Error('CSV file is empty');
          }

          // Import uploadCsvFile function
          const { uploadCsvFile } = await import('../services/apiService');
          
          // Upload to server - server will process and automatically update exports/students.csv
          const result = await uploadCsvFile(csvContent);
          
          // Handle both new and legacy response formats for backward compatibility
          const summary = result.summary || {
            totalRows: (result as any).total || 0,
            totalProcessed: (result as any).total || 0,
            studentsCreated: (result as any).created || (result as any).inserted || 0,
            studentsUpdated: (result as any).updated || 0,
            duplicatesMerged: result.details?.merged || 0,
            rowsSkipped: (result as any).skipped || 0,
          };
          
          setUploadCount(summary.totalProcessed);
          setIsUploading(false);
          setUploadSuccess(true);
          
          // Fetch updated students from server and save to localStorage
          try {
            const { getStudents } = await import('../services/apiService');
            const updatedStudents = await getStudents();
            if ((updatedStudents as any).length > 0) {
              // Save to localStorage as cache (used as fallback)
              localStorage.setItem('ku_students_cache', JSON.stringify(updatedStudents));
              localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
              console.log(`✅ Saved ${(updatedStudents as any[]).length} students to localStorage cache`);
            }
          } catch (fetchError) {
            console.warn('Failed to fetch updated students after CSV import:', fetchError);
            // Continue anyway - server CSV is already updated
          }
          
          // Build comprehensive message
          let message = `CSV Import Complete: ${summary.totalProcessed} of ${summary.totalRows} rows processed`;
          const parts: string[] = [];
          if (summary.studentsCreated > 0) {
            parts.push(`${summary.studentsCreated} new student${summary.studentsCreated !== 1 ? 's' : ''}`);
          }
          if (summary.studentsUpdated > 0) {
            parts.push(`${summary.studentsUpdated} updated`);
          }
          if (summary.duplicatesMerged > 0) {
            parts.push(`${summary.duplicatesMerged} duplicate${summary.duplicatesMerged !== 1 ? 's' : ''} merged`);
          }
          if (summary.rowsSkipped > 0) {
            parts.push(`${summary.rowsSkipped} skipped`);
          }
          
          if (parts.length > 0) {
            message += ` (${parts.join(', ')})`;
          }
          message += '. Server CSV and client cache updated.';
          
          addToast(message, 'success');
          
          // Show detailed merge information if available
          if (result.details?.mergeDetails && result.details.mergeDetails.length > 0) {
            console.log('Duplicate merge details:', result.details.mergeDetails);
            if (result.details.mergeDetails.length <= 5) {
              addToast(`${result.details.mergeDetails.length} duplicate row(s) were merged into existing profiles`, 'info');
            } else {
              addToast(`${result.details.mergeDetails.length} duplicate rows were merged. Check console for details.`, 'info');
            }
          }
          
          if (result.errors && result.errors.length > 0) {
            console.warn('CSV import had some errors:', result.errors);
            addToast(`${result.errors.length} row(s) had errors. Check console for details.`, 'warning');
          }
          
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTimeout(() => setUploadSuccess(false), 5000);
          
          // Note: Student Directory will automatically refresh via socket.io 'students:imported' event
          // No need to reload the page - the App.tsx socket handler will update the student list
        } catch (err: any) {
          console.error('CSV upload error', err);
          setIsUploading(false);
          const errorMessage = err?.response?.data?.error || err?.message || 'Failed to upload CSV file';
          addToast(errorMessage, 'error');
        }
      };
      reader.readAsText(file);
    }
  };

  // Import from server CSV file (server/exports/students.csv)
  const handleImportFromServerCsv = async () => {
    setIsImportingFromServer(true);
    try {
      addToast('Importing from server CSV file...', 'info');
      
      // Import the function
      const { importFromServerCsv } = await import('../services/apiService');
      
      // Import from server CSV
      const result = await importFromServerCsv();
      
      // Handle response
      const summary = result.summary || {
        totalRows: 0,
        totalProcessed: 0,
        studentsCreated: 0,
        studentsUpdated: 0,
        rowsSkipped: 0,
      };
      
      // Build comprehensive message
      let message = `Server CSV Import Complete: ${summary.totalProcessed} of ${summary.totalRows} rows processed`;
      const parts: string[] = [];
      if (summary.studentsCreated > 0) {
        parts.push(`${summary.studentsCreated} new student${summary.studentsCreated !== 1 ? 's' : ''}`);
      }
      if (summary.studentsUpdated > 0) {
        parts.push(`${summary.studentsUpdated} updated`);
      }
      if (summary.rowsSkipped > 0) {
        parts.push(`${summary.rowsSkipped} skipped`);
      }
      
      if (parts.length > 0) {
        message += ` (${parts.join(', ')})`;
      }
      message += '. Database and client updated.';
      
      addToast(message, 'success');
      
      // Fetch updated students from server and update client
      try {
        const { getStudents } = await import('../services/apiService');
        const updatedStudents = await getStudents();
        const studentsArray = Array.isArray(updatedStudents) 
          ? updatedStudents 
          : (updatedStudents as any).students || [];
        
        if (studentsArray.length > 0) {
          // Update parent component's students list
          onAddStudents(studentsArray);
          
          // Save to localStorage as cache
          localStorage.setItem('ku_students_cache', JSON.stringify(studentsArray));
          localStorage.setItem('ku_students_cache_timestamp', new Date().toISOString());
          
          addToast(`Client updated: ${studentsArray.length} student${studentsArray.length !== 1 ? 's' : ''} loaded`, 'success');
        }
      } catch (fetchError) {
        console.warn('Failed to fetch updated students after server CSV import:', fetchError);
        addToast('Import completed, but failed to refresh client. Please refresh the page.', 'warning');
      }
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Server CSV import had some errors:', result.errors);
        if (result.errors.length <= 5) {
          result.errors.forEach(err => addToast(err, 'warning'));
        } else {
          addToast(`${result.errors.length} row(s) had errors. Check console for details.`, 'warning');
        }
      }
    } catch (err: any) {
      console.error('Server CSV import error', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to import from server CSV file';
      addToast(errorMessage, 'error');
    } finally {
      setIsImportingFromServer(false);
    }
  };

  const handleSaveSettings = () => {
    onUpdateSettings({
      thresholds: localThresholds,
      preferences: localPreferences
    });
    addToast('System configuration saved successfully', 'success');
  };

  return (
    <div className="p-10 max-w-[1200px] mx-auto font-sans animate-fade-in pb-20">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Administration</h2>
          <p className="text-slate-500 mt-2 text-lg">Configure enrollment, risk parameters, and system behaviors.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
        <button
          onClick={() => setActiveTab('enrollment')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'enrollment' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <UserPlus size={18} /> Enrollment
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'thresholds' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <ShieldAlert size={18} /> Risk Thresholds
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'preferences' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <SettingsIcon size={18} /> Preferences
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="space-y-8">
        
        {/* -- ENROLLMENT TAB -- */}
        {activeTab === 'enrollment' && (
          <div className="animate-fade-in space-y-10">
            {/* Import from Server CSV */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[2.5rem] shadow-2xl overflow-hidden text-white relative border border-emerald-500/50 group">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full -mr-40 -mt-40 pointer-events-none blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400 opacity-20 rounded-full -ml-20 -mb-20 pointer-events-none blur-3xl"></div>
                
                <div className="p-10 relative z-10 flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                        <Server size={24} className="text-emerald-200" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">Import from Server CSV</h3>
                    </div>
                    <p className="text-emerald-100 text-lg leading-relaxed max-w-xl">
                      Import students directly from <code className="bg-white/20 px-2 py-1 rounded text-sm font-mono">server/exports/students.csv</code>. This will update the entire database and refresh the client site automatically.
                    </p>
                    <div className="mt-8 flex items-center gap-4 text-sm font-medium text-emerald-200 bg-black/20 p-4 rounded-xl border border-white/5 w-fit">
                      <Database size={20} />
                      <span>Updates database and client instantly</span>
                    </div>
                  </div>

                  <div className="w-full md:w-[400px]">
                    <button
                      onClick={handleImportFromServerCsv}
                      disabled={isImportingFromServer}
                      className="w-full h-64 bg-white/10 hover:bg-white/20 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 shadow-xl hover:shadow-2xl border-4 border-transparent hover:border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md"
                    >
                      {isImportingFromServer ? (
                        <>
                          <Loader2 size={48} className="animate-spin text-white" />
                          <p className="font-bold text-xl">Importing...</p>
                          <p className="text-emerald-100 text-sm">Updating database and client</p>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <RefreshCw size={32} className="text-emerald-600" />
                          </div>
                          <div className="text-center">
                            <span className="font-bold text-lg block text-white">Import from Server CSV</span>
                            <span className="text-emerald-100 text-sm">Click to import from server/exports/students.csv</span>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                </div>
            </div>

            {/* PDF Upload */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] shadow-2xl overflow-hidden text-white relative border border-indigo-500/50 group">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full -mr-40 -mt-40 pointer-events-none blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-ku-500 opacity-20 rounded-full -ml-20 -mb-20 pointer-events-none blur-3xl"></div>
                
                <div className="p-10 relative z-10 flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                        <FileText size={24} className="text-indigo-200" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">Bulk Import via PDF</h3>
                    </div>
                    <p className="text-indigo-100 text-lg leading-relaxed max-w-xl">
                      Upload class lists. The system will scan the document, structure the data, and populate the dashboard instantly.
                    </p>
                    <div className="mt-8 flex items-center gap-4 text-sm font-medium text-indigo-200 bg-black/20 p-4 rounded-xl border border-white/5 w-fit">
                      <CloudUpload size={20} />
                      <span>Supports PDF up to 10MB</span>
                    </div>
                  </div>

                  <div className="w-full md:w-[400px]">
                    {isUploading ? (
                      <div className="bg-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center backdrop-blur-md border border-white/20 h-64">
                        <Loader2 size={48} className="animate-spin mb-6 text-white" />
                        <p className="font-bold text-xl">Processing...</p>
                      </div>
                    ) : uploadSuccess ? (
                      <div className="bg-emerald-500/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center backdrop-blur-md border border-emerald-500/30 h-64 animate-in fade-in zoom-in">
                        <div className="p-4 bg-emerald-500 rounded-full mb-4 shadow-lg shadow-emerald-500/40">
                            <CheckCircle size={32} className="text-white" />
                        </div>
                        <p className="font-bold text-xl">Import Complete!</p>
                        <p className="text-indigo-100 mt-2">Added {uploadCount} students.</p>
                      </div>
                    ) : (
                      <label className="block h-64">
                        <div className="relative h-full bg-white text-slate-800 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-slate-50 transition-all duration-300 shadow-xl group-hover:shadow-2xl border-4 border-transparent hover:border-indigo-200">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <Upload size={32} className="text-indigo-600" />
                            </div>
                            <div className="text-center">
                              <span className="font-bold text-lg block text-slate-800">Select PDF or CSV</span>
                              <span className="text-slate-400 text-sm">Drag and drop or click to browse</span>
                            </div>
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              accept=".pdf,.csv" 
                              onChange={handleFileUpload}
                              className="hidden" 
                            />
                        </div>
                      </label>
                    )}
                  </div>
                </div>
            </div>

            {/* Manual Entry */}
            <div className="bg-white rounded-[2.5rem] shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
                <div className="border-b border-slate-100 p-8 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-ku-600">
                        <UserPlus size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Manual Enrollment</h3>
                        <p className="text-slate-500 text-sm mt-0.5">Add a single student record to the system.</p>
                      </div>
                    </div>
                    {success && (
                      <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl flex items-center gap-2 font-bold text-sm animate-in slide-in-from-right">
                        <CheckCircle size={18} /> Saved Successfully
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10">
                   {/* Fields */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">1</span>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Student Details</h4>
                      </div>
                      <div>
                        <input 
                          required 
                          name="studentId" 
                          value={formData.studentId} 
                          onChange={handleChange} 
                          aria-label="Student number"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all placeholder:text-slate-400 uppercase" 
                          placeholder="KU0099567890" 
                          pattern="KU[A-Z0-9]+"
                          title="Student number must start with KU followed by numbers/letters (e.g., KU0099567890)"
                        />
                        <p className="text-xs text-slate-400 mt-1.5 ml-1">Student number must start with "KU" (e.g., KU0099567890)</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm">2</span>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Academic, Attendance & Financial</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                         <div className="col-span-2">
                            <label htmlFor="program" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                              Academic Program
                            </label>
                            <select 
                              required 
                              id="program"
                              name="program" 
                              value={formData.program} 
                              onChange={handleChange} 
                              aria-label="Academic program"
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all"
                            >
                                <option value="">Select Program... (Required)</option>
                                {programs.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                         </div>
                         <div>
                           <label htmlFor="year" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                             Year of Study
                           </label>
                           <select 
                             id="year"
                             name="year" 
                             value={formData.year} 
                             onChange={handleChange} 
                             aria-label="Year of study"
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all"
                           >
                               {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                           </select>
                         </div>
                         <div>
                           <label htmlFor="semester" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                             Semester
                           </label>
                           <select 
                             id="semester"
                             name="semester" 
                             value={formData.semester} 
                             onChange={handleChange} 
                             aria-label="Semester"
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all"
                           >
                               {semesterOptions.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                           </select>
                         </div>
                         <div>
                           <label htmlFor="gpa" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                             GPA
                           </label>
                           <input 
                             required 
                             type="number" 
                             step="0.1" 
                             min="0" 
                             max="5"
                             id="gpa"
                             name="gpa" 
                             value={formData.gpa} 
                             onChange={handleChange} 
                             aria-label="Grade point average"
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all placeholder:text-slate-400" 
                             placeholder="GPA (0-5)" 
                           />
                           <p className="text-xs text-slate-400 mt-1.5 ml-1">On a scale of 0.0 to 5.0</p>
                         </div>
                         <div>
                           <label htmlFor="attendanceRate" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                             Attendance Rate
                           </label>
                           <input 
                             required 
                             type="number" 
                             min="0" 
                             max="100"
                             id="attendanceRate"
                             name="attendanceRate" 
                             value={formData.attendanceRate} 
                             onChange={handleChange} 
                             aria-label="Attendance percentage"
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all placeholder:text-slate-400" 
                             placeholder="Attendance %" 
                           />
                           <p className="text-xs text-slate-400 mt-1.5 ml-1">Percentage of classes attended</p>
                         </div>
                         <div className="col-span-2">
                           <label htmlFor="tuitionBalance" className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                             Tuition Balance
                           </label>
                           <input 
                             type="number" 
                             min="0"
                             id="tuitionBalance"
                             name="tuitionBalance" 
                             value={formData.tuitionBalance} 
                             onChange={handleChange} 
                             aria-label="Outstanding tuition balance"
                             className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-ku-500/20 focus:border-ku-500 transition-all placeholder:text-slate-400" 
                             placeholder="Balance (UGX)" 
                           />
                           <p className="text-xs text-slate-400 mt-1.5 ml-1">Outstanding balance in Ugandan Shillings</p>
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-8 border-t border-slate-100 flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      aria-label="Save and enroll student"
                      aria-busy={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Enrolling...
                        </>
                      ) : (
                        <>
                          <Save size={20} aria-hidden="true" /> Save & Enroll
                        </>
                      )}
                    </button>
                  </div>
                </form>
            </div>
          </div>
        )}

        {/* -- RISK THRESHOLDS TAB -- */}
        {activeTab === 'thresholds' && (
           <div className="bg-white rounded-[2.5rem] shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden animate-fade-in">
              <div className="p-10 space-y-8">
                 <div className="flex items-start gap-4 p-6 bg-amber-50 rounded-2xl border border-amber-100 mb-6">
                    <ShieldAlert className="text-amber-600 flex-shrink-0" size={24} />
                    <div>
                       <h4 className="font-bold text-amber-900 text-lg">Global Alert Sensitivity</h4>
                       <p className="text-amber-700/80 leading-relaxed mt-1">Adjusting these values will influence how the system classifies "High Risk" students across all departments. Changes take effect immediately on the next analysis cycle.</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                       {/* Academic Performance Section */}
                       <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="text-blue-600" size={20} />
                             </div>
                             <h4 className="font-bold text-slate-900 text-lg">Academic Performance</h4>
                          </div>
                          
                          <div className="space-y-4">
                             <div>
                                <label className="flex justify-between font-bold text-slate-700 mb-2">
                                   <span>Critical GPA Threshold</span>
                                   <span className="text-blue-600 font-black">{localThresholds.criticalGpa.toFixed(1)}</span>
                                </label>
                                <input 
                                   type="range" min="0" max="4" step="0.1" 
                                   value={localThresholds.criticalGpa}
                                   onChange={(e) => setLocalThresholds({...localThresholds, criticalGpa: parseFloat(e.target.value)})}
                                   className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                   <span>0.0</span>
                                   <span className="font-semibold">Minimum Acceptable</span>
                                   <span>4.0</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-3 font-medium leading-relaxed">
                                   Students with GPA below this threshold are automatically flagged as <span className="font-bold text-red-600">High Risk</span> and require immediate academic intervention.
                                </p>
                             </div>
                          </div>
                       </div>

                       {/* Attendance Section */}
                       <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-emerald-100 rounded-lg">
                                <Bell className="text-emerald-600" size={20} />
                             </div>
                             <h4 className="font-bold text-slate-900 text-lg">Attendance Monitoring</h4>
                          </div>
                          
                          <div className="space-y-4">
                             <div>
                                <label className="flex justify-between font-bold text-slate-700 mb-2">
                                   <span>Warning Attendance Level</span>
                                   <span className="text-emerald-600 font-black">{localThresholds.warningAttendance}%</span>
                                </label>
                                <input 
                                   type="range" min="50" max="95" step="1" 
                                   value={localThresholds.warningAttendance}
                                   onChange={(e) => setLocalThresholds({...localThresholds, warningAttendance: parseInt(e.target.value)})}
                                   className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                   <span>50%</span>
                                   <span className="font-semibold">Minimum Acceptable</span>
                                   <span>95%</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-3 font-medium leading-relaxed">
                                   Students with attendance below this percentage trigger a <span className="font-bold text-amber-600">Warning Alert</span>. Continuous monitoring helps identify at-risk students early.
                                </p>
                             </div>
                          </div>
                       </div>

                       {/* Financial Status Section */}
                       <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
                          <div className="flex items-center gap-3 mb-4">
                             <div className="p-2 bg-amber-100 rounded-lg">
                                <DollarSign className="text-amber-600" size={20} />
                             </div>
                             <h4 className="font-bold text-slate-900 text-lg">Financial Status</h4>
                          </div>
                          
                          <div className="space-y-4">
                             <div>
                                <label className="flex justify-between font-bold text-slate-700 mb-2">
                                   <span>Financial Alert Threshold</span>
                                   <span className="text-amber-600 font-black">{localThresholds.financialLimit.toLocaleString()} UGX</span>
                                </label>
                                <input 
                                   type="range" min="0" max="5000000" step="50000" 
                                   value={localThresholds.financialLimit}
                                   onChange={(e) => setLocalThresholds({...localThresholds, financialLimit: parseInt(e.target.value)})}
                                   className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                />
                                <div className="flex justify-between text-xs text-slate-500 mt-1">
                                   <span>0</span>
                                   <span className="font-semibold">Alert Trigger</span>
                                   <span>5,000,000</span>
                                </div>
                                <p className="text-xs text-slate-600 mt-3 font-medium leading-relaxed">
                                   Students with outstanding tuition balance exceeding this amount are flagged for <span className="font-bold text-red-600">Financial Hold</span> and may face registration restrictions.
                                </p>
                                <div className="mt-3 p-3 bg-white/60 rounded-lg border border-amber-200">
                                   <p className="text-xs font-semibold text-amber-900">
                                      Current Threshold: <span className="font-black">{localThresholds.financialLimit.toLocaleString()} UGX</span>
                                   </p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-2xl border-2 border-slate-200 h-fit shadow-lg">
                       <div className="flex items-center gap-3 mb-6">
                          <ShieldAlert className="text-ku-600" size={24} />
                          <h4 className="font-black text-xl text-slate-900">Risk Configuration Summary</h4>
                       </div>
                       
                       <div className="space-y-4">
                          {/* Academic Summary */}
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-blue-900 uppercase tracking-wide">Academic Performance</span>
                                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">Academic</span>
                             </div>
                             <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-blue-900">{localThresholds.criticalGpa.toFixed(1)}</span>
                                <span className="text-sm text-blue-700 font-medium">GPA Threshold</span>
                             </div>
                             <p className="text-xs text-blue-600 mt-2 font-medium">
                                Students below this GPA are flagged as <span className="font-bold">High Risk</span>
                             </p>
                          </div>

                          {/* Attendance Summary */}
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-emerald-900 uppercase tracking-wide">Attendance Monitoring</span>
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Attendance</span>
                             </div>
                             <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-900">{localThresholds.warningAttendance}%</span>
                                <span className="text-sm text-emerald-700 font-medium">Warning Level</span>
                             </div>
                             <p className="text-xs text-emerald-600 mt-2 font-medium">
                                Attendance below this triggers <span className="font-bold">Warning Alert</span>
                             </p>
                          </div>

                          {/* Financial Summary */}
                          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                             <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-amber-900 uppercase tracking-wide">Financial Status</span>
                                <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded">Financial</span>
                             </div>
                             <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-amber-900">{localThresholds.financialLimit.toLocaleString()}</span>
                                <span className="text-sm text-amber-700 font-medium">UGX Threshold</span>
                             </div>
                             <p className="text-xs text-amber-600 mt-2 font-medium">
                                Balance exceeding this triggers <span className="font-bold">Financial Hold</span>
                             </p>
                          </div>
                       </div>

                       <div className="mt-6 pt-6 border-t border-slate-300">
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">
                             <span className="font-bold text-slate-700">Note:</span> These thresholds are applied globally across all departments. Changes take effect immediately on the next risk analysis cycle.
                          </p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 flex justify-end">
                    <button 
                      onClick={handleSaveSettings} 
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      aria-label="Save risk threshold settings"
                    >
                       Save Thresholds
                    </button>
                 </div>
              </div>
           </div>
        )}

        {/* -- PREFERENCES TAB -- */}
        {activeTab === 'preferences' && (
           <div className="bg-white rounded-[2.5rem] shadow-[0_2px_15px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden animate-fade-in">
              <div className="p-10">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-ku-50 rounded-2xl text-ku-600">
                        <Bell size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Notification Preferences</h3>
                        <p className="text-slate-500 text-sm">Manage how and when you receive system alerts.</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                     {/* Channel Configuration */}
                     <div className="space-y-6">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Alert Channels</h4>
                        
                        {/* High Risk SMS */}
                        <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                           <div className="flex items-center gap-4">
                               <div className="p-2 bg-white rounded-lg shadow-sm text-slate-600"><Smartphone size={20} /></div>
                               <div>
                                  <p className="font-bold text-slate-900">SMS Alerts</p>
                                  <p className="text-xs text-slate-500 font-medium">Instant mobile notifications</p>
                               </div>
                           </div>
                           <div 
                              onClick={() => setLocalPreferences(p => ({...p, smsAlerts: !p.smsAlerts}))}
                              className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${localPreferences.smsAlerts ? 'bg-ku-500' : 'bg-slate-200'}`}
                           >
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${localPreferences.smsAlerts ? 'translate-x-5' : 'translate-x-0'}`}></div>
                           </div>
                        </div>

                         {/* High Risk Email */}
                        <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-slate-50/50">
                           <div className="flex items-center gap-4">
                               <div className="p-2 bg-white rounded-lg shadow-sm text-slate-600"><Mail size={20} /></div>
                               <div>
                                  <p className="font-bold text-slate-900">Email Alerts</p>
                                  <p className="text-xs text-slate-500 font-medium">Detailed risk reports</p>
                               </div>
                           </div>
                           <div 
                              onClick={() => setLocalPreferences(p => ({...p, emailAlerts: !p.emailAlerts}))}
                              className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${localPreferences.emailAlerts ? 'bg-ku-500' : 'bg-slate-200'}`}
                           >
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${localPreferences.emailAlerts ? 'translate-x-5' : 'translate-x-0'}`}></div>
                           </div>
                        </div>
                     </div>

                     {/* Triggers */}
                     <div className="space-y-6">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Trigger Conditions</h4>
                        
                        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
                           <label className="flex justify-between font-bold text-slate-700 mb-4">
                              <span>Automatic Alert Threshold</span>
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-sm">Risk Score &gt; {localPreferences.notificationThreshold}</span>
                           </label>
                           <input 
                              type="range" min="50" max="100" step="5" 
                              value={localPreferences.notificationThreshold}
                              onChange={(e) => setLocalPreferences({...localPreferences, notificationThreshold: parseInt(e.target.value)})}
                              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-ku-600"
                           />
                           <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                              System will automatically dispatch alerts via enabled channels when a student's calculated risk score exceeds this value.
                           </p>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
                           <div>
                              <p className="font-bold text-slate-900 text-sm">Daily Digest Summary</p>
                              <p className="text-xs text-slate-500">Consolidated report at 08:00 AM</p>
                           </div>
                           <div 
                              onClick={() => setLocalPreferences(p => ({...p, dailyDigest: !p.dailyDigest}))}
                              className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${localPreferences.dailyDigest ? 'bg-slate-800' : 'bg-slate-200'}`}
                           >
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${localPreferences.dailyDigest ? 'translate-x-4' : 'translate-x-0'}`}></div>
                           </div>
                        </div>
                     </div>
                 </div>

                 <div className="mt-10 pt-8 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={handleSaveSettings} 
                      className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                      aria-label="Save notification preferences"
                    >
                       <Save size={18} aria-hidden="true" /> Save Preferences
                    </button>
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default Settings;