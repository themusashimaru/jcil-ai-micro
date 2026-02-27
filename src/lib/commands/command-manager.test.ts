// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoadCommands = vi.fn();
const mockLoadCommand = vi.fn();
const mockExecuteCommand = vi.fn();
const mockGenerateHelpText = vi.fn();

vi.mock('./command-loader', () => ({
  loadCommands: (...args: unknown[]) => mockLoadCommands(...args),
  loadCommand: (...args: unknown[]) => mockLoadCommand(...args),
}));

vi.mock('./command-executor', () => ({
  executeCommand: (...args: unknown[]) => mockExecuteCommand(...args),
  generateHelpText: (...args: unknown[]) => mockGenerateHelpText(...args),
}));

import { CommandManager, getCommandManager, resetCommandManager } from './command-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    projectDir: '/test/project',
    sessionId: 'session_1',
    workspaceId: 'ws_1',
    ...overrides,
  };
}

function makeCommand(name: string, overrides = {}) {
  return {
    metadata: { name, description: `${name} command`, hidden: false },
    content: `Content for ${name}`,
    sourcePath: `/commands/${name}.md`,
    scope: 'project',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandManager', () => {
  let manager: CommandManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadCommands.mockReturnValue([]);
    mockLoadCommand.mockReturnValue(undefined);
    manager = new CommandManager(makeConfig());
  });

  // =========================================================================
  // Constructor
  // =========================================================================

  describe('constructor', () => {
    it('should include built-in commands by default', () => {
      const all = manager.getAll();
      expect(all.some((c) => c.metadata.name === 'help')).toBe(true);
      expect(all.some((c) => c.metadata.name === 'clear')).toBe(true);
      expect(all.some((c) => c.metadata.name === 'compact')).toBe(true);
    });

    it('should have 3 built-in commands', () => {
      expect(manager.getAll()).toHaveLength(3);
    });

    it('should exclude built-ins when includeBuiltIns is false', () => {
      const mgr = new CommandManager(makeConfig({ includeBuiltIns: false }));
      expect(mgr.getAll()).toHaveLength(0);
    });
  });

  // =========================================================================
  // getAll
  // =========================================================================

  describe('getAll', () => {
    it('should return all non-hidden commands', () => {
      expect(manager.getAll().every((c) => !c.metadata.hidden)).toBe(true);
    });

    it('should exclude hidden commands', async () => {
      mockLoadCommands.mockReturnValue([
        makeCommand('secret', {
          metadata: { name: 'secret', description: 'hidden', hidden: true },
        }),
      ]);
      await manager.reload();
      expect(manager.getAll().some((c) => c.metadata.name === 'secret')).toBe(false);
    });
  });

  // =========================================================================
  // get
  // =========================================================================

  describe('get', () => {
    it('should return built-in command by name', () => {
      const cmd = manager.get('help');
      expect(cmd).toBeDefined();
      expect(cmd?.metadata.name).toBe('help');
    });

    it('should return undefined for unknown command', () => {
      mockLoadCommand.mockReturnValue(undefined);
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('should try to load from disk if not cached', () => {
      manager.get('custom-cmd');
      expect(mockLoadCommand).toHaveBeenCalledWith('/test/project', 'custom-cmd');
    });

    it('should cache loaded command', () => {
      const custom = makeCommand('custom');
      mockLoadCommand.mockReturnValue(custom);

      manager.get('custom');
      manager.get('custom'); // Second call

      // Only called once because it's cached
      expect(mockLoadCommand).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // has
  // =========================================================================

  describe('has', () => {
    it('should return true for built-in commands', () => {
      expect(manager.has('help')).toBe(true);
    });

    it('should return false for unknown commands', () => {
      mockLoadCommand.mockReturnValue(undefined);
      expect(manager.has('nonexistent')).toBe(false);
    });

    it('should check disk when not in cache', () => {
      mockLoadCommand.mockReturnValue(makeCommand('disk-cmd'));
      expect(manager.has('disk-cmd')).toBe(true);
    });
  });

  // =========================================================================
  // reload
  // =========================================================================

  describe('reload', () => {
    it('should load custom commands from disk', async () => {
      const custom = [makeCommand('deploy'), makeCommand('lint')];
      mockLoadCommands.mockReturnValue(custom);

      await manager.reload();

      expect(manager.get('deploy')).toBeDefined();
      expect(manager.get('lint')).toBeDefined();
    });

    it('should keep built-in commands after reload', async () => {
      mockLoadCommands.mockReturnValue([]);
      await manager.reload();
      expect(manager.get('help')).toBeDefined();
    });

    it('should clear previously loaded custom commands', async () => {
      mockLoadCommands.mockReturnValueOnce([makeCommand('old')]);
      await manager.reload();
      expect(manager.get('old')).toBeDefined();

      mockLoadCommands.mockReturnValueOnce([makeCommand('new')]);
      await manager.reload();

      // old should be gone (cleared during reload), new should exist
      expect(manager.getAll().some((c) => c.metadata.name === 'old')).toBe(false);
      expect(manager.get('new')).toBeDefined();
    });
  });

  // =========================================================================
  // getByTag
  // =========================================================================

  describe('getByTag', () => {
    it('should return commands matching tag', async () => {
      mockLoadCommands.mockReturnValue([
        makeCommand('deploy', {
          metadata: { name: 'deploy', description: 'Deploy', hidden: false, tags: ['devops'] },
        }),
        makeCommand('test', {
          metadata: { name: 'test', description: 'Test', hidden: false, tags: ['dev'] },
        }),
      ]);
      await manager.reload();

      const devops = manager.getByTag('devops');
      expect(devops).toHaveLength(1);
      expect(devops[0].metadata.name).toBe('deploy');
    });

    it('should return empty array for unknown tag', () => {
      expect(manager.getByTag('unknown')).toHaveLength(0);
    });
  });

  // =========================================================================
  // getHelp
  // =========================================================================

  describe('getHelp', () => {
    it('should return help text for existing command', () => {
      mockGenerateHelpText.mockReturnValue('Usage: /help');
      const help = manager.getHelp('help');
      expect(help).toBe('Usage: /help');
      expect(mockGenerateHelpText).toHaveBeenCalled();
    });

    it('should return undefined for unknown command', () => {
      mockLoadCommand.mockReturnValue(undefined);
      expect(manager.getHelp('nonexistent')).toBeUndefined();
    });
  });

  // =========================================================================
  // execute
  // =========================================================================

  describe('execute', () => {
    it('should execute existing command', async () => {
      mockExecuteCommand.mockResolvedValue({ success: true, output: 'Done' });
      const result = await manager.execute('help', '');
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should return null for unknown command', async () => {
      mockLoadCommand.mockReturnValue(undefined);
      const result = await manager.execute('nonexistent', '');
      expect(result).toBeNull();
    });

    it('should pass arguments to executor', async () => {
      mockExecuteCommand.mockResolvedValue({ success: true });
      await manager.execute('help', '--verbose');

      const call = mockExecuteCommand.mock.calls[0];
      expect(call[1].arguments).toBe('--verbose');
    });

    it('should include session and workspace IDs', async () => {
      mockExecuteCommand.mockResolvedValue({ success: true });
      await manager.execute('help', '');

      const call = mockExecuteCommand.mock.calls[0];
      expect(call[1].sessionId).toBe('session_1');
      expect(call[1].workspaceId).toBe('ws_1');
    });

    it('should pass cwd option', async () => {
      mockExecuteCommand.mockResolvedValue({ success: true });
      await manager.execute('help', '', { cwd: '/some/path' });

      const call = mockExecuteCommand.mock.calls[0];
      expect(call[1].cwd).toBe('/some/path');
    });
  });

  // =========================================================================
  // parseMessage
  // =========================================================================

  describe('parseMessage', () => {
    it('should parse /command', () => {
      const result = manager.parseMessage('/help');
      expect(result).toEqual({ command: 'help', args: '', isCommand: true });
    });

    it('should parse /command with args', () => {
      const result = manager.parseMessage('/search some query');
      expect(result).toEqual({ command: 'search', args: 'some query', isCommand: true });
    });

    it('should return null for non-command messages', () => {
      expect(manager.parseMessage('hello world')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(manager.parseMessage('')).toBeNull();
    });

    it('should trim whitespace', () => {
      const result = manager.parseMessage('  /help  ');
      expect(result?.command).toBe('help');
    });

    it('should handle command with multiple spaces in args', () => {
      const result = manager.parseMessage('/search   multiple   words');
      expect(result?.command).toBe('search');
      expect(result?.args).toBe('  multiple   words');
    });
  });

  // =========================================================================
  // generateFullHelp
  // =========================================================================

  describe('generateFullHelp', () => {
    it('should contain "Available Commands" header', () => {
      expect(manager.generateFullHelp()).toContain('# Available Commands');
    });

    it('should list built-in commands', () => {
      const help = manager.generateFullHelp();
      expect(help).toContain('/help');
      expect(help).toContain('/clear');
      expect(help).toContain('/compact');
    });

    it('should include descriptions', () => {
      const help = manager.generateFullHelp();
      expect(help).toContain('Show available commands');
    });

    it('should group tagged commands', async () => {
      mockLoadCommands.mockReturnValue([
        makeCommand('deploy', {
          metadata: { name: 'deploy', description: 'Deploy', hidden: false, tags: ['devops'] },
        }),
      ]);
      await manager.reload();

      const help = manager.generateFullHelp();
      expect(help).toContain('## devops');
      expect(help).toContain('/deploy');
    });

    it('should have "Other" section for untagged commands', () => {
      const help = manager.generateFullHelp();
      expect(help).toContain('## Other');
    });
  });
});

// ---------------------------------------------------------------------------
// getCommandManager / resetCommandManager
// ---------------------------------------------------------------------------

describe('getCommandManager', () => {
  beforeEach(() => {
    resetCommandManager();
    vi.clearAllMocks();
  });

  it('should create a manager when config is provided', () => {
    const mgr = getCommandManager(makeConfig());
    expect(mgr).toBeInstanceOf(CommandManager);
  });

  it('should return the same instance on subsequent calls', () => {
    const mgr1 = getCommandManager(makeConfig());
    const mgr2 = getCommandManager();
    expect(mgr1).toBe(mgr2);
  });

  it('should throw when called without config and not initialized', () => {
    expect(() => getCommandManager()).toThrow('not initialized');
  });
});

describe('resetCommandManager', () => {
  it('should reset the global instance', () => {
    getCommandManager(makeConfig());
    resetCommandManager();
    expect(() => getCommandManager()).toThrow('not initialized');
  });
});
