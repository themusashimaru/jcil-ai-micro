/**
 * Event Hooks System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HookManager } from './event-hooks';
import { matchPattern, matchesHook, createMatcher } from './hook-matcher';
import { expandVariables } from './hook-executor';
import { validateHookConfig } from './hook-config';
import type { HookConfig, HookContext, HookDefinition } from './types';

// ============================================
// HOOK MATCHER TESTS
// ============================================

describe('Hook Matcher', () => {
  describe('matchPattern', () => {
    it('should match exact strings', () => {
      expect(matchPattern('git push', 'git push')).toBe(true);
      expect(matchPattern('git push', 'git pull')).toBe(false);
    });

    it('should match glob patterns', () => {
      expect(matchPattern('git *', 'git push')).toBe(true);
      expect(matchPattern('git *', 'git pull')).toBe(true);
      expect(matchPattern('git *', 'npm install')).toBe(false);
    });

    it('should match file patterns', () => {
      expect(matchPattern('*.ts', 'file.ts')).toBe(true);
      expect(matchPattern('*.ts', 'file.js')).toBe(false);
      expect(matchPattern('src/**/*.tsx', 'src/components/Button.tsx')).toBe(true);
    });

    it('should match colon-separated patterns', () => {
      expect(matchPattern('git push:*', 'git push origin main')).toBe(true);
      expect(matchPattern('git push:*', 'git push')).toBe(true);
      expect(matchPattern('git push:*', 'git pull')).toBe(false);
    });
  });

  describe('matchesHook', () => {
    const baseContext: HookContext = {
      event: 'PreToolUse',
      sessionId: 'session-1',
      workspaceId: 'workspace-1',
    };

    it('should match hooks with no matcher', () => {
      const hook: HookDefinition = { command: 'echo test' };
      expect(matchesHook(hook, baseContext)).toBe(true);
    });

    it('should match hooks with all: true', () => {
      const hook: HookDefinition = { matcher: { all: true }, command: 'echo test' };
      expect(matchesHook(hook, baseContext)).toBe(true);
    });

    it('should match hooks by tool name', () => {
      const hook: HookDefinition = {
        matcher: { tool: 'execute_shell' },
        command: 'echo test',
      };
      expect(matchesHook(hook, { ...baseContext, tool: 'execute_shell' })).toBe(true);
      expect(matchesHook(hook, { ...baseContext, tool: 'read_file' })).toBe(false);
    });

    it('should match hooks by command pattern', () => {
      const hook: HookDefinition = {
        matcher: { tool: 'execute_shell', command: 'git push*' },
        command: 'npm test',
      };
      const context: HookContext = {
        ...baseContext,
        tool: 'execute_shell',
        toolInput: { command: 'git push origin main' },
      };
      expect(matchesHook(hook, context)).toBe(true);
    });

    it('should match hooks by file path', () => {
      const hook: HookDefinition = {
        matcher: { tool: 'edit_file', path: 'src/**/*.ts' },
        command: 'eslint --fix $FILE',
      };
      const context: HookContext = {
        ...baseContext,
        tool: 'edit_file',
        filePath: 'src/lib/utils.ts',
      };
      expect(matchesHook(hook, context)).toBe(true);
    });
  });

  describe('createMatcher', () => {
    it('should parse Bash patterns', () => {
      const matcher = createMatcher('Bash(git push:*)');
      expect(matcher.tool).toBe('execute_shell');
      expect(matcher.command).toBe('git push:*');
    });

    it('should parse Edit patterns', () => {
      const matcher = createMatcher('Edit(/src/**)');
      expect(matcher.tool).toBe('edit_file');
      expect(matcher.path).toBe('/src/**');
    });

    it('should handle simple tool names', () => {
      const matcher = createMatcher('read_file');
      expect(matcher.tool).toBe('read_file');
    });
  });
});

// ============================================
// HOOK EXECUTOR TESTS
// ============================================

describe('Hook Executor', () => {
  describe('expandVariables', () => {
    const context: HookContext = {
      event: 'PostToolUse',
      sessionId: 'session-123',
      workspaceId: 'workspace-456',
      tool: 'edit_file',
      filePath: '/src/index.ts',
      toolInput: { path: '/src/index.ts', command: 'git push' },
    };

    it('should expand event variable', () => {
      expect(expandVariables('Event: $EVENT', context)).toBe('Event: PostToolUse');
    });

    it('should expand session ID', () => {
      expect(expandVariables('Session: $SESSION_ID', context)).toBe('Session: session-123');
    });

    it('should expand file path', () => {
      expect(expandVariables('File: $FILE_PATH', context)).toBe('File: /src/index.ts');
      expect(expandVariables('File: $FILE', context)).toBe('File: /src/index.ts');
    });

    it('should expand tool input fields', () => {
      expect(expandVariables('Command: $COMMAND', context)).toBe('Command: git push');
      expect(expandVariables('Path: $PATH', context)).toBe('Path: /src/index.ts');
    });

    it('should handle curly brace syntax', () => {
      expect(expandVariables('${EVENT} - ${TOOL}', context)).toBe('PostToolUse - edit_file');
    });
  });
});

// ============================================
// HOOK CONFIG TESTS
// ============================================

describe('Hook Config', () => {
  describe('validateHookConfig', () => {
    it('should validate valid config', () => {
      const config: HookConfig = {
        PreToolUse: [{ command: 'npm test', matcher: { tool: 'execute_shell' } }],
        SessionStart: [{ command: 'echo "Hello"', once: true }],
      };
      const result = validateHookConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject hooks without command or prompt', () => {
      const config: HookConfig = {
        PreToolUse: [{ matcher: { tool: 'execute_shell' } } as HookDefinition],
      };
      const result = validateHookConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("PreToolUse[0]: Must have either 'command' or 'prompt'");
    });

    it('should reject invalid onFailure values', () => {
      const config: HookConfig = {
        PreToolUse: [{ command: 'npm test', onFailure: 'invalid' as 'block' }],
      };
      const result = validateHookConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid timeout values', () => {
      const config: HookConfig = {
        PreToolUse: [{ command: 'npm test', timeout: -1 }],
      };
      const result = validateHookConfig(config);
      expect(result.valid).toBe(false);
    });
  });
});

// ============================================
// HOOK MANAGER TESTS
// ============================================

describe('HookManager', () => {
  let hookManager: HookManager;

  beforeEach(() => {
    hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        PreToolUse: [
          {
            id: 'test-hook-1',
            command: 'echo "pre-tool"',
            matcher: { tool: 'execute_shell' },
          },
        ],
        PostToolUse: [
          {
            id: 'test-hook-2',
            command: 'echo "post-tool"',
            matcher: { all: true },
          },
        ],
        SessionStart: [
          {
            id: 'once-hook',
            command: 'echo "session start"',
            once: true,
          },
        ],
      },
    });
  });

  it('should check if hooks exist for event', () => {
    expect(hookManager.hasHooks('PreToolUse')).toBe(true);
    expect(hookManager.hasHooks('PostToolUse')).toBe(true);
    expect(hookManager.hasHooks('PermissionRequest')).toBe(false);
  });

  it('should get hooks for event', () => {
    const hooks = hookManager.getHooks('PreToolUse');
    expect(hooks).toHaveLength(1);
    expect(hooks[0].id).toBe('test-hook-1');
  });

  it('should add hooks dynamically', () => {
    hookManager.addHook('PreToolUse', {
      id: 'dynamic-hook',
      command: 'echo "dynamic"',
    });
    expect(hookManager.getHooks('PreToolUse')).toHaveLength(2);
  });

  it('should remove hooks by ID', () => {
    const removed = hookManager.removeHook('PreToolUse', 'test-hook-1');
    expect(removed).toBe(true);
    expect(hookManager.getHooks('PreToolUse')).toHaveLength(0);
  });

  it('should return false when removing non-existent hook', () => {
    const removed = hookManager.removeHook('PreToolUse', 'non-existent');
    expect(removed).toBe(false);
  });

  it('should get all hooks', () => {
    const allHooks = hookManager.getAllHooks();
    expect(allHooks.PreToolUse).toHaveLength(1);
    expect(allHooks.PostToolUse).toHaveLength(1);
    expect(allHooks.SessionStart).toHaveLength(1);
  });

  it('should reset once hooks tracker', () => {
    hookManager.resetOnceHooks();
    // Should not throw
    expect(() => hookManager.resetOnceHooks()).not.toThrow();
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Hook System Integration', () => {
  it('should trigger hooks and return results', async () => {
    const hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        PreToolUse: [
          {
            id: 'echo-hook',
            command: 'echo "Hello from hook"',
            matcher: { tool: 'read_file' },
          },
        ],
      },
    });

    const result = await hookManager.preToolUse('read_file', { path: '/test.txt' });

    expect(result.executed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
  });

  it('should not execute hooks that do not match', async () => {
    const hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        PreToolUse: [
          {
            id: 'shell-only-hook',
            command: 'echo "shell"',
            matcher: { tool: 'execute_shell' },
          },
        ],
      },
    });

    const result = await hookManager.preToolUse('read_file', { path: '/test.txt' });

    expect(result.executed).toBe(false);
    expect(result.results).toHaveLength(0);
  });

  it('should handle blocking hooks', async () => {
    const hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        PreToolUse: [
          {
            id: 'block-hook',
            command: 'exit 1',
            onFailure: 'block',
            matcher: { all: true },
          },
        ],
      },
    });

    const result = await hookManager.preToolUse('read_file', { path: '/test.txt' });

    expect(result.executed).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBeDefined();
  });

  it('should handle warning hooks', async () => {
    const hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        PreToolUse: [
          {
            id: 'warn-hook',
            command: 'exit 1',
            onFailure: 'warn',
            matcher: { all: true },
          },
        ],
      },
    });

    const result = await hookManager.preToolUse('read_file', { path: '/test.txt' });

    expect(result.executed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });

  it('should execute once hooks only once', async () => {
    const hookManager = new HookManager({
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      hooks: {
        SessionStart: [
          {
            id: 'once-hook',
            command: 'echo "once"',
            once: true,
          },
        ],
      },
    });

    // First call should execute
    const result1 = await hookManager.sessionStart();
    expect(result1.executed).toBe(true);

    // Second call should not execute
    const result2 = await hookManager.sessionStart();
    expect(result2.executed).toBe(false);
  });
});
