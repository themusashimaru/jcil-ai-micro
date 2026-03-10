import { describe, it, expect } from 'vitest';
import { SLASH_COMMANDS, parseSlashCommand, getCommandSuggestions } from './slashCommands';

describe('SLASH_COMMANDS', () => {
  it('should define all expected commands', () => {
    expect(SLASH_COMMANDS.pray).toBeDefined();
    expect(SLASH_COMMANDS.verse).toBeDefined();
    expect(SLASH_COMMANDS.study).toBeDefined();
    expect(SLASH_COMMANDS.devotional).toBeDefined();
    expect(SLASH_COMMANDS.encourage).toBeDefined();
    expect(SLASH_COMMANDS.summarize).toBeDefined();
    expect(SLASH_COMMANDS.help).toBeDefined();
  });

  it('should have name, description, usage, and handler for each command', () => {
    for (const [key, cmd] of Object.entries(SLASH_COMMANDS)) {
      expect(cmd.name).toBe(key);
      expect(cmd.description).toBeTruthy();
      expect(cmd.usage).toContain(`/${key}`);
      expect(typeof cmd.handler).toBe('function');
    }
  });

  describe('command handlers', () => {
    it('pray handler should include topic', () => {
      const result = SLASH_COMMANDS.pray.handler('my family');
      expect(result).toContain('my family');
      expect(result).toContain('prayer');
    });

    it('pray handler should use default when no args', () => {
      const result = SLASH_COMMANDS.pray.handler('');
      expect(result).toContain('general blessing');
    });

    it('verse handler should include topic', () => {
      const result = SLASH_COMMANDS.verse.handler('hope');
      expect(result).toContain('hope');
      expect(result).toContain('Bible verse');
    });

    it('study handler should include topic', () => {
      const result = SLASH_COMMANDS.study.handler('Romans 8');
      expect(result).toContain('Romans 8');
      expect(result).toContain('Bible study');
    });

    it('devotional handler should include theme', () => {
      const result = SLASH_COMMANDS.devotional.handler('patience');
      expect(result).toContain('patience');
    });

    it('devotional handler should work without theme', () => {
      const result = SLASH_COMMANDS.devotional.handler('');
      expect(result).toContain('devotional');
    });

    it('encourage handler should include situation', () => {
      const result = SLASH_COMMANDS.encourage.handler('job loss');
      expect(result).toContain('job loss');
    });

    it('summarize handler should return prompt', () => {
      const result = SLASH_COMMANDS.summarize.handler('');
      expect(result).toContain('summarize');
    });

    it('help handler should return empty string', () => {
      const result = SLASH_COMMANDS.help.handler('');
      expect(result).toBe('');
    });
  });
});

describe('parseSlashCommand', () => {
  it('should return isCommand=false for non-slash messages', () => {
    expect(parseSlashCommand('hello')).toEqual({ isCommand: false });
    expect(parseSlashCommand('no slash here')).toEqual({ isCommand: false });
    expect(parseSlashCommand('')).toEqual({ isCommand: false });
  });

  it('should parse known command without args', () => {
    const result = parseSlashCommand('/summarize');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('summarize');
    expect(result.prompt).toBeDefined();
    expect(result.prompt).toContain('summarize');
  });

  it('should parse known command with args', () => {
    const result = parseSlashCommand('/pray my family');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('pray');
    expect(result.args).toBe('my family');
    expect(result.prompt).toContain('my family');
  });

  it('should handle /help specially', () => {
    const result = parseSlashCommand('/help');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('help');
    expect(result.helpText).toContain('Available Commands');
  });

  it('should return help text for unknown commands', () => {
    const result = parseSlashCommand('/unknown');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('unknown');
    expect(result.helpText).toContain('Unknown command');
    expect(result.helpText).toContain('/help');
  });

  it('should be case-insensitive', () => {
    const result = parseSlashCommand('/PRAY strength');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('pray');
    expect(result.prompt).toContain('strength');
  });

  it('should trim whitespace', () => {
    const result = parseSlashCommand('  /verse  love  ');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('verse');
  });

  it('should reject invalid command format', () => {
    expect(parseSlashCommand('/').isCommand).toBe(false);
    expect(parseSlashCommand('/ ').isCommand).toBe(false);
  });
});

describe('getCommandSuggestions', () => {
  it('should return all commands for empty string', () => {
    const suggestions = getCommandSuggestions('');
    expect(suggestions.length).toBe(Object.keys(SLASH_COMMANDS).length);
  });

  it('should filter by prefix', () => {
    const suggestions = getCommandSuggestions('pr');
    expect(suggestions).toContain('/pray');
    expect(suggestions).not.toContain('/verse');
  });

  it('should handle / prefix in input', () => {
    const suggestions = getCommandSuggestions('/pr');
    expect(suggestions).toContain('/pray');
  });

  it('should return empty for no matches', () => {
    const suggestions = getCommandSuggestions('xyz');
    expect(suggestions).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const suggestions = getCommandSuggestions('PR');
    expect(suggestions).toContain('/pray');
  });

  it('should return commands prefixed with /', () => {
    const suggestions = getCommandSuggestions('s');
    for (const s of suggestions) {
      expect(s).toMatch(/^\//);
    }
  });
});
