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

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { CodeLabSession } from './types';
import { CodeLabFileBrowser } from './CodeLabFileBrowser';
import { useDebounceValue } from '@/hooks/useDebounce';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  description: string | null;
  updated_at: string;
}

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
  onExportSession?: (sessionId: string) => Promise<void>;
  currentRepo?: CodeLabSession['repo'];
  currentCodeChanges?: CodeLabSession['codeChanges'];
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
  onSetRepo,
  onExportSession,
  currentRepo,
  currentCodeChanges,
}: CodeLabSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch GitHub repos when selector opens
  // Always refetch if not connected (user might have just connected via Settings)
  const fetchRepos = useCallback(
    async (forceRefresh = false) => {
      if (repos.length > 0 && githubConnected && !forceRefresh) return; // Use cache only if connected

      setLoadingRepos(true);
      setRepoError(null);
      try {
        const response = await fetch('/api/connectors?action=github-repos');
        if (response.ok) {
          const data = await response.json();
          setRepos(data.repos || []);
          setGithubConnected(true);
          setRepoError(null);
        } else if (response.status === 401) {
          // Not authenticated
          setGithubConnected(false);
          setRepos([]);
          setRepoError('Please log in to access repositories');
        } else if (response.status === 400) {
          // GitHub not connected
          setGithubConnected(false);
          setRepos([]);
          // Try to get specific error message from response
          const errorData = await response.json().catch(() => ({}));
          setRepoError(errorData.error || 'GitHub not connected');
        } else if (response.status === 503) {
          // Connectors disabled
          setGithubConnected(false);
          setRepos([]);
          setRepoError('GitHub integration is currently unavailable');
        } else {
          // Other errors
          const errorData = await response.json().catch(() => ({}));
          setRepoError(errorData.error || `Failed to load repositories (${response.status})`);
        }
      } catch (error) {
        console.error('[CodeLabSidebar] Error fetching repos:', error);
        setRepoError('Network error - please check your connection');
      } finally {
        setLoadingRepos(false);
      }
    },
    [repos.length, githubConnected]
  );

  useEffect(() => {
    if (showRepoSelector) {
      fetchRepos();
    }
  }, [showRepoSelector, fetchRepos]);

  const handleSelectRepo = async (repo: GitHubRepo) => {
    if (!currentSessionId) return;

    await onSetRepo(currentSessionId, {
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      branch: repo.default_branch,
    });
    setShowRepoSelector(false);
  };

  const handleClearRepo = async () => {
    if (!currentSessionId) return;
    await onSetRepo(currentSessionId, undefined);
    setShowRepoSelector(false);
  };

  // MEDIUM-010: Debounce search input to reduce filtering overhead
  const debouncedRepoSearch = useDebounceValue(repoSearch, 200);

  const filteredRepos = useMemo(
    () =>
      repos.filter((repo) =>
        repo.full_name.toLowerCase().includes(debouncedRepoSearch.toLowerCase())
      ),
    [repos, debouncedRepoSearch]
  );

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
    <aside
      className={`code-lab-sidebar ${collapsed ? 'collapsed' : ''}`}
      role="complementary"
      aria-label="Code Lab sidebar navigation"
    >
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
            />
          </svg>
          {!collapsed && <span>Code Lab</span>}
        </div>
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            {collapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
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
              aria-label="Create new coding session"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Session
            </button>
          </div>

          {/* Code Changes Panel */}
          {currentSessionId &&
            currentCodeChanges &&
            (currentCodeChanges.linesAdded > 0 || currentCodeChanges.linesRemoved > 0) && (
              <div className="sidebar-changes">
                <div className="changes-label">Session Changes</div>
                <div className="changes-stats">
                  <div className="change-stat added">
                    <span className="change-icon">+</span>
                    <span className="change-value">{currentCodeChanges.linesAdded}</span>
                    <span className="change-text">lines added</span>
                  </div>
                  <div className="change-stat removed">
                    <span className="change-icon">-</span>
                    <span className="change-value">{currentCodeChanges.linesRemoved}</span>
                    <span className="change-text">lines removed</span>
                  </div>
                  {currentCodeChanges.filesChanged > 0 && (
                    <div className="change-stat files">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      <span className="change-value">{currentCodeChanges.filesChanged}</span>
                      <span className="change-text">files changed</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Current Repo */}
          {currentSessionId && (
            <div className="sidebar-repo">
              <div className="repo-label-row">
                <span className="repo-label">Repository</span>
                <button
                  className="repo-refresh-btn"
                  onClick={() => fetchRepos(true)}
                  disabled={loadingRepos}
                  title="Refresh repositories"
                  aria-label="Refresh repository list"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={loadingRepos ? 'spinning' : ''}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                </button>
              </div>
              <button
                className="repo-selector"
                onClick={() => setShowRepoSelector(!showRepoSelector)}
                aria-label={
                  currentRepo
                    ? `Selected repository: ${currentRepo.fullName}. Click to change.`
                    : 'Select a repository'
                }
                aria-expanded={showRepoSelector}
                aria-haspopup="listbox"
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
                    <svg
                      className="repo-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    <span>Select Repository</span>
                  </>
                )}
              </button>

              {/* Repository Selector Dropdown */}
              {showRepoSelector && (
                <div className="repo-dropdown">
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="repo-search"
                    autoFocus
                  />

                  {loadingRepos ? (
                    <div className="repo-loading">Loading repositories...</div>
                  ) : repoError ? (
                    <div className="repo-not-connected">
                      <p>{repoError}</p>
                      <a href="/settings?tab=connectors">Connect GitHub</a>
                    </div>
                  ) : !githubConnected ? (
                    <div className="repo-not-connected">
                      <p>GitHub not connected</p>
                      <a href="/settings?tab=connectors">Connect GitHub</a>
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="repo-empty">
                      {repoSearch ? 'No matching repositories' : 'No repositories found'}
                    </div>
                  ) : (
                    <div className="repo-list">
                      {currentRepo && (
                        <button className="repo-item clear" onClick={handleClearRepo}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Clear Repository
                        </button>
                      )}
                      {filteredRepos.slice(0, 20).map((repo) => (
                        <button
                          key={repo.id}
                          className={`repo-item ${currentRepo?.fullName === repo.full_name ? 'active' : ''}`}
                          onClick={() => handleSelectRepo(repo)}
                        >
                          <svg className="repo-item-icon" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z" />
                          </svg>
                          <div className="repo-item-info">
                            <span className="repo-item-name">{repo.full_name}</span>
                            {repo.description && (
                              <span className="repo-item-desc">{repo.description}</span>
                            )}
                          </div>
                          {repo.private && (
                            <svg
                              className="repo-item-private"
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* File Browser (when repo selected) */}
          {currentSessionId && currentRepo && (
            <div className="sidebar-file-browser">
              <CodeLabFileBrowser
                repo={{
                  owner: currentRepo.owner,
                  name: currentRepo.name,
                  branch: currentRepo.branch,
                }}
              />
            </div>
          )}

          {/* Sessions List */}
          <div className="sidebar-sessions">
            <div className="sessions-label">Sessions</div>
            <div className="sessions-list">
              {sessions.length === 0 ? (
                <div className="sessions-empty">No sessions yet. Create one to get started.</div>
              ) : (
                sessions.map((session) => (
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
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="session-edit-input"
                        onClick={(e) => e.stopPropagation()}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === session.id ? null : session.id);
                          }}
                          aria-label={`Session options for ${session.title}`}
                          aria-expanded={menuOpenId === session.id}
                          aria-haspopup="menu"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                          </svg>
                        </button>

                        {/* Session Menu */}
                        {menuOpenId === session.id && (
                          <div className="session-menu" role="menu" aria-label="Session actions">
                            <button
                              onClick={() => handleStartEdit(session)}
                              role="menuitem"
                              aria-label="Rename session"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                                />
                              </svg>
                              Rename
                            </button>
                            {onExportSession && (
                              <button
                                onClick={() => {
                                  setMenuOpenId(null);
                                  onExportSession(session.id);
                                }}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                                  />
                                </svg>
                                Export
                              </button>
                            )}
                            <button
                              className="danger"
                              onClick={() => {
                                setMenuOpenId(null);
                                onDeleteSession(session.id);
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
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
            <div className="footer-links">
              <Link href="/chat" className="back-to-chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
                Chat
              </Link>
              <span className="footer-divider">·</span>
              <span className="powered-by">Claude Opus 4.6</span>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .code-lab-sidebar {
          width: 280px;
          min-width: 280px;
          background: #1a1a1a;
          border-right: 1px solid #333;
          display: flex;
          flex-direction: column;
          transition:
            width 0.2s,
            min-width 0.2s;
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
          border-bottom: 1px solid #333;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #ffffff;
        }

        .sidebar-logo svg {
          width: 24px;
          height: 24px;
          color: #ffffff;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          padding: 0.375rem;
          cursor: pointer;
          color: #888;
          border-radius: 6px;
          transition: background 0.2s;
        }

        .sidebar-toggle:hover {
          background: #333;
          color: #ffffff;
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
          background: #000000;
          color: #ffffff;
          border: 1px solid #444;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .new-session-btn:hover {
          background: #333;
          border-color: #555;
        }

        .new-session-btn svg {
          width: 18px;
          height: 18px;
        }

        .sidebar-changes {
          padding: 0 1rem 1rem;
        }

        .changes-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .changes-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #222;
          border: 1px solid #333;
          border-radius: 8px;
        }

        .change-stat {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.75rem;
        }

        .change-stat svg {
          width: 14px;
          height: 14px;
        }

        .change-icon {
          font-weight: 700;
          width: 1rem;
          text-align: center;
        }

        .change-value {
          font-weight: 600;
        }

        .change-text {
          color: #888;
        }

        .change-stat.added {
          color: #22c55e;
        }

        .change-stat.removed {
          color: #ef4444;
        }

        .change-stat.files {
          color: #ffffff;
          flex-basis: 100%;
          margin-top: 0.25rem;
          padding-top: 0.5rem;
          border-top: 1px solid #333;
        }

        .sidebar-repo {
          padding: 0 1rem 1rem;
        }

        .repo-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .repo-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .repo-refresh-btn {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #888;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .repo-refresh-btn:hover:not(:disabled) {
          color: #ffffff;
          background: #333;
        }

        .repo-refresh-btn:disabled {
          cursor: wait;
        }

        .repo-refresh-btn svg {
          width: 14px;
          height: 14px;
        }

        .repo-refresh-btn svg.spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .repo-selector {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #222;
          border: 1px solid #333;
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #ffffff;
          cursor: pointer;
          transition: border-color 0.2s;
          text-align: left;
        }

        .repo-selector:hover {
          border-color: #444;
        }

        .repo-icon {
          width: 16px;
          height: 16px;
          color: #888;
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
          color: #888;
        }

        .repo-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #222;
          border: 1px solid #333;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          z-index: 100;
          max-height: 320px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .sidebar-repo {
          position: relative;
        }

        .repo-search {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: none;
          border-bottom: 1px solid #333;
          background: #222;
          color: #ffffff;
          font-size: 0.8125rem;
          outline: none;
        }

        .repo-search:focus {
          border-bottom-color: #555;
        }

        .repo-search::placeholder {
          color: #666;
        }

        .repo-loading,
        .repo-empty,
        .repo-not-connected {
          padding: 1rem;
          text-align: center;
          color: #888;
          font-size: 0.8125rem;
        }

        .repo-not-connected a {
          display: inline-block;
          margin-top: 0.5rem;
          color: #7dd3fc;
          text-decoration: none;
          font-weight: 500;
        }

        .repo-not-connected a:hover {
          text-decoration: underline;
        }

        .repo-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.25rem;
        }

        .repo-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          border-radius: 6px;
          font-size: 0.8125rem;
          color: #ffffff;
          cursor: pointer;
          text-align: left;
        }

        .repo-item:hover {
          background: #333;
        }

        .repo-item.active {
          background: #333;
        }

        .repo-item.clear {
          color: #ef4444;
        }

        .repo-item.clear:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .repo-item svg {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .repo-item-icon {
          color: #888;
        }

        .repo-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .repo-item-name {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .repo-item-desc {
          font-size: 0.75rem;
          color: #888;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .repo-item-private {
          color: #f59e0b;
          width: 14px;
          height: 14px;
        }

        .sidebar-file-browser {
          max-height: 200px;
          overflow-y: auto;
          border-top: 1px solid #333;
          border-bottom: 1px solid #333;
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
          color: #888;
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
          color: #888;
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
          background: #333;
        }

        .session-item.active {
          background: #2a2a2a;
        }

        .session-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #666;
        }

        .session-item.active .session-indicator {
          background: #ffffff;
        }

        .session-info {
          flex: 1;
          min-width: 0;
        }

        .session-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .session-meta {
          font-size: 0.75rem;
          color: #888;
          margin-top: 0.125rem;
        }

        .session-menu-btn {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #888;
          border-radius: 4px;
          opacity: 0;
          transition:
            opacity 0.2s,
            background 0.2s;
        }

        .session-item:hover .session-menu-btn {
          opacity: 1;
        }

        .session-menu-btn:hover {
          background: #444;
          color: #ffffff;
        }

        .session-menu-btn svg {
          width: 18px;
          height: 18px;
        }

        .session-menu {
          position: absolute;
          right: 0.5rem;
          top: 100%;
          background: #222;
          border: 1px solid #333;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
          color: #ffffff;
          cursor: pointer;
          text-align: left;
        }

        .session-menu button:hover {
          background: #333;
        }

        .session-menu button.danger {
          color: #ef4444;
        }

        .session-menu button.danger:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .session-menu button svg {
          width: 16px;
          height: 16px;
        }

        .session-edit-input {
          width: 100%;
          padding: 0.25rem 0.5rem;
          border: 1px solid #555;
          border-radius: 4px;
          font-size: 0.875rem;
          background: #222;
          color: #ffffff;
          outline: none;
        }

        .sidebar-footer {
          padding: 0.75rem 1rem;
          border-top: 1px solid #333;
          margin-top: auto;
        }

        .footer-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.75rem;
        }

        .back-to-chat {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          color: #888;
          text-decoration: none;
          transition: color 0.2s;
        }

        .back-to-chat:hover {
          color: #ffffff;
        }

        .back-to-chat svg {
          width: 14px;
          height: 14px;
        }

        .footer-divider {
          color: #555;
        }

        .powered-by {
          color: #666;
        }

        /* Mobile: sidebar as slide-over drawer
         * z-index 45: sidebar overlays workspace panel (35)
         * backdrop is at 44, just below sidebar
         */
        @media (max-width: 768px) {
          .code-lab-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            height: 100vh;
            height: 100dvh;
            width: 280px;
            min-width: 280px;
            max-width: 85vw;
            z-index: 45;
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
            transform: translateX(0);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            /* Safe area for notched devices */
            padding-top: env(safe-area-inset-top, 0);
            padding-bottom: env(safe-area-inset-bottom, 0);
            padding-left: env(safe-area-inset-left, 0);
          }

          .code-lab-sidebar.collapsed {
            transform: translateX(-100%);
            box-shadow: none;
          }

          .sidebar-header {
            padding-top: max(1rem, env(safe-area-inset-top, 1rem));
          }

          .sidebar-changes {
            padding: 0.5rem 1rem;
          }

          .changes-stats {
            padding: 0.5rem;
            gap: 0.375rem;
          }

          .change-stat {
            font-size: 0.6875rem;
          }

          .sidebar-file-browser {
            max-height: 150px;
          }

          .session-menu-btn {
            opacity: 1;
          }

          .sidebar-footer {
            padding: 0.625rem 1rem;
            padding-bottom: calc(0.625rem + env(safe-area-inset-bottom, 0));
          }

          .footer-links {
            font-size: 0.6875rem;
          }

          .repo-dropdown {
            position: fixed;
            left: 1rem;
            right: 1rem;
            top: auto;
            bottom: 1rem;
            bottom: calc(1rem + env(safe-area-inset-bottom, 0));
            max-height: 60vh;
            z-index: 110;
          }

          /* Improve touch targets on mobile */
          .session-item {
            min-height: 52px;
            padding: 0.75rem;
          }

          .new-session-btn {
            min-height: 48px;
          }

          .sidebar-toggle {
            min-width: 44px;
            min-height: 44px;
          }
        }
      `}</style>
    </aside>
  );
}
