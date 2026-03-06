export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';
export type ToolCategory = 'file' | 'shell' | 'git' | 'mcp' | 'deploy' | 'search' | 'other';

export interface ToolExecution {
  id: string;
  tool: string;
  category: ToolCategory;
  status: ToolStatus;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  retryCount?: number;
}

export interface CodeLabToolHistoryProps {
  executions: ToolExecution[];
  onRetry?: (executionId: string) => void;
  onCancel?: (executionId: string) => void;
  onClear?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Tool category configurations
export const categoryConfig: Record<ToolCategory, { icon: string; color: string; label: string }> =
  {
    file: { icon: '📄', color: 'var(--cl-info)', label: 'File' },
    shell: { icon: '💻', color: 'var(--cl-purple)', label: 'Shell' },
    git: { icon: '🔀', color: 'var(--cl-warning)', label: 'Git' },
    mcp: { icon: '🔌', color: 'var(--cl-cyan)', label: 'MCP' },
    deploy: { icon: '🚀', color: 'var(--cl-success)', label: 'Deploy' },
    search: { icon: '🔍', color: 'var(--cl-pink)', label: 'Search' },
    other: { icon: '⚙️', color: 'var(--cl-gray)', label: 'Other' },
  };

// Status configurations
export const statusConfig: Record<ToolStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'var(--cl-gray)', label: 'Pending' },
  running: { icon: '◐', color: 'var(--cl-info)', label: 'Running' },
  success: { icon: '✓', color: 'var(--cl-success)', label: 'Success' },
  error: { icon: '✕', color: 'var(--cl-error)', label: 'Error' },
  cancelled: { icon: '⊘', color: 'var(--cl-warning)', label: 'Cancelled' },
};

// Helper to categorize tools (used when category not provided in execution data)
export function _getToolCategory(tool: string): ToolCategory {
  if (tool.match(/read_file|write_file|edit_file|list_files|search_files/)) return 'file';
  if (tool.match(/execute_shell|run_build|run_tests|install_packages/)) return 'shell';
  if (tool.match(/git_|create_pr/)) return 'git';
  if (tool.match(/mcp_|mcp__/)) return 'mcp';
  if (tool.match(/deploy_/)) return 'deploy';
  if (tool.match(/search_code|web_fetch/)) return 'search';
  return 'other';
}
void _getToolCategory; // Reserved for auto-categorization feature

// Helper to safely stringify values for display
export function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}
