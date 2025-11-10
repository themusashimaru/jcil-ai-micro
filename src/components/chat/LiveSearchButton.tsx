/**
 * LIVE SEARCH BUTTON
 * PURPOSE: Trigger real-time web search with modal UI
 */

'use client';

import { useState } from 'react';

interface LiveSearchButtonProps {
  onSearchComplete: (content: string, query: string, citations?: unknown[]) => void;
}

export function LiveSearchButton({ onSearchComplete }: LiveSearchButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/live-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Search failed');
      }

      const data = await response.json();

      if (data.success && data.content) {
        onSearchComplete(data.content, query, data.citations);
        setQuery('');
        setIsOpen(false);
        setError(null);
      } else {
        throw new Error('No search results returned');
      }
    } catch (err) {
      console.error('Live search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSearch();
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-white/20 bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
        aria-label="Live search"
        title="Search the web in real-time"
      >
        🔍 Live Search
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !loading && setIsOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-black p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Live Web Search</h3>
              <button
                onClick={() => !loading && setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
                disabled={loading}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Input */}
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to search for?&#10;Example: What time is it in Boston? Latest AI news"
              className="mb-4 w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
              disabled={loading}
              autoFocus
            />

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Searching...
                  </span>
                ) : (
                  'Search'
                )}
              </button>
            </div>

            {/* Tip */}
            <p className="mt-4 text-xs text-white/50">
              💡 Tip: Press Cmd/Ctrl + Enter to search
            </p>
          </div>
        </div>
      )}
    </>
  );
}
