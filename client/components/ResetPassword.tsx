import React, { useState, useEffect } from 'react';
import { Lock, ArrowLeft, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    }
  }, [token]);

  const validatePassword = (value: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (value.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(value)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(value)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(value)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      errors.push('Password must contain at least one special character');
    }

    return { isValid: errors.length === 0, errors };
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    const validation = validatePassword(value);
    if (value && !validation.isValid) {
      setPasswordError(validation.errors[0]);
    } else {
      setPasswordError('');
    }
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (value && value !== password) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.errors[0]);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        password,
      });

      setSuccess(true);
      setError('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to reset password. Please try again.';
      setError(errorMessage);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30 flex items-center justify-center p-4">
        <div className="glass w-full max-w-md rounded-3xl shadow-2xl border border-white/20 p-8 md:p-10">
          <div className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h1>
            <p className="text-gray-600 mb-6">
              Your password has been reset successfully. You will be redirected to the login page shortly.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold"
            >
              Go to Login
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="glass w-full max-w-md rounded-3xl shadow-2xl border border-white/20 p-8 md:p-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-primary-500 to-ku-600 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-600">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                  passwordError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="Enter new password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-600">{passwordError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Must contain: 8+ characters, uppercase, lowercase, number, special character
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                className={`w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
                  confirmPasswordError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="Confirm new password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600">{confirmPasswordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-gradient-to-r from-primary-600 to-ku-600 text-white py-3 rounded-xl font-semibold hover:from-primary-700 hover:to-ku-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Resetting Password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

