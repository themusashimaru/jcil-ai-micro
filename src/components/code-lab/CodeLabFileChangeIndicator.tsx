'use client';

/**
 * CODE LAB FILE CHANGE INDICATOR
 *
 * Claude Code parity - Shows notification when workspace files change:
 * - Detects when files have been modified externally
 * - Shows banner with refresh prompt
 * - Tracks changed files count
 * - Auto-dismisses after refresh
 *
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import './code-lab-file-change-indicator.css';

interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
  timestamp: Date;
}

interface CodeLabFileChangeIndicatorProps {
  sessionId: string | null;
  workspaceActive: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

export function CodeLabFileChangeIndicator({
  sessionId,
  workspaceActive,
  onRefresh,
  onDismiss,
}: CodeLabFileChangeIndicatorProps) {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastCheckRef = useRef<number>(Date.now());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for file changes
  const checkForChanges = useCallback(async () => {
    if (!sessionId || !workspaceActive) return;

    try {
      const response = await fetch(
        `/api/code-lab/files/changes?sessionId=${sessionId}&since=${lastCheckRef.current}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.changes && data.changes.length > 0) {
          setChanges((prev) => {
            // Merge new changes, avoiding duplicates
            const newChanges = data.changes.filter(
              (c: FileChange) => !prev.some((p) => p.path === c.path && p.type === c.type)
            );
            if (newChanges.length > 0) {
              setIsVisible(true);
              return [...prev, ...newChanges];
            }
            return prev;
          });
        }
        lastCheckRef.current = Date.now();
      }
    } catch (err) {
      // Silently ignore polling errors
      // eslint-disable-next-line no-console
      console.debug('File change check failed:', err);
    }
  }, [sessionId, workspaceActive]);

  // Set up polling
  useEffect(() => {
    if (workspaceActive && sessionId) {
      // Initial check
      checkForChanges();

      // Poll every 5 seconds
      pollIntervalRef.current = setInterval(checkForChanges, 5000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [workspaceActive, sessionId, checkForChanges]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    onRefresh();
    setChanges([]);
    setIsVisible(false);
    setIsExpanded(false);
    lastCheckRef.current = Date.now();
  }, [onRefresh]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setIsExpanded(false);
    setChanges([]);
    onDismiss();
  }, [onDismiss]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      // R to refresh, Escape to dismiss
      if (e.key === 'r' || e.key === 'R') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          handleRefresh();
        }
      } else if (e.key === 'Escape') {
        handleDismiss();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleRefresh, handleDismiss]);

  if (!isVisible || changes.length === 0) return null;

  // Group changes by type
  const created = changes.filter((c) => c.type === 'created');
  const modified = changes.filter((c) => c.type === 'modified');
  const deleted = changes.filter((c) => c.type === 'deleted');

  return (
    <div className={`file-change-indicator ${isExpanded ? 'expanded' : ''}`}>
      <div className="indicator-main">
        <div className="indicator-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </div>

        <div className="indicator-content">
          <span className="indicator-message">
            <strong>{changes.length}</strong> file{changes.length !== 1 ? 's' : ''} changed in
            workspace
          </span>
          <button className="indicator-expand" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Hide' : 'Show'} details
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isExpanded ? 'rotated' : ''}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="indicator-actions">
          <button className="btn-refresh" onClick={handleRefresh}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
            <kbd>R</kbd>
          </button>
          <button className="btn-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="indicator-details">
          {created.length > 0 && (
            <div className="change-group created">
              <div className="group-header">
                <span className="group-icon">+</span>
                <span className="group-label">Created ({created.length})</span>
              </div>
              <ul className="change-list">
                {created.slice(0, 5).map((c) => (
                  <li key={c.path}>{c.path}</li>
                ))}
                {created.length > 5 && <li className="more">+{created.length - 5} more</li>}
              </ul>
            </div>
          )}

          {modified.length > 0 && (
            <div className="change-group modified">
              <div className="group-header">
                <span className="group-icon">~</span>
                <span className="group-label">Modified ({modified.length})</span>
              </div>
              <ul className="change-list">
                {modified.slice(0, 5).map((c) => (
                  <li key={c.path}>{c.path}</li>
                ))}
                {modified.length > 5 && <li className="more">+{modified.length - 5} more</li>}
              </ul>
            </div>
          )}

          {deleted.length > 0 && (
            <div className="change-group deleted">
              <div className="group-header">
                <span className="group-icon">-</span>
                <span className="group-label">Deleted ({deleted.length})</span>
              </div>
              <ul className="change-list">
                {deleted.slice(0, 5).map((c) => (
                  <li key={c.path}>{c.path}</li>
                ))}
                {deleted.length > 5 && <li className="more">+{deleted.length - 5} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ============================================
// FILE CHANGE HOOK
// ============================================

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

/**
 * Hook to manage file change notifications
 */
export function useFileChangeNotifications(_sessionId: string | null) {
  const [pendingChanges, setPendingChanges] = useState<FileChangeEvent[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Add a change event
  const addChange = useCallback((change: Omit<FileChangeEvent, 'timestamp'>) => {
    setPendingChanges((prev) => [
      ...prev.filter((c) => c.path !== change.path),
      { ...change, timestamp: Date.now() },
    ]);
    setHasChanges(true);
  }, []);

  // Clear all changes
  const clearChanges = useCallback(() => {
    setPendingChanges([]);
    setHasChanges(false);
  }, []);

  // Dismiss changes without refresh
  const dismissChanges = useCallback(() => {
    setHasChanges(false);
  }, []);

  return {
    pendingChanges,
    hasChanges,
    addChange,
    clearChanges,
    dismissChanges,
  };
}

export default CodeLabFileChangeIndicator;
