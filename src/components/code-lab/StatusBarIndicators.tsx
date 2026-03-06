import React from 'react';
import type {
  ModelType,
  ConnectionStatus,
  SandboxStatus,
  TokenUsage,
  FileInfo,
  GitInfo,
  BackgroundTask,
} from './CodeLabStatusBar';

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

export const StatusItem = React.memo(function StatusItem({
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

export const ModelIndicator = React.memo(function ModelIndicator({
  model,
  onClick,
}: ModelIndicatorProps) {
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

function formatTokenCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export const TokenIndicator = React.memo(function TokenIndicator({
  usage,
  onClick,
}: TokenIndicatorProps) {
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

// ============================================================================
// CONNECTION STATUS
// ============================================================================

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  onClick?: () => void;
}

export const ConnectionIndicator = React.memo(function ConnectionIndicator({
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

export const SandboxIndicator = React.memo(function SandboxIndicator({
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

export const GitIndicator = React.memo(function GitIndicator({ git, onClick }: GitIndicatorProps) {
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

export const FileIndicator = React.memo(function FileIndicator({ file }: FileIndicatorProps) {
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

export const TaskIndicator = React.memo(function TaskIndicator({
  tasks,
  onClick,
}: TaskIndicatorProps) {
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
