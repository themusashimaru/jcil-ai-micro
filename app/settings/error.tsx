'use client';

import { useEffect } from 'react';

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Settings] Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4 bg-background">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">
          Settings Error
        </h2>

        <p className="font-mono text-xs text-muted-foreground mb-6">
          Something went wrong loading settings. This may be a temporary issue.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
          >
            Try Again
          </button>

          <button
            onClick={() => (window.location.href = '/chat')}
            className="border border-border/40 px-6 py-3 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
          >
            Back to Chat
          </button>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[10px] text-muted-foreground/50">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
