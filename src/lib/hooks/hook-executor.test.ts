// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

import { executeHook, executeHooks, expandVariables } from './hook-executor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHook(overrides = {}) {
  return {
    id: 'test-hook',
    command: 'echo hello',
    onFailure: 'continue' as const,
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  return {
    event: 'PreToolUse' as const,
    sessionId: 'sess_123',
    workspaceId: 'ws_456',
    tool: 'bash',
    filePath: '/src/app.ts',
    userPrompt: 'Fix the bug',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hook-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
  });

  // =========================================================================
  // executeHook
  // =========================================================================

  describe('executeHook', () => {
    it('should execute a bash command hook successfully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'ok', stderr: '' });
      const result = await executeHook(makeHook(), makeContext());

      expect(result.success).toBe(true);
      expect(result.action).toBe('continue');
      expect(result.hookId).toBe('test-hook');
    });

    it('should include output from stdout', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Build passed', stderr: '' });
      const result = await executeHook(makeHook(), makeContext());
      expect(result.output).toContain('Build passed');
    });

    it('should include stderr in output', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'ok', stderr: 'Warning: deprecated' });
      const result = await executeHook(makeHook(), makeContext());
      expect(result.output).toContain('Warning: deprecated');
    });

    it('should include duration', async () => {
      const result = await executeHook(makeHook(), makeContext());
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should skip hook when in skipHooks list', async () => {
      const result = await executeHook(makeHook(), makeContext(), {
        skipHooks: ['test-hook'],
      });
      expect(result.success).toBe(true);
      expect(result.output).toBe('Skipped');
      expect(mockExecAsync).not.toHaveBeenCalled();
    });

    it('should handle command execution failure', async () => {
      mockExecAsync.mockRejectedValue({
        code: 1,
        stdout: '',
        stderr: 'Error occurred',
        message: 'Command failed',
      });

      const result = await executeHook(makeHook(), makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });

    it('should use onFailure from hook definition', async () => {
      mockExecAsync.mockRejectedValue({ code: 1, message: 'fail' });

      const result = await executeHook(makeHook({ onFailure: 'block' }), makeContext());
      expect(result.action).toBe('block');
    });

    it('should handle warn onFailure', async () => {
      mockExecAsync.mockRejectedValue({ code: 1, message: 'fail' });

      const result = await executeHook(makeHook({ onFailure: 'warn' }), makeContext());
      expect(result.action).toBe('warn');
    });

    it('should handle prompt-based hooks', async () => {
      const result = await executeHook(
        makeHook({ command: undefined, prompt: 'Check if safe: $TOOL' }),
        makeContext()
      );
      expect(result.success).toBe(true);
      expect(result.output).toContain('Prompt hook');
    });

    it('should return continue for hooks with no command or prompt', async () => {
      const result = await executeHook(makeHook({ command: undefined }), makeContext());
      expect(result.success).toBe(true);
      expect(result.action).toBe('continue');
      expect(result.output).toBe('No action defined');
    });

    it('should generate hookId if not provided', async () => {
      const hook = makeHook({ id: undefined });
      const result = await executeHook(hook, makeContext());
      expect(result.hookId).toMatch(/^hook_/);
    });

    it('should catch thrown errors', async () => {
      mockExecAsync.mockRejectedValue(new Error('Timeout'));
      const result = await executeHook(makeHook(), makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('should catch non-Error throws', async () => {
      mockExecAsync.mockRejectedValue('string error');
      const result = await executeHook(makeHook(), makeContext());
      expect(result.success).toBe(false);
    });

    it('should set environment variables', async () => {
      await executeHook(makeHook(), makeContext());
      const callArgs = mockExecAsync.mock.calls[0];
      const env = callArgs[1]?.env;
      expect(env?.HOOK_EVENT).toBe('PreToolUse');
      expect(env?.HOOK_SESSION_ID).toBe('sess_123');
      expect(env?.HOOK_WORKSPACE_ID).toBe('ws_456');
    });

    it('should set HOOK_TOOL environment variable', async () => {
      await executeHook(makeHook(), makeContext({ tool: 'read_file' }));
      const env = mockExecAsync.mock.calls[0][1]?.env;
      expect(env?.HOOK_TOOL).toBe('read_file');
    });

    it('should set HOOK_FILE_PATH environment variable', async () => {
      await executeHook(makeHook(), makeContext({ filePath: '/src/index.ts' }));
      const env = mockExecAsync.mock.calls[0][1]?.env;
      expect(env?.HOOK_FILE_PATH).toBe('/src/index.ts');
    });

    it('should serialize toolInput as JSON in environment', async () => {
      await executeHook(makeHook(), makeContext({ toolInput: { command: 'ls -la' } }));
      const env = mockExecAsync.mock.calls[0][1]?.env;
      expect(env?.HOOK_TOOL_INPUT).toBe('{"command":"ls -la"}');
    });

    it('should apply custom timeout', async () => {
      await executeHook(makeHook({ timeout: 5000 }), makeContext());
      const opts = mockExecAsync.mock.calls[0][1];
      expect(opts?.timeout).toBe(5000);
    });

    it('should use default 30s timeout', async () => {
      await executeHook(makeHook({ timeout: undefined }), makeContext());
      const opts = mockExecAsync.mock.calls[0][1];
      expect(opts?.timeout).toBe(30000);
    });

    it('should use custom cwd from options', async () => {
      await executeHook(makeHook(), makeContext(), { cwd: '/custom/path' });
      const opts = mockExecAsync.mock.calls[0][1];
      expect(opts?.cwd).toBe('/custom/path');
    });

    it('should pass custom env from options', async () => {
      await executeHook(makeHook(), makeContext(), {
        env: { CUSTOM_VAR: 'test' },
      });
      const env = mockExecAsync.mock.calls[0][1]?.env;
      expect(env?.CUSTOM_VAR).toBe('test');
    });
  });

  // =========================================================================
  // expandVariables
  // =========================================================================

  describe('expandVariables', () => {
    it('should expand $SESSION_ID', () => {
      expect(expandVariables('id: $SESSION_ID', makeContext())).toBe('id: sess_123');
    });

    it('should expand ${SESSION_ID}', () => {
      expect(expandVariables('id: ${SESSION_ID}', makeContext())).toBe('id: sess_123');
    });

    it('should expand $WORKSPACE_ID', () => {
      expect(expandVariables('ws: $WORKSPACE_ID', makeContext())).toBe('ws: ws_456');
    });

    it('should expand $EVENT', () => {
      expect(expandVariables('event: $EVENT', makeContext())).toBe('event: PreToolUse');
    });

    it('should expand $TOOL', () => {
      expect(expandVariables('tool: $TOOL', makeContext())).toBe('tool: bash');
    });

    it('should expand $FILE_PATH', () => {
      expect(expandVariables('file: $FILE_PATH', makeContext())).toBe('file: /src/app.ts');
    });

    it('should expand $FILE (alias for FILE_PATH)', () => {
      expect(expandVariables('file: $FILE', makeContext())).toBe('file: /src/app.ts');
    });

    it('should expand $USER_PROMPT', () => {
      expect(expandVariables('prompt: $USER_PROMPT', makeContext())).toBe('prompt: Fix the bug');
    });

    it('should expand multiple variables in one string', () => {
      const result = expandVariables('$EVENT on $TOOL', makeContext());
      expect(result).toBe('PreToolUse on bash');
    });

    it('should handle missing optional values', () => {
      const ctx = makeContext({ tool: undefined, filePath: undefined });
      expect(expandVariables('$TOOL|$FILE_PATH', ctx)).toBe('|');
    });

    it('should expand $COMMAND from toolInput', () => {
      const ctx = makeContext({ toolInput: { command: 'git push' } });
      expect(expandVariables('cmd: $COMMAND', ctx)).toBe('cmd: git push');
    });

    it('should expand $PATH from toolInput', () => {
      const ctx = makeContext({ toolInput: { path: '/src/file.ts' } });
      expect(expandVariables('path: ${PATH}', ctx)).toBe('path: /src/file.ts');
    });

    it('should expand $CONTENT from toolInput', () => {
      const ctx = makeContext({ toolInput: { content: 'new code' } });
      expect(expandVariables('content: $CONTENT', ctx)).toBe('content: new code');
    });

    it('should leave text unchanged when no variables', () => {
      expect(expandVariables('plain text', makeContext())).toBe('plain text');
    });

    it('should handle empty template', () => {
      expect(expandVariables('', makeContext())).toBe('');
    });
  });

  // =========================================================================
  // executeHooks
  // =========================================================================

  describe('executeHooks', () => {
    it('should execute all hooks in sequence', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'ok', stderr: '' });
      const hooks = [makeHook({ id: 'h1' }), makeHook({ id: 'h2' }), makeHook({ id: 'h3' })];

      const results = await executeHooks(hooks, makeContext());
      expect(results).toHaveLength(3);
    });

    it('should stop on blocking hook', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
        .mockRejectedValueOnce({ code: 1, message: 'blocked' });

      const hooks = [
        makeHook({ id: 'h1' }),
        makeHook({ id: 'h2', onFailure: 'block' }),
        makeHook({ id: 'h3' }),
      ];

      const results = await executeHooks(hooks, makeContext());
      expect(results).toHaveLength(2);
      expect(results[1].action).toBe('block');
    });

    it('should continue past warn hooks', async () => {
      mockExecAsync
        .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
        .mockRejectedValueOnce({ code: 1, message: 'warning' })
        .mockResolvedValueOnce({ stdout: 'ok', stderr: '' });

      const hooks = [
        makeHook({ id: 'h1' }),
        makeHook({ id: 'h2', onFailure: 'warn' }),
        makeHook({ id: 'h3' }),
      ];

      const results = await executeHooks(hooks, makeContext());
      expect(results).toHaveLength(3);
    });

    it('should return empty array for empty hooks list', async () => {
      const results = await executeHooks([], makeContext());
      expect(results).toEqual([]);
    });

    it('should pass options to each hook', async () => {
      const hooks = [makeHook({ id: 'h1' })];
      await executeHooks(hooks, makeContext(), { cwd: '/custom' });
      const opts = mockExecAsync.mock.calls[0][1];
      expect(opts?.cwd).toBe('/custom');
    });
  });
});
