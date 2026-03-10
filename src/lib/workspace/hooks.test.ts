import { describe, it, expect, vi } from 'vitest';
import {
  HooksManager,
  DEFAULT_HOOKS,
  getHooksManager,
  getHooksTools,
  type HookConfig,
  type HookContext,
} from './hooks';

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
      upsert: () => Promise.resolve({}),
    }),
  }),
}));

// -------------------------------------------------------------------
// DEFAULT_HOOKS
// -------------------------------------------------------------------
describe('DEFAULT_HOOKS', () => {
  it('should have 4 default hooks', () => {
    expect(DEFAULT_HOOKS).toHaveLength(4);
  });

  it('should all be disabled by default', () => {
    DEFAULT_HOOKS.forEach((h) => expect(h.enabled).toBe(false));
  });

  it('should include pre-commit-lint', () => {
    const hook = DEFAULT_HOOKS.find((h) => h.id === 'pre-commit-lint');
    expect(hook).toBeDefined();
    expect(hook!.event).toBe('pre_tool');
    expect(hook!.toolPattern).toBe('git_commit');
    expect(hook!.action).toBe('block');
  });

  it('should include pre-commit-test', () => {
    const hook = DEFAULT_HOOKS.find((h) => h.id === 'pre-commit-test');
    expect(hook).toBeDefined();
    expect(hook!.event).toBe('pre_tool');
  });

  it('should include post-write-format', () => {
    const hook = DEFAULT_HOOKS.find((h) => h.id === 'post-write-format');
    expect(hook).toBeDefined();
    expect(hook!.event).toBe('post_tool');
    expect(hook!.action).toBe('allow');
  });

  it('should include session-start-deps', () => {
    const hook = DEFAULT_HOOKS.find((h) => h.id === 'session-start-deps');
    expect(hook).toBeDefined();
    expect(hook!.event).toBe('session_start');
  });
});

// -------------------------------------------------------------------
// HooksManager
// -------------------------------------------------------------------
describe('HooksManager', () => {
  describe('getHooks', () => {
    it('should return default hooks on construction', () => {
      const mgr = new HooksManager();
      const hooks = mgr.getHooks();
      expect(hooks).toHaveLength(4);
    });
  });

  describe('addHook / removeHook', () => {
    it('should add a custom hook', async () => {
      const mgr = new HooksManager();
      const custom: HookConfig = {
        id: 'custom-test',
        name: 'Custom Test',
        event: 'session_start',
        command: 'echo hello',
        enabled: true,
      };
      await mgr.addHook(custom);
      expect(mgr.getHooks()).toHaveLength(5);
    });

    it('should remove a hook', () => {
      const mgr = new HooksManager();
      const result = mgr.removeHook('pre-commit-lint');
      expect(result).toBe(true);
      expect(mgr.getHooks()).toHaveLength(3);
    });

    it('should return false for removing non-existent hook', () => {
      const mgr = new HooksManager();
      expect(mgr.removeHook('nonexistent')).toBe(false);
    });
  });

  describe('enableHook / disableHook', () => {
    it('should enable a hook', async () => {
      const mgr = new HooksManager();
      const result = await mgr.enableHook('pre-commit-lint');
      expect(result).toBe(true);
      const hook = mgr.getHooks().find((h) => h.id === 'pre-commit-lint');
      expect(hook!.enabled).toBe(true);
    });

    it('should disable a hook', async () => {
      const mgr = new HooksManager();
      await mgr.enableHook('pre-commit-lint');
      const result = await mgr.disableHook('pre-commit-lint');
      expect(result).toBe(true);
      const hook = mgr.getHooks().find((h) => h.id === 'pre-commit-lint');
      expect(hook!.enabled).toBe(false);
    });

    it('should return false for unknown hook', async () => {
      const mgr = new HooksManager();
      expect(await mgr.enableHook('nonexistent')).toBe(false);
      expect(await mgr.disableHook('nonexistent')).toBe(false);
    });
  });

  describe('getHooksForEvent', () => {
    it('should return empty when all hooks disabled', () => {
      const mgr = new HooksManager();
      expect(mgr.getHooksForEvent('pre_tool', 'git_commit')).toHaveLength(0);
    });

    it('should return matching hooks when enabled', async () => {
      const mgr = new HooksManager();
      await mgr.enableHook('pre-commit-lint');
      await mgr.enableHook('pre-commit-test');
      const hooks = mgr.getHooksForEvent('pre_tool', 'git_commit');
      expect(hooks).toHaveLength(2);
    });

    it('should filter by tool pattern', async () => {
      const mgr = new HooksManager();
      await mgr.enableHook('pre-commit-lint');
      // git_commit matches 'git_commit' pattern
      expect(mgr.getHooksForEvent('pre_tool', 'git_commit')).toHaveLength(1);
      // other tools don't match
      expect(mgr.getHooksForEvent('pre_tool', 'write_file')).toHaveLength(0);
    });

    it('should return session hooks regardless of tool name', async () => {
      const mgr = new HooksManager();
      await mgr.enableHook('session-start-deps');
      expect(mgr.getHooksForEvent('session_start')).toHaveLength(1);
    });

    it('should support glob patterns with wildcards', async () => {
      const mgr = new HooksManager();
      const custom: HookConfig = {
        id: 'all-git',
        name: 'All Git',
        event: 'pre_tool',
        toolPattern: 'git_*',
        command: 'echo',
        enabled: true,
      };
      await mgr.addHook(custom);
      expect(mgr.getHooksForEvent('pre_tool', 'git_commit')).toHaveLength(1);
      expect(mgr.getHooksForEvent('pre_tool', 'git_push')).toHaveLength(1);
      expect(mgr.getHooksForEvent('pre_tool', 'write_file')).toHaveLength(0);
    });
  });

  describe('executeHook', () => {
    const baseContext: HookContext = {
      event: 'pre_tool',
      sessionId: 's1',
      userId: 'u1',
      toolName: 'git_commit',
    };

    it('should fail when no executor configured', async () => {
      const mgr = new HooksManager();
      const hook = DEFAULT_HOOKS[0];
      const result = await mgr.executeHook(hook, baseContext);
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('executor not configured');
    });

    it('should execute command and return success', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'pre_tool',
        command: 'npm',
        args: ['run', 'lint'],
        enabled: true,
        action: 'block',
      };

      const result = await mgr.executeHook(hook, baseContext);
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.blocked).toBe(false);
      expect(executor).toHaveBeenCalledWith('npm run lint', 30000);
    });

    it('should block on failure when action is block', async () => {
      const mgr = new HooksManager();
      const executor = vi
        .fn()
        .mockResolvedValue({ stdout: '', stderr: 'lint failed', exitCode: 1 });
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'pre_tool',
        command: 'npm run lint',
        enabled: true,
        action: 'block',
        blockMessage: 'Lint failed!',
      };

      const result = await mgr.executeHook(hook, baseContext);
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.blockMessage).toBe('Lint failed!');
    });

    it('should not block on failure when action is allow', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: '', stderr: 'warn', exitCode: 1 });
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'post_tool',
        command: 'npx prettier',
        enabled: true,
        action: 'allow',
      };

      const result = await mgr.executeHook(hook, baseContext);
      expect(result.success).toBe(false);
      expect(result.blocked).toBe(false);
    });

    it('should substitute context variables in args', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'pre_tool',
        command: 'echo',
        args: ['${TOOL_NAME}', '${SESSION_ID}'],
        enabled: true,
      };

      await mgr.executeHook(hook, baseContext);
      expect(executor).toHaveBeenCalledWith('echo git_commit s1', 30000);
    });

    it('should use hook timeout', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'pre_tool',
        command: 'slow-cmd',
        timeout: 60000,
        enabled: true,
      };

      await mgr.executeHook(hook, baseContext);
      expect(executor).toHaveBeenCalledWith('slow-cmd', 60000);
    });

    it('should handle executor error', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockRejectedValue(new Error('exec failed'));
      mgr.setCommandExecutor(executor);

      const hook: HookConfig = {
        id: 'test',
        name: 'Test',
        event: 'pre_tool',
        command: 'bad-cmd',
        enabled: true,
        action: 'block',
        blockMessage: 'Hook failed',
      };

      const result = await mgr.executeHook(hook, baseContext);
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('exec failed');
      expect(result.blocked).toBe(true);
      expect(result.blockMessage).toBe('Hook failed');
    });
  });

  describe('runHooks', () => {
    const baseContext: HookContext = {
      event: 'pre_tool',
      sessionId: 's1',
      userId: 'u1',
      toolName: 'git_commit',
    };

    it('should return empty results when no hooks match', async () => {
      const mgr = new HooksManager();
      const result = await mgr.runHooks('pre_tool', baseContext);
      expect(result.results).toHaveLength(0);
      expect(result.blocked).toBe(false);
    });

    it('should run all matching hooks', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
      mgr.setCommandExecutor(executor);
      await mgr.enableHook('pre-commit-lint');
      await mgr.enableHook('pre-commit-test');

      const result = await mgr.runHooks('pre_tool', baseContext);
      expect(result.results).toHaveLength(2);
      expect(result.blocked).toBe(false);
    });

    it('should stop on first blocking hook', async () => {
      const mgr = new HooksManager();
      const executor = vi.fn().mockResolvedValue({ stdout: '', stderr: 'fail', exitCode: 1 });
      mgr.setCommandExecutor(executor);
      await mgr.enableHook('pre-commit-lint');
      await mgr.enableHook('pre-commit-test');

      const result = await mgr.runHooks('pre_tool', baseContext);
      expect(result.blocked).toBe(true);
      expect(result.blockMessage).toBeDefined();
      // Should stop after first blocking hook
      expect(result.results).toHaveLength(1);
    });
  });

  describe('loadUserPreferences', () => {
    it('should not reload if already loaded for same user', async () => {
      const mgr = new HooksManager();
      await mgr.loadUserPreferences('user1');
      // Second call should short-circuit
      await mgr.loadUserPreferences('user1');
      // No error means it worked
    });
  });
});

// -------------------------------------------------------------------
// getHooksManager (singleton)
// -------------------------------------------------------------------
describe('getHooksManager', () => {
  it('should return same instance', () => {
    expect(getHooksManager()).toBe(getHooksManager());
  });
});

// -------------------------------------------------------------------
// getHooksTools
// -------------------------------------------------------------------
describe('getHooksTools', () => {
  it('should return 4 tools', () => {
    const tools = getHooksTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name)).toEqual([
      'hooks_list',
      'hooks_enable',
      'hooks_disable',
      'hooks_create',
    ]);
  });

  it('should have required fields for hooks_enable', () => {
    const tools = getHooksTools();
    const enable = tools.find((t) => t.name === 'hooks_enable')!;
    expect(enable.input_schema.required).toContain('hook_id');
  });

  it('should have required fields for hooks_create', () => {
    const tools = getHooksTools();
    const create = tools.find((t) => t.name === 'hooks_create')!;
    expect(create.input_schema.required).toContain('id');
    expect(create.input_schema.required).toContain('name');
    expect(create.input_schema.required).toContain('event');
    expect(create.input_schema.required).toContain('command');
  });
});
