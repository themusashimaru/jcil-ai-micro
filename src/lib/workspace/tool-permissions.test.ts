/**
 * Tool Permission Patterns Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseToolPattern,
  matchInnerPattern,
  ToolPermissionManager,
  getToolPermissionManager,
  CommonPatterns,
  isSafeToolUse,
} from './tool-permissions';

// ============================================
// PATTERN PARSING TESTS
// ============================================

describe('parseToolPattern', () => {
  it('should parse simple tool name', () => {
    const result = parseToolPattern('Bash');
    expect(result).toEqual({
      pattern: 'Bash',
      tool: 'Bash',
      innerPattern: undefined,
    });
  });

  it('should parse tool with inner pattern', () => {
    const result = parseToolPattern('Bash(git push:*)');
    expect(result).toEqual({
      pattern: 'Bash(git push:*)',
      tool: 'Bash',
      innerPattern: 'git push:*',
    });
  });

  it('should parse Edit with glob pattern', () => {
    const result = parseToolPattern('Edit(src/**/*.ts)');
    expect(result).toEqual({
      pattern: 'Edit(src/**/*.ts)',
      tool: 'Edit',
      innerPattern: 'src/**/*.ts',
    });
  });

  it('should parse MCP pattern', () => {
    const result = parseToolPattern('mcp__myserver__mytool');
    expect(result).toEqual({
      pattern: 'mcp__myserver__mytool',
      tool: 'mytool',
      isMcp: true,
      mcpServer: 'myserver',
    });
  });

  it('should return null for invalid pattern', () => {
    expect(parseToolPattern('invalid pattern with spaces')).toBeNull();
    expect(parseToolPattern('')).toBeNull();
  });
});

// ============================================
// INNER PATTERN MATCHING TESTS
// ============================================

describe('matchInnerPattern', () => {
  it('should match exact strings', () => {
    expect(matchInnerPattern('git status', 'git status')).toBe(true);
    expect(matchInnerPattern('git status', 'git push')).toBe(false);
  });

  it('should match colon prefix patterns', () => {
    expect(matchInnerPattern('git push:*', 'git push')).toBe(true);
    expect(matchInnerPattern('git push:*', 'git push origin main')).toBe(true);
    expect(matchInnerPattern('git push:*', 'git pull')).toBe(false);
  });

  it('should match glob patterns', () => {
    expect(matchInnerPattern('*.ts', 'file.ts')).toBe(true);
    expect(matchInnerPattern('*.ts', 'file.js')).toBe(false);
    expect(matchInnerPattern('src/**/*.ts', 'src/lib/utils.ts')).toBe(true);
    expect(matchInnerPattern('src/**/*.ts', 'lib/utils.ts')).toBe(false);
  });

  it('should handle wildcard patterns', () => {
    expect(matchInnerPattern('*', 'anything')).toBe(true);
    expect(matchInnerPattern('**/*', 'any/path/file.ts')).toBe(true);
  });
});

// ============================================
// TOOL PERMISSION MANAGER TESTS
// ============================================

describe('ToolPermissionManager', () => {
  let manager: ToolPermissionManager;

  beforeEach(() => {
    manager = new ToolPermissionManager({
      allowedTools: ['Read', 'Bash(git status)', 'Bash(git push:*)', 'Edit(src/**/*.ts)'],
      deniedTools: ['Bash(rm -rf:*)'],
      autoAllowInSandbox: false,
      promptForUnknown: true,
    });
  });

  describe('check', () => {
    it('should allow Read tool', () => {
      const result = manager.check({
        tool: 'Read',
        input: { file_path: '/any/file.ts' },
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.matchedPattern).toBe('Read');
    });

    it('should allow git status command', () => {
      const result = manager.check({
        tool: 'Bash',
        input: { command: 'git status' },
      });

      expect(result.allowed).toBe(true);
      expect(result.matchedPattern).toBe('Bash(git status)');
    });

    it('should allow git push commands', () => {
      const result = manager.check({
        tool: 'Bash',
        input: { command: 'git push origin main' },
      });

      expect(result.allowed).toBe(true);
      expect(result.matchedPattern).toBe('Bash(git push:*)');
    });

    it('should allow editing TypeScript files in src/', () => {
      const result = manager.check({
        tool: 'Edit',
        input: { file_path: 'src/lib/utils.ts' },
      });

      expect(result.allowed).toBe(true);
      expect(result.matchedPattern).toBe('Edit(src/**/*.ts)');
    });

    it('should deny rm -rf commands', () => {
      const result = manager.check({
        tool: 'Bash',
        input: { command: 'rm -rf /home/user' },
      });

      expect(result.allowed).toBe(false);
      expect(result.matchedPattern).toBe('Bash(rm -rf:*)');
    });

    it('should require confirmation for unmatched tools', () => {
      const result = manager.check({
        tool: 'WebFetch',
        input: { url: 'https://example.com' },
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should handle internal tool names', () => {
      const result = manager.check({
        tool: 'read_file',
        input: { path: '/any/file.ts' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should handle execute_shell as Bash', () => {
      const result = manager.check({
        tool: 'execute_shell',
        input: { command: 'git status' },
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('pattern management', () => {
    it('should add allowed pattern', () => {
      manager.addAllowedPattern('WebFetch');
      const result = manager.check({
        tool: 'WebFetch',
        input: { url: 'https://example.com' },
      });

      expect(result.allowed).toBe(true);
    });

    it('should remove allowed pattern', () => {
      manager.removeAllowedPattern('Read');
      const result = manager.check({
        tool: 'Read',
        input: { file_path: '/file.ts' },
      });

      expect(result.allowed).toBe(false);
    });

    it('should get all patterns', () => {
      const patterns = manager.getPatterns();
      expect(patterns.allowed).toContain('Read');
      expect(patterns.denied).toContain('Bash(rm -rf:*)');
    });
  });

  describe('checkMultiple', () => {
    it('should check multiple tools at once', () => {
      const results = manager.checkMultiple([
        { tool: 'Read', input: { file_path: '/file.ts' } },
        { tool: 'Bash', input: { command: 'git status' } },
        { tool: 'WebFetch', input: { url: 'https://example.com' } },
      ]);

      expect(results.get('Read')?.allowed).toBe(true);
      expect(results.get('Bash')?.allowed).toBe(true);
      expect(results.get('WebFetch')?.allowed).toBe(false);
    });
  });
});

// ============================================
// SANDBOX MODE TESTS
// ============================================

describe('Sandbox Mode', () => {
  it('should auto-allow in sandbox mode', () => {
    const manager = new ToolPermissionManager({
      allowedTools: [],
      autoAllowInSandbox: true,
    });

    const result = manager.check({
      tool: 'Bash',
      input: { command: 'npm install' },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('sandbox');
  });

  it('should not auto-allow when sandbox mode disabled', () => {
    const manager = new ToolPermissionManager({
      allowedTools: [],
      autoAllowInSandbox: false,
    });

    const result = manager.check({
      tool: 'Bash',
      input: { command: 'npm install' },
    });

    expect(result.allowed).toBe(false);
  });
});

// ============================================
// SINGLETON TESTS
// ============================================

describe('getToolPermissionManager', () => {
  it('should return singleton instance', () => {
    const manager1 = getToolPermissionManager();
    const manager2 = getToolPermissionManager();
    expect(manager1).toBe(manager2);
  });
});

// ============================================
// COMMON PATTERNS TESTS
// ============================================

describe('CommonPatterns', () => {
  it('should have git patterns', () => {
    expect(CommonPatterns.gitPush).toBe('Bash(git push:*)');
    expect(CommonPatterns.gitCommit).toBe('Bash(git commit:*)');
    expect(CommonPatterns.gitStatus).toBe('Bash(git status)');
  });

  it('should have file patterns', () => {
    expect(CommonPatterns.allRead).toBe('Read');
    expect(CommonPatterns.allEdit).toBe('Edit');
    expect(CommonPatterns.editTypeScript).toBe('Edit(*.ts)');
  });

  it('should have package manager patterns', () => {
    expect(CommonPatterns.npm).toBe('Bash(npm:*)');
    expect(CommonPatterns.pnpm).toBe('Bash(pnpm:*)');
    expect(CommonPatterns.yarn).toBe('Bash(yarn:*)');
  });

  it('should work with manager', () => {
    const manager = new ToolPermissionManager({
      allowedTools: [CommonPatterns.gitPush, CommonPatterns.npm],
    });

    expect(
      manager.check({
        tool: 'Bash',
        input: { command: 'git push origin main' },
      }).allowed
    ).toBe(true);

    expect(
      manager.check({
        tool: 'Bash',
        input: { command: 'npm install lodash' },
      }).allowed
    ).toBe(true);
  });
});

// ============================================
// SAFE TOOL USE TESTS
// ============================================

describe('isSafeToolUse', () => {
  it('should consider Read tool safe', () => {
    expect(isSafeToolUse('Read', { file_path: '/any/file' })).toBe(true);
    expect(isSafeToolUse('read_file', { path: '/any/file' })).toBe(true);
  });

  it('should consider search tools safe', () => {
    expect(isSafeToolUse('search_files', { pattern: '*.ts' })).toBe(true);
    expect(isSafeToolUse('search_code', { pattern: 'function' })).toBe(true);
    expect(isSafeToolUse('list_files', { path: '/' })).toBe(true);
  });

  it('should consider safe bash commands safe', () => {
    expect(isSafeToolUse('Bash', { command: 'ls -la' })).toBe(true);
    expect(isSafeToolUse('Bash', { command: 'git status' })).toBe(true);
    expect(isSafeToolUse('Bash', { command: 'git log --oneline' })).toBe(true);
    expect(isSafeToolUse('Bash', { command: 'npm list' })).toBe(true);
  });

  it('should not consider dangerous bash commands safe', () => {
    expect(isSafeToolUse('Bash', { command: 'rm -rf /' })).toBe(false);
    expect(isSafeToolUse('Bash', { command: 'git push --force' })).toBe(false);
    expect(isSafeToolUse('Bash', { command: 'npm install' })).toBe(false);
  });

  it('should handle execute_shell as Bash', () => {
    expect(isSafeToolUse('execute_shell', { command: 'git status' })).toBe(true);
    expect(isSafeToolUse('execute_shell', { command: 'npm install' })).toBe(false);
  });
});

// ============================================
// MCP PATTERN TESTS
// ============================================

describe('MCP Tool Patterns', () => {
  it('should match MCP tool patterns', () => {
    const manager = new ToolPermissionManager({
      allowedTools: ['mcp__filesystem__read_file', 'mcp__github__*'],
    });

    expect(
      manager.check({
        tool: 'mcp__filesystem__read_file',
        input: {},
      }).allowed
    ).toBe(true);

    // MCP pattern with wildcard would need the tool to also start with mcp__github__
    // This test verifies basic MCP pattern parsing
    const parsed = parseToolPattern('mcp__github__list_repos');
    expect(parsed?.isMcp).toBe(true);
    expect(parsed?.mcpServer).toBe('github');
    expect(parsed?.tool).toBe('list_repos');
  });
});

// ============================================
// EDGE CASES
// ============================================

describe('Edge Cases', () => {
  it('should handle empty input', () => {
    const manager = new ToolPermissionManager({
      allowedTools: ['Bash(git:*)'],
    });

    const result = manager.check({
      tool: 'Bash',
      input: {},
    });

    expect(result.allowed).toBe(false);
  });

  it('should handle undefined checkValue', () => {
    const manager = new ToolPermissionManager({
      allowedTools: ['Edit'],
    });

    // Edit without inner pattern should match any Edit
    const result = manager.check({
      tool: 'Edit',
      input: { file_path: 'anything.txt' },
    });

    expect(result.allowed).toBe(true);
  });

  it('should prioritize denied patterns over allowed', () => {
    const manager = new ToolPermissionManager({
      allowedTools: ['Bash'],
      deniedTools: ['Bash(rm:*)'],
    });

    const result = manager.check({
      tool: 'Bash',
      input: { command: 'rm file.txt' },
    });

    expect(result.allowed).toBe(false);
  });
});
