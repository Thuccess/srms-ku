import React, { useState } from 'react';
import { GraduationCap, ArrowRight, Lock, Mail, Loader2, Info, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('vc@ku.ac.ug');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value && value.length < 4) {
      setPasswordError('Password must be at least 4 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');
    
    // Validate inputs
    let isValid = true;
    if (!email || !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }
    if (!password || password.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      isValid = false;
    }
    
    if (!isValid) {
      return;
    }
    
    setLoading(true);

    try {
      // Authenticate with backend
      await login(email, password);
      // Clear any previous errors
      setError('');
      // On success, call parent's onLogin callback
      // The AuthContext will update isAuthenticated, triggering a re-render
        onLogin();
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid credentials. Please check your email and password.';
      setError(errorMessage);
        setLoading(false);
      console.error('Login failed:', err);
      }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[900px] h-[900px] bg-gradient-to-br from-ku-200/40 to-ku-300/30 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-float -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-gradient-to-tr from-emerald-200/40 to-blue-200/30 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-float -ml-20 -mb-20" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary-200/20 to-ku-200/20 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse-slow"></div>
      </div>

      <div className="glass w-full max-w-md rounded-3xl shadow-2xl border border-white/20 p-8 md:p-10 relative z-10 animate-scale-in">
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 transform transition-transform hover:scale-105 duration-300">
            <img 
              src="/logo.png" 
              alt="Kampala University Logo" 
              className="h-20 w-auto object-contain mx-auto"
              onError={(e) => {
                // Fallback to icon if logo not found
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-16 h-16 bg-gradient-to-br from-ku-500 to-ku-700 rounded-2xl items-center justify-center shadow-lg shadow-ku-500/30 text-white mx-auto hidden">
              <GraduationCap className="w-9 h-9" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 mt-2 font-medium">Sign in to access the Risk Intelligence System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className={`h-5 w-5 transition-colors ${emailError ? 'text-red-500' : 'text-slate-400 group-focus-within:text-ku-600'}`} aria-hidden="true" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={handleEmailChange}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
                className={`w-full pl-11 pr-4 py-3.5 bg-white/80 backdrop-blur-sm border rounded-xl focus:ring-2 focus:ring-ku-500/30 focus:border-ku-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-sm hover:shadow-md ${
                  emailError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                placeholder="admin@ku.ac.ug"
              />
            </div>
            {emailError && (
              <p id="email-error" className="text-xs text-red-600 font-medium flex items-center gap-1.5 mt-1" role="alert">
                <span className="w-1 h-1 rounded-full bg-red-500"></span>
                {emailError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-bold text-slate-700 uppercase tracking-wide">
                Password
              </label>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className={`h-5 w-5 transition-colors ${passwordError ? 'text-red-500' : 'text-slate-400 group-focus-within:text-ku-600'}`} aria-hidden="true" />
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={handlePasswordChange}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? 'password-error' : undefined}
                className={`w-full pl-11 pr-4 py-3.5 bg-white/80 backdrop-blur-sm border rounded-xl focus:ring-2 focus:ring-ku-500/30 focus:border-ku-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 shadow-sm hover:shadow-md ${
                  passwordError 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                placeholder="••••••••"
              />
            </div>
            {passwordError && (
              <p id="password-error" className="text-xs text-red-600 font-medium flex items-center gap-1.5 mt-1" role="alert">
                <span className="w-1 h-1 rounded-full bg-red-500"></span>
                {passwordError}
              </p>
            )}
          </div>

          {error && (
            <div 
              className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-start gap-3 animate-slide-up" 
              role="alert"
              aria-live="polite"
            >
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-bold">{error}</p>
                {error.includes('Cannot connect') && (
                  <p className="text-xs mt-2 text-red-600">
                    Make sure the backend server is running: <code className="bg-red-100 px-1.5 py-0.5 rounded">cd server && npm run dev</code>
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-slate-800 hover:via-slate-700 hover:to-slate-800 text-white rounded-xl font-bold text-lg shadow-xl shadow-slate-900/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 relative overflow-hidden group"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" /> Authenticating...
              </>
            ) : (
              <>
                Sign In <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        {/* Forgot Password Link */}
        <div className="mt-4 text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Forgot your password?
          </Link>
        </div>
        
        {/* Demo Credentials Hint */}
        <div className="mt-8 pt-6 border-t border-slate-200/50">
          <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-ku-50 to-emerald-50 rounded-xl border border-ku-100/50 text-ku-900 text-sm shadow-sm">
            <Info size={18} className="text-ku-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold mb-2">Test Credentials</p>
              <div className="text-ku-700/80 text-xs space-y-1">
                <div><span className="font-semibold">VC:</span> vc@ku.ac.ug / vc123456</div>
                <div><span className="font-semibold">DVC:</span> dvc@ku.ac.ug / dvc123456</div>
                <div><span className="font-semibold">Dean:</span> dean@ku.ac.ug / dean123456</div>
                <div><span className="font-semibold">HOD:</span> hod@ku.ac.ug / hod123456</div>
                <div><span className="font-semibold">Advisor:</span> advisor@ku.ac.ug / advisor123456</div>
                <div><span className="font-semibold">Lecturer:</span> lecturer@ku.ac.ug / lecturer123456</div>
                <div><span className="font-semibold">Registry:</span> registry@ku.ac.ug / registry123456</div>
                <div><span className="font-semibold">Admin:</span> admin@ku.ac.ug / admin123456</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Protected by Kampala University IT Security.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;