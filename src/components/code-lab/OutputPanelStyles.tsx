export function OutputPanelStyles() {
  return (
    <style jsx>{`
      .output-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .output-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border-bottom: 1px solid #e5e7eb;
      }

      .output-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: #1a1f36;
      }

      .output-title svg {
        width: 18px;
        height: 18px;
        color: #1e3a5f;
      }

      .output-badge {
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        background: #e5e7eb;
        border-radius: 9999px;
        color: #6b7280;
      }

      .output-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .output-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 0.8125rem;
        color: #374151;
        cursor: pointer;
        transition: all 0.2s;
      }

      .output-btn:hover:not(:disabled) {
        background: #f3f4f6;
        border-color: #d1d5db;
      }

      .output-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .output-btn svg {
        width: 16px;
        height: 16px;
      }

      .output-btn.push {
        background: #1a1f36;
        border-color: #1a1f36;
        color: white;
      }

      .output-btn.push:hover:not(:disabled) {
        background: #2d3348;
      }

      .output-btn.close {
        padding: 0.375rem;
      }

      .spinner {
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

      .output-stats {
        display: flex;
        gap: 1rem;
        padding: 0.5rem 1rem;
        background: var(--cl-bg-secondary, #f9fafb);
        border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        font-size: 0.75rem;
        color: var(--cl-text-muted, #6b7280);
      }

      .stat-value {
        font-weight: 600;
        color: #374151;
      }

      .stat.new .stat-value {
        color: #16a34a;
      }

      .stat.modified .stat-value {
        color: #f59e0b;
      }

      .output-content {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      .output-files {
        width: 240px;
        flex-shrink: 0;
        border-right: 1px solid #e5e7eb;
        overflow-y: auto;
        background: #fafbfc;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: none;
        border: none;
        font-size: 0.8125rem;
        color: #374151;
        cursor: pointer;
        text-align: left;
        border-bottom: 1px solid #f3f4f6;
      }

      .file-item:hover {
        background: #f3f4f6;
      }

      .file-item.selected {
        background: var(--cl-info-bg, #eef2ff);
        color: var(--cl-accent-primary, #4f46e5);
      }

      .file-icon {
        flex-shrink: 0;
      }

      .file-icon svg {
        width: 16px;
        height: 16px;
      }

      .file-path {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-badge {
        font-size: 0.625rem;
        padding: 0.125rem 0.375rem;
        border-radius: 4px;
        font-weight: 500;
      }

      .file-badge.new {
        background: var(--cl-success-bg, #dcfce7);
        color: var(--cl-success, #16a34a);
      }

      .file-badge.modified {
        background: #fef3c7;
        color: #d97706;
      }

      .file-copy {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        color: #9ca3af;
        border-radius: 4px;
        opacity: 0;
        transition: all 0.2s;
      }

      .file-item:hover .file-copy {
        opacity: 1;
      }

      .file-copy:hover {
        color: var(--cl-accent-primary, #1e3a5f);
        background: var(--cl-info-bg, #eef2ff);
      }

      .file-copy svg {
        width: 14px;
        height: 14px;
      }

      .output-preview {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .preview-toggle {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
        background: #f8fafc;
      }

      .preview-toggle button {
        padding: 0.375rem 0.75rem;
        background: none;
        border: none;
        border-radius: 4px;
        font-size: 0.75rem;
        color: #6b7280;
        cursor: pointer;
      }

      .preview-toggle button.active {
        background: #1a1f36;
        color: white;
      }

      .code-preview {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .code-header {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        background: #f8fafc;
        border-bottom: 1px solid #e5e7eb;
      }

      .code-lang {
        font-size: 0.6875rem;
        font-weight: 500;
        color: #6b7280;
        text-transform: uppercase;
      }

      .code-lines {
        font-size: 0.6875rem;
        color: #9ca3af;
      }

      .code-content {
        flex: 1;
        margin: 0;
        padding: 1rem;
        background: #1e293b;
        overflow: auto;
      }

      .code-content code {
        font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
        font-size: 0.8125rem;
        line-height: 1.6;
        color: #e2e8f0;
        white-space: pre;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .output-content {
          flex-direction: column;
        }

        .output-files {
          width: 100%;
          max-height: 150px;
          border-right: none;
          border-bottom: 1px solid #e5e7eb;
        }

        .output-header {
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .output-actions {
          width: 100%;
          justify-content: flex-end;
        }

        .output-btn span {
          display: none;
        }
      }
    `}</style>
  );
}
