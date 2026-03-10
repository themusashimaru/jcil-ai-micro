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

import { useState, useMemo, useCallback } from 'react';
import { categoryConfig, statusConfig, formatDuration } from './toolHistoryConfig';
import type { ToolCategory, ToolStatus, CodeLabToolHistoryProps } from './toolHistoryConfig';
import { ToolExecutionItem } from './ToolExecutionItem';
import { ToolHistoryStyles } from './ToolHistoryStyles';

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
            filteredExecutions.map((exec) => (
              <ToolExecutionItem
                key={exec.id}
                exec={exec}
                isExpanded={expandedIds.has(exec.id)}
                onToggleExpand={toggleExpand}
                onRetry={onRetry}
                onCancel={onCancel}
              />
            ))
          )}
        </div>
      )}

      <ToolHistoryStyles />
    </div>
  );
}

export default CodeLabToolHistory;
