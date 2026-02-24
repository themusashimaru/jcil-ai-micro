import { describe, it, expect, vi } from 'vitest';
import { ProcessManager, getProcessManager } from './process-manager';

// -------------------------------------------------------------------
// ProcessManager
// -------------------------------------------------------------------
describe('ProcessManager', () => {
  describe('constructor', () => {
    it('should use default options', () => {
      const mgr = new ProcessManager();
      expect(mgr.getAll()).toHaveLength(0);
    });

    it('should accept custom options', () => {
      const mgr = new ProcessManager({ maxConcurrent: 5, defaultTimeout: 60000 });
      expect(mgr.getAll()).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should start a process and return processId', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
      const { processId, result } = await mgr.execute('echo hello', shell);
      expect(processId).toMatch(/^proc_/);
      const res = await result;
      expect(res.success).toBe(true);
      expect(res.output).toBe('ok');
      expect(res.exitCode).toBe(0);
    });

    it('should mark process as completed on success', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { processId, result } = await mgr.execute('cmd', shell);
      await result;
      expect(mgr.get(processId)?.status).toBe('completed');
    });

    it('should mark process as failed on non-zero exit', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: 'err', exitCode: 1 });
      const { processId, result } = await mgr.execute('bad-cmd', shell);
      await result;
      expect(mgr.get(processId)?.status).toBe('failed');
    });

    it('should handle shell error', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockRejectedValue(new Error('spawn failed'));
      const { processId, result } = await mgr.execute('cmd', shell);
      const res = await result;
      expect(res.success).toBe(false);
      expect(res.exitCode).toBe(-1);
      expect(mgr.get(processId)?.status).toBe('failed');
    });

    it('should reject when max concurrent reached', async () => {
      const mgr = new ProcessManager({ maxConcurrent: 1 });
      // Never resolves to keep process running
      const shell = vi.fn().mockReturnValue(new Promise(() => {}));
      await mgr.execute('long-cmd', shell);
      await expect(mgr.execute('another-cmd', shell)).rejects.toThrow('Maximum concurrent');
    });

    it('should call onOutput callback', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: 'out', stderr: 'warn', exitCode: 0 });
      const onOutput = vi.fn();
      const { result } = await mgr.execute('cmd', shell, { onOutput });
      await result;
      expect(onOutput).toHaveBeenCalledWith('out', false);
      expect(onOutput).toHaveBeenCalledWith('warn', true);
    });

    it('should prepend working dir when specified', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { result } = await mgr.execute('ls', shell, { workingDir: '/tmp' });
      await result;
      expect(shell).toHaveBeenCalledWith('cd /tmp && ls', expect.anything());
    });

    it('should track duration', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { result } = await mgr.execute('cmd', shell);
      const res = await result;
      expect(res.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('kill', () => {
    it('should kill a running process', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockReturnValue(new Promise(() => {}));
      const { processId } = await mgr.execute('long-cmd', shell);
      expect(mgr.kill(processId)).toBe(true);
      expect(mgr.get(processId)?.status).toBe('killed');
    });

    it('should return false for unknown process', () => {
      const mgr = new ProcessManager();
      expect(mgr.kill('nonexistent')).toBe(false);
    });

    it('should return false for non-running process', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { processId, result } = await mgr.execute('cmd', shell);
      await result;
      expect(mgr.kill(processId)).toBe(false);
    });
  });

  describe('killAll', () => {
    it('should kill all running processes', async () => {
      const mgr = new ProcessManager({ maxConcurrent: 5 });
      const shell = vi.fn().mockReturnValue(new Promise(() => {}));
      await mgr.execute('cmd1', shell);
      await mgr.execute('cmd2', shell);
      await mgr.execute('cmd3', shell);
      const killed = mgr.killAll();
      expect(killed).toBe(3);
      expect(mgr.getRunning()).toHaveLength(0);
    });

    it('should return 0 when no running processes', () => {
      const mgr = new ProcessManager();
      expect(mgr.killAll()).toBe(0);
    });
  });

  describe('getAll / getRunning / get', () => {
    it('should return all processes', async () => {
      const mgr = new ProcessManager();
      const ok = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { result: r1 } = await mgr.execute('cmd1', ok);
      const { result: r2 } = await mgr.execute('cmd2', ok);
      await r1;
      await r2;
      expect(mgr.getAll()).toHaveLength(2);
    });

    it('should return only running processes', async () => {
      const mgr = new ProcessManager({ maxConcurrent: 5 });
      const ok = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const hanging = vi.fn().mockReturnValue(new Promise(() => {}));
      const { result } = await mgr.execute('done', ok);
      await result;
      await mgr.execute('running', hanging);
      expect(mgr.getRunning()).toHaveLength(1);
    });

    it('should return undefined for unknown process', () => {
      const mgr = new ProcessManager();
      expect(mgr.get('nope')).toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('should return true for running process', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockReturnValue(new Promise(() => {}));
      const { processId } = await mgr.execute('cmd', shell);
      expect(mgr.isRunning(processId)).toBe(true);
    });

    it('should return false for completed process', async () => {
      const mgr = new ProcessManager();
      const shell = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const { processId, result } = await mgr.execute('cmd', shell);
      await result;
      expect(mgr.isRunning(processId)).toBe(false);
    });

    it('should return false for unknown process', () => {
      const mgr = new ProcessManager();
      expect(mgr.isRunning('nope')).toBe(false);
    });
  });

  describe('clearCompleted', () => {
    it('should clear non-running processes', async () => {
      const mgr = new ProcessManager({ maxConcurrent: 5 });
      const ok = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const hanging = vi.fn().mockReturnValue(new Promise(() => {}));
      const { result } = await mgr.execute('done', ok);
      await result;
      await mgr.execute('running', hanging);
      const cleared = mgr.clearCompleted();
      expect(cleared).toBe(1);
      expect(mgr.getAll()).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats for new manager', () => {
      const mgr = new ProcessManager();
      const stats = mgr.getStats();
      expect(stats.total).toBe(0);
      expect(stats.running).toBe(0);
    });

    it('should track all statuses', async () => {
      const mgr = new ProcessManager({ maxConcurrent: 5 });
      const ok = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      const fail = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 1 });
      const hanging = vi.fn().mockReturnValue(new Promise(() => {}));

      const { result: r1 } = await mgr.execute('ok', ok);
      const { result: r2 } = await mgr.execute('fail', fail);
      await r1;
      await r2;
      const { processId: p3 } = await mgr.execute('hanging', hanging);
      mgr.kill(p3);

      const stats = mgr.getStats();
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.killed).toBe(1);
    });
  });
});

// -------------------------------------------------------------------
// getProcessManager (singleton)
// -------------------------------------------------------------------
describe('getProcessManager', () => {
  it('should return same instance', () => {
    expect(getProcessManager()).toBe(getProcessManager());
  });
});
