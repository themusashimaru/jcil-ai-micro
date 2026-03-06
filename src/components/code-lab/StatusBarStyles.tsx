import React from 'react';

export const StatusBarStyles = React.memo(function StatusBarStyles() {
  return (
    <style>{`
        .code-lab-status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 24px;
          padding: 0 8px;
          background: var(--cl-bg-secondary, #161b22);
          border-top: 1px solid var(--cl-border, #30363d);
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          user-select: none;
          contain: layout;
        }

        .status-left,
        .status-center,
        .status-right {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .status-left { justify-content: flex-start; flex: 1; }
        .status-center { justify-content: center; }
        .status-right { justify-content: flex-end; flex: 1; }

        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: transparent;
          border: none;
          border-radius: 3px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 11px;
          cursor: default;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .status-item.clickable {
          cursor: pointer;
        }

        .status-item.clickable:hover {
          background: var(--cl-bg-hover, #21262d);
          color: var(--cl-text-primary, #e6edf3);
        }

        .status-item:disabled {
          pointer-events: none;
        }

        .status-icon {
          display: flex;
          align-items: center;
          font-size: 10px;
        }

        .status-label {
          font-weight: 500;
        }

        .status-value {
          opacity: 0.8;
        }

        /* Status colors */
        .status-success { color: var(--cl-accent-green, #3fb950); }
        .status-warning { color: var(--cl-accent-yellow, #d29922); }
        .status-error { color: var(--cl-text-danger, #f85149); }
        .status-info { color: var(--cl-accent, #58a6ff); }

        /* Animations */
        .animate-pulse {
          animation: statusPulse 1.5s ease-in-out infinite;
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Model Indicator */
        .model-indicator {
          color: var(--model-color, #a855f7);
          font-weight: 600;
        }

        .model-icon {
          font-size: 10px;
        }

        /* Token Indicator */
        .token-indicator {
          gap: 6px;
        }

        .token-icon {
          font-size: 9px;
        }

        .token-bar {
          width: 40px;
          height: 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-radius: 2px;
          overflow: hidden;
        }

        .token-bar-fill {
          height: 100%;
          background: currentColor;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        /* Connection Indicator */
        .connection-dot {
          width: 8px;
          height: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
        }

        .connection-dot.connected { color: var(--cl-accent-green, #3fb950); }
        .connection-dot.connecting { color: var(--cl-accent-yellow, #d29922); }
        .connection-dot.disconnected { color: var(--cl-text-muted, #6e7681); }
        .connection-dot.error { color: var(--cl-text-danger, #f85149); }

        /* Sandbox Indicator */
        .sandbox-icon {
          font-size: 10px;
        }

        /* Git Indicator */
        .git-indicator {
          gap: 4px;
        }

        .git-icon {
          display: flex;
          color: var(--cl-accent-orange, #f0883e);
        }

        .git-branch {
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .git-dirty {
          color: var(--cl-accent-yellow, #d29922);
          font-weight: bold;
        }

        .git-sync {
          color: var(--cl-accent, #58a6ff);
          font-size: 10px;
        }

        .git-indicator.dirty .git-branch {
          color: var(--cl-accent-yellow, #d29922);
        }

        /* File Indicator */
        .file-indicator {
          gap: 8px;
        }

        .file-language {
          text-transform: capitalize;
        }

        .file-encoding,
        .file-line-ending {
          color: var(--cl-text-muted, #6e7681);
        }

        .file-position {
          color: var(--cl-text-tertiary, #8b949e);
        }

        /* Task Indicator */
        .task-spinner {
          display: inline-block;
          font-size: 10px;
        }

        .status-warning .task-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* MCP Indicator */
        .mcp-indicator {
          gap: 4px;
        }

        .mcp-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 14px;
          height: 14px;
          padding: 0 4px;
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
          border-radius: 7px;
          font-size: 9px;
          font-weight: 600;
          color: var(--cl-accent, #58a6ff);
        }

        /* Time */
        .status-time {
          color: var(--cl-text-muted, #6e7681);
          font-variant-numeric: tabular-nums;
        }

        /* Keyboard hint */
        .keyboard-hint {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--cl-text-muted, #6e7681);
        }

        .kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 1px 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 3px;
          font-size: 9px;
          font-family: 'SF Mono', monospace;
        }

        /* Separator */
        .status-separator {
          width: 1px;
          height: 12px;
          background: var(--cl-border, #30363d);
          margin: 0 4px;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .code-lab-status-bar {
            height: 28px;
            padding: 0 4px;
          }

          .status-center,
          .file-indicator,
          .keyboard-hint,
          .token-bar {
            display: none;
          }

          .status-item {
            padding: 2px 4px;
          }

          .git-branch {
            max-width: 80px;
          }
        }
      `}</style>
  );
});
