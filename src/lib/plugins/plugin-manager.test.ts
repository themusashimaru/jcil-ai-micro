// @ts-nocheck - Test file with extensive mocking
/**
 * Tests for PluginManager
 *
 * Covers: PluginManager class, getPluginManager singleton, resetPluginManager,
 * plugin lifecycle (install, enable, disable, uninstall), registry methods,
 * capability aggregation, config updates, event emission, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs before imports — use vi.hoisted so variables are available to hoisted vi.mock
const { mockExistsSync, mockReaddirSync, mockReadFileSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('fs', () => {
  // Need to provide default export to avoid CJS/ESM issues
  const mocked = {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  };
  return { ...mocked, default: mocked };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { PluginManager, getPluginManager, resetPluginManager } from './plugin-manager';
import type { PluginDefinition, PluginInstance, PluginEvent } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig = {
  projectDir: '/test/project',
  userId: 'user-1',
  workspaceId: 'ws-1',
  sessionId: 'sess-1',
};

function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'tester',
    ...overrides,
  };
}

function makeManifestJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify(makeManifest(overrides));
}

/** Create a PluginManager and load a single plugin into it by mocking fs calls. */
async function loadSinglePlugin(
  manager: PluginManager,
  manifest: Record<string, unknown> = {},
  scope: 'project' | 'user' = 'project'
): Promise<PluginInstance | null> {
  const merged = makeManifest(manifest);
  mockExistsSync.mockImplementation((p) => {
    if (typeof p === 'string' && p.endsWith('package.json')) return true;
    return false;
  });
  mockReadFileSync.mockReturnValue(JSON.stringify(merged));

  return manager.loadPlugin('/fake/plugin-dir', scope);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPluginManager();
    manager = new PluginManager(defaultConfig);
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  // =========================================================================
  // Construction
  // =========================================================================

  describe('constructor', () => {
    it('creates an instance with no plugins', () => {
      expect(manager.getAll()).toEqual([]);
    });
  });

  // =========================================================================
  // Registry methods
  // =========================================================================

  describe('registry methods', () => {
    it('has() returns false for unknown id', () => {
      expect(manager.has('nope')).toBe(false);
    });

    it('get() returns undefined for unknown id', () => {
      expect(manager.get('nope')).toBeUndefined();
    });

    it('getByState() returns empty array when no plugins match', () => {
      expect(manager.getByState('enabled')).toEqual([]);
    });

    it('getByTool() returns undefined when no plugin provides the tool', () => {
      expect(manager.getByTool('nonexistent')).toBeUndefined();
    });

    it('getByCommand() returns undefined when no plugin provides the command', () => {
      expect(manager.getByCommand('nonexistent')).toBeUndefined();
    });
  });

  // =========================================================================
  // loadPlugin
  // =========================================================================

  describe('loadPlugin', () => {
    it('returns null when no package.json exists', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await manager.loadPlugin('/fake/dir', 'project');
      expect(result).toBeNull();
    });

    it('returns null when package.json is invalid JSON', async () => {
      mockExistsSync.mockImplementation((p) =>
        typeof p === 'string' && p.endsWith('package.json') ? true : false
      );
      mockReadFileSync.mockReturnValue('not json');

      const result = await manager.loadPlugin('/fake/dir', 'project');
      expect(result).toBeNull();
    });

    it('loads a valid plugin and adds it to the registry', async () => {
      const instance = await loadSinglePlugin(manager);
      expect(instance).not.toBeNull();
      expect(instance!.state).toBe('installed');
      expect(instance!.scope).toBe('project');
      expect(manager.has('test-plugin')).toBe(true);
      expect(manager.get('test-plugin')).toBe(instance);
    });

    it('emits plugin:installed event', async () => {
      const listener = vi.fn();
      manager.on('plugin:installed', listener);

      await loadSinglePlugin(manager);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:installed', pluginId: 'test-plugin' })
      );
    });

    it('handles author as object with name property', async () => {
      mockExistsSync.mockImplementation((p) =>
        typeof p === 'string' && p.endsWith('package.json') ? true : false
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          name: 'author-obj-plugin',
          version: '1.0.0',
          author: { name: 'Object Author', email: 'a@b.com' },
        })
      );

      const instance = await manager.loadPlugin('/fake/dir', 'project');
      expect(instance).not.toBeNull();
      expect(instance!.definition.metadata.author).toBe('Object Author');
    });

    it('uses codelab.engineVersion and codelab.dependencies from manifest', async () => {
      mockExistsSync.mockImplementation((p) =>
        typeof p === 'string' && p.endsWith('package.json') ? true : false
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          name: 'codelab-plugin',
          version: '2.0.0',
          codelab: {
            engineVersion: '>=1.0.0',
            dependencies: ['dep-a'],
            contributes: { tools: ['my-tool'] },
          },
        })
      );

      const instance = await manager.loadPlugin('/fake/dir', 'project');
      expect(instance).not.toBeNull();
      expect(instance!.definition.metadata.engineVersion).toBe('>=1.0.0');
      expect(instance!.definition.metadata.dependencies).toEqual(['dep-a']);
    });

    it('project scope overrides user scope for same id', async () => {
      // First load as user
      await loadSinglePlugin(manager, {}, 'user');
      expect(manager.get('test-plugin')!.scope).toBe('user');

      // Then load as project — should override
      const instance = await loadSinglePlugin(manager, {}, 'project');
      expect(instance).not.toBeNull();
      expect(manager.get('test-plugin')!.scope).toBe('project');
    });

    it('user scope does NOT override project scope for same id', async () => {
      await loadSinglePlugin(manager, {}, 'project');
      const instance = await loadSinglePlugin(manager, {}, 'user');
      expect(instance).toBeNull();
      expect(manager.get('test-plugin')!.scope).toBe('project');
    });

    it('loads plugin entry point path when it exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(makeManifestJson());

      const instance = await manager.loadPlugin('/fake/dir', 'project');
      expect(instance).not.toBeNull();
    });
  });

  // =========================================================================
  // loadAll
  // =========================================================================

  describe('loadAll', () => {
    it('loads from project and user directories when they exist', async () => {
      mockExistsSync.mockImplementation((p) => {
        const path = String(p);
        if (path.includes('.claude/plugins')) return true;
        if (path.endsWith('package.json')) return true;
        return false;
      });

      const dirEntry = { name: 'my-plugin', isDirectory: () => true };
      mockReaddirSync.mockReturnValue([dirEntry] as unknown as ReturnType<typeof readdirSync>);
      mockReadFileSync.mockReturnValue(makeManifestJson({ name: 'my-plugin' }));

      await manager.loadAll();

      // The plugin may be loaded from either project or user dir
      expect(manager.has('my-plugin')).toBe(true);
    });

    it('handles missing plugin directories gracefully', async () => {
      mockExistsSync.mockReturnValue(false);

      await manager.loadAll();
      expect(manager.getAll()).toEqual([]);
    });

    it('handles readdirSync failure gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('permission denied');
      });

      await expect(manager.loadAll()).resolves.not.toThrow();
    });

    it('skips non-directory entries', async () => {
      mockExistsSync.mockImplementation((p) => {
        const path = String(p);
        if (path.includes('.claude/plugins')) return true;
        return false;
      });
      const fileEntry = { name: 'readme.txt', isDirectory: () => false };
      mockReaddirSync.mockReturnValue([fileEntry] as unknown as ReturnType<typeof readdirSync>);

      await manager.loadAll();
      expect(manager.getAll()).toEqual([]);
    });
  });

  // =========================================================================
  // enable
  // =========================================================================

  describe('enable', () => {
    it('returns false for unknown plugin', async () => {
      expect(await manager.enable('nope')).toBe(false);
    });

    it('enables an installed plugin', async () => {
      await loadSinglePlugin(manager);
      const result = await manager.enable('test-plugin');
      expect(result).toBe(true);
      expect(manager.get('test-plugin')!.state).toBe('enabled');
      expect(manager.get('test-plugin')!.enabledAt).toBeInstanceOf(Date);
    });

    it('returns true if plugin is already enabled (idempotent)', async () => {
      await loadSinglePlugin(manager);
      await manager.enable('test-plugin');
      const result = await manager.enable('test-plugin');
      expect(result).toBe(true);
    });

    it('emits plugin:enabled event', async () => {
      await loadSinglePlugin(manager);
      const listener = vi.fn();
      manager.on('plugin:enabled', listener);

      await manager.enable('test-plugin');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:enabled', pluginId: 'test-plugin' })
      );
    });

    it('calls lifecycle activate hook', async () => {
      const activate = vi.fn();
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = { activate };

      await manager.enable('test-plugin');
      expect(activate).toHaveBeenCalledTimes(1);
      expect(activate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          userId: 'user-1',
          sessionId: 'sess-1',
        })
      );
    });

    it('sets error state and emits plugin:error on activate failure', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue(new Error('boom')),
      };

      const errorListener = vi.fn();
      manager.on('plugin:error', errorListener);

      const result = await manager.enable('test-plugin');
      expect(result).toBe(false);
      expect(instance.state).toBe('error');
      expect(instance.error).toBe('boom');
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:error', pluginId: 'test-plugin' })
      );
    });

    it('handles non-Error thrown in activate', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue('string error'),
      };

      const result = await manager.enable('test-plugin');
      expect(result).toBe(false);
      expect(instance.error).toBe('Unknown error');
    });
  });

  // =========================================================================
  // disable
  // =========================================================================

  describe('disable', () => {
    it('returns false for unknown plugin', async () => {
      expect(await manager.disable('nope')).toBe(false);
    });

    it('returns true if plugin is not enabled (e.g. installed state)', async () => {
      await loadSinglePlugin(manager);
      expect(await manager.disable('test-plugin')).toBe(true);
    });

    it('disables an enabled plugin', async () => {
      await loadSinglePlugin(manager);
      await manager.enable('test-plugin');
      const result = await manager.disable('test-plugin');
      expect(result).toBe(true);
      expect(manager.get('test-plugin')!.state).toBe('disabled');
    });

    it('emits plugin:disabled event', async () => {
      await loadSinglePlugin(manager);
      await manager.enable('test-plugin');
      const listener = vi.fn();
      manager.on('plugin:disabled', listener);

      await manager.disable('test-plugin');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:disabled', pluginId: 'test-plugin' })
      );
    });

    it('calls lifecycle deactivate hook', async () => {
      const deactivate = vi.fn();
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = { deactivate };
      instance.state = 'enabled';

      await manager.disable('test-plugin');
      expect(deactivate).toHaveBeenCalledTimes(1);
    });

    it('returns false when deactivate hook throws', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = {
        deactivate: vi.fn().mockRejectedValue(new Error('fail')),
      };
      instance.state = 'enabled';

      const result = await manager.disable('test-plugin');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // uninstall
  // =========================================================================

  describe('uninstall', () => {
    it('returns false for unknown plugin', async () => {
      expect(await manager.uninstall('nope')).toBe(false);
    });

    it('uninstalls an installed plugin', async () => {
      await loadSinglePlugin(manager);
      const result = await manager.uninstall('test-plugin');
      expect(result).toBe(true);
      expect(manager.has('test-plugin')).toBe(false);
    });

    it('disables first then uninstalls when plugin is enabled', async () => {
      await loadSinglePlugin(manager);
      await manager.enable('test-plugin');

      const disabledListener = vi.fn();
      manager.on('plugin:disabled', disabledListener);
      const uninstalledListener = vi.fn();
      manager.on('plugin:uninstalled', uninstalledListener);

      await manager.uninstall('test-plugin');
      expect(disabledListener).toHaveBeenCalled();
      expect(uninstalledListener).toHaveBeenCalled();
      expect(manager.has('test-plugin')).toBe(false);
    });

    it('emits plugin:uninstalled event', async () => {
      await loadSinglePlugin(manager);
      const listener = vi.fn();
      manager.on('plugin:uninstalled', listener);

      await manager.uninstall('test-plugin');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'plugin:uninstalled', pluginId: 'test-plugin' })
      );
    });
  });

  // =========================================================================
  // updateConfig
  // =========================================================================

  describe('updateConfig', () => {
    it('returns false for unknown plugin', async () => {
      expect(await manager.updateConfig('nope', { key: 'val' })).toBe(false);
    });

    it('merges config onto existing config', async () => {
      await loadSinglePlugin(manager);
      await manager.updateConfig('test-plugin', { theme: 'dark' });
      expect(manager.get('test-plugin')!.config).toEqual({ theme: 'dark' });

      await manager.updateConfig('test-plugin', { lang: 'en' });
      expect(manager.get('test-plugin')!.config).toEqual({ theme: 'dark', lang: 'en' });
    });

    it('emits plugin:configChanged event', async () => {
      await loadSinglePlugin(manager);
      const listener = vi.fn();
      manager.on('plugin:configChanged', listener);

      await manager.updateConfig('test-plugin', { a: 1 });
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:configChanged',
          pluginId: 'test-plugin',
        })
      );
    });

    it('calls onConfigChange lifecycle hook when plugin is enabled', async () => {
      const onConfigChange = vi.fn();
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.lifecycle = { onConfigChange };
      instance.state = 'enabled';

      await manager.updateConfig('test-plugin', { x: 42 });
      expect(onConfigChange).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onConfigChange when plugin is not enabled', async () => {
      const onConfigChange = vi.fn();
      await loadSinglePlugin(manager);
      manager.get('test-plugin')!.definition.lifecycle = { onConfigChange };

      await manager.updateConfig('test-plugin', { x: 42 });
      expect(onConfigChange).not.toHaveBeenCalled();
    });

    it('reverts config when onConfigChange throws', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.config = { original: true };
      instance.state = 'enabled';
      instance.definition.lifecycle = {
        onConfigChange: vi.fn().mockRejectedValue(new Error('rejected')),
      };

      const result = await manager.updateConfig('test-plugin', { original: false, extra: 1 });
      expect(result).toBe(false);
      expect(instance.config).toEqual({ original: true });
    });
  });

  // =========================================================================
  // Capability aggregation (getAllTools, getAllCommands, getAllHooks, getAllMCPServers)
  // =========================================================================

  describe('capability aggregation', () => {
    async function setupEnabledPlugin(id: string, definition: Partial<PluginDefinition> = {}) {
      mockExistsSync.mockImplementation((p) =>
        typeof p === 'string' && p.endsWith('package.json') ? true : false
      );
      mockReadFileSync.mockReturnValue(JSON.stringify(makeManifest({ name: id })));
      await manager.loadPlugin('/fake/' + id, 'project');
      const instance = manager.get(id)!;
      Object.assign(instance.definition, definition);
      instance.state = 'enabled';
      return instance;
    }

    it('getAllTools returns tools from all enabled plugins', async () => {
      const tool = {
        name: 'my-tool',
        description: 'a tool',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      await setupEnabledPlugin('p1', { tools: [tool] });
      await setupEnabledPlugin('p2', { tools: [] });

      const tools = manager.getAllTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].pluginId).toBe('p1');
      expect(tools[0].tool.name).toBe('my-tool');
    });

    it('getAllCommands returns commands from all enabled plugins', async () => {
      const cmd = { name: 'do-thing', description: 'does thing', prompt: 'Do the thing' };
      await setupEnabledPlugin('p1', { commands: [cmd] });

      const commands = manager.getAllCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].command.name).toBe('do-thing');
    });

    it('getAllHooks returns hooks from all enabled plugins', async () => {
      const hook = { event: 'before:chat' as any, hook: { name: 'h', handler: vi.fn() } as any };
      await setupEnabledPlugin('p1', { hooks: [hook] });

      const hooks = manager.getAllHooks();
      expect(hooks).toHaveLength(1);
    });

    it('getAllMCPServers returns servers from all enabled plugins', async () => {
      const server = { name: 'srv', command: 'node', args: ['server.js'] };
      await setupEnabledPlugin('p1', { mcpServers: [server] });

      const servers = manager.getAllMCPServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].server.name).toBe('srv');
    });

    it('does not include capabilities from non-enabled plugins', async () => {
      const tool = {
        name: 'hidden',
        description: '',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      await setupEnabledPlugin('p1', { tools: [tool] });
      manager.get('p1')!.state = 'installed'; // not enabled

      expect(manager.getAllTools()).toHaveLength(0);
    });
  });

  // =========================================================================
  // getByTool / getByCommand with loaded plugins
  // =========================================================================

  describe('getByTool and getByCommand', () => {
    it('getByTool finds plugin providing a tool', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.tools = [
        {
          name: 'special-tool',
          description: '',
          inputSchema: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
      ];

      expect(manager.getByTool('special-tool')).toBe(instance);
      expect(manager.getByTool('other')).toBeUndefined();
    });

    it('getByCommand finds plugin providing a command', async () => {
      await loadSinglePlugin(manager);
      const instance = manager.get('test-plugin')!;
      instance.definition.commands = [{ name: 'my-cmd', description: '', prompt: '' }];

      expect(manager.getByCommand('my-cmd')).toBe(instance);
      expect(manager.getByCommand('other')).toBeUndefined();
    });
  });

  // =========================================================================
  // onPluginEvent
  // =========================================================================

  describe('onPluginEvent', () => {
    it('registers listener for all plugin event types', async () => {
      const listener = vi.fn();
      manager.onPluginEvent(listener);

      await loadSinglePlugin(manager);
      await manager.enable('test-plugin');
      await manager.disable('test-plugin');
      await manager.uninstall('test-plugin');

      const eventTypes = listener.mock.calls.map((c) => (c[0] as PluginEvent).type);
      expect(eventTypes).toContain('plugin:installed');
      expect(eventTypes).toContain('plugin:enabled');
      expect(eventTypes).toContain('plugin:disabled');
      expect(eventTypes).toContain('plugin:uninstalled');
    });
  });

  // =========================================================================
  // getPluginManager singleton
  // =========================================================================

  describe('getPluginManager', () => {
    beforeEach(() => {
      resetPluginManager();
    });

    it('throws when called without config and no instance exists', () => {
      expect(() => getPluginManager()).toThrow('PluginManager must be initialized with config');
    });

    it('creates and returns a singleton', () => {
      const pm = getPluginManager(defaultConfig);
      expect(pm).toBeInstanceOf(PluginManager);
      expect(getPluginManager()).toBe(pm);
    });

    it('resetPluginManager clears singleton', () => {
      getPluginManager(defaultConfig);
      resetPluginManager();
      expect(() => getPluginManager()).toThrow();
    });
  });
});
