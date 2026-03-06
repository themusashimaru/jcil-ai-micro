'use client';

import type { ReactNode } from 'react';
import {
  categoryConfig,
  statusConfig,
  stringifyValue,
  formatDuration,
  formatTime,
} from './toolHistoryConfig';
import type { ToolExecution } from './toolHistoryConfig';

interface ToolExecutionItemProps {
  exec: ToolExecution;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onRetry?: (executionId: string) => void;
  onCancel?: (executionId: string) => void;
}

export function ToolExecutionItem({
  exec,
  isExpanded,
  onToggleExpand,
  onRetry,
  onCancel,
}: ToolExecutionItemProps): ReactNode {
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
      <div className="execution-header" onClick={() => onToggleExpand(exec.id)}>
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
}
