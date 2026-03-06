'use client';

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

export type { SearchResult, SessionBreakdown };

export function useSessionHistorySearch(
  isOpen: boolean,
  currentSessionId: string | null,
  onClose: () => void
) {
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

  return {
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
  };
}
