'use client';

/**
 * CODE LAB ERROR PAGE
 *
 * Segment-level error boundary for the /code-lab route.
 * Shows a code-lab-specific recovery UI with retry and navigation options.
 */

import { useEffect } from 'react';

export default function CodeLabError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CodeLabError] Code Lab page error:', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#6366f1' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Code Lab hit a snag
        </h2>

        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Something went wrong loading Code Lab. Your sessions are saved &mdash; let&apos;s get you
          back to coding.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
            aria-label="Try loading Code Lab again"
          >
            Try Again
          </button>

          <button
            onClick={() => {
              window.location.href = '/code-lab';
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
            aria-label="Reload Code Lab"
          >
            Reload
          </button>

          <button
            onClick={() => (window.location.href = '/chat')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
            aria-label="Go to Chat"
          >
            Go to Chat
          </button>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
