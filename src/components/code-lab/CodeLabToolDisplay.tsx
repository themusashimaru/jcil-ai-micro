'use client';

/**
 * CODE LAB TOOL DISPLAY
 *
 * Displays tool execution status inline in messages.
 * Shows Claude Code-like tool usage with:
 * - Tool name and icon
 * - Input parameters
 * - Execution status (running/completed/error)
 * - Output preview (collapsible)
 */

import { useState } from 'react';

export interface ToolExecution {
  id: string;
  tool: string;
  input?: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'error';
  startedAt: Date;
  completedAt?: Date;
}

interface CodeLabToolDisplayProps {
  execution: ToolExecution;
  compact?: boolean;
}

export function CodeLabToolDisplay({
  execution,
  compact = false,
}: CodeLabToolDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  const toolConfig = getToolConfig(execution.tool);
  const duration = execution.completedAt
    ? execution.completedAt.getTime() - execution.startedAt.getTime()
    : null;

  return (
    <div className={`tool-display ${execution.status} ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <button
        className="tool-header"
        onClick={() => setExpanded(!expanded)}
        disabled={!execution.output}
      >
        <span className="tool-icon">{toolConfig.icon}</span>
        <span className="tool-name">{toolConfig.name}</span>

        {execution.status === 'running' && (
          <span className="tool-status running">
            <span className="spinner" />
          </span>
        )}

        {execution.status === 'completed' && (
          <span className="tool-status completed">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}

        {execution.status === 'error' && (
          <span className="tool-status error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}

        {/* Input summary */}
        <span className="tool-input">
          {formatToolInput(execution.tool, execution.input)}
        </span>

        {duration !== null && (
          <span className="tool-duration">{formatDuration(duration)}</span>
        )}

        {execution.output && (
          <span className="expand-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        )}
      </button>

      {/* Output (collapsible) */}
      {expanded && execution.output && (
        <div className="tool-output">
          <pre>{truncateOutput(execution.output)}</pre>
        </div>
      )}

      <style jsx>{`
        .tool-display {
          margin: 0.5rem 0;
          border-radius: 6px;
          overflow: hidden;
          font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
          font-size: 0.8125rem;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .tool-display.running {
          border-color: #fbbf24;
          background: #fffbeb;
        }

        .tool-display.error {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .tool-display.compact {
          margin: 0.25rem 0;
        }

        .tool-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          color: #374151;
        }

        .tool-header:disabled {
          cursor: default;
        }

        .tool-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }

        .tool-name {
          font-weight: 600;
          color: #1a1f36;
          flex-shrink: 0;
        }

        .tool-status {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .tool-status svg {
          width: 14px;
          height: 14px;
        }

        .tool-status.completed svg {
          color: #16a34a;
        }

        .tool-status.error svg {
          color: #dc2626;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #fbbf24;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .tool-input {
          flex: 1;
          color: #6b7280;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tool-duration {
          font-size: 0.6875rem;
          color: #9ca3af;
          flex-shrink: 0;
        }

        .expand-icon {
          flex-shrink: 0;
          color: #9ca3af;
        }

        .expand-icon svg {
          width: 14px;
          height: 14px;
          transition: transform 0.2s;
        }

        .tool-output {
          padding: 0.5rem 0.75rem;
          background: #1e293b;
          border-top: 1px solid #e5e7eb;
          max-height: 200px;
          overflow-y: auto;
        }

        .tool-output pre {
          margin: 0;
          color: #e2e8f0;
          white-space: pre-wrap;
          word-break: break-all;
          font-size: 0.75rem;
          line-height: 1.5;
        }

        /* Compact mode */
        .compact .tool-header {
          padding: 0.375rem 0.5rem;
          font-size: 0.75rem;
        }

        .compact .tool-icon {
          font-size: 0.875rem;
        }

        .compact .tool-status svg,
        .compact .spinner {
          width: 12px;
          height: 12px;
        }
      `}</style>
    </div>
  );
}

// Tool configurations
interface ToolConfig {
  name: string;
  icon: string;
}

function getToolConfig(tool: string): ToolConfig {
  const configs: Record<string, ToolConfig> = {
    execute_shell: { name: 'Running command', icon: '>' },
    read_file: { name: 'Reading file', icon: '📄' },
    write_file: { name: 'Writing file', icon: '✏️' },
    edit_file: { name: 'Editing file', icon: '🔧' },
    list_files: { name: 'Listing files', icon: '📁' },
    search_files: { name: 'Searching files', icon: '🔍' },
    search_code: { name: 'Searching code', icon: '🔎' },
    git_status: { name: 'Git status', icon: '📊' },
    git_diff: { name: 'Git diff', icon: '📋' },
    git_commit: { name: 'Git commit', icon: '✅' },
    run_build: { name: 'Running build', icon: '🔨' },
    run_tests: { name: 'Running tests', icon: '🧪' },
    install_packages: { name: 'Installing packages', icon: '📦' },
  };

  return configs[tool] || { name: tool, icon: '⚙️' };
}

function formatToolInput(tool: string, input?: Record<string, unknown>): string {
  if (!input) return '';

  switch (tool) {
    case 'execute_shell':
      return `\`${input.command}\``;
    case 'read_file':
    case 'write_file':
    case 'edit_file':
      return `\`${input.path}\``;
    case 'list_files':
      return input.path ? `\`${input.path}\`` : '`/workspace`';
    case 'search_files':
      return `\`${input.pattern}\``;
    case 'search_code':
      return `"${input.pattern}"`;
    case 'git_commit':
      return `"${(input.message as string)?.substring(0, 50)}${(input.message as string)?.length > 50 ? '...' : ''}"`;
    default:
      return '';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function truncateOutput(output: string, maxLength = 1000): string {
  if (output.length <= maxLength) return output;
  return output.substring(0, maxLength) + '\n... (truncated)';
}

// Parse tool executions from workspace agent output
export function parseToolExecutions(content: string): ToolExecution[] {
  const executions: ToolExecution[] = [];

  // Match patterns like: `▶ Running command` `npm install`
  const toolStartRegex = /`▶\s+([^`]+)`\s+`([^`]+)`/g;
  let match;

  while ((match = toolStartRegex.exec(content)) !== null) {
    const toolName = match[1];
    const input = match[2];

    // Map display name back to tool name
    const toolMap: Record<string, string> = {
      'Running command': 'execute_shell',
      'Reading file': 'read_file',
      'Writing file': 'write_file',
      'Editing file': 'edit_file',
      'Listing files': 'list_files',
      'Searching files': 'search_files',
      'Searching code': 'search_code',
      'Git status': 'git_status',
      'Git diff': 'git_diff',
      'Git commit': 'git_commit',
      'Running build': 'run_build',
      'Running tests': 'run_tests',
      'Installing packages': 'install_packages',
    };

    const tool = toolMap[toolName] || toolName;

    executions.push({
      id: `tool-${executions.length}`,
      tool,
      input: tool === 'execute_shell' ? { command: input } : { path: input },
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    });
  }

  return executions;
}
