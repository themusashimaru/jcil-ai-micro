/**
 * Custom Slash Commands Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CommandManager } from './command-manager';
import { parseArguments, expandVariables } from './command-executor';
import type { CommandExecutionInput } from './types';

// ============================================
// ARGUMENT PARSING TESTS
// ============================================

describe('Argument Parsing', () => {
  describe('parseArguments', () => {
    it('should parse positional arguments', () => {
      const result = parseArguments('file1.ts file2.ts');
      expect(result.positional).toEqual(['file1.ts', 'file2.ts']);
      expect(result.named).toEqual({});
    });

    it('should parse named arguments with equals', () => {
      const result = parseArguments('--output=dist --format=json');
      expect(result.named).toEqual({ output: 'dist', format: 'json' });
    });

    it('should parse mixed arguments', () => {
      const result = parseArguments('input.ts --output=dist --verbose');
      expect(result.positional).toEqual(['input.ts']);
      expect(result.named.output).toBe('dist');
      expect(result.named.verbose).toBe('true');
    });

    it('should handle quoted strings', () => {
      const result = parseArguments('"hello world" --message="multi word"');
      expect(result.positional).toEqual(['hello world']);
      // Named arguments with = preserve the value as-is after the =
      expect(result.named.message).toBe('multi word');
    });

    it('should handle empty string', () => {
      const result = parseArguments('');
      expect(result.positional).toEqual([]);
      expect(result.named).toEqual({});
    });
  });
});

// ============================================
// VARIABLE EXPANSION TESTS
// ============================================

describe('Variable Expansion', () => {
  const baseInput: CommandExecutionInput = {
    arguments: 'file1.ts file2.ts --output=dist',
    positionalArgs: ['file1.ts', 'file2.ts'],
    namedArgs: { output: 'dist', format: 'json' },
    sessionId: 'session-123',
    workspaceId: 'workspace-456',
    cwd: '/project',
  };

  describe('expandVariables', () => {
    it('should expand $ARGUMENTS', () => {
      const result = expandVariables('Args: $ARGUMENTS', baseInput);
      expect(result).toBe('Args: file1.ts file2.ts --output=dist');
    });

    it('should expand positional arguments', () => {
      const result = expandVariables('First: $1, Second: $2', baseInput);
      expect(result).toBe('First: file1.ts, Second: file2.ts');
    });

    it('should expand curly brace syntax', () => {
      const result = expandVariables('First: ${1}, Second: ${2}', baseInput);
      expect(result).toBe('First: file1.ts, Second: file2.ts');
    });

    it('should expand named arguments', () => {
      const result = expandVariables('Output: $output, Format: $format', baseInput);
      expect(result).toBe('Output: dist, Format: json');
    });

    it('should expand session and workspace IDs', () => {
      const result = expandVariables('Session: $SESSION_ID, Workspace: $WORKSPACE_ID', baseInput);
      expect(result).toBe('Session: session-123, Workspace: workspace-456');
    });

    it('should expand CWD', () => {
      const result = expandVariables('Dir: $CWD', baseInput);
      expect(result).toBe('Dir: /project');
    });

    it('should replace missing positional args with empty string', () => {
      const result = expandVariables('Third: $3', baseInput);
      expect(result).toBe('Third: ');
    });
  });
});

// ============================================
// COMMAND MANAGER TESTS
// ============================================

describe('CommandManager', () => {
  let manager: CommandManager;

  beforeEach(() => {
    manager = new CommandManager({
      projectDir: '/tmp/test-project',
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
      includeBuiltIns: true,
    });
  });

  describe('built-in commands', () => {
    it('should include help command', () => {
      expect(manager.has('help')).toBe(true);
    });

    it('should include clear command', () => {
      expect(manager.has('clear')).toBe(true);
    });

    it('should include compact command', () => {
      expect(manager.has('compact')).toBe(true);
    });

    it('should get all built-in commands', () => {
      const commands = manager.getAll();
      expect(commands.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('parseMessage', () => {
    it('should parse simple command', () => {
      const result = manager.parseMessage('/help');
      expect(result).toEqual({
        command: 'help',
        args: '',
        isCommand: true,
      });
    });

    it('should parse command with arguments', () => {
      const result = manager.parseMessage('/review src/index.ts --verbose');
      expect(result).toEqual({
        command: 'review',
        args: 'src/index.ts --verbose',
        isCommand: true,
      });
    });

    it('should return null for non-commands', () => {
      expect(manager.parseMessage('hello world')).toBeNull();
      expect(manager.parseMessage('not a /command')).toBeNull();
    });

    it('should handle command with spaces in arguments', () => {
      const result = manager.parseMessage('/search "multi word query"');
      expect(result).toEqual({
        command: 'search',
        args: '"multi word query"',
        isCommand: true,
      });
    });
  });

  describe('getHelp', () => {
    it('should return help text for existing command', () => {
      const help = manager.getHelp('help');
      expect(help).toBeDefined();
      expect(help).toContain('/help');
    });

    it('should return undefined for non-existent command', () => {
      const help = manager.getHelp('nonexistent');
      expect(help).toBeUndefined();
    });
  });

  describe('generateFullHelp', () => {
    it('should generate help for all commands', () => {
      const help = manager.generateFullHelp();
      expect(help).toContain('Available Commands');
      expect(help).toContain('/help');
      expect(help).toContain('/clear');
      expect(help).toContain('/compact');
    });
  });

  describe('getByTag', () => {
    it('should return empty array for non-existent tag', () => {
      const commands = manager.getByTag('nonexistent');
      expect(commands).toEqual([]);
    });
  });
});

// ============================================
// COMMAND EXECUTION TESTS
// ============================================

describe('Command Execution', () => {
  let manager: CommandManager;

  beforeEach(() => {
    manager = new CommandManager({
      projectDir: '/tmp/test-project',
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
    });
  });

  it('should execute built-in help command', async () => {
    const result = await manager.execute('help', '');
    expect(result).not.toBeNull();
    expect(result?.metadata.name).toBe('help');
    expect(result?.prompt).toContain('Show all available slash commands');
  });

  it('should return null for non-existent command', async () => {
    const result = await manager.execute('nonexistent', '');
    expect(result).toBeNull();
  });

  it('should include metadata in result', async () => {
    const result = await manager.execute('help', '');
    expect(result?.metadata).toBeDefined();
    expect(result?.metadata.description).toBe('Show available commands');
  });
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe('Commands Integration', () => {
  it('should process a full command flow', async () => {
    const manager = new CommandManager({
      projectDir: '/tmp/test-project',
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
    });

    // Parse message
    const parsed = manager.parseMessage('/help --verbose');
    expect(parsed?.isCommand).toBe(true);

    // Execute command
    const result = await manager.execute(parsed!.command, parsed!.args);
    expect(result).not.toBeNull();
    expect(result?.prompt).toBeDefined();
  });

  it('should handle command not found gracefully', async () => {
    const manager = new CommandManager({
      projectDir: '/tmp/test-project',
      sessionId: 'test-session',
      workspaceId: 'test-workspace',
    });

    const parsed = manager.parseMessage('/unknown-command');
    expect(parsed?.isCommand).toBe(true);

    const result = await manager.execute(parsed!.command, parsed!.args);
    expect(result).toBeNull();
  });
});
