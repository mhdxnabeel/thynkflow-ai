'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Countdown timer for resend
  const [resendCountdown, setResendCountdown] = useState(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('thynkflow_token');
    if (token) {
      router.push('/');
    }
  }, [router]);

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Clear errors and success when switching between auth modes
  const handleToggleAuthMode = () => {
    setIsTransitioning(true);
    setError('');
    setSuccess('');
    setPassword('');
    
    setTimeout(() => {
      setIsSignUp(!isSignUp);
      setIsTransitioning(false);
    }, 300);
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed');
      }

      setSuccess('✅ Verification code sent to your email!');
      setError('');
      setShowVerification(true);
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0) return;
    
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Resend failed');
      }

      setSuccess('✅ New verification code sent to your email!');
      setError('');
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
      setSuccess('');
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyEmail = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Verification failed');
      }

      localStorage.setItem('thynkflow_token', data.token);
      localStorage.setItem('thynkflow_user', JSON.stringify(data.user));

      setSuccess('✅ Email verified! Redirecting to dashboard...');
      setError('');
      setIsRedirecting(true);

      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      localStorage.setItem('thynkflow_token', data.token);
      localStorage.setItem('thynkflow_user', JSON.stringify(data.user));

      setSuccess('✅ Login successful! Redirecting...');
      setError('');
      setIsRedirecting(true);

      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
      }

      setSuccess('✅ Reset code sent to your email!');
      setError('');
      setShowResetPassword(true);
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Request failed');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resendCountdown > 0) return;
    
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Resend failed');
      }

      setSuccess('✅ New reset code sent to your email!');
      setError('');
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
      setSuccess('');
    } finally {
      setResendLoading(false);
    }
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          code: resetCode, 
          new_password: newPassword 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Reset failed');
      }

      setSuccess('✅ Password reset successfully! Redirecting to login...');
      setError('');
      
      setTimeout(() => {
        setShowForgotPassword(false);
        setShowResetPassword(false);
        setIsSignUp(false);
        setSuccess('');
        setError('');
        setResetCode('');
        setNewPassword('');
        setEmail('');
        setPassword('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Form
  if (showForgotPassword && !showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg animate-float">
              T
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Forgot Password</h2>
            <p className="text-gray-600 mt-3">Enter your email to receive a reset code</p>
          </div>

          {error && !success && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 animate-shake">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 animate-slide-in">
              {success}
            </div>
          )}

          <div className="space-y-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleForgotPassword()}
              className="w-full px-5 py-4 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-base transition-all"
              required
            />

            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold text-base hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 transform hover:scale-105"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>

            <button
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setSuccess('');
              }}
              className="w-full text-gray-600 hover:text-purple-600 transition-colors text-base flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset Password Form
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg animate-float">
              T
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
            <p className="text-gray-600 mt-3">Enter the code sent to</p>
            <p className="text-purple-600 font-semibold">{email}</p>
          </div>

          {error && !success && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 animate-shake">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 animate-slide-in">
              {success}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="000000"
                value={resetCode}
                onChange={(e) => {
                  setResetCode(e.target.value);
                  setError('');
                }}
                className="w-full px-5 py-4 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-center text-3xl tracking-widest font-mono transition-all"
                maxLength={6}
                required
              />
              
              <div className="mt-3 text-center">
                {resendCountdown > 0 ? (
                  <p className="text-sm text-gray-500">
                    Resend code in {resendCountdown}s
                  </p>
                ) : (
                  <button
                    onClick={handleResendResetCode}
                    disabled={resendLoading}
                    className="text-sm text-purple-600 hover:text-purple-700 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {resendLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Resend Code
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                className="w-full px-5 py-4 pr-12 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-base transition-all"
                required
              />
              <button
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                type="button"
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold text-base hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 transform hover:scale-105"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              onClick={() => {
                setShowResetPassword(false);
                setShowForgotPassword(false);
                setResetCode('');
                setNewPassword('');
                setError('');
                setSuccess('');
              }}
              className="w-full text-gray-600 hover:text-purple-600 transition-colors text-base flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Verification Form
  if (showVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 animate-scale-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg animate-float">
              T
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Verify Email</h2>
            <p className="text-gray-600 mt-3">Enter the 6-digit code sent to</p>
            <p className="text-purple-600 font-semibold">{email}</p>
          </div>

          {error && !success && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 animate-shake">
              {error}
            </div>
          )}

          {success && !error && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 animate-slide-in">
              {success}
            </div>
          )}

          {isRedirecting && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 flex items-center justify-center gap-2 animate-slide-in">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to dashboard...
            </div>
          )}

          <div className="space-y-6">
            <div>
              <input
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyEmail()}
                className="w-full px-5 py-4 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-center text-3xl tracking-widest font-mono transition-all"
                maxLength={6}
                required
                disabled={isRedirecting}
              />
              
              {!isRedirecting && (
                <div className="mt-3 text-center">
                  {resendCountdown > 0 ? (
                    <p className="text-sm text-gray-500">
                      Resend code in {resendCountdown}s
                    </p>
                  ) : (
                    <button
                      onClick={handleResendCode}
                      disabled={resendLoading}
                      className="text-sm text-purple-600 hover:text-purple-700 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          Resend Code
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleVerifyEmail}
              disabled={loading || isRedirecting}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold text-base hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 transform hover:scale-105"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            {!isRedirecting && (
              <button
                onClick={() => {
                  setShowVerification(false);
                  setSuccess('');
                  setError('');
                  setVerificationCode('');
                }}
                className="w-full text-gray-600 hover:text-purple-600 transition-colors text-base flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Sign Up
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Login/Signup Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-purple-50 to-pink-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl">
        <div className="flex flex-col md:flex-row min-h-[650px]">
          {/* Form Section */}
          <div 
            className={`flex-1 p-12 flex flex-col justify-center transition-all duration-700 ease-in-out ${
              isSignUp ? 'md:order-2' : 'md:order-1'
            } ${isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
          >
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg animate-float">
                T
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-2">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              <p className="text-gray-600 text-base">
                {isSignUp ? 'Join ThynkFlow AI today' : 'Welcome back to ThynkFlow AI'}
              </p>
            </div>

            {error && !success && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 animate-shake">
                {error}
              </div>
            )}

            {success && !error && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 animate-slide-in">
                {success}
              </div>
            )}

            {isRedirecting && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 flex items-center justify-center gap-2 animate-slide-in">
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting...
              </div>
            )}

            <div className="space-y-5">
              {isSignUp && (
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="w-full px-5 py-4 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-base transition-all animate-slide-in"
                  required
                  disabled={isRedirecting}
                />
              )}

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full px-5 py-4 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-base transition-all"
                required
                disabled={isRedirecting}
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (isSignUp ? handleSignUp() : handleLogin())}
                  className="w-full px-5 py-4 pr-12 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 text-base transition-all"
                  required
                  disabled={isRedirecting}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  type="button"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {!isSignUp && (
                <div className="text-right">
                  <button
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-purple-600 hover:text-purple-700 transition-colors text-base"
                    type="button"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                onClick={isSignUp ? handleSignUp : handleLogin}
                disabled={loading || isRedirecting}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold text-base hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2 transform hover:scale-105"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
              </button>
            </div>
          </div>

          {/* Toggle Panel */}
          <div 
            className={`flex-1 bg-gradient-to-br from-purple-600 to-pink-600 p-12 text-white flex flex-col justify-center items-center transition-all duration-700 ease-in-out ${
              isSignUp ? 'md:order-1' : 'md:order-2'
            }`}
          >
            <div className={`text-center transition-all duration-500 ${isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
              <h2 className="text-4xl font-bold mb-6">
                {isSignUp ? 'Welcome Back!' : 'Hello, Friend!'}
              </h2>
              <p className="text-lg mb-10 opacity-95 leading-relaxed">
                {isSignUp 
                  ? 'Already have an account? Sign in to continue your creative journey with ThynkFlow AI.' 
                  : 'New to ThynkFlow? Create an account and unlock limitless ideation possibilities.'}
              </p>
              <button
                onClick={handleToggleAuthMode}
                disabled={isRedirecting || loading}
                className="px-10 py-4 border-2 border-white rounded-lg font-semibold text-base hover:bg-white hover:text-purple-600 transition-all shadow-lg disabled:opacity-50 transform hover:scale-105"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        @keyframes slide-in {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-slide-in {
          animation: slide-in 0.4s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}