import { describe, it, expect } from 'vitest';
import {
  matchesHook,
  matchPattern,
  parsePermissionPattern,
  filterMatchingHooks,
  createMatcher,
} from './hook-matcher';
import type { HookDefinition, HookContext } from './types';

// Helper to create a minimal context
function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    event: 'PreToolUse',
    sessionId: 'sess-1',
    workspaceId: 'ws-1',
    ...overrides,
  };
}

// -------------------------------------------------------------------
// matchPattern
// -------------------------------------------------------------------
describe('matchPattern', () => {
  it('should match exact strings', () => {
    expect(matchPattern('git push', 'git push')).toBe(true);
  });

  it('should reject non-matching strings', () => {
    expect(matchPattern('git push', 'git pull')).toBe(false);
  });

  it('should match glob star pattern', () => {
    expect(matchPattern('*.ts', 'index.ts')).toBe(true);
    expect(matchPattern('*.ts', 'index.js')).toBe(false);
  });

  it('should match double-star glob', () => {
    expect(matchPattern('src/**/*.ts', 'src/lib/utils.ts')).toBe(true);
  });

  it('should handle colon prefix:* patterns', () => {
    expect(matchPattern('git push:*', 'git push origin main')).toBe(true);
    expect(matchPattern('git push:*', 'git pull origin main')).toBe(false);
  });

  it('should handle exact colon pattern as match', () => {
    expect(matchPattern('foo:bar', 'foo:bar')).toBe(true);
  });

  it('should strip tool(pattern) wrapper', () => {
    // tool(pattern) is stripped, inner pattern is used
    expect(matchPattern('Bash(git*)', 'git push')).toBe(true);
    expect(matchPattern('Bash(git*)', 'npm install')).toBe(false);
  });

  it('should not match partial substring without glob', () => {
    // "push" is not a glob that matches "git push origin"
    expect(matchPattern('push', 'git push origin')).toBe(false);
  });
});

// -------------------------------------------------------------------
// parsePermissionPattern
// -------------------------------------------------------------------
describe('parsePermissionPattern', () => {
  it('should parse tool-only pattern', () => {
    expect(parsePermissionPattern('Bash')).toEqual({ tool: 'Bash', pattern: undefined });
  });

  it('should parse tool with inner pattern', () => {
    expect(parsePermissionPattern('Bash(git push:*)')).toEqual({
      tool: 'Bash',
      pattern: 'git push:*',
    });
  });

  it('should parse Edit with path', () => {
    expect(parsePermissionPattern('Edit(src/**/*.ts)')).toEqual({
      tool: 'Edit',
      pattern: 'src/**/*.ts',
    });
  });

  it('should return null for empty string', () => {
    expect(parsePermissionPattern('')).toBeNull();
  });

  it('should return null for pattern with spaces but no parens', () => {
    // "git push" has a space but no (…) so the regex won't match
    expect(parsePermissionPattern('git push')).toBeNull();
  });
});

// -------------------------------------------------------------------
// matchesHook
// -------------------------------------------------------------------
describe('matchesHook', () => {
  it('should match when hook has no matcher', () => {
    const hook: HookDefinition = { command: 'echo hi' };
    expect(matchesHook(hook, ctx())).toBe(true);
  });

  it('should match when matcher.all is true', () => {
    const hook: HookDefinition = { matcher: { all: true } };
    expect(matchesHook(hook, ctx({ tool: 'read_file' }))).toBe(true);
  });

  it('should match on tool name', () => {
    const hook: HookDefinition = { matcher: { tool: 'read_file' } };
    expect(matchesHook(hook, ctx({ tool: 'read_file' }))).toBe(true);
    expect(matchesHook(hook, ctx({ tool: 'write_file' }))).toBe(false);
  });

  it('should return false when matcher requires tool but context has none', () => {
    const hook: HookDefinition = { matcher: { tool: 'read_file' } };
    expect(matchesHook(hook, ctx())).toBe(false);
  });

  it('should match on command for execute_shell tool', () => {
    const hook: HookDefinition = {
      matcher: { command: 'git*' },
    };
    const context = ctx({ tool: 'execute_shell', toolInput: { command: 'git push' } });
    expect(matchesHook(hook, context)).toBe(true);
  });

  it('should reject command match on non-shell tool', () => {
    const hook: HookDefinition = { matcher: { command: 'git*' } };
    expect(matchesHook(hook, ctx({ tool: 'read_file' }))).toBe(false);
  });

  it('should reject command match when no command in input', () => {
    const hook: HookDefinition = { matcher: { command: 'git*' } };
    const context = ctx({ tool: 'execute_shell', toolInput: {} });
    expect(matchesHook(hook, context)).toBe(false);
  });

  it('should match on path via filePath', () => {
    const hook: HookDefinition = { matcher: { path: '*.ts' } };
    const context = ctx({ filePath: 'src/index.ts' });
    expect(matchesHook(hook, context)).toBe(true);
  });

  it('should match on path via toolInput.path', () => {
    const hook: HookDefinition = { matcher: { path: '*.ts' } };
    const context = ctx({ toolInput: { path: 'src/index.ts' } });
    expect(matchesHook(hook, context)).toBe(true);
  });

  it('should reject path match when no path available', () => {
    const hook: HookDefinition = { matcher: { path: '*.ts' } };
    expect(matchesHook(hook, ctx())).toBe(false);
  });
});

// -------------------------------------------------------------------
// filterMatchingHooks
// -------------------------------------------------------------------
describe('filterMatchingHooks', () => {
  it('should return only matching hooks', () => {
    const hooks: HookDefinition[] = [
      { id: 'a', matcher: { tool: 'read_file' } },
      { id: 'b', matcher: { tool: 'write_file' } },
      { id: 'c', matcher: { all: true } },
    ];
    const result = filterMatchingHooks(hooks, ctx({ tool: 'read_file' }));
    expect(result.map((h) => h.id)).toEqual(['a', 'c']);
  });

  it('should skip disabled hooks', () => {
    const hooks: HookDefinition[] = [
      { id: 'a', enabled: false, matcher: { all: true } },
      { id: 'b', matcher: { all: true } },
    ];
    const result = filterMatchingHooks(hooks, ctx());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('should return empty array when nothing matches', () => {
    const hooks: HookDefinition[] = [{ matcher: { tool: 'write_file' } }];
    const result = filterMatchingHooks(hooks, ctx({ tool: 'read_file' }));
    expect(result).toEqual([]);
  });
});

// -------------------------------------------------------------------
// createMatcher
// -------------------------------------------------------------------
describe('createMatcher', () => {
  it('should create Bash matcher with command', () => {
    expect(createMatcher('Bash(git push:*)')).toEqual({
      tool: 'execute_shell',
      command: 'git push:*',
    });
  });

  it('should create Edit matcher with path', () => {
    expect(createMatcher('Edit(src/**/*.ts)')).toEqual({
      tool: 'edit_file',
      path: 'src/**/*.ts',
    });
  });

  it('should create Write matcher with path', () => {
    expect(createMatcher('Write(*.md)')).toEqual({
      tool: 'write_file',
      path: '*.md',
    });
  });

  it('should create Read matcher with path', () => {
    expect(createMatcher('Read(config/*)')).toEqual({
      tool: 'read_file',
      path: 'config/*',
    });
  });

  it('should lowercase unknown tool names', () => {
    expect(createMatcher('Glob')).toEqual({ tool: 'glob' });
  });

  it('should treat raw pattern as tool name', () => {
    expect(createMatcher('execute_shell')).toEqual({ tool: 'execute_shell' });
  });
});
