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

  const hasToken = searchParams.get('code') || searchParams.get('token');
  const errorParam = searchParams.get('error');
  const errorCode = searchParams.get('error_code');
  const errorDescription = searchParams.get('error_description');

  useEffect(() => {
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <div className="w-full max-w-md relative z-10">
          <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-6 sm:p-8 text-center">
            <div className="w-16 h-16 border border-accent/40 bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-2">PASSWORD UPDATED</h2>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Your password has been successfully updated. Redirecting to login...
            </p>
            <Link
              href="/login"
              className="inline-block border border-accent bg-accent/10 px-6 py-3 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 bg-background border border-border/40 font-mono text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-accent transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="w-full max-w-md relative z-10">
        <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-bebas text-3xl sm:text-4xl tracking-tight text-foreground mb-2">RESET PASSWORD</h1>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Enter your new password below</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30">
              <p className="font-mono text-xs text-red-400 mb-3">{error}</p>
              {(errorParam || !hasToken) && (
                <Link href="/forgot-password" className="inline-block font-mono text-xs text-accent hover:text-accent/80 underline">
                  Request a new password reset link
                </Link>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className={inputClass}
                disabled={loading || !hasToken || !!errorParam}
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className={inputClass}
                disabled={loading || !hasToken || !!errorParam}
                required
                minLength={8}
              />
            </div>

            {(password || confirmPassword) && (
              <div className="-mt-2">
                <PasswordStrengthIndicator password={password} confirmPassword={confirmPassword} showMatchStatus={true} />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !hasToken}
              className="w-full border border-accent bg-accent/10 px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="text-center font-mono text-xs text-muted-foreground mt-6">
            Remember your password?{' '}
            <Link href="/login" className="text-accent hover:text-accent/80 transition-colors">Sign in</Link>
          </p>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
