'use client';

/**
 * CODE LAB TOOL PROGRESS
 *
 * Beautiful progress indicators for tool executions.
 * Shows what the AI is doing in real-time.
 * Features:
 * - Animated progress indicators
 * - Tool-specific icons
 * - Expandable details
 * - Status colors
 */

import { useState } from 'react';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  name: string;
  description?: string;
  status: ToolStatus;
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

interface CodeLabToolProgressProps {
  tools: ToolExecution[];
  className?: string;
}

const TOOL_ICONS: Record<string, string> = {
  // File operations
  Read: '📖',
  Write: '✏️',
  Edit: '📝',
  Glob: '🔍',
  Grep: '🔎',

  // Bash/Terminal
  Bash: '💻',
  Terminal: '🖥️',

  // Git
  GitStatus: '📊',
  GitCommit: '✅',
  GitPush: '🚀',
  GitPull: '⬇️',
  GitDiff: '📋',

  // Web
  WebFetch: '🌐',
  WebSearch: '🔍',

  // AI
  Think: '🧠',
  Analyze: '🔬',

  // Default
  default: '⚙️',
};

function getToolIcon(toolName: string): string {
  // Try exact match first
  if (TOOL_ICONS[toolName]) return TOOL_ICONS[toolName];

  // Try partial match
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (toolName.toLowerCase().includes(key.toLowerCase())) {
      return icon;
    }
  }

  return TOOL_ICONS.default;
}

function formatDuration(startTime?: Date, endTime?: Date): string {
  if (!startTime) return '';

  const end = endTime || new Date();
  const ms = end.getTime() - startTime.getTime();

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function CodeLabToolProgress({ tools, className = '' }: CodeLabToolProgressProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (tools.length === 0) return null;

  const runningTools = tools.filter(t => t.status === 'running');
  const completedTools = tools.filter(t => t.status === 'success' || t.status === 'error');

  return (
    <div className={`tool-progress ${className}`}>
      {/* Running tools */}
      {runningTools.length > 0 && (
        <div className="progress-section running">
          <div className="section-header">
            <div className="running-indicator">
              <span className="pulse-dot" />
              <span>Running</span>
            </div>
            <span className="count">{runningTools.length}</span>
          </div>

          <div className="tool-list">
            {runningTools.map(tool => (
              <div key={tool.id} className="tool-item running">
                <span className="tool-icon">{getToolIcon(tool.name)}</span>
                <div className="tool-info">
                  <span className="tool-name">{tool.name}</span>
                  {tool.description && (
                    <span className="tool-desc">{tool.description}</span>
                  )}
                </div>
                <div className="tool-status">
                  <div className="spinner" />
                  <span className="duration">{formatDuration(tool.startTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tools */}
      {completedTools.length > 0 && (
        <div className="progress-section completed">
          <div className="section-header">
            <span>Completed</span>
            <span className="count">{completedTools.length}</span>
          </div>

          <div className="tool-list">
            {completedTools.map(tool => (
              <div
                key={tool.id}
                className={`tool-item ${tool.status}`}
                onClick={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
              >
                <span className="tool-icon">{getToolIcon(tool.name)}</span>
                <div className="tool-info">
                  <span className="tool-name">{tool.name}</span>
                  {tool.description && (
                    <span className="tool-desc">{tool.description}</span>
                  )}
                </div>
                <div className="tool-status">
                  <span className={`status-badge ${tool.status}`}>
                    {tool.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span className="duration">
                    {formatDuration(tool.startTime, tool.endTime)}
                  </span>
                </div>

                {/* Expandable output */}
                {expandedId === tool.id && (tool.output || tool.error) && (
                  <div className="tool-output" onClick={(e) => e.stopPropagation()}>
                    {tool.error ? (
                      <pre className="error">{tool.error}</pre>
                    ) : (
                      <pre>{tool.output}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .tool-progress {
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .progress-section {
          padding: 0.75rem;
        }

        .progress-section + .progress-section {
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--cl-text-tertiary, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .running-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--cl-accent-primary, #6366f1);
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--cl-accent-primary, #6366f1);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .count {
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 999px;
          font-size: 0.625rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .tool-list {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .tool-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.75rem;
          background: var(--cl-bg-primary, white);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tool-item:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .tool-item.running {
          border-left: 3px solid var(--cl-accent-primary, #6366f1);
        }

        .tool-item.success {
          border-left: 3px solid var(--cl-success, #22c55e);
        }

        .tool-item.error {
          border-left: 3px solid var(--cl-error, #ef4444);
        }

        .tool-icon {
          font-size: 1.125rem;
          flex-shrink: 0;
        }

        .tool-info {
          flex: 1;
          min-width: 0;
        }

        .tool-name {
          display: block;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
        }

        .tool-desc {
          display: block;
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tool-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--cl-border-primary, #e5e7eb);
          border-top-color: var(--cl-accent-primary, #6366f1);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .status-badge {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 0.6875rem;
          font-weight: bold;
        }

        .status-badge.success {
          background: #dcfce7;
          color: var(--cl-success, #22c55e);
        }

        .status-badge.error {
          background: #fef2f2;
          color: var(--cl-error, #ef4444);
        }

        .duration {
          font-size: 0.6875rem;
          color: var(--cl-text-muted, #9ca3af);
          font-variant-numeric: tabular-nums;
        }

        .tool-output {
          width: 100%;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .tool-output pre {
          margin: 0;
          padding: 0.5rem;
          background: var(--cl-bg-code, #1e1e1e);
          color: #d4d4d4;
          border-radius: 6px;
          font-size: 0.75rem;
          overflow-x: auto;
          max-height: 200px;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .tool-output pre.error {
          background: #fef2f2;
          color: var(--cl-error, #ef4444);
        }
      `}</style>
    </div>
  );
}

/**
 * Mini progress bar for inline display
 */
interface MiniProgressProps {
  running: boolean;
  progress?: number; // 0-100
  className?: string;
}

export function CodeLabMiniProgress({ running, progress, className = '' }: MiniProgressProps) {
  if (!running && !progress) return null;

  return (
    <div className={`mini-progress ${className}`}>
      <div
        className={`progress-bar ${running ? 'indeterminate' : ''}`}
        style={progress !== undefined ? { width: `${progress}%` } : undefined}
      />

      <style jsx>{`
        .mini-progress {
          height: 3px;
          background: var(--cl-border-primary, #e5e7eb);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(
            90deg,
            var(--cl-accent-primary, #6366f1),
            var(--cl-accent-secondary, #818cf8)
          );
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .progress-bar.indeterminate {
          width: 30%;
          animation: indeterminate 1.5s ease-in-out infinite;
        }

        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
