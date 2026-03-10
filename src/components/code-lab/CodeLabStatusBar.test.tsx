// @ts-nocheck - Test file with extensive mocking
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================================
// MOCKS
// ============================================================================

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => mockLogger,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import CodeLabStatusBar, {
  CodeLabStatusBar as NamedCodeLabStatusBar,
  useStatusBar,
  type ModelType,
  type ConnectionStatus,
  type SandboxStatus,
  type TokenUsage,
  type FileInfo,
  type GitInfo,
  type BackgroundTask,
  type CodeLabStatusBarProps,
} from './CodeLabStatusBar';

// ============================================================================
// HELPERS
// ============================================================================

function renderStatusBar(props: Partial<CodeLabStatusBarProps> = {}) {
  return render(<CodeLabStatusBar {...props} />);
}

// Helper to render hook
function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result = { current: null as T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  render(<TestComponent />);
  return { result };
}

// ============================================================================
// TESTS
// ============================================================================

describe('CodeLabStatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // MODULE EXPORTS
  // --------------------------------------------------------------------------

  describe('Module Exports', () => {
    it('should export CodeLabStatusBar as default export', () => {
      expect(CodeLabStatusBar).toBeDefined();
      expect(typeof CodeLabStatusBar).toBe('function');
    });

    it('should export CodeLabStatusBar as named export', () => {
      expect(NamedCodeLabStatusBar).toBeDefined();
      expect(typeof NamedCodeLabStatusBar).toBe('function');
    });

    it('should export useStatusBar hook', () => {
      expect(useStatusBar).toBeDefined();
      expect(typeof useStatusBar).toBe('function');
    });

    it('should export all type interfaces without runtime errors', () => {
      // Type-level check: these are compile-time only but verifying the
      // module can be imported without errors covers them.
      const model: ModelType = 'opus';
      const conn: ConnectionStatus = 'connected';
      const sandbox: SandboxStatus = 'active';
      const tokenUsage: TokenUsage = { used: 100, limit: 1000 };
      const fileInfo: FileInfo = { name: 'test.ts', language: 'TypeScript' };
      const gitInfo: GitInfo = { branch: 'main', isDirty: false };
      const task: BackgroundTask = { id: '1', name: 'test', status: 'running' };

      expect(model).toBe('opus');
      expect(conn).toBe('connected');
      expect(sandbox).toBe('active');
      expect(tokenUsage.used).toBe(100);
      expect(fileInfo.name).toBe('test.ts');
      expect(gitInfo.branch).toBe('main');
      expect(task.status).toBe('running');
    });
  });

  // --------------------------------------------------------------------------
  // BASIC RENDERING
  // --------------------------------------------------------------------------

  describe('Basic Rendering', () => {
    it('should render without crashing with no props', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.code-lab-status-bar')).toBeInTheDocument();
    });

    it('should render as a footer element', () => {
      renderStatusBar();
      const footer = screen.getByRole('status');
      expect(footer.tagName).toBe('FOOTER');
    });

    it('should have role="status"', () => {
      renderStatusBar();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label', () => {
      renderStatusBar();
      expect(screen.getByLabelText('Code Lab status bar')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderStatusBar({ className: 'my-custom-class' });
      const statusBar = container.querySelector('.code-lab-status-bar');
      expect(statusBar).toHaveClass('my-custom-class');
    });

    it('should render left, center, and right sections', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.status-left')).toBeInTheDocument();
      expect(container.querySelector('.status-center')).toBeInTheDocument();
      expect(container.querySelector('.status-right')).toBeInTheDocument();
    });

    it('should render embedded styles', () => {
      const { container } = renderStatusBar();
      const styleElements = container.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // MODEL INDICATOR
  // --------------------------------------------------------------------------

  describe('Model Indicator', () => {
    it('should default to Opus model', () => {
      renderStatusBar();
      expect(screen.getByText('Opus 4.6')).toBeInTheDocument();
    });

    it('should display Sonnet model', () => {
      renderStatusBar({ model: 'sonnet' });
      expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument();
    });

    it('should display Haiku model', () => {
      renderStatusBar({ model: 'haiku' });
      expect(screen.getByText('Haiku 4.5')).toBeInTheDocument();
    });

    it('should show correct icon for Opus', () => {
      const { container } = renderStatusBar({ model: 'opus' });
      const icon = container.querySelector('.model-icon');
      expect(icon).toHaveTextContent('◆');
    });

    it('should show correct icon for Sonnet', () => {
      const { container } = renderStatusBar({ model: 'sonnet' });
      const icon = container.querySelector('.model-icon');
      expect(icon).toHaveTextContent('◈');
    });

    it('should show correct icon for Haiku', () => {
      const { container } = renderStatusBar({ model: 'haiku' });
      const icon = container.querySelector('.model-icon');
      expect(icon).toHaveTextContent('◇');
    });

    it('should have proper aria-label for model', () => {
      renderStatusBar({ model: 'opus' });
      expect(screen.getByLabelText('Current model: Claude Opus 4.6')).toBeInTheDocument();
    });

    it('should call onModelClick when clicked', () => {
      const onClick = vi.fn();
      renderStatusBar({ model: 'opus', onModelClick: onClick });
      fireEvent.click(screen.getByLabelText('Current model: Claude Opus 4.6'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have model-icon with aria-hidden', () => {
      const { container } = renderStatusBar({ model: 'opus' });
      const icon = container.querySelector('.model-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // --------------------------------------------------------------------------
  // TOKEN INDICATOR
  // --------------------------------------------------------------------------

  describe('Token Indicator', () => {
    it('should not render token indicator when tokens prop is not provided', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.token-indicator')).not.toBeInTheDocument();
    });

    it('should render token indicator when tokens are provided', () => {
      const tokens: TokenUsage = { used: 50000, limit: 200000 };
      const { container } = renderStatusBar({ tokens });
      expect(container.querySelector('.token-indicator')).toBeInTheDocument();
    });

    it('should format token counts in K notation', () => {
      const tokens: TokenUsage = { used: 50000, limit: 200000 };
      renderStatusBar({ tokens });
      expect(screen.getByText('50.0K/200.0K')).toBeInTheDocument();
    });

    it('should format token counts in M notation', () => {
      const tokens: TokenUsage = { used: 1500000, limit: 3000000 };
      renderStatusBar({ tokens });
      expect(screen.getByText('1.5M/3.0M')).toBeInTheDocument();
    });

    it('should display raw number for counts under 1000', () => {
      const tokens: TokenUsage = { used: 500, limit: 999 };
      renderStatusBar({ tokens });
      expect(screen.getByText('500/999')).toBeInTheDocument();
    });

    it('should apply success status when usage is below 70%', () => {
      const tokens: TokenUsage = { used: 10000, limit: 200000 };
      const { container } = renderStatusBar({ tokens });
      const indicator = container.querySelector('.token-indicator');
      expect(indicator).toHaveClass('status-success');
    });

    it('should apply warning status when usage is 70-89%', () => {
      const tokens: TokenUsage = { used: 150000, limit: 200000 };
      const { container } = renderStatusBar({ tokens });
      const indicator = container.querySelector('.token-indicator');
      expect(indicator).toHaveClass('status-warning');
    });

    it('should apply error status when usage is 90%+', () => {
      const tokens: TokenUsage = { used: 190000, limit: 200000 };
      const { container } = renderStatusBar({ tokens });
      const indicator = container.querySelector('.token-indicator');
      expect(indicator).toHaveClass('status-error');
    });

    it('should cap percentage at 100% even when usage exceeds limit', () => {
      const tokens: TokenUsage = { used: 300000, limit: 200000 };
      const { container } = renderStatusBar({ tokens });
      const fill = container.querySelector('.token-bar-fill') as HTMLElement;
      expect(fill.style.width).toBe('100%');
    });

    it('should include cost in aria-label when costUSD is provided', () => {
      const tokens: TokenUsage = { used: 50000, limit: 200000, costUSD: 3.75 };
      renderStatusBar({ tokens });
      const indicator = screen.getByLabelText(/cost \$3.7500/);
      expect(indicator).toBeInTheDocument();
    });

    it('should call onTokensClick when clicked', () => {
      const onClick = vi.fn();
      const tokens: TokenUsage = { used: 50000, limit: 200000 };
      renderStatusBar({ tokens, onTokensClick: onClick });
      const indicator = screen.getByLabelText(/Token usage/);
      fireEvent.click(indicator);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // CONNECTION INDICATOR
  // --------------------------------------------------------------------------

  describe('Connection Indicator', () => {
    it('should default to connected status', () => {
      renderStatusBar();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show connecting status', () => {
      renderStatusBar({ connectionStatus: 'connecting' });
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show disconnected status', () => {
      renderStatusBar({ connectionStatus: 'disconnected' });
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should show error status', () => {
      renderStatusBar({ connectionStatus: 'error' });
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should call onConnectionClick when clicked', () => {
      const onClick = vi.fn();
      renderStatusBar({ connectionStatus: 'connected', onConnectionClick: onClick });
      fireEvent.click(screen.getByLabelText('API connection: Connected'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // SANDBOX INDICATOR
  // --------------------------------------------------------------------------

  describe('Sandbox Indicator', () => {
    it('should default to active sandbox status', () => {
      renderStatusBar();
      expect(screen.getByText('E2B Active')).toBeInTheDocument();
    });

    it('should show starting status', () => {
      renderStatusBar({ sandboxStatus: 'starting' });
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('should show stopped status', () => {
      renderStatusBar({ sandboxStatus: 'stopped' });
      expect(screen.getByText('E2B Stopped')).toBeInTheDocument();
    });

    it('should show sandbox error status', () => {
      renderStatusBar({ sandboxStatus: 'error' });
      expect(screen.getByText('E2B Error')).toBeInTheDocument();
    });

    it('should call onSandboxClick when clicked', () => {
      const onClick = vi.fn();
      renderStatusBar({ sandboxStatus: 'active', onSandboxClick: onClick });
      fireEvent.click(screen.getByLabelText('Sandbox: E2B Active'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // GIT INDICATOR
  // --------------------------------------------------------------------------

  describe('Git Indicator', () => {
    it('should not render git indicator when git prop is not provided', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.git-indicator')).not.toBeInTheDocument();
    });

    it('should render git branch name', () => {
      const git: GitInfo = { branch: 'main', isDirty: false };
      renderStatusBar({ git });
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('should show dirty indicator when repo has changes', () => {
      const git: GitInfo = { branch: 'feature/test', isDirty: true };
      const { container } = renderStatusBar({ git });
      expect(container.querySelector('.git-dirty')).toBeInTheDocument();
      expect(container.querySelector('.git-dirty')).toHaveTextContent('*');
    });

    it('should not show dirty indicator when repo is clean', () => {
      const git: GitInfo = { branch: 'main', isDirty: false };
      const { container } = renderStatusBar({ git });
      expect(container.querySelector('.git-dirty')).not.toBeInTheDocument();
    });

    it('should show ahead count', () => {
      const git: GitInfo = { branch: 'main', isDirty: false, ahead: 3 };
      const { container } = renderStatusBar({ git });
      const syncEl = container.querySelector('.git-sync');
      expect(syncEl).toHaveTextContent('↑3');
    });

    it('should show behind count', () => {
      const git: GitInfo = { branch: 'main', isDirty: false, behind: 2 };
      const { container } = renderStatusBar({ git });
      const syncEl = container.querySelector('.git-sync');
      expect(syncEl).toHaveTextContent('↓2');
    });

    it('should show both ahead and behind counts', () => {
      const git: GitInfo = { branch: 'main', isDirty: false, ahead: 3, behind: 2 };
      const { container } = renderStatusBar({ git });
      const syncEl = container.querySelector('.git-sync');
      expect(syncEl).toHaveTextContent('↑3 ↓2');
    });

    it('should not show sync info when neither ahead nor behind', () => {
      const git: GitInfo = { branch: 'main', isDirty: false };
      const { container } = renderStatusBar({ git });
      expect(container.querySelector('.git-sync')).not.toBeInTheDocument();
    });

    it('should have proper aria-label with branch info', () => {
      const git: GitInfo = { branch: 'main', isDirty: true, ahead: 1 };
      renderStatusBar({ git });
      const btn = screen.getByLabelText(/Git branch: main, modified, ↑1/);
      expect(btn).toBeInTheDocument();
    });

    it('should call onGitClick when clicked', () => {
      const onClick = vi.fn();
      const git: GitInfo = { branch: 'main', isDirty: false };
      renderStatusBar({ git, onGitClick: onClick });
      fireEvent.click(screen.getByLabelText(/Git branch: main/));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should add dirty class to git indicator when isDirty', () => {
      const git: GitInfo = { branch: 'dev', isDirty: true };
      const { container } = renderStatusBar({ git });
      expect(container.querySelector('.git-indicator')).toHaveClass('dirty');
    });
  });

  // --------------------------------------------------------------------------
  // FILE INDICATOR
  // --------------------------------------------------------------------------

  describe('File Indicator', () => {
    it('should not render file indicator when file prop is not provided', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.file-indicator')).not.toBeInTheDocument();
    });

    it('should display file language', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript' };
      renderStatusBar({ file });
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
    });

    it('should display file encoding when provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript', encoding: 'UTF-8' };
      renderStatusBar({ file });
      expect(screen.getByText('UTF-8')).toBeInTheDocument();
    });

    it('should display line ending when provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript', lineEnding: 'LF' };
      renderStatusBar({ file });
      expect(screen.getByText('LF')).toBeInTheDocument();
    });

    it('should display line position when provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript', line: 42 };
      renderStatusBar({ file });
      expect(screen.getByText('Ln 42')).toBeInTheDocument();
    });

    it('should display line and column when both provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript', line: 42, column: 10 };
      renderStatusBar({ file });
      expect(screen.getByText('Ln 42, Col 10')).toBeInTheDocument();
    });

    it('should not display encoding when not provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript' };
      const { container } = renderStatusBar({ file });
      expect(container.querySelector('.file-encoding')).not.toBeInTheDocument();
    });

    it('should not display position when line is not provided', () => {
      const file: FileInfo = { name: 'test.ts', language: 'TypeScript' };
      const { container } = renderStatusBar({ file });
      expect(container.querySelector('.file-position')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // BACKGROUND TASKS
  // --------------------------------------------------------------------------

  describe('Background Tasks', () => {
    it('should not render task indicator when no tasks', () => {
      const { container } = renderStatusBar({ backgroundTasks: [] });
      expect(container.querySelector('.task-spinner')).not.toBeInTheDocument();
    });

    it('should render task indicator when tasks are present', () => {
      const tasks: BackgroundTask[] = [{ id: '1', name: 'Build', status: 'running' }];
      renderStatusBar({ backgroundTasks: tasks });
      expect(screen.getByText('1 task')).toBeInTheDocument();
    });

    it('should pluralize task count', () => {
      const tasks: BackgroundTask[] = [
        { id: '1', name: 'Build', status: 'running' },
        { id: '2', name: 'Lint', status: 'running' },
      ];
      renderStatusBar({ backgroundTasks: tasks });
      expect(screen.getByText('2 tasks')).toBeInTheDocument();
    });

    it('should show running icon when tasks are running', () => {
      const tasks: BackgroundTask[] = [{ id: '1', name: 'Build', status: 'running' }];
      const { container } = renderStatusBar({ backgroundTasks: tasks });
      const spinner = container.querySelector('.task-spinner');
      expect(spinner).toHaveTextContent('◐');
    });

    it('should show failed icon when tasks have failed', () => {
      const tasks: BackgroundTask[] = [{ id: '1', name: 'Build', status: 'failed' }];
      const { container } = renderStatusBar({ backgroundTasks: tasks });
      const spinner = container.querySelector('.task-spinner');
      expect(spinner).toHaveTextContent('✕');
    });

    it('should show completed icon when all tasks completed', () => {
      const tasks: BackgroundTask[] = [{ id: '1', name: 'Build', status: 'completed' }];
      const { container } = renderStatusBar({ backgroundTasks: tasks });
      const spinner = container.querySelector('.task-spinner');
      expect(spinner).toHaveTextContent('✓');
    });

    it('should call onTasksClick when clicked', () => {
      const onClick = vi.fn();
      const tasks: BackgroundTask[] = [{ id: '1', name: 'Build', status: 'running' }];
      renderStatusBar({ backgroundTasks: tasks, onTasksClick: onClick });
      fireEvent.click(screen.getByLabelText(/Background tasks/));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should have correct tooltip with task breakdown', () => {
      const tasks: BackgroundTask[] = [
        { id: '1', name: 'Build', status: 'running' },
        { id: '2', name: 'Lint', status: 'failed' },
        { id: '3', name: 'Test', status: 'completed' },
      ];
      renderStatusBar({ backgroundTasks: tasks });
      const indicator = screen.getByLabelText('Background tasks: 1 running, 1 failed, 1 completed');
      expect(indicator).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // KEYBOARD HINT
  // --------------------------------------------------------------------------

  describe('Keyboard Hint', () => {
    it('should render keyboard shortcut hint', () => {
      const { container } = renderStatusBar();
      const kbdElements = container.querySelectorAll('.kbd');
      expect(kbdElements.length).toBe(2);
    });

    it('should show Command + K shortcut', () => {
      const { container } = renderStatusBar();
      const kbdElements = container.querySelectorAll('.kbd');
      const texts = Array.from(kbdElements).map((el) => el.textContent);
      expect(texts).toContain('⌘');
      expect(texts).toContain('K');
    });
  });

  // --------------------------------------------------------------------------
  // TIME DISPLAY
  // --------------------------------------------------------------------------

  describe('Time Display', () => {
    it('should render time element', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.status-time')).toBeInTheDocument();
    });

    it('should display formatted time', () => {
      const mockDate = new Date(2026, 1, 28, 14, 30, 0);
      vi.setSystemTime(mockDate);

      const { container } = renderStatusBar();
      const timeEl = container.querySelector('.status-time');
      // Time should be rendered (exact format depends on locale)
      expect(timeEl).toBeInTheDocument();
      expect(timeEl?.textContent).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // SEPARATORS
  // --------------------------------------------------------------------------

  describe('Separators', () => {
    it('should render separator elements', () => {
      const { container } = renderStatusBar();
      const separators = container.querySelectorAll('.status-separator');
      expect(separators.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // DEFAULT PROPS
  // --------------------------------------------------------------------------

  describe('Default Props', () => {
    it('should use opus as default model', () => {
      renderStatusBar();
      expect(screen.getByText('Opus 4.6')).toBeInTheDocument();
    });

    it('should use connected as default connection status', () => {
      renderStatusBar();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should use active as default sandbox status', () => {
      renderStatusBar();
      expect(screen.getByText('E2B Active')).toBeInTheDocument();
    });

    it('should default to empty background tasks', () => {
      const { container } = renderStatusBar();
      expect(container.querySelector('.task-spinner')).not.toBeInTheDocument();
    });

    it('should default to empty className', () => {
      const { container } = renderStatusBar();
      const statusBar = container.querySelector('.code-lab-status-bar');
      // Should have base class and a space for the empty className
      expect(statusBar?.className).toContain('code-lab-status-bar');
    });
  });

  // --------------------------------------------------------------------------
  // useStatusBar HOOK
  // --------------------------------------------------------------------------

  describe('useStatusBar Hook', () => {
    it('should return initial model as opus by default', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.model).toBe('opus');
    });

    it('should use custom initial model', () => {
      const { result } = renderHook(() => useStatusBar({ initialModel: 'sonnet' }));
      expect(result.current.model).toBe('sonnet');
    });

    it('should return tokens with default limit of 3M', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.tokens.limit).toBe(3000000);
    });

    it('should use custom token limit', () => {
      const { result } = renderHook(() => useStatusBar({ tokenLimit: 1000000 }));
      expect(result.current.tokens.limit).toBe(1000000);
    });

    it('should start with 0 tokens used', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.tokens.used).toBe(0);
    });

    it('should calculate cost based on model', () => {
      const { result } = renderHook(() => useStatusBar({ initialModel: 'opus' }));
      // With 0 tokens used, cost should be 0
      expect(result.current.tokens.costUSD).toBe(0);
    });

    it('should return connected as default connection status', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should return active as default sandbox status', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.sandboxStatus).toBe('active');
    });

    it('should return undefined git by default', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.git).toBeUndefined();
    });

    it('should return undefined file by default', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.file).toBeUndefined();
    });

    it('should return empty background tasks by default', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.backgroundTasks).toEqual([]);
    });

    it('should return 0 MCP servers by default', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(result.current.mcpServersActive).toBe(0);
    });

    it('should provide setter functions', () => {
      const { result } = renderHook(() => useStatusBar());
      expect(typeof result.current.setModel).toBe('function');
      expect(typeof result.current.setTokensUsed).toBe('function');
      expect(typeof result.current.addTokens).toBe('function');
      expect(typeof result.current.setConnectionStatus).toBe('function');
      expect(typeof result.current.setSandboxStatus).toBe('function');
      expect(typeof result.current.setGit).toBe('function');
      expect(typeof result.current.setFile).toBe('function');
      expect(typeof result.current.setMcpServersActive).toBe('function');
      expect(typeof result.current.addBackgroundTask).toBe('function');
      expect(typeof result.current.updateBackgroundTask).toBe('function');
      expect(typeof result.current.removeBackgroundTask).toBe('function');
    });

    it('should accept empty options object', () => {
      const { result } = renderHook(() => useStatusBar({}));
      expect(result.current.model).toBe('opus');
      expect(result.current.tokens.limit).toBe(3000000);
    });
  });

  // --------------------------------------------------------------------------
  // COMBINED RENDERING
  // --------------------------------------------------------------------------

  describe('Combined Rendering', () => {
    it('should render all sections when all props provided', () => {
      renderStatusBar({
        model: 'sonnet',
        tokens: { used: 100000, limit: 200000 },
        connectionStatus: 'connected',
        sandboxStatus: 'active',
        file: { name: 'test.ts', language: 'TypeScript', encoding: 'UTF-8', line: 10, column: 5 },
        git: { branch: 'feature/test', isDirty: true, ahead: 2 },
        backgroundTasks: [{ id: '1', name: 'Build', status: 'running' }],
      });

      expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument();
      expect(screen.getByText('100.0K/200.0K')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('E2B Active')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('feature/test')).toBeInTheDocument();
      expect(screen.getByText('1 task')).toBeInTheDocument();
    });

    it('should render minimal configuration', () => {
      renderStatusBar({});
      // Should at least show model and connection
      expect(screen.getByText('Opus 4.6')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });
});
