'use client';

/**
 * CODE LAB STATUS BAR
 *
 * Bottom status bar with real-time information display.
 * Mirrors VS Code / Claude Code CLI status bar experience.
 *
 * Features:
 * - Model indicator (Opus/Sonnet/Haiku)
 * - Token usage with visual progress
 * - Connection status (sandbox/MCP)
 * - Current file info (language, encoding, line)
 * - Git branch indicator
 * - Background task count
 * - Keyboard shortcuts hint
 * - Live indicators with smooth animations
 *
 * WCAG 2.1 AA Accessible
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ModelType = 'opus' | 'sonnet' | 'haiku';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export type SandboxStatus = 'active' | 'starting' | 'stopped' | 'error';

export interface TokenUsage {
  used: number;
  limit: number;
  costUSD?: number;
}

export interface FileInfo {
  name: string;
  language: string;
  encoding?: string;
  lineEnding?: 'LF' | 'CRLF';
  line?: number;
  column?: number;
}

export interface GitInfo {
  branch: string;
  isDirty: boolean;
  ahead?: number;
  behind?: number;
}

export interface BackgroundTask {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
}

export interface CodeLabStatusBarProps {
  model?: ModelType;
  tokens?: TokenUsage;
  connectionStatus?: ConnectionStatus;
  sandboxStatus?: SandboxStatus;
  file?: FileInfo;
  git?: GitInfo;
  backgroundTasks?: BackgroundTask[];
  mcpServersActive?: number;
  onModelClick?: () => void;
  onTokensClick?: () => void;
  onConnectionClick?: () => void;
  onSandboxClick?: () => void;
  onGitClick?: () => void;
  onTasksClick?: () => void;
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusItemProps {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  className?: string;
  tooltip?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
  animate?: boolean;
}

const StatusItem = React.memo(function StatusItem({
  icon,
  label,
  value,
  onClick,
  className = '',
  tooltip,
  status,
  animate,
}: StatusItemProps) {
  const statusClass = status ? `status-${status}` : '';
  const animateClass = animate ? 'animate-pulse' : '';
  const clickableClass = onClick ? 'clickable' : '';

  return (
    <button
      className={`status-item ${statusClass} ${animateClass} ${clickableClass} ${className}`}
      onClick={onClick}
      title={tooltip || label}
      disabled={!onClick}
      aria-label={tooltip || `${label}${value ? `: ${value}` : ''}`}
    >
      {icon && <span className="status-icon">{icon}</span>}
      <span className="status-label">{label}</span>
      {value && <span className="status-value">{value}</span>}
    </button>
  );
});

// ============================================================================
// MODEL INDICATOR
// ============================================================================

const MODEL_INFO: Record<ModelType, { name: string; color: string; icon: string }> = {
  opus: { name: 'Opus 4.6', color: 'var(--cl-model-opus)', icon: '◆' },
  sonnet: { name: 'Sonnet 4.6', color: 'var(--cl-model-sonnet)', icon: '◈' },
  haiku: { name: 'Haiku 4.5', color: 'var(--cl-model-haiku)', icon: '◇' },
};

interface ModelIndicatorProps {
  model: ModelType;
  onClick?: () => void;
}

const ModelIndicator = React.memo(function ModelIndicator({ model, onClick }: ModelIndicatorProps) {
  const info = MODEL_INFO[model];

  return (
    <button
      className="status-item model-indicator"
      onClick={onClick}
      title={`Current model: Claude ${info.name}`}
      aria-label={`Current model: Claude ${info.name}`}
      style={{ '--model-color': info.color } as React.CSSProperties}
    >
      <span className="model-icon" aria-hidden="true">
        {info.icon}
      </span>
      <span className="model-name">{info.name}</span>
    </button>
  );
});

// ============================================================================
// TOKEN USAGE INDICATOR
// ============================================================================

interface TokenIndicatorProps {
  usage: TokenUsage;
  onClick?: () => void;
}

const TokenIndicator = React.memo(function TokenIndicator({ usage, onClick }: TokenIndicatorProps) {
  const percentage = Math.min((usage.used / usage.limit) * 100, 100);
  const formattedUsed = formatTokenCount(usage.used);
  const formattedLimit = formatTokenCount(usage.limit);

  const status = percentage >= 90 ? 'error' : percentage >= 70 ? 'warning' : 'success';

  return (
    <button
      className={`status-item token-indicator status-${status}`}
      onClick={onClick}
      title={`Tokens: ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()}${usage.costUSD ? ` ($${usage.costUSD.toFixed(4)})` : ''}`}
      aria-label={`Token usage: ${formattedUsed} of ${formattedLimit}${usage.costUSD ? `, cost $${usage.costUSD.toFixed(4)}` : ''}`}
    >
      <span className="token-icon" aria-hidden="true">
        ⬡
      </span>
      <span className="token-text">
        {formattedUsed}/{formattedLimit}
      </span>
      <div className="token-bar">
        <div className="token-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </button>
  );
});

function formatTokenCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  onClick?: () => void;
}

const ConnectionIndicator = React.memo(function ConnectionIndicator({
  status,
  onClick,
}: ConnectionIndicatorProps) {
  const configs: Record<
    ConnectionStatus,
    { icon: string; label: string; status: StatusItemProps['status'] }
  > = {
    connected: { icon: '●', label: 'Connected', status: 'success' },
    connecting: { icon: '◐', label: 'Connecting...', status: 'warning' },
    disconnected: { icon: '○', label: 'Disconnected', status: undefined },
    error: { icon: '✕', label: 'Error', status: 'error' },
  };

  const config = configs[status];

  return (
    <StatusItem
      icon={<span className={`connection-dot ${status}`}>{config.icon}</span>}
      label={config.label}
      onClick={onClick}
      status={config.status}
      animate={status === 'connecting'}
      tooltip={`API connection: ${config.label}`}
    />
  );
});

// ============================================================================
// SANDBOX STATUS
// ============================================================================

interface SandboxIndicatorProps {
  status: SandboxStatus;
  onClick?: () => void;
}

const SandboxIndicator = React.memo(function SandboxIndicator({
  status,
  onClick,
}: SandboxIndicatorProps) {
  const configs: Record<
    SandboxStatus,
    { icon: string; label: string; status: StatusItemProps['status'] }
  > = {
    active: { icon: '▣', label: 'E2B Active', status: 'success' },
    starting: { icon: '◧', label: 'Starting...', status: 'warning' },
    stopped: { icon: '▢', label: 'E2B Stopped', status: undefined },
    error: { icon: '⚠', label: 'E2B Error', status: 'error' },
  };

  const config = configs[status];

  return (
    <StatusItem
      icon={<span className="sandbox-icon">{config.icon}</span>}
      label={config.label}
      onClick={onClick}
      status={config.status}
      animate={status === 'starting'}
      tooltip={`Sandbox: ${config.label}`}
    />
  );
});

// ============================================================================
// GIT INDICATOR
// ============================================================================

interface GitIndicatorProps {
  git: GitInfo;
  onClick?: () => void;
}

const GitIndicator = React.memo(function GitIndicator({ git, onClick }: GitIndicatorProps) {
  const syncInfo = [];
  if (git.ahead) syncInfo.push(`↑${git.ahead}`);
  if (git.behind) syncInfo.push(`↓${git.behind}`);

  return (
    <button
      className={`status-item git-indicator ${git.isDirty ? 'dirty' : ''}`}
      onClick={onClick}
      title={`Branch: ${git.branch}${git.isDirty ? ' (modified)' : ''}${syncInfo.length ? ` ${syncInfo.join(' ')}` : ''}`}
      aria-label={`Git branch: ${git.branch}${git.isDirty ? ', modified' : ''}${syncInfo.length ? `, ${syncInfo.join(' ')}` : ''}`}
    >
      <span className="git-icon" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M15.698 7.287L8.712.302a1.03 1.03 0 00-1.457 0L5.632 1.924l1.84 1.84a1.223 1.223 0 011.55 1.56l1.773 1.774a1.224 1.224 0 11-.733.69l-1.654-1.654v4.353a1.224 1.224 0 11-1.007-.019V6.054a1.224 1.224 0 01-.665-1.604L4.922 2.636.302 7.256a1.03 1.03 0 000 1.457l6.986 6.985a1.03 1.03 0 001.457 0l6.953-6.953a1.03 1.03 0 000-1.458z" />
        </svg>
      </span>
      <span className="git-branch">{git.branch}</span>
      {git.isDirty && <span className="git-dirty">*</span>}
      {syncInfo.length > 0 && <span className="git-sync">{syncInfo.join(' ')}</span>}
    </button>
  );
});

// ============================================================================
// FILE INFO
// ============================================================================

interface FileIndicatorProps {
  file: FileInfo;
}

const FileIndicator = React.memo(function FileIndicator({ file }: FileIndicatorProps) {
  return (
    <div className="status-item file-indicator" title={`${file.name} (${file.language})`}>
      <span className="file-language">{file.language}</span>
      {file.encoding && <span className="file-encoding">{file.encoding}</span>}
      {file.lineEnding && <span className="file-line-ending">{file.lineEnding}</span>}
      {file.line !== undefined && (
        <span className="file-position">
          Ln {file.line}
          {file.column !== undefined ? `, Col ${file.column}` : ''}
        </span>
      )}
    </div>
  );
});

// ============================================================================
// BACKGROUND TASKS
// ============================================================================

interface TaskIndicatorProps {
  tasks: BackgroundTask[];
  onClick?: () => void;
}

const TaskIndicator = React.memo(function TaskIndicator({ tasks, onClick }: TaskIndicatorProps) {
  const running = tasks.filter((t) => t.status === 'running').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;

  if (tasks.length === 0) return null;

  const status: StatusItemProps['status'] =
    failed > 0 ? 'error' : running > 0 ? 'warning' : 'success';

  return (
    <StatusItem
      icon={<span className="task-spinner">{running > 0 ? '◐' : failed > 0 ? '✕' : '✓'}</span>}
      label={`${running} task${running !== 1 ? 's' : ''}`}
      onClick={onClick}
      status={status}
      animate={running > 0}
      tooltip={`Background tasks: ${running} running, ${failed} failed, ${tasks.length - running - failed} completed`}
    />
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeLabStatusBar({
  model = 'opus',
  tokens,
  connectionStatus = 'connected',
  sandboxStatus = 'active',
  file,
  git,
  backgroundTasks = [],
  mcpServersActive: _mcpServersActive = 0,
  onModelClick,
  onTokensClick,
  onConnectionClick,
  onSandboxClick,
  onGitClick,
  onTasksClick,
  className = '',
}: CodeLabStatusBarProps) {
  const [time, setTime] = useState<string>('');

  // Update time every minute
  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      className={`code-lab-status-bar ${className}`}
      role="status"
      aria-label="Code Lab status bar"
    >
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

      {/* Left Section */}
      <div className="status-left">
        <ModelIndicator model={model} onClick={onModelClick} />

        <span className="status-separator" />

        {tokens && (
          <>
            <TokenIndicator usage={tokens} onClick={onTokensClick} />
            <span className="status-separator" />
          </>
        )}

        <ConnectionIndicator status={connectionStatus} onClick={onConnectionClick} />
        <SandboxIndicator status={sandboxStatus} onClick={onSandboxClick} />

        {/* MCP indicator removed — tools work seamlessly in background */}

        {backgroundTasks.length > 0 && (
          <>
            <span className="status-separator" />
            <TaskIndicator tasks={backgroundTasks} onClick={onTasksClick} />
          </>
        )}
      </div>

      {/* Center Section */}
      <div className="status-center">{git && <GitIndicator git={git} onClick={onGitClick} />}</div>

      {/* Right Section */}
      <div className="status-right">
        {file && (
          <>
            <FileIndicator file={file} />
            <span className="status-separator" />
          </>
        )}

        <div className="keyboard-hint" title="Open Command Palette">
          <span className="kbd">⌘</span>
          <span className="kbd">K</span>
        </div>

        <span className="status-separator" />

        <span className="status-time">{time}</span>
      </div>
    </footer>
  );
}

// ============================================================================
// HOOK FOR STATUS BAR STATE
// ============================================================================

export interface UseStatusBarOptions {
  initialModel?: ModelType;
  tokenLimit?: number;
}

export function useStatusBar(options: UseStatusBarOptions = {}) {
  const { initialModel = 'opus', tokenLimit = 3000000 } = options;

  const [model, setModel] = useState<ModelType>(initialModel);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>('active');
  const [git, setGit] = useState<GitInfo | undefined>(undefined);
  const [file, setFile] = useState<FileInfo | undefined>(undefined);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [mcpServersActive, setMcpServersActive] = useState(0);

  const tokens = useMemo<TokenUsage>(
    () => ({
      used: tokensUsed,
      limit: tokenLimit,
      costUSD: calculateCost(tokensUsed, model),
    }),
    [tokensUsed, tokenLimit, model]
  );

  const addTokens = useCallback((count: number) => {
    setTokensUsed((prev) => prev + count);
  }, []);

  const addBackgroundTask = useCallback((task: Omit<BackgroundTask, 'id'>) => {
    const newTask: BackgroundTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setBackgroundTasks((prev) => [...prev, newTask]);
    return newTask.id;
  }, []);

  const updateBackgroundTask = useCallback((id: string, status: BackgroundTask['status']) => {
    setBackgroundTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
  }, []);

  const removeBackgroundTask = useCallback((id: string) => {
    setBackgroundTasks((prev) => prev.filter((task) => task.id !== id));
  }, []);

  return {
    // State
    model,
    tokens,
    connectionStatus,
    sandboxStatus,
    git,
    file,
    backgroundTasks,
    mcpServersActive,

    // Setters
    setModel,
    setTokensUsed,
    addTokens,
    setConnectionStatus,
    setSandboxStatus,
    setGit,
    setFile,
    setMcpServersActive,
    addBackgroundTask,
    updateBackgroundTask,
    removeBackgroundTask,
  };
}

function calculateCost(tokens: number, model: ModelType): number {
  // Approximate costs per 1M tokens (input + output average)
  const costs: Record<ModelType, number> = {
    opus: 75, // $75 per 1M tokens average
    sonnet: 15, // $15 per 1M tokens average
    haiku: 1.25, // $1.25 per 1M tokens average
  };

  return (tokens / 1000000) * costs[model];
}

export default CodeLabStatusBar;
