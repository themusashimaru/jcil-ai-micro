/**
 * WORKFLOW EXECUTOR TESTS
 *
 * Tests for src/lib/workflows/workflow-executor.ts
 * Covers types, default workflows, AgenticWorkflowExecutor class,
 * trigger detection, execution, conditions, retry, custom workflows,
 * and formatWorkflowExecution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  DEFAULT_WORKFLOWS,
  AgenticWorkflowExecutor,
  formatWorkflowExecution,
} from './workflow-executor';
import type { Workflow, WorkflowExecution, WorkflowCondition } from './workflow-executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolExecutor(defaultResult = { success: true, output: 'OK' }) {
  return vi.fn().mockResolvedValue(defaultResult);
}

function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: 'test-wf',
    name: 'Test Workflow',
    description: 'A test workflow',
    triggerPhrases: ['run test'],
    steps: [
      {
        id: 'step-1',
        tool: 'workspace',
        arguments: { command: 'echo hello' },
        description: 'Say hello',
      },
    ],
    ...overrides,
  };
}

function makeExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  return {
    id: 'exec-1',
    workflowId: 'wf-1',
    workflowName: 'Test WF',
    status: 'completed',
    currentStep: 2,
    totalSteps: 2,
    results: [
      {
        stepId: 's1',
        stepDescription: 'Step 1',
        success: true,
        output: 'done',
        executionTimeMs: 100,
      },
      {
        stepId: 's2',
        stepDescription: 'Step 2',
        success: true,
        output: 'done',
        executionTimeMs: 200,
      },
    ],
    startTime: new Date('2026-01-01T00:00:00Z'),
    endTime: new Date('2026-01-01T00:00:01Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workflows/workflow-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== DEFAULT_WORKFLOWS =====

  describe('DEFAULT_WORKFLOWS', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(DEFAULT_WORKFLOWS)).toBe(true);
      expect(DEFAULT_WORKFLOWS.length).toBeGreaterThan(0);
    });

    it('includes ship-it workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'ship-it')).toBeDefined();
    });

    it('includes test-everything workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'test-everything')).toBeDefined();
    });

    it('includes clean-start workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'clean-start')).toBeDefined();
    });

    it('includes code-review workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'code-review')).toBeDefined();
    });

    it('includes document-project workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'document-project')).toBeDefined();
    });

    it('includes fix-and-commit workflow', () => {
      expect(DEFAULT_WORKFLOWS.find((w) => w.id === 'fix-and-commit')).toBeDefined();
    });

    it('all default workflows are marked as default', () => {
      for (const wf of DEFAULT_WORKFLOWS) {
        expect(wf.isDefault).toBe(true);
      }
    });

    it('all default workflows have trigger phrases', () => {
      for (const wf of DEFAULT_WORKFLOWS) {
        expect(wf.triggerPhrases.length).toBeGreaterThan(0);
      }
    });

    it('all default workflows have at least one step', () => {
      for (const wf of DEFAULT_WORKFLOWS) {
        expect(wf.steps.length).toBeGreaterThan(0);
      }
    });
  });

  // ===== AgenticWorkflowExecutor constructor =====

  describe('AgenticWorkflowExecutor constructor', () => {
    it('loads default workflows on construction', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const workflows = executor.listWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(DEFAULT_WORKFLOWS.length);
    });
  });

  // ===== detectTrigger =====

  describe('detectTrigger', () => {
    it('detects "ship it" trigger phrase', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.detectTrigger('Can you ship it please?');
      expect(wf).not.toBeNull();
      expect(wf!.id).toBe('ship-it');
    });

    it('detects "test everything" trigger phrase', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.detectTrigger('please test everything');
      expect(wf).not.toBeNull();
      expect(wf!.id).toBe('test-everything');
    });

    it('detects "clean start" trigger phrase', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.detectTrigger('I need a clean start');
      expect(wf).not.toBeNull();
      expect(wf!.id).toBe('clean-start');
    });

    it('returns null for unrecognized input', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      expect(executor.detectTrigger('hello world')).toBeNull();
    });

    it('is case-insensitive', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.detectTrigger('SHIP IT NOW');
      expect(wf).not.toBeNull();
    });

    it('detects trigger within a longer sentence', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.detectTrigger('Hey can you run all tests for me?');
      expect(wf).not.toBeNull();
      expect(wf!.id).toBe('test-everything');
    });

    it('detects custom workflow triggers', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      executor.addWorkflow(makeWorkflow({ id: 'custom', triggerPhrases: ['magic time'] }));
      const wf = executor.detectTrigger('It is magic time!');
      expect(wf).not.toBeNull();
      expect(wf!.id).toBe('custom');
    });
  });

  // ===== execute =====

  describe('execute', () => {
    it('executes all steps and returns completed status', async () => {
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          { id: 's1', tool: 'tool1', arguments: {}, description: 'Step 1' },
          { id: 's2', tool: 'tool2', arguments: {}, description: 'Step 2' },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(2);
      expect(result.endTime).toBeDefined();
    });

    it('calls onProgress callback for each step', async () => {
      const onProgress = vi.fn();
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const workflow = makeWorkflow({
        steps: [
          { id: 's1', tool: 't1', arguments: {}, description: 'S1' },
          { id: 's2', tool: 't2', arguments: {}, description: 'S2' },
        ],
      });

      await executor.execute(workflow, onProgress);
      // Called at start of each step + end of each step + final completion
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('stops on error when onError is "stop" (default)', async () => {
      const toolExec = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: 'lint failed' })
        .mockResolvedValueOnce({ success: true, output: 'OK' });

      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          { id: 's1', tool: 't1', arguments: {}, description: 'Lint' },
          { id: 's2', tool: 't2', arguments: {}, description: 'Build' },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('failed');
      expect(result.results).toHaveLength(1);
      expect(result.error).toContain('Lint');
    });

    it('continues on error when onError is "continue"', async () => {
      const toolExec = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: 'warning' })
        .mockResolvedValueOnce({ success: true, output: 'OK' });

      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Lint',
            onError: 'continue' as const,
          },
          { id: 's2', tool: 't2', arguments: {}, description: 'Build' },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(2);
    });

    it('retries step on error when onError is "retry"', async () => {
      const toolExec = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: 'flaky' })
        .mockResolvedValueOnce({ success: true, output: 'OK on retry' });

      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Flaky step',
            onError: 'retry' as const,
            retryCount: 2,
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('completed');
      expect(toolExec).toHaveBeenCalledTimes(2);
    });

    it('skips step when previousSuccess condition is not met', async () => {
      const toolExec = vi
        .fn()
        .mockResolvedValueOnce({ success: false, output: 'fail' })
        .mockResolvedValueOnce({ success: true, output: 'OK' });

      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Test',
            onError: 'continue' as const,
          },
          {
            id: 's2',
            tool: 't2',
            arguments: {},
            description: 'Build (needs previous success)',
            condition: { type: 'previousSuccess', value: true },
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('completed');
      // Step 2 should be skipped
      const step2Result = result.results.find((r) => r.stepId === 's2');
      expect(step2Result!.output).toBe('(skipped due to condition)');
    });

    it('runs step when previousSuccess condition is met', async () => {
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          { id: 's1', tool: 't1', arguments: {}, description: 'Test' },
          {
            id: 's2',
            tool: 't2',
            arguments: {},
            description: 'Build',
            condition: { type: 'previousSuccess', value: true },
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.status).toBe('completed');
      const step2Result = result.results.find((r) => r.stepId === 's2');
      expect(step2Result!.success).toBe(true);
    });

    it('handles envVar condition type', async () => {
      process.env.TEST_WORKFLOW_VAR = '1';
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Conditional',
            condition: { type: 'envVar', value: 'TEST_WORKFLOW_VAR' },
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.results[0].success).toBe(true);
      delete process.env.TEST_WORKFLOW_VAR;
    });

    it('skips step when envVar is not set', async () => {
      delete process.env.NONEXISTENT_VAR;
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Skipped',
            condition: { type: 'envVar', value: 'NONEXISTENT_VAR' },
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.results[0].output).toBe('(skipped due to condition)');
    });

    it('handles unknown condition type by running the step', async () => {
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow({
        steps: [
          {
            id: 's1',
            tool: 't1',
            arguments: {},
            description: 'Unknown condition',
            condition: { type: 'custom' as WorkflowCondition['type'], value: 'anything' },
          },
        ],
      });

      const result = await executor.execute(workflow);
      expect(result.results[0].success).toBe(true);
    });

    it('handles tool executor throwing an error', async () => {
      const toolExec = vi.fn().mockRejectedValue(new Error('Tool crash'));
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow();

      const result = await executor.execute(workflow);
      // The step catches the error and returns a failed step result
      expect(result.results[0].success).toBe(false);
    });

    it('handles unexpected error in execute loop', async () => {
      // Force a crash in the execute method itself
      const toolExec = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected crash');
      });
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow();

      const result = await executor.execute(workflow);
      // The step's own try-catch should handle this
      expect(result.results.length).toBeGreaterThanOrEqual(1);
    });

    it('records execution time per step', async () => {
      const toolExec = makeToolExecutor();
      const executor = new AgenticWorkflowExecutor(toolExec);
      const workflow = makeWorkflow();

      const result = await executor.execute(workflow);
      expect(result.results[0].executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('sets endTime on completion', async () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const result = await executor.execute(makeWorkflow());
      expect(result.endTime).toBeInstanceOf(Date);
    });
  });

  // ===== addWorkflow / removeWorkflow =====

  describe('addWorkflow / removeWorkflow', () => {
    it('addWorkflow adds a custom workflow', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const before = executor.listWorkflows().length;
      executor.addWorkflow(makeWorkflow({ id: 'custom-wf' }));
      expect(executor.listWorkflows().length).toBe(before + 1);
    });

    it('removeWorkflow removes a custom workflow', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      executor.addWorkflow(makeWorkflow({ id: 'removable', isDefault: false }));
      const removed = executor.removeWorkflow('removable');
      expect(removed).toBe(true);
    });

    it('removeWorkflow refuses to remove default workflows', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const removed = executor.removeWorkflow('ship-it');
      expect(removed).toBe(false);
    });

    it('removeWorkflow returns false for nonexistent workflow', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const removed = executor.removeWorkflow('nonexistent');
      expect(removed).toBe(false);
    });
  });

  // ===== listWorkflows / getWorkflow =====

  describe('listWorkflows / getWorkflow', () => {
    it('listWorkflows returns all workflows', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const workflows = executor.listWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(DEFAULT_WORKFLOWS.length);
    });

    it('getWorkflow returns a workflow by ID', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      const wf = executor.getWorkflow('ship-it');
      expect(wf).toBeDefined();
      expect(wf!.name).toBe('Ship It');
    });

    it('getWorkflow returns undefined for unknown ID', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      expect(executor.getWorkflow('nope')).toBeUndefined();
    });
  });

  // ===== getActiveExecutions / cancelExecution =====

  describe('getActiveExecutions / cancelExecution', () => {
    it('getActiveExecutions returns empty array when nothing is running', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      expect(executor.getActiveExecutions()).toEqual([]);
    });

    it('cancelExecution returns false for nonexistent execution', () => {
      const executor = new AgenticWorkflowExecutor(makeToolExecutor());
      expect(executor.cancelExecution('nonexistent')).toBe(false);
    });
  });

  // ===== formatWorkflowExecution =====

  describe('formatWorkflowExecution', () => {
    it('includes workflow name in output', () => {
      const execution = makeExecution();
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('## Workflow: Test WF');
    });

    it('includes status in output', () => {
      const execution = makeExecution({ status: 'completed' });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('**Status**: COMPLETED');
    });

    it('includes progress fraction', () => {
      const execution = makeExecution({ currentStep: 2, totalSteps: 5 });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('2/5 steps');
    });

    it('includes error message when present', () => {
      const execution = makeExecution({ error: 'Something went wrong' });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('**Error**: Something went wrong');
    });

    it('does not include error section when no error', () => {
      const execution = makeExecution({ error: undefined });
      const output = formatWorkflowExecution(execution);
      expect(output).not.toContain('**Error**:');
    });

    it('renders step results with success icon', () => {
      const execution = makeExecution();
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('\u2713'); // checkmark
    });

    it('renders step results with failure icon', () => {
      const execution = makeExecution({
        results: [
          {
            stepId: 's1',
            stepDescription: 'Fail step',
            success: false,
            output: 'error',
            executionTimeMs: 50,
          },
        ],
      });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('\u2717'); // X mark
    });

    it('truncates long output to 200 chars', () => {
      const longOutput = 'a'.repeat(300);
      const execution = makeExecution({
        results: [
          {
            stepId: 's1',
            stepDescription: 'Long',
            success: true,
            output: longOutput,
            executionTimeMs: 50,
          },
        ],
      });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('...');
    });

    it('does not truncate short output', () => {
      const shortOutput = 'hello world';
      const execution = makeExecution({
        results: [
          {
            stepId: 's1',
            stepDescription: 'Short',
            success: true,
            output: shortOutput,
            executionTimeMs: 50,
          },
        ],
      });
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('hello world');
      expect(output).not.toContain('...');
    });

    it('skips output for skipped steps', () => {
      const execution = makeExecution({
        results: [
          {
            stepId: 's1',
            stepDescription: 'Skipped',
            success: true,
            output: '(skipped due to condition)',
            executionTimeMs: 0,
          },
        ],
      });
      const output = formatWorkflowExecution(execution);
      // Should NOT show code block for skipped steps
      expect(output).not.toContain('```\n(skipped due to condition)');
    });

    it('includes total duration when endTime is set', () => {
      const execution = makeExecution();
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('**Total Duration**:');
    });

    it('omits total duration when endTime is not set', () => {
      const execution = makeExecution({ endTime: undefined });
      const output = formatWorkflowExecution(execution);
      expect(output).not.toContain('**Total Duration**:');
    });

    it('includes execution time per step', () => {
      const execution = makeExecution();
      const output = formatWorkflowExecution(execution);
      expect(output).toContain('100ms');
    });
  });
});
