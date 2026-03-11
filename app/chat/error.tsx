'use client';

/**
 * CHAT ERROR PAGE
 *
 * Segment-level error boundary for the /chat route.
 * Uses hardcoded dark theme colors to guarantee visibility.
 */

import { useEffect } from 'react';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ChatError] Chat page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#000' }}>
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>
          Chat hit a snag
        </h2>

        <p className="mb-6 text-sm" style={{ color: '#a1a1aa' }}>
          Something went wrong loading your chat. Your conversations are safe — let&apos;s get you
          back on track.
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
          >
            Try Again
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
          >
            New Chat
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
