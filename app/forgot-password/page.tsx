'use client';

import { useState } from 'react';
import Link from 'next/link';
import { resetPassword } from '@/lib/supabase/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-2">CHECK YOUR EMAIL</h2>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              We&apos;ve sent you a password reset link. Click it to create a new password.
            </p>
            <Link
              href="/login"
              className="inline-block border border-accent bg-accent/10 px-6 py-3 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="w-full max-w-md relative z-10">
        <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="font-bebas text-3xl sm:text-4xl tracking-tight text-foreground mb-2">FORGOT PASSWORD?</h1>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Enter your email for a reset link</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-background border border-border/40 font-mono text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-accent transition-colors"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-accent bg-accent/10 px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
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
