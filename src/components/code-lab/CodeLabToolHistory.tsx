'use client';

/**
 * CODE LAB TOOL HISTORY
 *
 * Shows complete history of tool executions with:
 * - Real-time streaming status
 * - Success/failure indicators
 * - Expandable input/output
 * - Retry failed operations
 * - Filter by tool type
 * - Search functionality
 * - Export execution log
 *
 * Goes BEYOND Claude Code with visual execution timeline.
 *
 * @version 1.0.0
 */

import { useState, useMemo, useCallback, type ReactNode } from 'react';

type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';
type ToolCategory = 'file' | 'shell' | 'git' | 'mcp' | 'deploy' | 'search' | 'other';

interface ToolExecution {
  id: string;
  tool: string;
  category: ToolCategory;
  status: ToolStatus;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  retryCount?: number;
}

interface CodeLabToolHistoryProps {
  executions: ToolExecution[];
  onRetry?: (executionId: string) => void;
  onCancel?: (executionId: string) => void;
  onClear?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Tool category configurations
const categoryConfig: Record<ToolCategory, { icon: string; color: string; label: string }> = {
  file: { icon: '📄', color: 'var(--cl-info)', label: 'File' },
  shell: { icon: '💻', color: 'var(--cl-purple)', label: 'Shell' },
  git: { icon: '🔀', color: 'var(--cl-warning)', label: 'Git' },
  mcp: { icon: '🔌', color: 'var(--cl-cyan)', label: 'MCP' },
  deploy: { icon: '🚀', color: 'var(--cl-success)', label: 'Deploy' },
  search: { icon: '🔍', color: 'var(--cl-pink)', label: 'Search' },
  other: { icon: '⚙️', color: 'var(--cl-gray)', label: 'Other' },
};

// Status configurations
const statusConfig: Record<ToolStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'var(--cl-gray)', label: 'Pending' },
  running: { icon: '◐', color: 'var(--cl-info)', label: 'Running' },
  success: { icon: '✓', color: 'var(--cl-success)', label: 'Success' },
  error: { icon: '✕', color: 'var(--cl-error)', label: 'Error' },
  cancelled: { icon: '⊘', color: 'var(--cl-warning)', label: 'Cancelled' },
};

// Tool name to category mapping
// Helper to categorize tools (used when category not provided in execution data)
function _getToolCategory(tool: string): ToolCategory {
  if (tool.match(/read_file|write_file|edit_file|list_files|search_files/)) return 'file';
  if (tool.match(/execute_shell|run_build|run_tests|install_packages/)) return 'shell';
  if (tool.match(/git_|create_pr/)) return 'git';
  if (tool.match(/mcp_|mcp__/)) return 'mcp';
  if (tool.match(/deploy_/)) return 'deploy';
  if (tool.match(/search_code|web_fetch/)) return 'search';
  return 'other';
}
void _getToolCategory; // Reserved for auto-categorization feature

// Helper to safely stringify values for display
function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function CodeLabToolHistory({
  executions,
  onRetry,
  onCancel,
  onClear,
  isCollapsed = false,
  onToggleCollapse,
}: CodeLabToolHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<ToolCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ToolStatus | 'all'>('all');

  // Toggle execution expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Filter executions
  const filteredExecutions = useMemo(() => {
    return executions.filter((exec) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !exec.tool.toLowerCase().includes(query) &&
          !JSON.stringify(exec.input).toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Category filter
      if (filterCategory !== 'all' && exec.category !== filterCategory) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && exec.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [executions, searchQuery, filterCategory, filterStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = executions.length;
    const success = executions.filter((e) => e.status === 'success').length;
    const errors = executions.filter((e) => e.status === 'error').length;
    const running = executions.filter((e) => e.status === 'running').length;
    const totalDuration = executions
      .filter((e) => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);

    return { total, success, errors, running, totalDuration };
  }, [executions]);

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format timestamp
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Render a single execution
  const renderExecution = (exec: ToolExecution): ReactNode => {
    const isExpanded = expandedIds.has(exec.id);
    const category = categoryConfig[exec.category];
    const status = statusConfig[exec.status];

    // Pre-compute string values to avoid type issues in JSX
    const inputStr: string = stringifyValue(exec.input);
    const outputStr: string = exec.output ? stringifyValue(exec.output) : '';

    return (
      <div
        key={exec.id}
        className={`execution-item status-${exec.status}`}
        data-testid={`execution-${exec.id}`}
      >
        {/* Header */}
        <div className="execution-header" onClick={() => toggleExpand(exec.id)}>
          <div className="execution-status">
            <span
              className={`status-icon ${exec.status === 'running' ? 'spinning' : ''}`}
              style={{ color: status.color }}
            >
              {status.icon}
            </span>
          </div>

          <div className="execution-info">
            <span className="tool-category" style={{ color: category.color }}>
              {category.icon}
            </span>
            <span className="tool-name">{exec.tool}</span>
          </div>

          <div className="execution-meta">
            {exec.duration && (
              <span className="execution-duration">{formatDuration(exec.duration)}</span>
            )}
            <span className="execution-time">{formatTime(exec.startTime)}</span>
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </span>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="execution-details">
            {/* Input */}
            <div className="detail-section">
              <div className="detail-label">Input</div>
              <pre className="detail-code">{inputStr}</pre>
            </div>

            {/* Output or Error */}
            {exec.status === 'success' && exec.output ? (
              <div className="detail-section">
                <div className="detail-label">Output</div>
                <pre className="detail-code output">{outputStr}</pre>
              </div>
            ) : null}

            {exec.status === 'error' && exec.error ? (
              <div className="detail-section error">
                <div className="detail-label">Error</div>
                <pre className="detail-code error">{exec.error}</pre>
              </div>
            ) : null}

            {/* Actions */}
            <div className="detail-actions">
              {exec.status === 'error' && onRetry && (
                <button className="action-btn retry" onClick={() => onRetry(exec.id)}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.705 8.005a.75.75 0 01.834.656 5.5 5.5 0 009.592 2.97l-1.204-1.204a.25.25 0 01.177-.427h3.646a.25.25 0 01.25.25v3.646a.25.25 0 01-.427.177l-1.38-1.38A7.001 7.001 0 011.05 8.84a.75.75 0 01.656-.834zM8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.38 1.38A7.001 7.001 0 0114.95 7.16a.75.75 0 11-1.49.178A5.5 5.5 0 008 2.5z" />
                  </svg>
                  Retry
                </button>
              )}
              {exec.status === 'running' && onCancel && (
                <button className="action-btn cancel" onClick={() => onCancel(exec.id)}>
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                  </svg>
                  Cancel
                </button>
              )}
              <button
                className="action-btn copy"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(exec, null, 2))}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                  <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
                </svg>
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`code-lab-tool-history ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="history-header">
        <div className="header-left">
          <button className="collapse-btn" onClick={onToggleCollapse}>
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={isCollapsed ? '-rotate-90' : 'rotate-0'}
            >
              <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z" />
            </svg>
          </button>
          <span className="header-icon">⚡</span>
          <span className="header-title">Tool Executions</span>
          <span className="header-count">{stats.total}</span>
          {stats.running > 0 && <span className="running-badge">{stats.running} running</span>}
        </div>
        <div className="header-right">
          {onClear && executions.length > 0 && (
            <button className="clear-btn" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {!isCollapsed && executions.length > 0 && (
        <div className="stats-bar">
          <div className="stat success">
            <span className="stat-value">{stats.success}</span>
            <span className="stat-label">Success</span>
          </div>
          <div className="stat error">
            <span className="stat-value">{stats.errors}</span>
            <span className="stat-label">Errors</span>
          </div>
          <div className="stat duration">
            <span className="stat-value">{formatDuration(stats.totalDuration)}</span>
            <span className="stat-label">Total Time</span>
          </div>
        </div>
      )}

      {/* Filters */}
      {!isCollapsed && executions.length > 0 && (
        <div className="filters-bar">
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Search tools"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ToolCategory | 'all')}
            className="filter-select"
            aria-label="Filter by category"
          >
            <option value="all">All Types</option>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ToolStatus | 'all')}
            className="filter-select"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            {Object.entries(statusConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.icon} {config.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Executions list */}
      {!isCollapsed && (
        <div className="executions-list">
          {filteredExecutions.length === 0 ? (
            <div className="empty-state">
              {executions.length === 0 ? (
                <>
                  <span className="empty-icon">⚡</span>
                  <p>No tool executions yet</p>
                  <span className="empty-hint">
                    Claude will execute tools as you interact with Code Lab
                  </span>
                </>
              ) : (
                <>
                  <span className="empty-icon">🔍</span>
                  <p>No matching executions</p>
                  <button
                    className="reset-filters"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCategory('all');
                      setFilterStatus('all');
                    }}
                  >
                    Reset filters
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredExecutions.map(renderExecution)
          )}
        </div>
      )}

      <style jsx>{`
        .code-lab-tool-history {
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }

        /* Header */
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          background: none;
          border: none;
          border-radius: 4px;
          color: var(--cl-text-tertiary, #4b5563);
          cursor: pointer;
          transition: all 0.15s;
        }

        .collapse-btn:hover {
          background: var(--cl-bg-hover, #f3f4f6);
          color: var(--cl-text-secondary, #374151);
        }

        .collapse-btn svg {
          width: 14px;
          height: 14px;
          transition: transform 0.2s;
        }

        .header-icon {
          font-size: 1.125rem;
        }

        .header-title {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--cl-text-primary, #1a1f36);
        }

        .header-count {
          padding: 0.125rem 0.5rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 9999px;
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #4b5563);
        }

        .running-badge {
          padding: 0.125rem 0.5rem;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 9999px;
          font-size: 0.75rem;
          color: #3b82f6;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .clear-btn {
          padding: 0.25rem 0.75rem;
          background: none;
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 6px;
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #4b5563);
          cursor: pointer;
          transition: all 0.15s;
        }

        .clear-btn:hover {
          background: var(--cl-bg-hover, #f3f4f6);
          border-color: var(--cl-text-tertiary, #4b5563);
        }

        /* Stats bar */
        .stats-bar {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .stat-value {
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .stat.success .stat-value {
          color: #22c55e;
        }

        .stat.error .stat-value {
          color: #ef4444;
        }

        .stat-label {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cl-text-tertiary, #4b5563);
        }

        /* Filters */
        .filters-bar {
          display: flex;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .search-input {
          flex: 1;
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 6px;
          background: var(--cl-bg-primary, #ffffff);
          color: var(--cl-text-primary, #1a1f36);
          outline: none;
        }

        .search-input:focus {
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .filter-select {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 6px;
          background: var(--cl-bg-primary, #ffffff);
          color: var(--cl-text-secondary, #374151);
          cursor: pointer;
        }

        /* Executions list */
        .executions-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .execution-item {
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .execution-item:last-child {
          border-bottom: none;
        }

        .execution-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .execution-header:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .execution-status {
          width: 20px;
          text-align: center;
        }

        .status-icon {
          font-size: 1rem;
        }

        .status-icon.spinning {
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

        .execution-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tool-category {
          font-size: 0.875rem;
        }

        .tool-name {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.8125rem;
          color: var(--cl-text-primary, #1a1f36);
        }

        .execution-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .execution-duration {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #4b5563);
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .execution-time {
          font-size: 0.75rem;
          color: var(--cl-text-muted, #6b7280);
        }

        .expand-icon {
          color: var(--cl-text-tertiary, #4b5563);
          transition: transform 0.2s;
        }

        .expand-icon.expanded {
          transform: rotate(90deg);
        }

        .expand-icon svg {
          width: 14px;
          height: 14px;
        }

        /* Execution details */
        .execution-details {
          padding: 0 1rem 1rem;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .detail-section {
          margin-bottom: 0.75rem;
        }

        .detail-section.error .detail-label {
          color: #ef4444;
        }

        .detail-label {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cl-text-tertiary, #4b5563);
          margin-bottom: 0.375rem;
        }

        .detail-code {
          padding: 0.75rem;
          background: var(--cl-bg-code, #1e1e1e);
          color: #e5e7eb;
          border-radius: 8px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.75rem;
          overflow-x: auto;
          margin: 0;
          max-height: 200px;
          overflow-y: auto;
        }

        .detail-code.output {
          background: #0f2e1f;
          color: #86efac;
        }

        .detail-code.error {
          background: #2e0f0f;
          color: #fca5a5;
        }

        .detail-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn svg {
          width: 14px;
          height: 14px;
        }

        .action-btn.retry {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .action-btn.retry:hover {
          background: rgba(34, 197, 94, 0.2);
        }

        .action-btn.cancel {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .action-btn.cancel:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .action-btn.copy {
          background: var(--cl-bg-tertiary, #f3f4f6);
          color: var(--cl-text-secondary, #374151);
          border: 1px solid var(--cl-border-secondary, #d1d5db);
        }

        .action-btn.copy:hover {
          background: var(--cl-bg-hover, #e5e7eb);
        }

        /* Empty state */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem;
          text-align: center;
        }

        .empty-icon {
          font-size: 2.5rem;
          margin-bottom: 0.75rem;
        }

        .empty-state p {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
          margin: 0 0 0.5rem;
        }

        .empty-hint {
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary, #4b5563);
        }

        .reset-filters {
          padding: 0.5rem 1rem;
          margin-top: 0.75rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 6px;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          cursor: pointer;
          transition: all 0.15s;
        }

        .reset-filters:hover {
          background: var(--cl-bg-hover, #e5e7eb);
        }
      `}</style>
    </div>
  );
}

export default CodeLabToolHistory;
