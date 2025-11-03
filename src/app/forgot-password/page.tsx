// /src/app/forgot-password/page.tsx

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-2xl bg-white">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" strokeWidth={2} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-slate-900">Check Your Email</h1>
            <CardDescription className="text-center text-slate-600 text-base">
              We've sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-900">
                Click the link in the email to reset your password. The link will expire in 1 hour.
              </p>
            </div>

            <Link href="/login">
              <Button
                variant="outline"
                className="w-full h-12 border-2 border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-all"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </Link>

            <div className="text-center pt-2">
              <button
                onClick={() => setSuccess(false)}
                className="text-sm text-blue-900 hover:text-blue-950 font-medium transition-colors"
              >
                Didn't receive the email? Try again
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md shadow-xl border-slate-200 rounded-2xl bg-white">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex justify-center">
            <img
              src="/jcil-ai-logo.png"
              alt="JCIL.ai"
              className="h-32 w-auto object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-900">Reset Password</h1>
          <CardDescription className="text-center text-slate-600 text-base">
            Enter your email and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-900">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-slate-300 focus:border-blue-900 rounded-lg"
                disabled={loading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Send Reset Link Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-900 hover:bg-blue-950 text-white rounded-lg font-medium transition-all shadow-sm"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>

            {/* Back to Login Link */}
            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}