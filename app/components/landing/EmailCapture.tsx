/**
 * EMAIL CAPTURE COMPONENT
 *
 * Newsletter signup with faith-based messaging
 * Includes early access and updates options
 */

'use client';

import { useState } from 'react';

interface EmailCaptureProps {
  variant?: 'inline' | 'card' | 'hero';
  title?: string;
  description?: string;
  buttonText?: string;
  className?: string;
}

export default function EmailCapture({
  variant = 'card',
  title = 'Stay in the Word, stay in the loop',
  description = 'Get updates on new features, faith-based AI insights, and early access to upcoming tools.',
  buttonText = 'Subscribe',
  className = '',
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');

    try {
      // TODO: Implement actual email capture API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus('success');
      setMessage('Welcome to the family! Check your inbox for confirmation.');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-3 ${className}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          aria-label="Email address"
          className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'loading' ? 'Subscribing...' : buttonText}
        </button>
        {status === 'success' && (
          <span className="text-green-400 text-sm self-center">{message}</span>
        )}
        {status === 'error' && <span className="text-red-400 text-sm self-center">{message}</span>}
      </form>
    );
  }

  if (variant === 'hero') {
    return (
      <div className={className}>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            aria-label="Email address"
            className="flex-1 px-4 py-3.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-base"
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-8 py-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {status === 'loading' ? 'Joining...' : 'Get Early Access'}
          </button>
        </form>
        {status === 'success' && (
          <p className="text-green-400 text-sm mt-3 text-center">{message}</p>
        )}
        {status === 'error' && <p className="text-red-400 text-sm mt-3 text-center">{message}</p>}
        <p className="text-slate-500 text-xs mt-4 text-center">No spam, unsubscribe anytime.</p>
      </div>
    );
  }

  // Card variant (default)
  return (
    <div
      className={`bg-gradient-to-br from-amber-950/50 to-amber-900/20 rounded-2xl p-8 lg:p-10 border border-amber-500/20 ${className}`}
    >
      {/* Cross icon */}
      <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-6">
        <svg
          className="w-6 h-6 text-amber-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M6 8h12" />
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-6">{description}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          aria-label="Email address"
          className="w-full px-4 py-3 rounded-lg bg-black/30 border border-amber-500/20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Subscribing...' : buttonText}
        </button>
      </form>

      {status === 'success' && <p className="text-green-400 text-sm mt-4">{message}</p>}
      {status === 'error' && <p className="text-red-400 text-sm mt-4">{message}</p>}

      <p className="text-slate-500 text-xs mt-4">
        By subscribing, you agree to receive emails from JCIL.AI. Unsubscribe anytime.
      </p>
    </div>
  );
}

// Compact banner variant
export function EmailBanner() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="bg-amber-600 text-white text-center py-3 px-4">
        <span className="text-sm font-medium">
          Welcome to the JCIL community! Check your inbox to confirm.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 px-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-3xl mx-auto"
      >
        <span className="text-sm font-medium">Get early access to new features</span>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email"
            aria-label="Email address"
            className="px-3 py-1.5 rounded text-sm text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-black/20 hover:bg-black/30 text-sm font-medium transition-colors"
          >
            Subscribe
          </button>
        </div>
      </form>
    </div>
  );
}
