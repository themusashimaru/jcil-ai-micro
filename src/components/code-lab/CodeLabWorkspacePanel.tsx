'use client';

/**
 * CODE LAB WORKSPACE PANEL
 *
 * A collapsible panel showing workspace status:
 * - Task/TODO tracking (what AI is working on)
 * - Git status (branch, changes)
 * - Active workspace info
 * - Recent tool executions
 */

import { useState } from 'react';

// ============================================
// TYPES
// ============================================

export interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  isClean: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  type: 'sandbox' | 'github' | 'local';
  status: 'active' | 'suspended';
  repo?: {
    owner: string;
    name: string;
    fullName: string;
  };
  lastAccessed?: Date;
}

interface CodeLabWorkspacePanelProps {
  workspace?: WorkspaceInfo;
  tasks?: Task[];
  gitStatus?: GitStatus;
  onTaskAdd?: (content: string) => void;
  onTaskComplete?: (taskId: string) => void;
  onRefreshGit?: () => void;
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function CodeLabWorkspacePanel({
  workspace,
  tasks = [],
  gitStatus,
  onTaskAdd,
  onTaskComplete,
  onRefreshGit,
  className = '',
}: CodeLabWorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'git' | 'info'>('tasks');
  const [newTaskInput, setNewTaskInput] = useState('');

  // Count tasks by status
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  // Handle task add
  const handleAddTask = () => {
    if (newTaskInput.trim() && onTaskAdd) {
      onTaskAdd(newTaskInput.trim());
      setNewTaskInput('');
    }
  };

  return (
    <div className={`workspace-panel ${className}`}>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span>Workspace</span>
          {workspace && (
            <span className={`status-badge ${workspace.status}`}>{workspace.status}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
          {pendingTasks + inProgressTasks > 0 && (
            <span className="tab-badge">{pendingTasks + inProgressTasks}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'git' ? 'active' : ''}`}
          onClick={() => setActiveTab('git')}
        >
          Git
          {gitStatus && !gitStatus.isClean && <span className="tab-badge warning">!</span>}
        </button>
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
      </div>

      {/* Content */}
      <div className="panel-content">
        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="tasks-content">
            {/* Task Stats */}
            <div className="task-stats">
              <span className="stat">
                <span className="stat-icon pending">○</span>
                {pendingTasks} pending
              </span>
              <span className="stat">
                <span className="stat-icon in-progress">◐</span>
                {inProgressTasks} active
              </span>
              <span className="stat">
                <span className="stat-icon completed">●</span>
                {completedTasks} done
              </span>
            </div>

            {/* Task List */}
            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <p>No tasks yet</p>
                  <p className="hint">Tasks will appear when the AI is working</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`task-item ${task.status}`}
                    onClick={() => task.status !== 'completed' && onTaskComplete?.(task.id)}
                  >
                    <span className="task-status">
                      {task.status === 'pending' && '○'}
                      {task.status === 'in_progress' && <span className="spinner" />}
                      {task.status === 'completed' && '✓'}
                    </span>
                    <span className="task-content">{task.content}</span>
                  </div>
                ))
              )}
            </div>

            {/* Add Task */}
            {onTaskAdd && (
              <div className="add-task">
                <input
                  type="text"
                  placeholder="Add a task..."
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <button onClick={handleAddTask} disabled={!newTaskInput.trim()}>
                  +
                </button>
              </div>
            )}
          </div>
        )}

        {/* Git Tab */}
        {activeTab === 'git' && (
          <div className="git-content">
            {gitStatus ? (
              <>
                {/* Branch Info */}
                <div className="git-branch">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 7h10M7 12h10M7 17h10"
                    />
                  </svg>
                  <span className="branch-name">{gitStatus.branch}</span>
                  {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <span className="branch-sync">
                      {gitStatus.ahead > 0 && <span className="ahead">↑{gitStatus.ahead}</span>}
                      {gitStatus.behind > 0 && <span className="behind">↓{gitStatus.behind}</span>}
                    </span>
                  )}
                  {onRefreshGit && (
                    <button className="refresh-btn" onClick={onRefreshGit} title="Refresh">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {gitStatus.isClean ? (
                  <div className="git-clean">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Working tree clean
                  </div>
                ) : (
                  <div className="git-changes">
                    {gitStatus.staged.length > 0 && (
                      <div className="change-section">
                        <h4>Staged ({gitStatus.staged.length})</h4>
                        {gitStatus.staged.slice(0, 5).map((file, i) => (
                          <div key={i} className="change-file staged">
                            {file}
                          </div>
                        ))}
                        {gitStatus.staged.length > 5 && (
                          <div className="more">+{gitStatus.staged.length - 5} more</div>
                        )}
                      </div>
                    )}

                    {gitStatus.modified.length > 0 && (
                      <div className="change-section">
                        <h4>Modified ({gitStatus.modified.length})</h4>
                        {gitStatus.modified.slice(0, 5).map((file, i) => (
                          <div key={i} className="change-file modified">
                            {file}
                          </div>
                        ))}
                        {gitStatus.modified.length > 5 && (
                          <div className="more">+{gitStatus.modified.length - 5} more</div>
                        )}
                      </div>
                    )}

                    {gitStatus.untracked.length > 0 && (
                      <div className="change-section">
                        <h4>Untracked ({gitStatus.untracked.length})</h4>
                        {gitStatus.untracked.slice(0, 5).map((file, i) => (
                          <div key={i} className="change-file untracked">
                            {file}
                          </div>
                        ))}
                        {gitStatus.untracked.length > 5 && (
                          <div className="more">+{gitStatus.untracked.length - 5} more</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>No git repository</p>
                <p className="hint">Git status will appear when working in a repo</p>
              </div>
            )}
          </div>
        )}

        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="info-content">
            {workspace ? (
              <div className="info-list">
                <div className="info-item">
                  <span className="info-label">Name</span>
                  <span className="info-value">{workspace.name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Type</span>
                  <span className="info-value capitalize">{workspace.type}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">ID</span>
                  <span className="info-value mono">{workspace.id.substring(0, 8)}...</span>
                </div>
                {workspace.repo && (
                  <div className="info-item">
                    <span className="info-label">Repository</span>
                    <span className="info-value">{workspace.repo.fullName}</span>
                  </div>
                )}
                {workspace.lastAccessed && (
                  <div className="info-item">
                    <span className="info-label">Last accessed</span>
                    <span className="info-value">{workspace.lastAccessed.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <p>No active workspace</p>
                <p className="hint">A workspace will be created when you run commands</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .workspace-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          font-size: 0.8125rem;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .panel-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #1a1f36;
        }

        .panel-title svg {
          width: 16px;
          height: 16px;
          color: #1e3a5f;
        }

        .status-badge {
          font-size: 0.625rem;
          font-weight: 500;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #16a34a;
        }

        .status-badge.suspended {
          background: #fef3c7;
          color: #d97706;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: #fafbfc;
        }

        .tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.5rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 0.75rem;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #374151;
          background: #f3f4f6;
        }

        .tab.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
        }

        .tab-badge {
          font-size: 0.625rem;
          padding: 0.0625rem 0.375rem;
          background: #e5e7eb;
          border-radius: 9999px;
          color: #374151;
        }

        .tab-badge.warning {
          background: #fef3c7;
          color: #d97706;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem;
        }

        .empty-state {
          text-align: center;
          padding: 1.5rem;
          color: #6b7280;
        }

        .empty-state .hint {
          font-size: 0.6875rem;
          color: #9ca3af;
          margin-top: 0.25rem;
        }

        /* Tasks */
        .task-stats {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          font-size: 0.6875rem;
          color: #6b7280;
        }

        .stat {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .stat-icon {
          font-size: 0.75rem;
        }

        .stat-icon.pending {
          color: #9ca3af;
        }
        .stat-icon.in-progress {
          color: #3b82f6;
        }
        .stat-icon.completed {
          color: #16a34a;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .task-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #f8fafc;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .task-item:hover {
          background: #f3f4f6;
        }

        .task-item.completed {
          opacity: 0.6;
        }

        .task-item.completed .task-content {
          text-decoration: line-through;
        }

        .task-status {
          flex-shrink: 0;
          font-size: 0.875rem;
        }

        .task-item.pending .task-status {
          color: #9ca3af;
        }
        .task-item.in_progress .task-status {
          color: #3b82f6;
        }
        .task-item.completed .task-status {
          color: #16a34a;
        }

        .task-item .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #3b82f6;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .task-content {
          flex: 1;
          color: #374151;
          line-height: 1.4;
        }

        .add-task {
          display: flex;
          gap: 0.375rem;
          margin-top: 0.75rem;
        }

        .add-task input {
          flex: 1;
          padding: 0.375rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .add-task button {
          padding: 0.375rem 0.75rem;
          background: #4f46e5;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .add-task button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Git */
        .git-branch {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #f8fafc;
          border-radius: 4px;
          margin-bottom: 0.75rem;
        }

        .git-branch svg {
          width: 14px;
          height: 14px;
          color: #6b7280;
        }

        .branch-name {
          font-weight: 600;
          color: #1a1f36;
        }

        .branch-sync {
          font-size: 0.6875rem;
          display: flex;
          gap: 0.25rem;
        }

        .ahead {
          color: #16a34a;
        }
        .behind {
          color: #dc2626;
        }

        .refresh-btn {
          margin-left: auto;
          padding: 0.25rem;
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          border-radius: 4px;
        }

        .refresh-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .refresh-btn svg {
          width: 14px;
          height: 14px;
        }

        .git-clean {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          color: #16a34a;
          font-size: 0.75rem;
        }

        .git-clean svg {
          width: 14px;
          height: 14px;
        }

        .git-changes {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .change-section h4 {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #6b7280;
          margin: 0 0 0.375rem 0;
          text-transform: uppercase;
        }

        .change-file {
          font-family: 'SF Mono', monospace;
          font-size: 0.6875rem;
          padding: 0.25rem 0.375rem;
          border-radius: 2px;
          margin-bottom: 0.125rem;
        }

        .change-file.staged {
          background: #dcfce7;
          color: #16a34a;
        }
        .change-file.modified {
          background: #fef3c7;
          color: #d97706;
        }
        .change-file.untracked {
          background: #f3f4f6;
          color: #6b7280;
        }

        .more {
          font-size: 0.625rem;
          color: #9ca3af;
          padding: 0.125rem 0.375rem;
        }

        /* Info */
        .info-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 0.375rem 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .info-label {
          color: #6b7280;
        }

        .info-value {
          font-weight: 500;
          color: #1a1f36;
        }

        .info-value.mono {
          font-family: 'SF Mono', monospace;
          font-size: 0.75rem;
        }

        .info-value.capitalize {
          text-transform: capitalize;
        }
      `}</style>
    </div>
  );
}

// Helper to create tasks
let taskIdCounter = 0;
export function createTask(content: string, status: Task['status'] = 'pending'): Task {
  return {
    id: `task-${++taskIdCounter}`,
    content,
    status,
    createdAt: new Date(),
  };
}
