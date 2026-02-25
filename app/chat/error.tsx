'use client';

/**
 * CHAT ERROR PAGE
 *
 * Segment-level error boundary for the /chat route.
 * Shows a chat-specific recovery UI instead of the generic error page.
 * Offers retry, new chat, and home navigation.
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-red-500/10">
          <svg
            className="w-8 h-8 text-red-500"
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

        <h2 className="text-xl font-semibold mb-2 text-text-primary">Chat hit a snag</h2>

        <p className="mb-6 text-sm text-text-secondary">
          Something went wrong loading your chat. Your conversations are safe — let&apos;s get you
          back on track.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90 bg-primary"
          >
            Try Again
          </button>

          <button
            onClick={() => {
              // Clear any bad state and reload
              window.location.href = '/chat';
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90 bg-surface-elevated text-text-secondary border border-theme"
          >
            New Chat
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors hover:opacity-90 bg-surface-elevated text-text-secondary border border-theme"
          >
            Go Home
          </button>
        </div>

        {error.digest && <p className="mt-6 text-xs text-text-muted">Error ID: {error.digest}</p>}
      </div>
    </div>
  );
}
