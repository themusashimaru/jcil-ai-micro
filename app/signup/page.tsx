'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signUpWithEmail, signInWithGoogle, signInWithGitHub } from '@/lib/supabase/auth';
import PasswordStrengthIndicator from '@/app/components/PasswordStrengthIndicator';

export default function SignUpPage() {
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logo, setLogo] = useState<string>('');
  const [isLogoLoading, setIsLogoLoading] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    try {
      setError('');
      setGoogleLoading(true);
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
      setGoogleLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    try {
      setError('');
      setGithubLoading(true);
      await signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with GitHub');
      setGithubLoading(false);
    }
  };

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms) {
      setError('Please read and agree to the User Agreement to continue');
      return;
    }

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
      await signUpWithEmail(formData.email, formData.password, {
        full_name: formData.full_name,
        role: formData.role,
        field: formData.field,
        purpose: formData.purpose,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
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
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-2">CHECK YOUR EMAIL</h2>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              We&apos;ve sent a confirmation link to{' '}
              <span className="text-foreground">{formData.email}</span>
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/60 mb-6 uppercase tracking-widest">
              Don&apos;t see it? Check your spam folder.
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
  const labelClass = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4 py-12"
      role="main"
      id="main-content"
    >
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="w-full max-w-md relative z-10">
        <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-6 sm:p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            {isLogoLoading ? (
              <div className="h-12 mx-auto" />
            ) : logo ? (
              <Image src={logo} alt="JCIL.ai" width={180} height={48} className="h-12 w-auto mx-auto" priority />
            ) : (
              <h1 className="font-bebas text-4xl sm:text-5xl tracking-tight">
                <span className="text-accent">JCIL</span>
                <span className="text-muted-foreground">.AI</span>
              </h1>
            )}
          </div>

          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="font-bebas text-3xl sm:text-4xl tracking-tight text-foreground mb-2">CREATE ACCOUNT</h2>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Get started with enterprise AI</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30" role="alert" aria-live="assertive">
              <p className="font-mono text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="full_name" className={labelClass}>Full Name</label>
              <input id="full_name" name="full_name" type="text" value={formData.full_name} onChange={handleChange} placeholder="John Doe" className={inputClass} disabled={loading} required />
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" className={inputClass} disabled={loading} required />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>Password</label>
              <div className="relative">
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="••••••••" className={`${inputClass} pr-12`} disabled={loading} required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <span className="font-mono text-[10px] uppercase">{showPassword ? 'HIDE' : 'SHOW'}</span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm Password</label>
              <div className="relative">
                <input id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" className={`${inputClass} pr-12`} disabled={loading} required />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                  <span className="font-mono text-[10px] uppercase">{showConfirmPassword ? 'HIDE' : 'SHOW'}</span>
                </button>
              </div>
            </div>

            {(formData.password || formData.confirmPassword) && (
              <div className="-mt-2">
                <PasswordStrengthIndicator password={formData.password} confirmPassword={formData.confirmPassword} showMatchStatus={true} />
              </div>
            )}

            <div>
              <label htmlFor="role" className={labelClass}>I am a...</label>
              <select id="role" name="role" value={formData.role} onChange={handleChange} className={inputClass} disabled={loading}>
                <option value="student">Student</option>
                <option value="professional">Professional</option>
              </select>
            </div>

            <div>
              <label htmlFor="field" className={labelClass}>Field of Study/Work</label>
              <input id="field" name="field" type="text" value={formData.field} onChange={handleChange} placeholder="e.g., Computer Science, Marketing" className={inputClass} disabled={loading} />
            </div>

            <div>
              <label htmlFor="purpose" className={labelClass}>Why are you using JCIL.ai?</label>
              <textarea id="purpose" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="Tell us how you plan to use JCIL.ai..." rows={3} className={`${inputClass} resize-none`} disabled={loading} />
            </div>

            {/* User Agreement */}
            <div className="bg-background border border-border/40 p-4">
              <button type="button" onClick={() => setShowAgreement(!showAgreement)} className="w-full flex items-center justify-between text-left" aria-expanded={showAgreement} aria-label="Toggle user agreement details">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">User Agreement & Platform Values</span>
                <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showAgreement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAgreement && (
                <div className="mt-4 font-mono text-xs text-muted-foreground space-y-3 max-h-64 overflow-y-auto">
                  <p className="text-foreground/80 uppercase tracking-widest text-[10px]">Please read before signing up:</p>
                  <div className="space-y-2">
                    <p className="text-foreground/80">1. Age Requirement</p>
                    <p>JCIL.AI is intended for users 18 years of age and older.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground/80">2. Faith Foundation</p>
                    <p>JCIL.AI is built on a biblical Christian worldview. Our platform reflects traditional Christian values while remaining open to all users.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground/80">3. What This Means</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Content moderation maintains a professional, respectful environment</li>
                      <li>Our values inform how we build, not what you can create</li>
                      <li>All users are welcome regardless of background</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground/80">4. Our Commitment</p>
                    <p>Enterprise-grade AI built with integrity. Your data stays private. Your work stays yours.</p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-start gap-3">
                <input type="checkbox" id="agreement" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 h-4 w-4 accent-accent bg-background border-border/40" disabled={loading} />
                <label htmlFor="agreement" className="font-mono text-xs text-muted-foreground">
                  I am 18+ and agree to the{' '}
                  <Link href="/terms" className="text-accent hover:text-accent/80 underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-accent hover:text-accent/80 underline">Privacy Policy</Link>
                </label>
              </div>
            </div>

            <button type="submit" disabled={loading || !agreedToTerms} className="w-full border border-accent bg-accent/10 px-4 py-3 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/30" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-background font-mono text-[10px] uppercase tracking-widest text-muted-foreground">or continue with</span>
            </div>
          </div>

          {/* OAuth */}
          <div className="space-y-3">
            <button onClick={handleGoogleSignUp} disabled={googleLoading || githubLoading || loading} className="w-full flex items-center justify-center gap-3 border border-border/40 px-4 py-3 font-mono text-sm text-foreground hover:border-foreground/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleLoading ? 'Signing up...' : 'Continue with Google'}
            </button>

            <button onClick={handleGitHubSignUp} disabled={githubLoading || googleLoading || loading} className="w-full flex items-center justify-center gap-3 border border-border/40 px-4 py-3 font-mono text-sm text-foreground hover:border-foreground/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              {githubLoading ? 'Signing up...' : 'Continue with GitHub'}
            </button>
          </div>

          {/* Sign In Link */}
          <p className="text-center font-mono text-xs text-muted-foreground mt-6">
            Already have an account?{' '}
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
