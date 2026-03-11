'use client';

/**
 * ERROR PAGE
 *
 * Handles errors at the route segment level.
 * Uses hardcoded dark theme colors to ensure buttons are always visible,
 * even before CSS variables load.
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
    console.error('[Error] Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4" style={{ backgroundColor: '#000' }}>
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

        <h2 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>
          Something went wrong
        </h2>

        <p className="mb-6 text-sm" style={{ color: '#a1a1aa' }}>
          We encountered an error while loading this page. Please try again.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f97316',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#a1a1aa',
              border: '1px solid #27272a',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Go Home
          </button>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs" style={{ color: '#52525b' }}>
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
