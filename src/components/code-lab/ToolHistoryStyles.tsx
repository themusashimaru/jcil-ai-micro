'use client';

export function ToolHistoryStyles() {
  return (
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
  );
}
