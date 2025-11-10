/**
 * QUICK LIVE SEARCH
 * Real-time web search in chat
 */

'use client';

import { useState } from 'react';

interface QuickLiveSearchProps {
  onSearchComplete: (response: string, query: string) => void;
  isSearching?: boolean;
}

export function QuickLiveSearch({ onSearchComplete, isSearching = false }: QuickLiveSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || loading) return;

    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: query }],
          tool: 'research',
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            const content = line.slice(2).replace(/^"(.*)"$/, '$1');
            if (content) {
              fullResponse += content;
            }
          }
        }
      }

      if (fullResponse) {
        onSearchComplete(fullResponse, query);
        setQuery('');
        setIsOpen(false);
      } else {
        throw new Error('No search results');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
        disabled={isSearching}
        aria-label="Live search"
        title="Search the web in real-time"
      >
        Live Search
      </button>

      {/* Popup Form */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-black/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Live Web Search</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Close"
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSearch();
                }
              }}
              placeholder="What would you like to search for?&#10;Example: Latest AI news, weather in Tokyo, best React practices"
              className="mb-4 w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
              rows={3}
              disabled={loading}
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
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
              🔍 Tip: Uses real-time web search with AI-powered analysis
            </p>
          </div>
        </div>
      )}
    </>
  );
}
