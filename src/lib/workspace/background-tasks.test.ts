import { describe, it, expect, vi } from 'vitest';
import {
  BackgroundTaskManager,
  getBackgroundTaskManager,
  getBackgroundTaskTools,
} from './background-tasks';

// -------------------------------------------------------------------
// BackgroundTaskManager
// -------------------------------------------------------------------
describe('BackgroundTaskManager', () => {
  describe('startTask', () => {
    it('should create a running task', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '123' });
      const task = await mgr.startTask('npm test', executor);
      expect(task.command).toBe('npm test');
      expect(task.status).toBe('running');
      expect(task.id).toMatch(/^bg-/);
      expect(executor).toHaveBeenCalledWith('npm test');
    });

    it('should store initial output', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1', initialOutput: 'Starting...' });
      const task = await mgr.startTask('echo hello', executor);
      expect(task.output).toContain('Starting...');
    });

    it('should parse PID from taskId', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '42' });
      const task = await mgr.startTask('ls', executor);
      expect(task.pid).toBe(42);
    });

    it('should handle executor failure', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockRejectedValue(new Error('spawn failed'));
      const task = await mgr.startTask('bad-cmd', executor);
      expect(task.status).toBe('failed');
      expect(task.error).toContain('spawn failed');
      expect(task.completedAt).toBeDefined();
    });

    it('should generate unique task IDs', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const t1 = await mgr.startTask('cmd1', executor);
      const t2 = await mgr.startTask('cmd2', executor);
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('getTaskOutput', () => {
    it('should return null for unknown task', async () => {
      const mgr = new BackgroundTaskManager();
      const result = await mgr.getTaskOutput('nonexistent');
      expect(result).toBeNull();
    });

    it('should return cached output without fetcher', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1', initialOutput: 'hello' });
      const task = await mgr.startTask('echo hello', executor);
      const output = await mgr.getTaskOutput(task.id);
      expect(output).not.toBeNull();
      expect(output!.newOutput).toContain('hello');
    });

    it('should use fetcher when provided', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const fetcher = vi.fn().mockResolvedValue({ output: 'line 2', isComplete: false });
      const output = await mgr.getTaskOutput(task.id, fetcher);
      expect(output!.newOutput).toBe('line 2');
      expect(output!.isComplete).toBe(false);
    });

    it('should mark task complete when fetcher reports completion', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const fetcher = vi.fn().mockResolvedValue({ output: 'done', isComplete: true, exitCode: 0 });
      await mgr.getTaskOutput(task.id, fetcher);
      expect(mgr.getTask(task.id)!.status).toBe('completed');
    });

    it('should mark task failed on non-zero exit', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const fetcher = vi.fn().mockResolvedValue({ output: 'err', isComplete: true, exitCode: 1 });
      await mgr.getTaskOutput(task.id, fetcher);
      expect(mgr.getTask(task.id)!.status).toBe('failed');
    });

    it('should handle fetcher error', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const fetcher = vi.fn().mockRejectedValue(new Error('network'));
      const output = await mgr.getTaskOutput(task.id, fetcher);
      expect(output!.newOutput).toContain('Error fetching output');
      expect(output!.isComplete).toBe(false);
    });
  });

  describe('killTask', () => {
    it('should return error for unknown task', async () => {
      const mgr = new BackgroundTaskManager();
      const result = await mgr.killTask('nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return error for non-running task', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockRejectedValue(new Error('fail'));
      const task = await mgr.startTask('cmd', executor);
      const result = await mgr.killTask(task.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not running');
    });

    it('should kill a running task with killer', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const killer = vi.fn().mockResolvedValue(true);
      const result = await mgr.killTask(task.id, killer);
      expect(result.success).toBe(true);
      expect(mgr.getTask(task.id)!.status).toBe('killed');
    });

    it('should handle killer failure', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const killer = vi.fn().mockResolvedValue(false);
      const result = await mgr.killTask(task.id, killer);
      expect(result.success).toBe(false);
    });

    it('should mark as killed without killer', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const result = await mgr.killTask(task.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('marked as killed');
    });

    it('should handle killer exception', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      const killer = vi.fn().mockRejectedValue(new Error('kill failed'));
      const result = await mgr.killTask(task.id, killer);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error killing task');
    });
  });

  describe('listTasks', () => {
    it('should return all tasks by default', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      await mgr.startTask('cmd1', executor);
      await mgr.startTask('cmd2', executor);
      expect(mgr.listTasks()).toHaveLength(2);
    });

    it('should filter running tasks', async () => {
      const mgr = new BackgroundTaskManager();
      const ok = vi.fn().mockResolvedValue({ taskId: '1' });
      const fail = vi.fn().mockRejectedValue(new Error('fail'));
      await mgr.startTask('cmd1', ok);
      await mgr.startTask('cmd2', fail);
      expect(mgr.listTasks('running')).toHaveLength(1);
    });

    it('should filter completed tasks', async () => {
      const mgr = new BackgroundTaskManager();
      const ok = vi.fn().mockResolvedValue({ taskId: '1' });
      const fail = vi.fn().mockRejectedValue(new Error('fail'));
      await mgr.startTask('cmd1', ok);
      await mgr.startTask('cmd2', fail);
      expect(mgr.listTasks('completed')).toHaveLength(1);
    });

    it('should return all with filter "all"', async () => {
      const mgr = new BackgroundTaskManager();
      const ok = vi.fn().mockResolvedValue({ taskId: '1' });
      await mgr.startTask('cmd1', ok);
      expect(mgr.listTasks('all')).toHaveLength(1);
    });
  });

  describe('getTask', () => {
    it('should return undefined for unknown task', () => {
      const mgr = new BackgroundTaskManager();
      expect(mgr.getTask('nope')).toBeUndefined();
    });

    it('should return task by ID', async () => {
      const mgr = new BackgroundTaskManager();
      const executor = vi.fn().mockResolvedValue({ taskId: '1' });
      const task = await mgr.startTask('cmd', executor);
      expect(mgr.getTask(task.id)).toBeDefined();
      expect(mgr.getTask(task.id)!.command).toBe('cmd');
    });
  });

  describe('clearCompleted', () => {
    it('should clear only non-running tasks', async () => {
      const mgr = new BackgroundTaskManager();
      const ok = vi.fn().mockResolvedValue({ taskId: '1' });
      const fail = vi.fn().mockRejectedValue(new Error('fail'));
      await mgr.startTask('running', ok);
      await mgr.startTask('failed', fail);
      const cleared = mgr.clearCompleted();
      expect(cleared).toBe(1);
      expect(mgr.listTasks()).toHaveLength(1);
      expect(mgr.listTasks()[0].command).toBe('running');
    });

    it('should return 0 when nothing to clear', () => {
      const mgr = new BackgroundTaskManager();
      expect(mgr.clearCompleted()).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return empty summary for new manager', () => {
      const mgr = new BackgroundTaskManager();
      const summary = mgr.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.running).toBe(0);
      expect(summary.completed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.killed).toBe(0);
    });

    it('should track task statuses', async () => {
      const mgr = new BackgroundTaskManager();
      const ok = vi.fn().mockResolvedValue({ taskId: '1' });
      const fail = vi.fn().mockRejectedValue(new Error('fail'));
      await mgr.startTask('running', ok);
      await mgr.startTask('failed', fail);
      const t3 = await mgr.startTask('to-kill', ok);
      await mgr.killTask(t3.id);

      const summary = mgr.getSummary();
      expect(summary.total).toBe(3);
      expect(summary.running).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.killed).toBe(1);
    });
  });
});

// -------------------------------------------------------------------
// getBackgroundTaskManager (singleton)
// -------------------------------------------------------------------
describe('getBackgroundTaskManager', () => {
  it('should return same instance', () => {
    expect(getBackgroundTaskManager()).toBe(getBackgroundTaskManager());
  });
});

// -------------------------------------------------------------------
// getBackgroundTaskTools
// -------------------------------------------------------------------
describe('getBackgroundTaskTools', () => {
  it('should return 4 tools', () => {
    const tools = getBackgroundTaskTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name)).toEqual(['bg_run', 'bg_output', 'bg_kill', 'bg_list']);
  });

  it('should have required fields in schemas', () => {
    const tools = getBackgroundTaskTools();
    const bgRun = tools.find((t) => t.name === 'bg_run')!;
    expect(bgRun.input_schema.required).toContain('command');
  });
});
