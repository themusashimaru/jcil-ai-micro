export const emptyStateStyles = `
  .code-lab-editor.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: var(--cl-bg-secondary, #f9fafb);
  }

  .editor-empty-state {
    text-align: center;
    padding: 3rem;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--cl-text-tertiary, #4b5563);
    margin-bottom: 1rem;
  }

  .editor-empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--cl-text-primary, #1a1f36);
    margin: 0 0 0.5rem;
  }

  .editor-empty-state p {
    color: var(--cl-text-secondary, #374151);
    margin: 0 0 1.5rem;
  }

  .empty-action {
    padding: 0.75rem 1.5rem;
    background: var(--cl-accent-primary, #1e3a5f);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .empty-action:hover {
    background: var(--cl-accent-secondary, #2d4a6f);
  }
`;

export const editorStyles = `
  .code-lab-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--cl-bg-primary, #ffffff);
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  }

  .code-lab-editor.dark {
    background: var(--cl-bg-primary, #0f1419);
  }

  /* Tabs */
  .editor-tabs {
    display: flex;
    background: var(--cl-bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .editor-tabs::-webkit-scrollbar {
    display: none;
  }

  .editor-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    color: var(--cl-text-secondary, #374151);
    border-right: 1px solid var(--cl-border-primary, #e5e7eb);
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .editor-tab:hover {
    background: var(--cl-bg-hover, #f3f4f6);
  }

  .editor-tab.active {
    background: var(--cl-bg-primary, #ffffff);
    color: var(--cl-text-primary, #1a1f36);
    border-bottom: 2px solid var(--cl-accent-primary, #1e3a5f);
    margin-bottom: -1px;
  }

  .tab-icon {
    font-size: 1rem;
  }

  .tab-dirty-indicator {
    width: 8px;
    height: 8px;
    background: var(--cl-warning, #f59e0b);
    border-radius: 50%;
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--cl-text-tertiary, #4b5563);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .editor-tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: var(--cl-bg-hover, #f3f4f6);
    color: var(--cl-error, #ef4444);
  }

  .tab-close svg {
    width: 12px;
    height: 12px;
  }

  /* Breadcrumbs */
  .editor-breadcrumbs {
    display: flex;
    align-items: center;
    padding: 0.25rem 1rem;
    font-size: 0.75rem;
    color: var(--cl-text-tertiary, #4b5563);
    background: var(--cl-bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
  }

  .breadcrumb-separator {
    margin: 0 0.375rem;
    color: var(--cl-text-muted, #6b7280);
  }

  .breadcrumb-current {
    color: var(--cl-text-primary, #1a1f36);
  }

  /* Diff Actions */
  .diff-actions-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: var(--cl-bg-tertiary, #f3f4f6);
    border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
  }

  .diff-info {
    font-size: 0.8125rem;
    color: var(--cl-text-secondary, #374151);
  }

  .diff-count {
    font-weight: 500;
  }

  .diff-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .diff-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .diff-btn svg {
    width: 14px;
    height: 14px;
  }

  .diff-btn.accept-all {
    background: var(--cl-success, #22c55e);
    color: white;
    border: none;
  }

  .diff-btn.accept-all:hover:not(:disabled) {
    background: #16a34a;
  }

  .diff-btn.reject-all {
    background: transparent;
    color: var(--cl-error, #ef4444);
    border: 1px solid var(--cl-error, #ef4444);
  }

  .diff-btn.reject-all:hover:not(:disabled) {
    background: #fee2e2;
  }

  .diff-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Search Bar */
  .editor-search-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--cl-bg-tertiary, #f3f4f6);
    border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
  }

  .editor-search-bar input {
    flex: 1;
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--cl-border-secondary, #d1d5db);
    border-radius: 6px;
    background: var(--cl-bg-primary, #ffffff);
    color: var(--cl-text-primary, #1a1f36);
    outline: none;
  }

  .editor-search-bar input:focus {
    border-color: var(--cl-accent-primary, #1e3a5f);
    box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.1);
  }

  .search-results-count {
    font-size: 0.75rem;
    color: var(--cl-text-tertiary, #4b5563);
  }

  .editor-search-bar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: 1px solid var(--cl-border-secondary, #d1d5db);
    border-radius: 4px;
    color: var(--cl-text-secondary, #374151);
    cursor: pointer;
  }

  .editor-search-bar button:hover:not(:disabled) {
    background: var(--cl-bg-hover, #f3f4f6);
  }

  .editor-search-bar button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .editor-search-bar button svg {
    width: 14px;
    height: 14px;
  }

  /* Editor Container */
  .editor-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  /* Line Numbers */
  .line-numbers {
    width: 50px;
    padding: 0.5rem 0;
    background: var(--cl-bg-secondary, #f9fafb);
    border-right: 1px solid var(--cl-border-primary, #e5e7eb);
    overflow: hidden;
    user-select: none;
  }

  .line-number {
    padding: 0 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.5rem;
    text-align: right;
    color: var(--cl-text-muted, #6b7280);
  }

  /* Editor Content */
  .editor-content {
    flex: 1;
    padding: 0.5rem 1rem;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.5rem;
    background: var(--cl-bg-primary, #ffffff);
    color: var(--cl-text-primary, #1a1f36);
    border: none;
    outline: none;
    resize: none;
    overflow: auto;
    white-space: pre;
    tab-size: 2;
  }

  .editor-content::selection {
    background: var(--cl-accent-bg, #eef3f8);
  }

  /* Minimap */
  .editor-minimap {
    width: 80px;
    background: var(--cl-bg-secondary, #f9fafb);
    border-left: 1px solid var(--cl-border-primary, #e5e7eb);
    position: relative;
  }

  .minimap-content {
    position: absolute;
    top: 0;
    left: 4px;
    right: 4px;
    background: linear-gradient(
      to bottom,
      var(--cl-text-muted, #6b7280) 1px,
      transparent 1px
    );
    background-size: 100% 4px;
    opacity: 0.3;
  }

  /* Status Bar */
  .editor-status-bar {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 1rem;
    font-size: 0.75rem;
    background: var(--cl-accent-primary, #1e3a5f);
    color: rgba(255, 255, 255, 0.8);
  }

  .status-left,
  .status-right {
    display: flex;
    gap: 1rem;
  }

  .status-item {
    padding: 0 0.25rem;
  }

  .status-dirty {
    color: var(--cl-warning, #fbbf24);
  }

  /* Mobile */
  @media (max-width: 768px) {
    .line-numbers {
      width: 40px;
    }

    .editor-minimap {
      display: none;
    }
  }
`;
