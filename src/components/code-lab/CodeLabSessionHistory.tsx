'use client';

/**
 * CODE LAB SESSION HISTORY
 *
 * Claude Code parity - Session history and search:
 * - Search across all sessions
 * - Export sessions as markdown
 * - Session recovery
 *
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface SearchResult {
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  role: string;
  content: string;
  createdAt: string;
  matchContext: string[];
}

interface SessionBreakdown {
  sessionId: string;
  sessionTitle: string;
  matchCount: number;
}

interface CodeLabSessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  currentSessionId: string | null;
}

export function CodeLabSessionHistory({
  isOpen,
  onClose,
  onSelectSession,
  currentSessionId,
}: CodeLabSessionHistoryProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [breakdown, setBreakdown] = useState<SessionBreakdown[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search handler
  const handleSearch = useCallback(async () => {
    if (!query || query.length < 2) {
      setResults([]);
      setBreakdown([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch('/api/code-lab/sessions/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          role: selectedRole === 'all' ? undefined : selectedRole,
          limit: 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setBreakdown(data.breakdown || []);
    } catch {
      setError('Search failed. Please try again.');
      setResults([]);
      setBreakdown([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedRole]);

  // Debounced search on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  // Export current session
  const handleExport = useCallback(async () => {
    if (!currentSessionId) return;

    try {
      const response = await fetch(
        `/api/code-lab/sessions/${currentSessionId}/history?format=markdown`
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${currentSessionId.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed. Please try again.');
    }
  }, [currentSessionId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && e.metaKey && currentSessionId) {
        handleExport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, currentSessionId, handleExport]);

  if (!isOpen) return null;

  return (
    <div className="session-history-overlay">
      <div className="session-history-modal">
        {/* Header */}
        <div className="history-header">
          <div className="header-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <h2>Search Session History</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="search-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across all sessions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          <div className="search-filters">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="role-filter"
            >
              <option value="all">All messages</option>
              <option value="user">My messages</option>
              <option value="assistant">Claude&apos;s responses</option>
            </select>
            {currentSessionId && (
              <button
                className="export-btn"
                onClick={handleExport}
                title="Export current session (⌘+Enter)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Export
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && <div className="search-error">{error}</div>}

        {/* Loading */}
        {isSearching && (
          <div className="search-loading">
            <div className="spinner" />
            <span>Searching...</span>
          </div>
        )}

        {/* Results */}
        {!isSearching && results.length > 0 && (
          <div className="search-results">
            {/* Session breakdown */}
            {breakdown.length > 1 && (
              <div className="results-breakdown">
                <span className="breakdown-label">Found in {breakdown.length} sessions:</span>
                <div className="breakdown-chips">
                  {breakdown.slice(0, 5).map((b) => (
                    <button
                      key={b.sessionId}
                      className="breakdown-chip"
                      onClick={() => onSelectSession(b.sessionId)}
                    >
                      {b.sessionTitle} ({b.matchCount})
                    </button>
                  ))}
                  {breakdown.length > 5 && (
                    <span className="breakdown-more">+{breakdown.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Result list */}
            <div className="results-list">
              {results.map((result) => (
                <button
                  key={result.messageId}
                  className={`result-item ${result.sessionId === currentSessionId ? 'current' : ''}`}
                  onClick={() => {
                    onSelectSession(result.sessionId);
                    onClose();
                  }}
                >
                  <div className="result-header">
                    <span className="result-session">{result.sessionTitle}</span>
                    <span className="result-role">
                      {result.role === 'user' ? '👤 You' : '🤖 Claude'}
                    </span>
                    <span className="result-time">
                      {new Date(result.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="result-contexts">
                    {result.matchContext.map((ctx, i) => (
                      <p key={i} className="result-context">
                        {highlightMatches(ctx, query)}
                      </p>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isSearching && query.length >= 2 && results.length === 0 && (
          <div className="search-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
              />
            </svg>
            <p>No results found for &quot;{query}&quot;</p>
            <span>Try different keywords or check your filters</span>
          </div>
        )}

        {/* Initial state */}
        {!isSearching && query.length < 2 && (
          <div className="search-initial">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <p>Search your conversation history</p>
            <span>Type at least 2 characters to search across all sessions</span>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="history-hints">
          <span>
            <kbd>Esc</kbd> Close
          </span>
          {currentSessionId && (
            <span>
              <kbd>⌘</kbd>+<kbd>Enter</kbd> Export
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        .session-history-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .session-history-modal {
          background: white;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 700px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-title svg {
          width: 24px;
          height: 24px;
          color: #6b7280;
        }

        .header-title h2 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .close-btn svg {
          width: 20px;
          height: 20px;
        }

        .search-container {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 0.15s;
        }

        .search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-filters {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .role-filter {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
          background: white;
          cursor: pointer;
        }

        .export-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.15s;
          margin-left: auto;
        }

        .export-btn:hover {
          background: #e5e7eb;
        }

        .export-btn svg {
          width: 16px;
          height: 16px;
        }

        .search-error {
          padding: 0.75rem 1.25rem;
          background: #fef2f2;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .search-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: #6b7280;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .search-results {
          flex: 1;
          overflow-y: auto;
        }

        .results-breakdown {
          padding: 0.75rem 1.25rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .breakdown-label {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }

        .breakdown-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .breakdown-chip {
          padding: 0.25rem 0.625rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 9999px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s;
        }

        .breakdown-chip:hover {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .breakdown-more {
          padding: 0.25rem 0.625rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .results-list {
          padding: 0.5rem;
        }

        .result-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 0.75rem 1rem;
          background: none;
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .result-item:hover {
          background: var(--cl-bg-secondary, #f9fafb);
          border-color: var(--cl-border-primary, #e5e7eb);
        }

        .result-item.current {
          background: #eff6ff;
          border-color: #93c5fd;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.375rem;
        }

        .result-session {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #111827;
        }

        .result-role {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .result-time {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-left: auto;
        }

        .result-contexts {
          margin: 0;
        }

        .result-context {
          margin: 0 0 0.25rem;
          font-size: 0.8125rem;
          color: #4b5563;
          line-height: 1.5;
        }

        .result-context :global(mark) {
          background: #fef08a;
          padding: 0 0.125rem;
          border-radius: 2px;
        }

        .search-empty,
        .search-initial {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          text-align: center;
          color: #6b7280;
        }

        .search-empty svg,
        .search-initial svg {
          width: 48px;
          height: 48px;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .search-empty p,
        .search-initial p {
          margin: 0 0 0.25rem;
          font-size: 0.9375rem;
          color: #374151;
        }

        .search-empty span,
        .search-initial span {
          font-size: 0.8125rem;
        }

        .history-hints {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          padding: 0.75rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .history-hints kbd {
          display: inline-block;
          padding: 0.125rem 0.375rem;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-family: 'SF Mono', monospace;
          font-size: 0.6875rem;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .session-history-modal {
            background: #1f2937;
          }

          .history-header {
            border-color: #374151;
          }

          .header-title h2 {
            color: #f9fafb;
          }

          .close-btn:hover {
            background: #374151;
            color: #f9fafb;
          }

          .search-container {
            border-color: #374151;
          }

          .search-input {
            background: #111827;
            border-color: #374151;
            color: #f9fafb;
          }

          .search-input:focus {
            border-color: #60a5fa;
          }

          .role-filter {
            background: #111827;
            border-color: #374151;
            color: #f9fafb;
          }

          .export-btn {
            background: #374151;
            border-color: #4b5563;
            color: #f9fafb;
          }

          .results-breakdown {
            background: #111827;
            border-color: #374151;
          }

          .breakdown-chip {
            background: #374151;
            border-color: #4b5563;
            color: #f9fafb;
          }

          .result-item:hover {
            background: #374151;
            border-color: #4b5563;
          }

          .result-session {
            color: #f9fafb;
          }

          .result-context {
            color: #d1d5db;
          }

          .history-hints {
            background: #111827;
            border-color: #374151;
          }

          .history-hints kbd {
            background: #374151;
            border-color: #4b5563;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Highlight search matches in text
 */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

/**
 * Escape regex special characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default CodeLabSessionHistory;
