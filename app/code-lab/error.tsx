'use client';

/**
 * CODE LAB ERROR PAGE
 *
 * Segment-level error boundary for the /code-lab route.
 * Uses hardcoded dark theme colors to guarantee visibility.
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#000' }}>
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: '#818cf8' }}
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

        <h2 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>
          Code Lab hit a snag
        </h2>

        <p className="mb-6 text-sm" style={{ color: '#a1a1aa' }}>
          Something went wrong loading Code Lab. Your sessions are saved &mdash; let&apos;s get you
          back to coding.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
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
            aria-label="Try loading Code Lab again"
          >
            Try Again
          </button>

          <button
            onClick={() => (window.location.href = '/code-lab')}
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
            aria-label="Reload Code Lab"
          >
            Reload
          </button>

          <button
            onClick={() => (window.location.href = '/chat')}
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
            aria-label="Go to Chat"
          >
            Go to Chat
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
