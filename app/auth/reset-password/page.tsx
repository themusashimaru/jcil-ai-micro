'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { updatePassword } from '@/lib/supabase/auth';
import PasswordStrengthIndicator from '@/app/components/PasswordStrengthIndicator';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if we have the required token/code
  const hasToken = searchParams.get('code') || searchParams.get('token');
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
    // Check for Supabase error parameters first
    if (errorParam) {
      if (errorCode === 'otp_expired') {
        setError('This password reset link has expired. Please request a new one.');
      } else if (errorDescription) {
        setError(decodeURIComponent(errorDescription));
      } else {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    } else if (!hasToken) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
    }
  }, [hasToken, errorParam, errorCode, errorDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await updatePassword(password);
      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login?message=Password updated successfully. Please sign in.');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md">
          <div className="glass-morphism rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Updated!</h2>
            <p className="text-gray-400 mb-6">
              Your password has been successfully updated. Redirecting to login...
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-black rounded-lg px-6 py-3 font-medium hover:bg-gray-200 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="glass-morphism rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Reset Password
            </h1>
            <p className="text-gray-400">
              Enter your new password below
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm mb-3">{error}</p>
              {(errorParam || !hasToken) && (
                <Link
                  href="/forgot-password"
                  className="inline-block text-sm text-red-300 hover:text-red-100 font-medium underline"
                >
                  Request a new password reset link →
                </Link>
              )}
            </div>
          )}

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading || !hasToken || !!errorParam}
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading || !hasToken || !!errorParam}
                required
                minLength={8}
              />
            </div>

            {/* Password Strength Indicator */}
            {(password || confirmPassword) && (
              <div className="-mt-2">
                <PasswordStrengthIndicator
                  password={password}
                  confirmPassword={confirmPassword}
                  showMatchStatus={true}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !hasToken}
              className="w-full bg-white text-black rounded-lg px-4 py-3 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          {/* Back to Login */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Remember your password?{' '}
            <Link
              href="/login"
              className="text-white hover:text-gray-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-white transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
