// @ts-nocheck - Test file with extensive mocking; strict types not needed
/**
 * Comprehensive tests for PluginManager
 *
 * Covers: registration, loading, validation, lifecycle management,
 * event emission, capabilities aggregation, singleton, and error handling.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginDefinition, PluginEvent, PluginContext, PluginState } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// We mock 'fs' to control filesystem access. The plugin-manager imports named
// exports from 'fs', so we need the mock to expose them.
import * as fs from 'fs';
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { PluginManager, resetPluginManager, getPluginManager } from '../plugin-manager';

// Typed references to the mocked functions
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedReaddirSync = vi.mocked(fs.readdirSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  projectDir: '/tmp/test-project',
  userId: 'test-user',
  workspaceId: 'test-workspace',
  sessionId: 'test-session',
};

function createManager(overrides: Partial<typeof DEFAULT_CONFIG> = {}): PluginManager {
  return new PluginManager({ ...DEFAULT_CONFIG, ...overrides });
}

/**
 * Configure fs mocks so that loadPlugin succeeds for the given directory.
 */
function stubPluginOnDisk(pluginDir: string, manifest: Record<string, unknown> = {}) {
  const merged = { name: 'test-plugin', version: '1.0.0', ...manifest };
  const packagePath = `${pluginDir}/package.json`;

  mockedExistsSync.mockImplementation(((p: string) => {
    if (p === packagePath) return true;
    return false;
  }) as typeof fs.existsSync);

  mockedReadFileSync.mockImplementation(((p: string) => {
    if (p === packagePath) return JSON.stringify(merged);
    throw new Error('File not found');
  }) as typeof fs.readFileSync);

  return merged.name as string;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPluginManager();
    manager = createManager();
    mockedExistsSync.mockReturnValue(false as never);
    mockedReaddirSync.mockReturnValue([] as never);
    mockedReadFileSync.mockReturnValue('' as never);
  });

  // ========================================================================
  // CONSTRUCTOR
  // ========================================================================

  describe('constructor', () => {
    it('should create an instance of PluginManager', () => {
      expect(manager).toBeInstanceOf(PluginManager);
    });

    it('should extend EventEmitter', () => {
      expect(typeof manager.on).toBe('function');
      expect(typeof manager.emit).toBe('function');
    });
  });

  // ========================================================================
  // REGISTRY — empty state
  // ========================================================================

  describe('registry (empty)', () => {
    it('getAll returns an empty array', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('get returns undefined for unknown id', () => {
      expect(manager.get('nope')).toBeUndefined();
    });

    it('has returns false for unknown id', () => {
      expect(manager.has('nope')).toBe(false);
    });

    it('getByState returns empty for every state', () => {
      for (const state of ['installed', 'enabled', 'disabled', 'error'] as PluginState[]) {
        expect(manager.getByState(state)).toEqual([]);
      }
    });

    it('getByTool returns undefined when no plugins registered', () => {
      expect(manager.getByTool('any-tool')).toBeUndefined();
    });

    it('getByCommand returns undefined when no plugins registered', () => {
      expect(manager.getByCommand('any-cmd')).toBeUndefined();
    });
  });

  // ========================================================================
  // loadPlugin
  // ========================================================================

  describe('loadPlugin', () => {
    it('should return null when package.json does not exist', async () => {
      mockedExistsSync.mockReturnValue(false as never);
      const result = await manager.loadPlugin('/fake/dir', 'project');
      expect(result).toBeNull();
    });

    it('should return null when package.json is invalid JSON', async () => {
      mockedExistsSync.mockImplementation(((p: string) =>
        p.endsWith('package.json')) as typeof fs.existsSync);
      mockedReadFileSync.mockReturnValue('NOT VALID JSON' as never);
      const result = await manager.loadPlugin('/fake/dir', 'project');
      expect(result).toBeNull();
    });

    it('should load a plugin and add it to the registry', async () => {
      stubPluginOnDisk('/plugins/alpha', { name: 'alpha', version: '2.0.0' });

      const instance = await manager.loadPlugin('/plugins/alpha', 'project');

      expect(instance).not.toBeNull();
      expect(instance!.definition.metadata.id).toBe('alpha');
      expect(instance!.definition.metadata.version).toBe('2.0.0');
      expect(instance!.state).toBe('installed');
      expect(instance!.scope).toBe('project');
      expect(manager.has('alpha')).toBe(true);
    });

    it('should emit plugin:installed event on successful load', async () => {
      stubPluginOnDisk('/plugins/alpha', { name: 'alpha' });
      const listener = vi.fn();
      manager.on('plugin:installed', listener);

      await manager.loadPlugin('/plugins/alpha', 'project');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        type: 'plugin:installed',
        pluginId: 'alpha',
      });
    });

    it('should populate metadata from manifest fields', async () => {
      stubPluginOnDisk('/plugins/meta', {
        name: 'meta-plugin',
        version: '3.1.0',
        description: 'Meta desc',
        author: 'Author Name',
        homepage: 'https://example.com',
        license: 'MIT',
        keywords: ['test', 'meta'],
        codelab: {
          engineVersion: '>=1.0.0',
          dependencies: ['dep-a'],
        },
      });

      const inst = await manager.loadPlugin('/plugins/meta', 'user');
      const meta = inst!.definition.metadata;

      expect(meta.id).toBe('meta-plugin');
      expect(meta.description).toBe('Meta desc');
      expect(meta.author).toBe('Author Name');
      expect(meta.homepage).toBe('https://example.com');
      expect(meta.license).toBe('MIT');
      expect(meta.keywords).toEqual(['test', 'meta']);
      expect(meta.engineVersion).toBe('>=1.0.0');
      expect(meta.dependencies).toEqual(['dep-a']);
    });

    it('should handle author as object with name field', async () => {
      stubPluginOnDisk('/plugins/obj-author', {
        name: 'obj-author-plugin',
        author: { name: 'Obj Author', email: 'a@b.com' },
      });

      const inst = await manager.loadPlugin('/plugins/obj-author', 'project');
      expect(inst!.definition.metadata.author).toBe('Obj Author');
    });

    it('project scope should override existing user-scoped plugin', async () => {
      stubPluginOnDisk('/user/alpha', { name: 'alpha', version: '1.0.0' });
      await manager.loadPlugin('/user/alpha', 'user');

      stubPluginOnDisk('/project/alpha', { name: 'alpha', version: '2.0.0' });
      const inst = await manager.loadPlugin('/project/alpha', 'project');

      expect(inst).not.toBeNull();
      expect(manager.get('alpha')!.definition.metadata.version).toBe('2.0.0');
      expect(manager.get('alpha')!.scope).toBe('project');
    });

    it('user scope should NOT override existing project-scoped plugin', async () => {
      stubPluginOnDisk('/project/alpha', { name: 'alpha', version: '1.0.0' });
      await manager.loadPlugin('/project/alpha', 'project');

      stubPluginOnDisk('/user/alpha', { name: 'alpha', version: '9.9.9' });
      const inst = await manager.loadPlugin('/user/alpha', 'user');

      expect(inst).toBeNull();
      expect(manager.get('alpha')!.definition.metadata.version).toBe('1.0.0');
    });

    it('should set config to empty object by default', async () => {
      stubPluginOnDisk('/plugins/cfg', { name: 'cfg-plugin' });
      const inst = await manager.loadPlugin('/plugins/cfg', 'project');
      expect(inst!.config).toEqual({});
    });

    it('should set installedAt to a Date on load', async () => {
      stubPluginOnDisk('/plugins/ts', { name: 'ts-plugin' });
      const inst = await manager.loadPlugin('/plugins/ts', 'project');
      expect(inst!.installedAt).toBeInstanceOf(Date);
    });
  });

  // ========================================================================
  // loadAll
  // ========================================================================

  describe('loadAll', () => {
    it('should load plugins from project directory when it exists', async () => {
      mockedExistsSync.mockImplementation(((p: string) => {
        if (p === '/tmp/test-project/.claude/plugins') return true;
        if (p.endsWith('package.json')) return true;
        return false;
      }) as typeof fs.existsSync);

      mockedReaddirSync.mockImplementation(((...args: unknown[]) => {
        const dir = args[0] as string;
        if (dir === '/tmp/test-project/.claude/plugins') {
          return [{ name: 'pluginA', isDirectory: () => true }];
        }
        return [];
      }) as typeof fs.readdirSync);

      mockedReadFileSync.mockImplementation(((p: string) => {
        if (p.includes('pluginA') && p.endsWith('package.json')) {
          return JSON.stringify({ name: 'pluginA', version: '1.0.0' });
        }
        throw new Error('not found');
      }) as typeof fs.readFileSync);

      await manager.loadAll();

      expect(manager.has('pluginA')).toBe(true);
    });

    it('should skip non-directory entries in plugin directory', async () => {
      mockedExistsSync.mockImplementation(((p: string) => {
        if (p === '/tmp/test-project/.claude/plugins') return true;
        return false;
      }) as typeof fs.existsSync);

      mockedReaddirSync.mockReturnValue([{ name: 'file.txt', isDirectory: () => false }] as never);

      await manager.loadAll();
      expect(manager.getAll()).toEqual([]);
    });

    it('should handle readdirSync throwing an error gracefully', async () => {
      mockedExistsSync.mockReturnValue(true as never);
      mockedReaddirSync.mockImplementation((() => {
        throw new Error('Permission denied');
      }) as typeof fs.readdirSync);

      await expect(manager.loadAll()).resolves.not.toThrow();
    });
  });

  // ========================================================================
  // enable
  // ========================================================================

  describe('enable', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.enable('ghost')).toBe(false);
    });

    it('should enable an installed plugin and set state', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const ok = await manager.enable('a');
      expect(ok).toBe(true);
      expect(manager.get('a')!.state).toBe('enabled');
      expect(manager.get('a')!.enabledAt).toBeInstanceOf(Date);
    });

    it('should return true if plugin is already enabled', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      await manager.enable('a');

      const again = await manager.enable('a');
      expect(again).toBe(true);
    });

    it('should call lifecycle.activate when defined', async () => {
      stubPluginOnDisk('/p/lc', { name: 'lc' });
      const inst = await manager.loadPlugin('/p/lc', 'project');
      const activateFn = vi.fn();
      inst!.definition.lifecycle = { activate: activateFn };

      await manager.enable('lc');

      expect(activateFn).toHaveBeenCalledTimes(1);
      const ctx: PluginContext = activateFn.mock.calls[0][0];
      expect(ctx.workspaceId).toBe('test-workspace');
      expect(ctx.userId).toBe('test-user');
      expect(ctx.sessionId).toBe('test-session');
      expect(typeof ctx.log.info).toBe('function');
      expect(typeof ctx.services.executeShell).toBe('function');
    });

    it('should emit plugin:enabled event', async () => {
      stubPluginOnDisk('/p/ev', { name: 'ev' });
      await manager.loadPlugin('/p/ev', 'project');

      const listener = vi.fn();
      manager.on('plugin:enabled', listener);

      await manager.enable('ev');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        type: 'plugin:enabled',
        pluginId: 'ev',
      });
    });

    it('should set error state and emit plugin:error when activate throws', async () => {
      stubPluginOnDisk('/p/bad', { name: 'bad' });
      const inst = await manager.loadPlugin('/p/bad', 'project');
      inst!.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue(new Error('Activation failed')),
      };

      const errorListener = vi.fn();
      manager.on('plugin:error', errorListener);

      const ok = await manager.enable('bad');

      expect(ok).toBe(false);
      expect(manager.get('bad')!.state).toBe('error');
      expect(manager.get('bad')!.error).toBe('Activation failed');
      expect(errorListener).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error thrown values during activation', async () => {
      stubPluginOnDisk('/p/str', { name: 'str' });
      const inst = await manager.loadPlugin('/p/str', 'project');
      inst!.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue('string error'),
      };

      await manager.enable('str');

      expect(manager.get('str')!.state).toBe('error');
      expect(manager.get('str')!.error).toBe('Unknown error');
    });
  });

  // ========================================================================
  // disable
  // ========================================================================

  describe('disable', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.disable('ghost')).toBe(false);
    });

    it('should return true if plugin is not in enabled state', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      expect(await manager.disable('a')).toBe(true);
    });

    it('should disable an enabled plugin and set state to disabled', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      await manager.enable('a');

      const ok = await manager.disable('a');
      expect(ok).toBe(true);
      expect(manager.get('a')!.state).toBe('disabled');
    });

    it('should call lifecycle.deactivate when defined', async () => {
      stubPluginOnDisk('/p/lc', { name: 'lc' });
      const inst = await manager.loadPlugin('/p/lc', 'project');
      const deactivateFn = vi.fn();
      inst!.definition.lifecycle = { deactivate: deactivateFn };

      await manager.enable('lc');
      await manager.disable('lc');

      expect(deactivateFn).toHaveBeenCalledTimes(1);
    });

    it('should emit plugin:disabled event', async () => {
      stubPluginOnDisk('/p/ev', { name: 'ev' });
      await manager.loadPlugin('/p/ev', 'project');
      await manager.enable('ev');

      const listener = vi.fn();
      manager.on('plugin:disabled', listener);

      await manager.disable('ev');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        type: 'plugin:disabled',
        pluginId: 'ev',
      });
    });

    it('should return false when deactivate throws', async () => {
      stubPluginOnDisk('/p/bad', { name: 'bad' });
      const inst = await manager.loadPlugin('/p/bad', 'project');
      inst!.definition.lifecycle = {
        deactivate: vi.fn().mockRejectedValue(new Error('Deactivation boom')),
      };
      await manager.enable('bad');

      const ok = await manager.disable('bad');
      expect(ok).toBe(false);
    });
  });

  // ========================================================================
  // uninstall
  // ========================================================================

  describe('uninstall', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.uninstall('ghost')).toBe(false);
    });

    it('should remove the plugin from the registry', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      expect(manager.has('a')).toBe(true);
      const ok = await manager.uninstall('a');
      expect(ok).toBe(true);
      expect(manager.has('a')).toBe(false);
    });

    it('should disable an enabled plugin before uninstalling', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      const inst = await manager.loadPlugin('/p/a', 'project');
      const deactivateFn = vi.fn();
      inst!.definition.lifecycle = { deactivate: deactivateFn };
      await manager.enable('a');

      const disabledListener = vi.fn();
      manager.on('plugin:disabled', disabledListener);

      await manager.uninstall('a');

      expect(deactivateFn).toHaveBeenCalledTimes(1);
      expect(disabledListener).toHaveBeenCalledTimes(1);
      expect(manager.has('a')).toBe(false);
    });

    it('should emit plugin:uninstalled event', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const listener = vi.fn();
      manager.on('plugin:uninstalled', listener);

      await manager.uninstall('a');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        type: 'plugin:uninstalled',
        pluginId: 'a',
      });
    });
  });

  // ========================================================================
  // updateConfig
  // ========================================================================

  describe('updateConfig', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.updateConfig('ghost', {})).toBe(false);
    });

    it('should merge config into existing config', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      await manager.updateConfig('a', { key1: 'val1' });
      expect(manager.get('a')!.config).toEqual({ key1: 'val1' });

      await manager.updateConfig('a', { key2: 'val2' });
      expect(manager.get('a')!.config).toEqual({ key1: 'val1', key2: 'val2' });
    });

    it('should call lifecycle.onConfigChange when plugin is enabled', async () => {
      stubPluginOnDisk('/p/cfg', { name: 'cfg' });
      const inst = await manager.loadPlugin('/p/cfg', 'project');
      const onConfigChange = vi.fn();
      inst!.definition.lifecycle = { onConfigChange };
      await manager.enable('cfg');

      await manager.updateConfig('cfg', { newKey: true });

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange.mock.calls[0][0]).toEqual({ newKey: true });
    });

    it('should NOT call onConfigChange when plugin is not enabled', async () => {
      stubPluginOnDisk('/p/cfg', { name: 'cfg' });
      const inst = await manager.loadPlugin('/p/cfg', 'project');
      const onConfigChange = vi.fn();
      inst!.definition.lifecycle = { onConfigChange };

      await manager.updateConfig('cfg', { key: 'value' });

      expect(onConfigChange).not.toHaveBeenCalled();
    });

    it('should revert config when onConfigChange throws', async () => {
      stubPluginOnDisk('/p/cfg', { name: 'cfg' });
      const inst = await manager.loadPlugin('/p/cfg', 'project');
      inst!.definition.lifecycle = {
        onConfigChange: vi.fn().mockRejectedValue(new Error('bad config')),
      };
      await manager.enable('cfg');

      inst!.config = { original: true };

      const ok = await manager.updateConfig('cfg', { original: false, extra: 1 });

      expect(ok).toBe(false);
      expect(manager.get('cfg')!.config).toEqual({ original: true });
    });

    it('should emit plugin:configChanged event on success', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const listener = vi.fn();
      manager.on('plugin:configChanged', listener);

      await manager.updateConfig('a', { hello: 'world' });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as PluginEvent;
      expect(event.type).toBe('plugin:configChanged');
      expect(event.pluginId).toBe('a');
      expect(event.data).toMatchObject({
        oldConfig: {},
        newConfig: { hello: 'world' },
      });
    });
  });

  // ========================================================================
  // CAPABILITIES
  // ========================================================================

  describe('capabilities aggregation', () => {
    async function loadAndEnable(
      mgr: PluginManager,
      name: string,
      extras: Partial<PluginDefinition> = {}
    ) {
      stubPluginOnDisk(`/p/${name}`, { name });
      const inst = await mgr.loadPlugin(`/p/${name}`, 'project');
      Object.assign(inst!.definition, extras);
      await mgr.enable(name);
      return inst!;
    }

    it('getAllTools returns tools from all enabled plugins', async () => {
      const tool1 = {
        name: 'tool-a',
        description: 'Tool A',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      const tool2 = {
        name: 'tool-b',
        description: 'Tool B',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };

      await loadAndEnable(manager, 'p1', { tools: [tool1] });
      await loadAndEnable(manager, 'p2', { tools: [tool2] });

      const tools = manager.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.tool.name)).toEqual(['tool-a', 'tool-b']);
      expect(tools[0].pluginId).toBe('p1');
      expect(tools[1].pluginId).toBe('p2');
    });

    it('getAllTools excludes disabled plugins', async () => {
      const tool = {
        name: 'my-tool',
        description: 'Tool',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      await loadAndEnable(manager, 'p1', { tools: [tool] });
      await manager.disable('p1');

      expect(manager.getAllTools()).toEqual([]);
    });

    it('getAllCommands returns commands from enabled plugins', async () => {
      const cmd = { name: 'my-cmd', description: 'My command', prompt: 'Do thing' };
      await loadAndEnable(manager, 'p1', { commands: [cmd] });

      const cmds = manager.getAllCommands();
      expect(cmds).toHaveLength(1);
      expect(cmds[0].command.name).toBe('my-cmd');
      expect(cmds[0].pluginId).toBe('p1');
    });

    it('getAllHooks returns hooks from enabled plugins', async () => {
      const hook = {
        event: 'beforeMessage' as const,
        hook: { id: 'h1', name: 'Hook 1', event: 'beforeMessage' as const, handler: vi.fn() },
      };
      await loadAndEnable(manager, 'p1', { hooks: [hook] });

      const hooks = manager.getAllHooks();
      expect(hooks).toHaveLength(1);
      expect(hooks[0].pluginId).toBe('p1');
    });

    it('getAllMCPServers returns servers from enabled plugins', async () => {
      const server = { name: 'srv1', command: 'node', args: ['server.js'] };
      await loadAndEnable(manager, 'p1', { mcpServers: [server] });

      const servers = manager.getAllMCPServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].server.name).toBe('srv1');
      expect(servers[0].pluginId).toBe('p1');
    });
  });

  // ========================================================================
  // REGISTRY — getByTool / getByCommand
  // ========================================================================

  describe('registry lookups with loaded plugins', () => {
    it('getByTool finds the plugin that owns a specific tool', async () => {
      stubPluginOnDisk('/p/owner', { name: 'owner' });
      const inst = await manager.loadPlugin('/p/owner', 'project');
      inst!.definition.tools = [
        {
          name: 'special-tool',
          description: 'Special',
          inputSchema: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
      ];

      expect(manager.getByTool('special-tool')?.definition.metadata.id).toBe('owner');
      expect(manager.getByTool('nonexistent')).toBeUndefined();
    });

    it('getByCommand finds the plugin that owns a specific command', async () => {
      stubPluginOnDisk('/p/owner', { name: 'owner' });
      const inst = await manager.loadPlugin('/p/owner', 'project');
      inst!.definition.commands = [{ name: 'my-command', description: 'Desc', prompt: 'prompt' }];

      expect(manager.getByCommand('my-command')?.definition.metadata.id).toBe('owner');
      expect(manager.getByCommand('nonexistent')).toBeUndefined();
    });
  });

  // ========================================================================
  // onPluginEvent
  // ========================================================================

  describe('onPluginEvent', () => {
    it('should receive events for all lifecycle transitions', async () => {
      const listener = vi.fn();
      manager.onPluginEvent(listener);

      stubPluginOnDisk('/p/full', { name: 'full' });
      await manager.loadPlugin('/p/full', 'project');
      await manager.enable('full');
      await manager.updateConfig('full', { x: 1 });
      await manager.disable('full');
      await manager.enable('full');
      await manager.uninstall('full');

      const eventTypes = listener.mock.calls.map((call: [PluginEvent]) => call[0].type);

      expect(eventTypes).toContain('plugin:installed');
      expect(eventTypes).toContain('plugin:enabled');
      expect(eventTypes).toContain('plugin:configChanged');
      expect(eventTypes).toContain('plugin:disabled');
      expect(eventTypes).toContain('plugin:uninstalled');
    });
  });

  // ========================================================================
  // createPluginContext (tested indirectly)
  // ========================================================================

  describe('plugin context (via enable)', () => {
    it('should provide working log methods in context', async () => {
      stubPluginOnDisk('/p/ctx', { name: 'ctx' });
      const inst = await manager.loadPlugin('/p/ctx', 'project');
      let capturedCtx: PluginContext | null = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx: PluginContext) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('ctx');

      expect(capturedCtx).not.toBeNull();
      capturedCtx!.log.info('test');
      capturedCtx!.log.warn('test');
      capturedCtx!.log.error('test');
      capturedCtx!.log.debug('test');
    });

    it('should provide stub services in context', async () => {
      stubPluginOnDisk('/p/svc', { name: 'svc' });
      const inst = await manager.loadPlugin('/p/svc', 'project');
      let capturedCtx: PluginContext | null = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx: PluginContext) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('svc');

      const shellResult = await capturedCtx!.services.executeShell('ls');
      expect(shellResult.exitCode).toBe(1);
      expect(shellResult.stderr).toContain('Not implemented');

      const fileContent = await capturedCtx!.services.readFile('/tmp/x');
      expect(fileContent).toContain('Not implemented');

      await expect(capturedCtx!.services.writeFile('/tmp/x', 'y')).resolves.toBeUndefined();

      const files = await capturedCtx!.services.searchFiles('*.ts');
      expect(files).toEqual([]);
    });

    it('should include the correct plugin config in context', async () => {
      stubPluginOnDisk('/p/cfgctx', { name: 'cfgctx' });
      const inst = await manager.loadPlugin('/p/cfgctx', 'project');
      inst!.config = { myKey: 'myVal' };
      let capturedCtx: PluginContext | null = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx: PluginContext) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('cfgctx');

      expect(capturedCtx!.config).toEqual({ myKey: 'myVal' });
    });
  });
});

// ==========================================================================
// SINGLETON
// ==========================================================================

describe('getPluginManager / resetPluginManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPluginManager();
    vi.mocked(fs.existsSync).mockReturnValue(false as never);
  });

  it('should throw if called without config on first access', () => {
    expect(() => getPluginManager()).toThrow('must be initialized with config');
  });

  it('should return a PluginManager when initialized with config', () => {
    const mgr = getPluginManager(DEFAULT_CONFIG);
    expect(mgr).toBeInstanceOf(PluginManager);
  });

  it('should return the same instance on subsequent calls', () => {
    const mgr1 = getPluginManager(DEFAULT_CONFIG);
    const mgr2 = getPluginManager();
    expect(mgr1).toBe(mgr2);
  });

  it('should allow re-initialization after reset', () => {
    const mgr1 = getPluginManager(DEFAULT_CONFIG);
    resetPluginManager();
    const mgr2 = getPluginManager({ ...DEFAULT_CONFIG, projectDir: '/other' });
    expect(mgr1).not.toBe(mgr2);
  });

  it('should throw after reset if called without config again', () => {
    getPluginManager(DEFAULT_CONFIG);
    resetPluginManager();
    expect(() => getPluginManager()).toThrow('must be initialized with config');
  });
});
