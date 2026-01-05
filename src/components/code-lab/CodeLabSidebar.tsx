'use client';

/**
 * CODE LAB SIDEBAR
 *
 * Professional session management:
 * - Session list with easy switching
 * - Repo selector per session
 * - New session creation
 * - Session renaming/deletion
 */

import { useState, useRef, useEffect } from 'react';
import type { CodeLabSession } from './types';

interface CodeLabSidebarProps {
  sessions: CodeLabSession[];
  currentSessionId: string | null;
  collapsed: boolean;
  onToggle: () => void;
  onCreateSession: (title?: string) => Promise<CodeLabSession | null>;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onSetRepo: (sessionId: string, repo: CodeLabSession['repo']) => Promise<void>;
  currentRepo?: CodeLabSession['repo'];
}

export function CodeLabSidebar({
  sessions,
  currentSessionId,
  collapsed,
  onToggle,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onSetRepo: _onSetRepo,
  currentRepo,
}: CodeLabSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = (session: CodeLabSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await onRenameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditTitle('');
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <aside className={`code-lab-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
          {!collapsed && <span>Code Lab</span>}
        </div>
        <button className="sidebar-toggle" onClick={onToggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            )}
          </svg>
        </button>
      </div>

      {!collapsed && (
        <>
          {/* New Session Button */}
          <div className="sidebar-actions">
            <button
              className="new-session-btn"
              onClick={() => onCreateSession()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Session
            </button>
          </div>

          {/* Current Repo */}
          {currentSessionId && (
            <div className="sidebar-repo">
              <div className="repo-label">Repository</div>
              <button
                className="repo-selector"
                onClick={() => setShowRepoSelector(!showRepoSelector)}
              >
                {currentRepo ? (
                  <>
                    <svg className="repo-icon" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
                    </svg>
                    <span className="repo-name">{currentRepo.fullName}</span>
                    <span className="repo-branch">{currentRepo.branch}</span>
                  </>
                ) : (
                  <>
                    <svg className="repo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Select Repository</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Sessions List */}
          <div className="sidebar-sessions">
            <div className="sessions-label">Sessions</div>
            <div className="sessions-list">
              {sessions.length === 0 ? (
                <div className="sessions-empty">
                  No sessions yet. Create one to get started.
                </div>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    {editingId === session.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="session-edit-input"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div className="session-indicator" />
                        <div className="session-info">
                          <div className="session-title">{session.title}</div>
                          <div className="session-meta">
                            {session.messageCount} messages · {formatDate(session.updatedAt)}
                          </div>
                        </div>
                        <button
                          className="session-menu-btn"
                          onClick={e => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === session.id ? null : session.id);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>

                        {/* Session Menu */}
                        {menuOpenId === session.id && (
                          <div className="session-menu">
                            <button onClick={() => handleStartEdit(session)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                              </svg>
                              Rename
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                setMenuOpenId(null);
                                onDeleteSession(session.id);
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="powered-by">
              Powered by Claude Opus 4.5
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .code-lab-sidebar {
          width: 280px;
          min-width: 280px;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          transition: width 0.2s, min-width 0.2s;
        }

        .code-lab-sidebar.collapsed {
          width: 56px;
          min-width: 56px;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #1a1f36;
        }

        .sidebar-logo svg {
          width: 24px;
          height: 24px;
          color: #6366f1;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          padding: 0.375rem;
          cursor: pointer;
          color: #6b7280;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .sidebar-toggle:hover {
          background: #f3f4f6;
        }

        .sidebar-toggle svg {
          width: 18px;
          height: 18px;
        }

        .sidebar-actions {
          padding: 1rem;
        }

        .new-session-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: #1a1f36;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .new-session-btn:hover {
          background: #2d3348;
        }

        .new-session-btn svg {
          width: 18px;
          height: 18px;
        }

        .sidebar-repo {
          padding: 0 1rem 1rem;
        }

        .repo-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .repo-selector {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          transition: border-color 0.2s;
          text-align: left;
        }

        .repo-selector:hover {
          border-color: #d1d5db;
        }

        .repo-icon {
          width: 16px;
          height: 16px;
          color: #6b7280;
        }

        .repo-name {
          flex: 1;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .repo-branch {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .sidebar-sessions {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .sessions-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0 1rem;
          margin-bottom: 0.5rem;
        }

        .sessions-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 0.5rem;
        }

        .sessions-empty {
          padding: 1rem;
          text-align: center;
          color: #9ca3af;
          font-size: 0.8125rem;
        }

        .session-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          position: relative;
        }

        .session-item:hover {
          background: #f3f4f6;
        }

        .session-item.active {
          background: #eef2ff;
        }

        .session-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d1d5db;
        }

        .session-item.active .session-indicator {
          background: #6366f1;
        }

        .session-info {
          flex: 1;
          min-width: 0;
        }

        .session-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1a1f36;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .session-meta {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-top: 0.125rem;
        }

        .session-menu-btn {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 4px;
          opacity: 0;
          transition: opacity 0.2s, background 0.2s;
        }

        .session-item:hover .session-menu-btn {
          opacity: 1;
        }

        .session-menu-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .session-menu-btn svg {
          width: 18px;
          height: 18px;
        }

        .session-menu {
          position: absolute;
          right: 0.5rem;
          top: 100%;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 10;
          min-width: 140px;
          overflow: hidden;
        }

        .session-menu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: none;
          border: none;
          font-size: 0.8125rem;
          color: #374151;
          cursor: pointer;
          text-align: left;
        }

        .session-menu button:hover {
          background: #f3f4f6;
        }

        .session-menu button.danger {
          color: #ef4444;
        }

        .session-menu button.danger:hover {
          background: #fef2f2;
        }

        .session-menu button svg {
          width: 16px;
          height: 16px;
        }

        .session-edit-input {
          width: 100%;
          padding: 0.25rem 0.5rem;
          border: 1px solid #6366f1;
          border-radius: 4px;
          font-size: 0.875rem;
          outline: none;
        }

        .sidebar-footer {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .powered-by {
          font-size: 0.75rem;
          color: #9ca3af;
          text-align: center;
        }
      `}</style>
    </aside>
  );
}
