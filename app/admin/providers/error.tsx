'use client';

import { useEffect } from 'react';

export default function ProvidersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Providers Page Error]:', error);
  }, [error]);

  return (
    <div className="min-h-screen p-8 bg-black text-white">
      <h1 className="mb-8 text-3xl font-bold">AI Provider Settings</h1>

      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-6">
        <h2 className="text-xl font-semibold text-red-400 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-300 mb-4">
          {error.message || 'An error occurred while loading the providers page.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Try again
          </button>
          <a
            href="/admin/dashboard"
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
