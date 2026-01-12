'use client';

/**
 * ERROR PAGE
 *
 * Handles errors at the route segment level.
 * Provides a user-friendly error UI with retry capability.
 * Uses theme-aware CSS variables for consistent styling.
 */

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('[Error] Page error:', error);
  }, [error]);

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#ef4444' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Something went wrong
        </h2>

        <p className="mb-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          We encountered an error while loading this page. Please try again.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Try Again
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Go Home
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
