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

import { useSessionHistorySearch } from './useSessionHistorySearch';
import { highlightMatches } from './highlightMatches';
import { sessionHistoryStyles } from './CodeLabSessionHistory.styles';

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
  const {
    query,
    setQuery,
    results,
    breakdown,
    isSearching,
    error,
    selectedRole,
    setSelectedRole,
    inputRef,
    handleExport,
  } = useSessionHistorySearch(isOpen, currentSessionId, onClose);

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
          <button className="close-btn" onClick={onClose} aria-label="Close session history">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
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

      <style jsx>{sessionHistoryStyles}</style>
    </div>
  );
}

export default CodeLabSessionHistory;
