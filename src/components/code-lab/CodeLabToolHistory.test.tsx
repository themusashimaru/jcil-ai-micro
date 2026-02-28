// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

import { CodeLabToolHistory } from './CodeLabToolHistory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExecution(overrides = {}) {
  return {
    id: 'exec-1',
    tool: 'read_file',
    category: 'file' as const,
    status: 'success' as const,
    input: { path: '/src/index.ts' },
    output: 'file contents',
    startTime: Date.now(),
    duration: 150,
    ...overrides,
  };
}

function renderHistory(props = {}) {
  const defaults = {
    executions: [],
    ...props,
  };
  return render(<CodeLabToolHistory {...defaults} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeLabToolHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      const { container } = renderHistory();
      expect(container).toBeTruthy();
    });

    it('should show header with title', () => {
      renderHistory();
      expect(screen.getByText('Tool Executions')).toBeInTheDocument();
    });

    it('should show execution count of 0 when empty', () => {
      renderHistory();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should show execution count matching executions length', () => {
      const { container } = renderHistory({
        executions: [makeExecution(), makeExecution({ id: 'exec-2' })],
      });
      const countEl = container.querySelector('.header-count');
      expect(countEl?.textContent).toBe('2');
    });

    it('should show empty state message when no executions', () => {
      renderHistory();
      expect(screen.getByText('No tool executions yet')).toBeInTheDocument();
    });

    it('should show empty state hint', () => {
      renderHistory();
      expect(screen.getByText(/Claude will execute tools as you interact/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Collapsed state
  // =========================================================================

  describe('collapsed state', () => {
    it('should hide executions list when collapsed', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
        isCollapsed: true,
      });
      expect(container.querySelector('.executions-list')).not.toBeInTheDocument();
    });

    it('should add collapsed class when isCollapsed', () => {
      const { container } = renderHistory({ isCollapsed: true });
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
    });

    it('should show executions when not collapsed', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
        isCollapsed: false,
      });
      expect(container.querySelector('.executions-list')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when collapse button is clicked', () => {
      const onToggleCollapse = vi.fn();
      const { container } = renderHistory({ onToggleCollapse });
      const collapseBtn = container.querySelector('.collapse-btn');
      fireEvent.click(collapseBtn!);
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Execution rendering
  // =========================================================================

  describe('execution rendering', () => {
    it('should render execution with tool name', () => {
      renderHistory({
        executions: [makeExecution({ tool: 'write_file' })],
      });
      expect(screen.getByText('write_file')).toBeInTheDocument();
    });

    it('should render execution with test id', () => {
      renderHistory({
        executions: [makeExecution({ id: 'my-exec' })],
      });
      expect(screen.getByTestId('execution-my-exec')).toBeInTheDocument();
    });

    it('should render duration for execution', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ duration: 500 })],
      });
      const durationEl = container.querySelector('.execution-duration');
      expect(durationEl?.textContent).toBe('500ms');
    });

    it('should format duration in seconds', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ duration: 2500 })],
      });
      const durationEl = container.querySelector('.execution-duration');
      expect(durationEl?.textContent).toBe('2.5s');
    });

    it('should format duration in minutes', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ duration: 120000 })],
      });
      const durationEl = container.querySelector('.execution-duration');
      expect(durationEl?.textContent).toBe('2.0m');
    });

    it('should render multiple executions', () => {
      renderHistory({
        executions: [
          makeExecution({ id: 'e1', tool: 'read_file' }),
          makeExecution({ id: 'e2', tool: 'write_file' }),
          makeExecution({ id: 'e3', tool: 'execute_shell' }),
        ],
      });
      expect(screen.getByText('read_file')).toBeInTheDocument();
      expect(screen.getByText('write_file')).toBeInTheDocument();
      expect(screen.getByText('execute_shell')).toBeInTheDocument();
    });

    it('should apply status class to execution item', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'error' })],
      });
      expect(container.querySelector('.status-error')).toBeInTheDocument();
    });

    it('should render status icon', () => {
      renderHistory({
        executions: [makeExecution({ status: 'success' })],
      });
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should render error status icon', () => {
      renderHistory({
        executions: [makeExecution({ status: 'error' })],
      });
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('should render running status icon', () => {
      renderHistory({
        executions: [makeExecution({ status: 'running' })],
      });
      expect(screen.getByText('◐')).toBeInTheDocument();
    });

    it('should render pending status icon', () => {
      renderHistory({
        executions: [makeExecution({ status: 'pending' })],
      });
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('should render cancelled status icon', () => {
      renderHistory({
        executions: [makeExecution({ status: 'cancelled' })],
      });
      expect(screen.getByText('⊘')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Expand / collapse executions
  // =========================================================================

  describe('expand/collapse executions', () => {
    it('should not show details by default', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
      });
      expect(container.querySelector('.execution-details')).not.toBeInTheDocument();
    });

    it('should show details when execution header is clicked', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(container.querySelector('.execution-details')).toBeInTheDocument();
    });

    it('should show input in details', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ input: { path: '/test.ts' } })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Input')).toBeInTheDocument();
      expect(screen.getByText(/\/test\.ts/)).toBeInTheDocument();
    });

    it('should show output for successful execution', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'success', output: 'result data' })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Output')).toBeInTheDocument();
      // stringifyValue wraps strings in JSON.stringify quotes
      const outputPre = container.querySelector('.detail-code.output');
      expect(outputPre?.textContent).toContain('result data');
    });

    it('should show error message for failed execution', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'error', error: 'File not found' })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('File not found')).toBeInTheDocument();
    });

    it('should collapse when clicked again', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(container.querySelector('.execution-details')).toBeInTheDocument();
      fireEvent.click(header!);
      expect(container.querySelector('.execution-details')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Actions
  // =========================================================================

  describe('actions', () => {
    it('should show retry button for errored execution', () => {
      const onRetry = vi.fn();
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'error' })],
        onRetry,
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call onRetry with execution id', () => {
      const onRetry = vi.fn();
      const { container } = renderHistory({
        executions: [makeExecution({ id: 'retry-exec', status: 'error' })],
        onRetry,
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      const retryBtn = screen.getByText('Retry');
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledWith('retry-exec');
    });

    it('should not show retry button without onRetry handler', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'error' })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should show cancel button for running execution', () => {
      const onCancel = vi.fn();
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'running' })],
        onCancel,
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onCancel with execution id', () => {
      const onCancel = vi.fn();
      const { container } = renderHistory({
        executions: [makeExecution({ id: 'cancel-exec', status: 'running' })],
        onCancel,
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledWith('cancel-exec');
    });

    it('should show copy button in expanded details', () => {
      const { container } = renderHistory({
        executions: [makeExecution()],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should show clear button when onClear provided and executions exist', () => {
      const onClear = vi.fn();
      renderHistory({
        executions: [makeExecution()],
        onClear,
      });
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('should call onClear when clear button clicked', () => {
      const onClear = vi.fn();
      renderHistory({
        executions: [makeExecution()],
        onClear,
      });
      fireEvent.click(screen.getByText('Clear'));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('should not show clear button without onClear', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('should not show clear button when no executions', () => {
      const onClear = vi.fn();
      renderHistory({
        executions: [],
        onClear,
      });
      expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Stats bar
  // =========================================================================

  describe('stats bar', () => {
    it('should show stats when executions exist and not collapsed', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
      expect(screen.getByText('Total Time')).toBeInTheDocument();
    });

    it('should not show stats when collapsed', () => {
      renderHistory({
        executions: [makeExecution()],
        isCollapsed: true,
      });
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });

    it('should not show stats when no executions', () => {
      renderHistory();
      expect(screen.queryByText('Total Time')).not.toBeInTheDocument();
    });

    it('should count successes correctly', () => {
      const { container } = renderHistory({
        executions: [
          makeExecution({ id: 'e1', status: 'success' }),
          makeExecution({ id: 'e2', status: 'success' }),
          makeExecution({ id: 'e3', status: 'error' }),
        ],
      });
      const successStat = container.querySelector('.stat.success .stat-value');
      expect(successStat?.textContent).toBe('2');
    });

    it('should count errors correctly', () => {
      const { container } = renderHistory({
        executions: [
          makeExecution({ id: 'e1', status: 'error' }),
          makeExecution({ id: 'e2', status: 'error' }),
          makeExecution({ id: 'e3', status: 'success' }),
        ],
      });
      const errorStat = container.querySelector('.stat.error .stat-value');
      expect(errorStat?.textContent).toBe('2');
    });

    it('should show running badge when executions are running', () => {
      renderHistory({
        executions: [
          makeExecution({ id: 'e1', status: 'running' }),
          makeExecution({ id: 'e2', status: 'running' }),
        ],
      });
      expect(screen.getByText('2 running')).toBeInTheDocument();
    });

    it('should not show running badge when no running executions', () => {
      renderHistory({
        executions: [makeExecution({ status: 'success' })],
      });
      expect(screen.queryByText(/running/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Filters
  // =========================================================================

  describe('filters', () => {
    it('should render search input', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      expect(screen.getByLabelText('Search tools')).toBeInTheDocument();
    });

    it('should render category filter', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      expect(screen.getByLabelText('Filter by category')).toBeInTheDocument();
    });

    it('should render status filter', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    });

    it('should filter executions by search query', () => {
      renderHistory({
        executions: [
          makeExecution({ id: 'e1', tool: 'read_file' }),
          makeExecution({ id: 'e2', tool: 'write_file' }),
        ],
      });
      const searchInput = screen.getByLabelText('Search tools');
      fireEvent.change(searchInput, { target: { value: 'read' } });
      expect(screen.getByText('read_file')).toBeInTheDocument();
      expect(screen.queryByText('write_file')).not.toBeInTheDocument();
    });

    it('should filter by category', () => {
      renderHistory({
        executions: [
          makeExecution({ id: 'e1', tool: 'read_file', category: 'file' }),
          makeExecution({ id: 'e2', tool: 'git_commit', category: 'git' }),
        ],
      });
      const categorySelect = screen.getByLabelText('Filter by category');
      fireEvent.change(categorySelect, { target: { value: 'git' } });
      expect(screen.queryByText('read_file')).not.toBeInTheDocument();
      expect(screen.getByText('git_commit')).toBeInTheDocument();
    });

    it('should filter by status', () => {
      renderHistory({
        executions: [
          makeExecution({ id: 'e1', tool: 'read_file', status: 'success' }),
          makeExecution({ id: 'e2', tool: 'write_file', status: 'error' }),
        ],
      });
      const statusSelect = screen.getByLabelText('Filter by status');
      fireEvent.change(statusSelect, { target: { value: 'error' } });
      expect(screen.queryByText('read_file')).not.toBeInTheDocument();
      expect(screen.getByText('write_file')).toBeInTheDocument();
    });

    it('should show no matching message when filters exclude all', () => {
      renderHistory({
        executions: [makeExecution({ tool: 'read_file' })],
      });
      const searchInput = screen.getByLabelText('Search tools');
      fireEvent.change(searchInput, { target: { value: 'xyz_nonexistent' } });
      expect(screen.getByText('No matching executions')).toBeInTheDocument();
    });

    it('should show reset filters button when no matches', () => {
      renderHistory({
        executions: [makeExecution({ tool: 'read_file' })],
      });
      const searchInput = screen.getByLabelText('Search tools');
      fireEvent.change(searchInput, { target: { value: 'xyz_nonexistent' } });
      expect(screen.getByText('Reset filters')).toBeInTheDocument();
    });

    it('should reset filters when reset button clicked', () => {
      renderHistory({
        executions: [makeExecution({ tool: 'read_file' })],
      });
      const searchInput = screen.getByLabelText('Search tools');
      fireEvent.change(searchInput, { target: { value: 'xyz_nonexistent' } });
      fireEvent.click(screen.getByText('Reset filters'));
      expect(screen.getByText('read_file')).toBeInTheDocument();
    });

    it('should not show filters when collapsed', () => {
      renderHistory({
        executions: [makeExecution()],
        isCollapsed: true,
      });
      expect(screen.queryByLabelText('Search tools')).not.toBeInTheDocument();
    });

    it('should not show filters when no executions', () => {
      renderHistory();
      expect(screen.queryByLabelText('Search tools')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Category display
  // =========================================================================

  describe('category display', () => {
    it('should show file category icon', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ category: 'file' })],
      });
      const categorySpan = container.querySelector('.tool-category');
      expect(categorySpan?.textContent).toContain('📄');
    });

    it('should show shell category icon', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ category: 'shell' })],
      });
      const categorySpan = container.querySelector('.tool-category');
      expect(categorySpan?.textContent).toContain('💻');
    });

    it('should show git category icon', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ category: 'git' })],
      });
      const categorySpan = container.querySelector('.tool-category');
      expect(categorySpan?.textContent).toContain('🔀');
    });

    it('should show deploy category icon', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ category: 'deploy' })],
      });
      const categorySpan = container.querySelector('.tool-category');
      expect(categorySpan?.textContent).toContain('🚀');
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle execution without duration', () => {
      renderHistory({
        executions: [makeExecution({ duration: undefined })],
      });
      expect(screen.getByText('read_file')).toBeInTheDocument();
    });

    it('should handle execution without output', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ status: 'success', output: undefined })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.queryByText('Output')).not.toBeInTheDocument();
    });

    it('should handle non-string input values', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ input: { count: 42, nested: { a: 1 } } })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Input')).toBeInTheDocument();
    });

    it('should handle empty input object', () => {
      const { container } = renderHistory({
        executions: [makeExecution({ input: {} })],
      });
      const header = container.querySelector('.execution-header');
      fireEvent.click(header!);
      expect(screen.getByText('Input')).toBeInTheDocument();
    });

    it('should render with all categories in filter dropdown', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      const categorySelect = screen.getByLabelText('Filter by category');
      expect(categorySelect.querySelectorAll('option').length).toBeGreaterThan(5);
    });

    it('should render with all statuses in filter dropdown', () => {
      renderHistory({
        executions: [makeExecution()],
      });
      const statusSelect = screen.getByLabelText('Filter by status');
      expect(statusSelect.querySelectorAll('option').length).toBeGreaterThan(4);
    });
  });
});
