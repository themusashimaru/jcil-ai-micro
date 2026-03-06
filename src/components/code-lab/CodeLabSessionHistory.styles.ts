export const sessionHistoryStyles = `
  .session-history-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .session-history-modal {
    background: white;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 700px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-title svg {
    width: 24px;
    height: 24px;
    color: #6b7280;
  }

  .header-title h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .search-container {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.9375rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .search-filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .role-filter {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.8125rem;
    background: white;
    cursor: pointer;
  }

  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
    margin-left: auto;
  }

  .export-btn:hover {
    background: #e5e7eb;
  }

  .export-btn svg {
    width: 16px;
    height: 16px;
  }

  .search-error {
    padding: 0.75rem 1.25rem;
    background: #fef2f2;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .search-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: #6b7280;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .search-results {
    flex: 1;
    overflow-y: auto;
  }

  .results-breakdown {
    padding: 0.75rem 1.25rem;
    background: var(--cl-bg-secondary, #f9fafb);
    border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
  }

  .breakdown-label {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
  }

  .breakdown-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .breakdown-chip {
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .breakdown-chip:hover {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .breakdown-more {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .results-list {
    padding: 0.5rem;
  }

  .result-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .result-item:hover {
    background: var(--cl-bg-secondary, #f9fafb);
    border-color: var(--cl-border-primary, #e5e7eb);
  }

  .result-item.current {
    background: #eff6ff;
    border-color: #93c5fd;
  }

  .result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .result-session {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #111827;
  }

  .result-role {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .result-time {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-left: auto;
  }

  .result-contexts {
    margin: 0;
  }

  .result-context {
    margin: 0 0 0.25rem;
    font-size: 0.8125rem;
    color: #4b5563;
    line-height: 1.5;
  }

  .result-context :global(mark) {
    background: #fef08a;
    padding: 0 0.125rem;
    border-radius: 2px;
  }

  .search-empty,
  .search-initial {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    text-align: center;
    color: #6b7280;
  }

  .search-empty svg,
  .search-initial svg {
    width: 48px;
    height: 48px;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .search-empty p,
  .search-initial p {
    margin: 0 0 0.25rem;
    font-size: 0.9375rem;
    color: #374151;
  }

  .search-empty span,
  .search-initial span {
    font-size: 0.8125rem;
  }

  .history-hints {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.75rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .history-hints kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-family: 'SF Mono', monospace;
    font-size: 0.6875rem;
  }

  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    .session-history-modal {
      background: #1f2937;
    }

    .history-header {
      border-color: #374151;
    }

    .header-title h2 {
      color: #f9fafb;
    }

    .close-btn:hover {
      background: #374151;
      color: #f9fafb;
    }

    .search-container {
      border-color: #374151;
    }

    .search-input {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }

    .search-input:focus {
      border-color: #60a5fa;
    }

    .role-filter {
      background: #111827;
      border-color: #374151;
      color: #f9fafb;
    }

    .export-btn {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .results-breakdown {
      background: #111827;
      border-color: #374151;
    }

    .breakdown-chip {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    .result-item:hover {
      background: #374151;
      border-color: #4b5563;
    }

    .result-session {
      color: #f9fafb;
    }

    .result-context {
      color: #d1d5db;
    }

    .history-hints {
      background: #111827;
      border-color: #374151;
    }

    .history-hints kbd {
      background: #374151;
      border-color: #4b5563;
    }
  }
`;
