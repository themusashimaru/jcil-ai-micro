'use client';

/**
 * TerminalSearchBar
 *
 * Search bar for finding text within terminal output.
 * Supports next/prev navigation and keyboard shortcuts.
 */

import React, { useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TerminalSearchBar = React.memo(function TerminalSearchBar({
  query,
  onQueryChange,
  resultCount,
  currentIndex,
  onNext,
  onPrev,
  onClose,
}: TerminalSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="terminal-search-bar" role="search">
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search terminal..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search terminal output"
      />
      <span className="search-results" aria-live="polite">
        {query ? `${resultCount > 0 ? currentIndex + 1 : 0}/${resultCount}` : ''}
      </span>
      <div className="search-actions">
        <button
          onClick={onPrev}
          disabled={resultCount === 0}
          aria-label="Previous match"
          title="Previous (Shift+Enter)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 3l-4 4h8z" fill="currentColor" />
          </svg>
        </button>
        <button
          onClick={onNext}
          disabled={resultCount === 0}
          aria-label="Next match"
          title="Next (Enter)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 9l-4-4h8z" fill="currentColor" />
          </svg>
        </button>
        <button onClick={onClose} aria-label="Close search" title="Close (Esc)">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
});
