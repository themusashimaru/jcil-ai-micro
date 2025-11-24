'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUpWithEmail } from '@/lib/supabase/auth';
import PasswordStrengthIndicator from '@/app/components/PasswordStrengthIndicator';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'student' as 'student' | 'professional',
    field: '',
    purpose: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [logo, setLogo] = useState<string>('');
  const [isLogoLoading, setIsLogoLoading] = useState(true);

  // Load logo from design settings
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          // Use login_logo, fall back to main_logo
          const logoUrl = settings.login_logo || settings.main_logo;
          if (logoUrl && logoUrl !== '/images/logo.png') {
            setLogo(logoUrl);
          }
        }
      } catch (err) {
        console.error('Failed to load logo:', err);
      } finally {
        setIsLogoLoading(false);
      }
    };
    loadLogo();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setLoading(true);

      // Sign up with Supabase Auth - user record will be created on first login
      await signUpWithEmail(
        formData.email,
        formData.password,
        {
          full_name: formData.full_name,
          role: formData.role,
          field: formData.field,
          purpose: formData.purpose,
        }
      );

      setSuccess(true);

      // Show success message, then redirect
      setTimeout(() => {
        router.push('/login?message=Please check your email to confirm your account');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-md">
          <div className="glass-morphism rounded-2xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Check your email!</h2>
            <p className="text-gray-400">
              We&apos;ve sent you a confirmation link. Click it to activate your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="glass-morphism rounded-2xl p-6 sm:p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            {isLogoLoading ? (
              <div className="h-16 mx-auto" />
            ) : logo ? (
              <img src={logo} alt="JCIL.ai" className="h-16 mx-auto" />
            ) : (
              <h1 className="text-3xl sm:text-4xl font-bold">
                <span className="text-white">JCIL</span>
                <span className="text-blue-500">.ai</span>
              </h1>
            )}
          </div>

          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Create Account
            </h2>
            <p className="text-gray-400">
              Join us today
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
                required
              />
            </div>

            {/* Password Strength Indicator */}
            {(formData.password || formData.confirmPassword) && (
              <div className="-mt-2">
                <PasswordStrengthIndicator
                  password={formData.password}
                  confirmPassword={formData.confirmPassword}
                  showMatchStatus={true}
                />
              </div>
            )}

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
                I am a...
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
              >
                <option value="student" className="bg-black">Student</option>
                <option value="professional" className="bg-black">Professional</option>
              </select>
            </div>

            <div>
              <label htmlFor="field" className="block text-sm font-medium text-gray-300 mb-2">
                Field of Study/Work
              </label>
              <input
                id="field"
                name="field"
                type="text"
                value={formData.field}
                onChange={handleChange}
                placeholder="e.g., Computer Science, Marketing"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="purpose" className="block text-sm font-medium text-gray-300 mb-2">
                Why are you using JCIL.ai?
              </label>
              <textarea
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Tell us how you plan to use JCIL.ai..."
                rows={3}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black rounded-lg px-4 py-3 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
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
