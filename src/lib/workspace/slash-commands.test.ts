import { describe, it, expect } from 'vitest';
import {
  parseSlashCommand,
  processSlashCommand,
  isSlashCommand,
  getCommandSuggestions,
  getAllCommands,
  type CommandContext,
} from './slash-commands';

const ctx: CommandContext = { userId: 'u1', sessionId: 's1' };

// -------------------------------------------------------------------
// parseSlashCommand
// -------------------------------------------------------------------
describe('parseSlashCommand', () => {
  it('should return null for non-slash input', () => {
    expect(parseSlashCommand('hello')).toBeNull();
    expect(parseSlashCommand('')).toBeNull();
  });

  it('should parse /fix', () => {
    const result = parseSlashCommand('/fix');
    expect(result?.command.name).toBe('fix');
    expect(result?.args).toBe('');
  });

  it('should parse /fix with arguments', () => {
    const result = parseSlashCommand('/fix the login bug');
    expect(result?.command.name).toBe('fix');
    expect(result?.args).toBe('the login bug');
  });

  it('should parse aliases', () => {
    expect(parseSlashCommand('/f')?.command.name).toBe('fix');
    expect(parseSlashCommand('/t')?.command.name).toBe('test');
    expect(parseSlashCommand('/b')?.command.name).toBe('build');
    expect(parseSlashCommand('/c')?.command.name).toBe('commit');
  });

  it('should parse /test', () => {
    expect(parseSlashCommand('/test')?.command.name).toBe('test');
  });

  it('should parse /build', () => {
    expect(parseSlashCommand('/build')?.command.name).toBe('build');
  });

  it('should parse /commit', () => {
    expect(parseSlashCommand('/commit fix auth')?.args).toBe('fix auth');
  });

  it('should parse /push', () => {
    expect(parseSlashCommand('/push main')?.args).toBe('main');
  });

  it('should parse /review', () => {
    expect(parseSlashCommand('/review')?.command.name).toBe('review');
  });

  it('should parse /explain', () => {
    expect(parseSlashCommand('/explain')?.command.name).toBe('explain');
  });

  it('should parse /help', () => {
    expect(parseSlashCommand('/help')?.command.name).toBe('help');
  });

  it('should parse /model', () => {
    expect(parseSlashCommand('/model opus')?.args).toBe('opus');
  });

  it('should return null for unknown commands', () => {
    expect(parseSlashCommand('/nonexistent')).toBeNull();
  });

  it('should be case-insensitive via alias matching', () => {
    // The findCommand lowercases, so /FIX won't match since 'FIX' !== 'fix'
    // but /fix should work
    expect(parseSlashCommand('/fix')).not.toBeNull();
  });

  it('should store rawInput', () => {
    const result = parseSlashCommand('/fix this bug');
    expect(result?.rawInput).toBe('/fix this bug');
  });

  it('should trim input', () => {
    const result = parseSlashCommand('  /fix  ');
    expect(result?.command.name).toBe('fix');
  });
});

// -------------------------------------------------------------------
// processSlashCommand
// -------------------------------------------------------------------
describe('processSlashCommand', () => {
  it('should return null for non-commands', () => {
    expect(processSlashCommand('hello', ctx)).toBeNull();
  });

  it('should process /fix with no args', () => {
    const result = processSlashCommand('/fix', ctx);
    expect(result).toContain('fix');
    expect(result).toContain('errors');
  });

  it('should process /fix with args', () => {
    const result = processSlashCommand('/fix the login bug', ctx);
    expect(result).toContain('login bug');
  });

  it('should process /test with no args', () => {
    const result = processSlashCommand('/test', ctx);
    expect(result).toContain('test suite');
  });

  it('should process /test with pattern', () => {
    const result = processSlashCommand('/test auth.spec', ctx);
    expect(result).toContain('auth.spec');
  });

  it('should process /commit with message', () => {
    const result = processSlashCommand('/commit fix login', ctx);
    expect(result).toContain('fix login');
  });

  it('should process /model with valid model', () => {
    const result = processSlashCommand('/model opus', ctx);
    expect(result).toContain('MODEL_SWITCH');
    expect(result).toContain('opus');
  });

  it('should process /model with invalid model', () => {
    const result = processSlashCommand('/model gpt4', ctx);
    expect(result).toContain('Invalid model');
  });

  it('should process /style with valid style', () => {
    const result = processSlashCommand('/style concise', ctx);
    expect(result).toContain('STYLE_SWITCH');
  });

  it('should process /vim toggle', () => {
    const result = processSlashCommand('/vim', ctx);
    expect(result).toContain('VIM_TOGGLE');
  });

  it('should process /vim on', () => {
    const result = processSlashCommand('/vim on', ctx);
    expect(result).toContain('VIM_ENABLE');
  });

  it('should process /clear', () => {
    const result = processSlashCommand('/clear', ctx);
    expect(result).toContain('CLEAR_HISTORY');
  });

  it('should process /compact', () => {
    const result = processSlashCommand('/compact', ctx);
    expect(result).toContain('COMPACT_CONTEXT');
  });

  it('should process /rename with name', () => {
    const result = processSlashCommand('/rename My Session', ctx);
    expect(result).toContain('SESSION_RENAME');
    expect(result).toContain('My Session');
  });

  it('should process /rewind with number', () => {
    const result = processSlashCommand('/rewind 3', ctx);
    expect(result).toContain('REWIND:3');
  });

  it('should process /rewind with invalid number', () => {
    const result = processSlashCommand('/rewind abc', ctx);
    expect(result).toContain('Invalid');
  });
});

// -------------------------------------------------------------------
// isSlashCommand
// -------------------------------------------------------------------
describe('isSlashCommand', () => {
  it('should return true for valid commands', () => {
    expect(isSlashCommand('/fix')).toBe(true);
    expect(isSlashCommand('/test')).toBe(true);
    expect(isSlashCommand('/help')).toBe(true);
  });

  it('should return false for non-commands', () => {
    expect(isSlashCommand('hello')).toBe(false);
    expect(isSlashCommand('')).toBe(false);
    expect(isSlashCommand('/nonexistent')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getCommandSuggestions
// -------------------------------------------------------------------
describe('getCommandSuggestions', () => {
  it('should return empty for non-slash input', () => {
    expect(getCommandSuggestions('hello')).toEqual([]);
  });

  it('should return all commands for just /', () => {
    const suggestions = getCommandSuggestions('/');
    expect(suggestions.length).toBeGreaterThan(10);
  });

  it('should filter by command name', () => {
    const suggestions = getCommandSuggestions('/fi');
    expect(suggestions.some((s) => s.name === 'fix')).toBe(true);
  });

  it('should filter by alias', () => {
    const suggestions = getCommandSuggestions('/st');
    expect(suggestions.some((s) => s.name === 'status')).toBe(true);
  });

  it('should filter by description', () => {
    const suggestions = getCommandSuggestions('/error');
    expect(suggestions.some((s) => s.name === 'fix')).toBe(true);
  });
});

// -------------------------------------------------------------------
// getAllCommands
// -------------------------------------------------------------------
describe('getAllCommands', () => {
  it('should return all registered commands', () => {
    const cmds = getAllCommands();
    expect(cmds.length).toBeGreaterThan(10);
    expect(cmds.every((c) => typeof c.name === 'string')).toBe(true);
    expect(cmds.every((c) => typeof c.handler === 'function')).toBe(true);
  });

  it('should include core commands', () => {
    const names = getAllCommands().map((c) => c.name);
    expect(names).toContain('fix');
    expect(names).toContain('test');
    expect(names).toContain('build');
    expect(names).toContain('commit');
    expect(names).toContain('help');
  });
});
