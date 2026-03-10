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

      <style jsx>{`
        .file-change-indicator {
          position: fixed;
          bottom: 60px; /* Above status bar */
          left: 50%;
          transform: translateX(-50%);
          background: #1a1f36;
          border-radius: 12px;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          z-index: 1000;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          max-width: 90vw;
          overflow: hidden;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .indicator-main {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
        }

        .indicator-icon {
          width: 32px;
          height: 32px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #60a5fa;
          animation: spin 2s linear infinite;
          animation-play-state: paused;
        }

        .file-change-indicator:hover .indicator-icon {
          animation-play-state: running;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .indicator-icon svg {
          width: 18px;
          height: 18px;
        }

        .indicator-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .indicator-message {
          font-size: 0.875rem;
          color: #e2e8f0;
        }

        .indicator-message strong {
          color: #60a5fa;
        }

        .indicator-expand {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background: none;
          border: none;
          padding: 0;
          font-size: 0.75rem;
          color: #94a3b8;
          cursor: pointer;
          transition: color 0.15s;
        }

        .indicator-expand:hover {
          color: #e2e8f0;
        }

        .indicator-expand svg {
          width: 12px;
          height: 12px;
          transition: transform 0.2s;
        }

        .indicator-expand svg.rotated {
          transform: rotate(180deg);
        }

        .indicator-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-left: auto;
        }

        .btn-refresh {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: background 0.15s;
        }

        .btn-refresh:hover {
          background: #2563eb;
        }

        .btn-refresh svg {
          width: 14px;
          height: 14px;
        }

        .btn-refresh kbd {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.625rem;
          padding: 0.125rem 0.25rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          margin-left: 0.125rem;
        }

        .btn-dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: none;
          border: none;
          border-radius: 6px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-dismiss:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
        }

        .btn-dismiss svg {
          width: 16px;
          height: 16px;
        }

        .indicator-details {
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
          max-height: 200px;
          overflow-y: auto;
        }

        .change-group {
          margin-bottom: 0.75rem;
        }

        .change-group:last-child {
          margin-bottom: 0;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-bottom: 0.375rem;
        }

        .group-icon {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          font-family: 'SF Mono', 'Menlo', monospace;
        }

        .created .group-icon {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .modified .group-icon {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
        }

        .deleted .group-icon {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .group-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #94a3b8;
        }

        .change-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .change-list li {
          font-size: 0.75rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          color: #cbd5e1;
          padding: 0.125rem 0 0.125rem 1.25rem;
        }

        .change-list li.more {
          color: #64748b;
          font-style: italic;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .file-change-indicator {
            left: 1rem;
            right: 1rem;
            transform: none;
            bottom: 70px;
          }

          .indicator-main {
            flex-wrap: wrap;
          }

          .indicator-actions {
            width: 100%;
            justify-content: flex-end;
            margin-top: 0.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
      `}</style>
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
