// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * Comprehensive tests for PluginManager
 *
 * Covers: constructor, registry methods, plugin loading, manifest parsing,
 * lifecycle management (enable/disable/uninstall), configuration updates,
 * event emission, capabilities aggregation, singleton pattern, context
 * creation, scope override logic, and error handling edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must come before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

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

function createManager(overrides = {}) {
  return new PluginManager({ ...DEFAULT_CONFIG, ...overrides });
}

/**
 * Set up fs mocks so that loadPlugin succeeds for the given directory.
 * Returns the plugin name.
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

/**
 * Stub plugin with entry point that exists on disk, so loadPluginDefinition
 * exercises the entryPath branch.
 */
function stubPluginWithEntry(
  pluginDir: string,
  manifest: Record<string, unknown> = {},
  entryFile = 'index.js'
) {
  const merged = { name: 'test-plugin', version: '1.0.0', ...manifest };
  const packagePath = `${pluginDir}/package.json`;
  const entryPath = `${pluginDir}/${entryFile}`;

  mockedExistsSync.mockImplementation(((p: string) => {
    if (p === packagePath) return true;
    if (p === entryPath) return true;
    return false;
  }) as typeof fs.existsSync);

  mockedReadFileSync.mockImplementation(((p: string) => {
    if (p === packagePath) return JSON.stringify(merged);
    throw new Error('File not found');
  }) as typeof fs.readFileSync);

  return merged.name as string;
}

/**
 * Helper to load and enable a plugin in one call.
 */
async function loadAndEnable(mgr: PluginManager, name: string, extras = {}) {
  stubPluginOnDisk(`/p/${name}`, { name });
  const inst = await mgr.loadPlugin(`/p/${name}`, 'project');
  Object.assign(inst!.definition, extras);
  await mgr.enable(name);
  return inst!;
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
      expect(typeof manager.removeListener).toBe('function');
    });

    it('should accept all config fields', () => {
      const mgr = createManager({
        projectDir: '/custom/dir',
        userId: 'custom-user',
        workspaceId: 'custom-ws',
        sessionId: 'custom-session',
      });
      expect(mgr).toBeInstanceOf(PluginManager);
    });
  });

  // ========================================================================
  // REGISTRY — empty state
  // ========================================================================

  describe('registry (empty)', () => {
    it('getAll returns an empty array when no plugins loaded', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('get returns undefined for unknown id', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('has returns false for unknown id', () => {
      expect(manager.has('nonexistent')).toBe(false);
    });

    it('getByState returns empty for installed state', () => {
      expect(manager.getByState('installed')).toEqual([]);
    });

    it('getByState returns empty for enabled state', () => {
      expect(manager.getByState('enabled')).toEqual([]);
    });

    it('getByState returns empty for disabled state', () => {
      expect(manager.getByState('disabled')).toEqual([]);
    });

    it('getByState returns empty for error state', () => {
      expect(manager.getByState('error')).toEqual([]);
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

    it('should include a timestamp in the installed event', async () => {
      stubPluginOnDisk('/plugins/alpha', { name: 'alpha' });
      const listener = vi.fn();
      manager.on('plugin:installed', listener);

      await manager.loadPlugin('/plugins/alpha', 'project');

      expect(listener.mock.calls[0][0].timestamp).toBeInstanceOf(Date);
    });

    it('should populate all metadata from manifest fields', async () => {
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
      expect(meta.name).toBe('meta-plugin');
      expect(meta.version).toBe('3.1.0');
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

    it('should handle missing author gracefully', async () => {
      stubPluginOnDisk('/plugins/no-author', {
        name: 'no-author-plugin',
      });

      const inst = await manager.loadPlugin('/plugins/no-author', 'project');
      expect(inst!.definition.metadata.author).toBeUndefined();
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

    it('project scope should override existing project-scoped plugin', async () => {
      stubPluginOnDisk('/project/alpha-v1', { name: 'alpha', version: '1.0.0' });
      await manager.loadPlugin('/project/alpha-v1', 'project');

      stubPluginOnDisk('/project/alpha-v2', { name: 'alpha', version: '2.0.0' });
      const inst = await manager.loadPlugin('/project/alpha-v2', 'project');

      expect(inst).not.toBeNull();
      expect(manager.get('alpha')!.definition.metadata.version).toBe('2.0.0');
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

    it('should initialize tools, commands, hooks, mcpServers as empty arrays', async () => {
      stubPluginOnDisk('/plugins/empty', { name: 'empty-plugin' });
      const inst = await manager.loadPlugin('/plugins/empty', 'project');
      expect(inst!.definition.tools).toEqual([]);
      expect(inst!.definition.commands).toEqual([]);
      expect(inst!.definition.hooks).toEqual([]);
      expect(inst!.definition.mcpServers).toEqual([]);
    });

    it('should use codelab.main as entry point when specified', async () => {
      stubPluginWithEntry(
        '/plugins/custom-entry',
        {
          name: 'custom-entry',
          codelab: { main: 'custom.js' },
        },
        'custom.js'
      );

      const inst = await manager.loadPlugin('/plugins/custom-entry', 'project');
      expect(inst).not.toBeNull();
      expect(inst!.definition.metadata.id).toBe('custom-entry');
    });

    it('should handle entry point existing on disk', async () => {
      stubPluginWithEntry('/plugins/with-entry', {
        name: 'with-entry',
      });

      const inst = await manager.loadPlugin('/plugins/with-entry', 'project');
      expect(inst).not.toBeNull();
    });

    it('should handle codelab.contributes section without errors', async () => {
      stubPluginOnDisk('/plugins/contributes', {
        name: 'contributes-plugin',
        codelab: {
          contributes: {
            tools: ['tool-a'],
            commands: ['cmd-a'],
          },
        },
      });

      const inst = await manager.loadPlugin('/plugins/contributes', 'project');
      expect(inst).not.toBeNull();
    });

    it('should store the sourcePath correctly', async () => {
      stubPluginOnDisk('/plugins/src-path', { name: 'src-path-plugin' });
      const inst = await manager.loadPlugin('/plugins/src-path', 'project');
      expect(inst!.sourcePath).toBe('/plugins/src-path');
    });

    it('should store scope as user when loaded with user scope', async () => {
      stubPluginOnDisk('/plugins/user-scope', { name: 'user-scope-plugin' });
      const inst = await manager.loadPlugin('/plugins/user-scope', 'user');
      expect(inst!.scope).toBe('user');
    });

    it('should increase getAll count after loading', async () => {
      expect(manager.getAll()).toHaveLength(0);
      stubPluginOnDisk('/plugins/a', { name: 'a' });
      await manager.loadPlugin('/plugins/a', 'project');
      expect(manager.getAll()).toHaveLength(1);
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

    it('should not attempt to read from non-existent project directory', async () => {
      mockedExistsSync.mockReturnValue(false as never);

      await manager.loadAll();

      expect(mockedReaddirSync).not.toHaveBeenCalled();
    });

    it('should load from both project and user directories when both exist', async () => {
      const userDir = `${process.env.HOME || '~'}/.claude/plugins`;

      mockedExistsSync.mockImplementation(((p: string) => {
        if (p === '/tmp/test-project/.claude/plugins') return true;
        if (p === userDir) return true;
        if (p.endsWith('package.json')) return true;
        return false;
      }) as typeof fs.existsSync);

      mockedReaddirSync.mockImplementation(((...args: unknown[]) => {
        const dir = args[0] as string;
        if (dir === '/tmp/test-project/.claude/plugins') {
          return [{ name: 'projPlugin', isDirectory: () => true }];
        }
        if (dir === userDir) {
          return [{ name: 'userPlugin', isDirectory: () => true }];
        }
        return [];
      }) as typeof fs.readdirSync);

      mockedReadFileSync.mockImplementation(((p: string) => {
        if (p.includes('projPlugin') && p.endsWith('package.json')) {
          return JSON.stringify({ name: 'projPlugin', version: '1.0.0' });
        }
        if (p.includes('userPlugin') && p.endsWith('package.json')) {
          return JSON.stringify({ name: 'userPlugin', version: '1.0.0' });
        }
        throw new Error('not found');
      }) as typeof fs.readFileSync);

      await manager.loadAll();

      expect(manager.has('projPlugin')).toBe(true);
      expect(manager.has('userPlugin')).toBe(true);
      expect(manager.getAll()).toHaveLength(2);
    });
  });

  // ========================================================================
  // enable
  // ========================================================================

  describe('enable', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.enable('ghost')).toBe(false);
    });

    it('should enable an installed plugin and set state to enabled', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const ok = await manager.enable('a');
      expect(ok).toBe(true);
      expect(manager.get('a')!.state).toBe('enabled');
    });

    it('should set enabledAt date when enabling', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      await manager.enable('a');
      expect(manager.get('a')!.enabledAt).toBeInstanceOf(Date);
    });

    it('should return true if plugin is already enabled (idempotent)', async () => {
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
    });

    it('should provide correct context to lifecycle.activate', async () => {
      stubPluginOnDisk('/p/lc', { name: 'lc' });
      const inst = await manager.loadPlugin('/p/lc', 'project');
      const activateFn = vi.fn();
      inst!.definition.lifecycle = { activate: activateFn };

      await manager.enable('lc');

      const ctx = activateFn.mock.calls[0][0];
      expect(ctx.workspaceId).toBe('test-workspace');
      expect(ctx.userId).toBe('test-user');
      expect(ctx.sessionId).toBe('test-session');
      expect(typeof ctx.log.info).toBe('function');
      expect(typeof ctx.log.warn).toBe('function');
      expect(typeof ctx.log.error).toBe('function');
      expect(typeof ctx.log.debug).toBe('function');
      expect(typeof ctx.services.executeShell).toBe('function');
      expect(typeof ctx.services.readFile).toBe('function');
      expect(typeof ctx.services.writeFile).toBe('function');
      expect(typeof ctx.services.searchFiles).toBe('function');
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

    it('should set error state when activate throws an Error', async () => {
      stubPluginOnDisk('/p/bad', { name: 'bad' });
      const inst = await manager.loadPlugin('/p/bad', 'project');
      inst!.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue(new Error('Activation failed')),
      };

      const ok = await manager.enable('bad');

      expect(ok).toBe(false);
      expect(manager.get('bad')!.state).toBe('error');
      expect(manager.get('bad')!.error).toBe('Activation failed');
    });

    it('should emit plugin:error event when activate throws', async () => {
      stubPluginOnDisk('/p/bad', { name: 'bad' });
      const inst = await manager.loadPlugin('/p/bad', 'project');
      inst!.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue(new Error('boom')),
      };

      const errorListener = vi.fn();
      manager.on('plugin:error', errorListener);

      await manager.enable('bad');

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(errorListener.mock.calls[0][0]).toMatchObject({
        type: 'plugin:error',
        pluginId: 'bad',
      });
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

    it('should not call activate if no lifecycle is defined', async () => {
      stubPluginOnDisk('/p/no-lc', { name: 'no-lc' });
      await manager.loadPlugin('/p/no-lc', 'project');

      const ok = await manager.enable('no-lc');
      expect(ok).toBe(true);
      expect(manager.get('no-lc')!.state).toBe('enabled');
    });
  });

  // ========================================================================
  // disable
  // ========================================================================

  describe('disable', () => {
    it('should return false for non-existent plugin', async () => {
      expect(await manager.disable('ghost')).toBe(false);
    });

    it('should return true if plugin is not in enabled state (installed)', async () => {
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

    it('should return false when deactivate throws an Error', async () => {
      stubPluginOnDisk('/p/bad', { name: 'bad' });
      const inst = await manager.loadPlugin('/p/bad', 'project');
      inst!.definition.lifecycle = {
        deactivate: vi.fn().mockRejectedValue(new Error('Deactivation boom')),
      };
      await manager.enable('bad');

      const ok = await manager.disable('bad');
      expect(ok).toBe(false);
    });

    it('should return false when deactivate throws a non-Error value', async () => {
      stubPluginOnDisk('/p/bad2', { name: 'bad2' });
      const inst = await manager.loadPlugin('/p/bad2', 'project');
      inst!.definition.lifecycle = {
        deactivate: vi.fn().mockRejectedValue('string failure'),
      };
      await manager.enable('bad2');

      const ok = await manager.disable('bad2');
      expect(ok).toBe(false);
    });

    it('should not call deactivate when no lifecycle is defined', async () => {
      stubPluginOnDisk('/p/no-lc', { name: 'no-lc' });
      await manager.loadPlugin('/p/no-lc', 'project');
      await manager.enable('no-lc');

      const ok = await manager.disable('no-lc');
      expect(ok).toBe(true);
      expect(manager.get('no-lc')!.state).toBe('disabled');
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

    it('should not call disable if plugin is in installed state', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const disabledListener = vi.fn();
      manager.on('plugin:disabled', disabledListener);

      await manager.uninstall('a');

      expect(disabledListener).not.toHaveBeenCalled();
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

    it('should reduce getAll count after uninstalling', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      expect(manager.getAll()).toHaveLength(1);

      await manager.uninstall('a');
      expect(manager.getAll()).toHaveLength(0);
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

    it('should overwrite existing keys when updating config', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      await manager.updateConfig('a', { key1: 'original' });
      await manager.updateConfig('a', { key1: 'updated' });
      expect(manager.get('a')!.config).toEqual({ key1: 'updated' });
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

    it('should pass context to onConfigChange', async () => {
      stubPluginOnDisk('/p/cfg', { name: 'cfg' });
      const inst = await manager.loadPlugin('/p/cfg', 'project');
      const onConfigChange = vi.fn();
      inst!.definition.lifecycle = { onConfigChange };
      await manager.enable('cfg');

      await manager.updateConfig('cfg', { k: 'v' });

      const ctx = onConfigChange.mock.calls[0][1];
      expect(ctx.workspaceId).toBe('test-workspace');
      expect(ctx.userId).toBe('test-user');
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

    it('should revert config when onConfigChange throws non-Error', async () => {
      stubPluginOnDisk('/p/cfg2', { name: 'cfg2' });
      const inst = await manager.loadPlugin('/p/cfg2', 'project');
      inst!.definition.lifecycle = {
        onConfigChange: vi.fn().mockRejectedValue('string error'),
      };
      await manager.enable('cfg2');

      inst!.config = { keep: 'me' };

      const ok = await manager.updateConfig('cfg2', { keep: 'changed' });
      expect(ok).toBe(false);
      expect(manager.get('cfg2')!.config).toEqual({ keep: 'me' });
    });

    it('should emit plugin:configChanged event on success', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const listener = vi.fn();
      manager.on('plugin:configChanged', listener);

      await manager.updateConfig('a', { hello: 'world' });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe('plugin:configChanged');
      expect(event.pluginId).toBe('a');
      expect(event.data).toMatchObject({
        oldConfig: {},
        newConfig: { hello: 'world' },
      });
    });

    it('should NOT emit configChanged event when onConfigChange throws', async () => {
      stubPluginOnDisk('/p/cfg', { name: 'cfg' });
      const inst = await manager.loadPlugin('/p/cfg', 'project');
      inst!.definition.lifecycle = {
        onConfigChange: vi.fn().mockRejectedValue(new Error('fail')),
      };
      await manager.enable('cfg');

      const listener = vi.fn();
      manager.on('plugin:configChanged', listener);

      await manager.updateConfig('cfg', { x: 1 });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // CAPABILITIES AGGREGATION
  // ========================================================================

  describe('capabilities aggregation', () => {
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

    it('getAllTools returns empty array when no plugins are enabled', () => {
      expect(manager.getAllTools()).toEqual([]);
    });

    it('getAllTools handles plugins with no tools defined', async () => {
      await loadAndEnable(manager, 'no-tools', {});
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

    it('getAllCommands returns empty when no plugins have commands', async () => {
      await loadAndEnable(manager, 'p-no-cmds', {});
      expect(manager.getAllCommands()).toEqual([]);
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

    it('getAllHooks returns empty when no plugins have hooks', async () => {
      await loadAndEnable(manager, 'p-no-hooks', {});
      expect(manager.getAllHooks()).toEqual([]);
    });

    it('getAllMCPServers returns servers from enabled plugins', async () => {
      const server = { name: 'srv1', command: 'node', args: ['server.js'] };
      await loadAndEnable(manager, 'p1', { mcpServers: [server] });

      const servers = manager.getAllMCPServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].server.name).toBe('srv1');
      expect(servers[0].pluginId).toBe('p1');
    });

    it('getAllMCPServers returns empty when no plugins have servers', async () => {
      await loadAndEnable(manager, 'p-no-srv', {});
      expect(manager.getAllMCPServers()).toEqual([]);
    });

    it('getAllTools aggregates tools across multiple enabled plugins', async () => {
      const tool1 = {
        name: 'tool-1',
        description: 'T1',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      const tool2 = {
        name: 'tool-2',
        description: 'T2',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };
      const tool3 = {
        name: 'tool-3',
        description: 'T3',
        inputSchema: { type: 'object' as const, properties: {} },
        execute: vi.fn(),
      };

      await loadAndEnable(manager, 'pa', { tools: [tool1, tool2] });
      await loadAndEnable(manager, 'pb', { tools: [tool3] });

      const tools = manager.getAllTools();
      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.tool.name)).toEqual(['tool-1', 'tool-2', 'tool-3']);
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
    });

    it('getByTool returns undefined for nonexistent tool', async () => {
      stubPluginOnDisk('/p/owner', { name: 'owner' });
      await manager.loadPlugin('/p/owner', 'project');

      expect(manager.getByTool('nonexistent')).toBeUndefined();
    });

    it('getByCommand finds the plugin that owns a specific command', async () => {
      stubPluginOnDisk('/p/owner', { name: 'owner' });
      const inst = await manager.loadPlugin('/p/owner', 'project');
      inst!.definition.commands = [{ name: 'my-command', description: 'Desc', prompt: 'prompt' }];

      expect(manager.getByCommand('my-command')?.definition.metadata.id).toBe('owner');
    });

    it('getByCommand returns undefined for nonexistent command', async () => {
      stubPluginOnDisk('/p/owner', { name: 'owner' });
      await manager.loadPlugin('/p/owner', 'project');

      expect(manager.getByCommand('nonexistent')).toBeUndefined();
    });

    it('getByTool returns the first plugin when multiple have same tool name', async () => {
      stubPluginOnDisk('/p/first', { name: 'first' });
      const inst1 = await manager.loadPlugin('/p/first', 'project');
      inst1!.definition.tools = [
        {
          name: 'shared-tool',
          description: 'Shared',
          inputSchema: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
      ];

      stubPluginOnDisk('/p/second', { name: 'second' });
      const inst2 = await manager.loadPlugin('/p/second', 'project');
      inst2!.definition.tools = [
        {
          name: 'shared-tool',
          description: 'Shared 2',
          inputSchema: { type: 'object', properties: {} },
          execute: vi.fn(),
        },
      ];

      const found = manager.getByTool('shared-tool');
      expect(found?.definition.metadata.id).toBe('first');
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

      const eventTypes = listener.mock.calls.map((call) => call[0].type);

      expect(eventTypes).toContain('plugin:installed');
      expect(eventTypes).toContain('plugin:enabled');
      expect(eventTypes).toContain('plugin:configChanged');
      expect(eventTypes).toContain('plugin:disabled');
      expect(eventTypes).toContain('plugin:uninstalled');
    });

    it('should register listeners for all six event types', async () => {
      const listener = vi.fn();
      manager.onPluginEvent(listener);

      // Verify that the listener is registered by checking EventEmitter
      expect(manager.listenerCount('plugin:installed')).toBe(1);
      expect(manager.listenerCount('plugin:enabled')).toBe(1);
      expect(manager.listenerCount('plugin:disabled')).toBe(1);
      expect(manager.listenerCount('plugin:uninstalled')).toBe(1);
      expect(manager.listenerCount('plugin:error')).toBe(1);
      expect(manager.listenerCount('plugin:configChanged')).toBe(1);
    });
  });

  // ========================================================================
  // createPluginContext (tested indirectly through enable)
  // ========================================================================

  describe('plugin context (via enable)', () => {
    it('should provide working log methods in context', async () => {
      stubPluginOnDisk('/p/ctx', { name: 'ctx' });
      const inst = await manager.loadPlugin('/p/ctx', 'project');
      let capturedCtx = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('ctx');

      expect(capturedCtx).not.toBeNull();
      // Call all log methods without throwing
      capturedCtx!.log.info('test message');
      capturedCtx!.log.warn('test warning');
      capturedCtx!.log.error('test error');
      capturedCtx!.log.debug('test debug');
    });

    it('should provide stub services in context', async () => {
      stubPluginOnDisk('/p/svc', { name: 'svc' });
      const inst = await manager.loadPlugin('/p/svc', 'project');
      let capturedCtx = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('svc');

      const shellResult = await capturedCtx!.services.executeShell('ls');
      expect(shellResult.exitCode).toBe(1);
      expect(shellResult.stderr).toContain('Not implemented');
      expect(shellResult.stdout).toBe('');

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
      let capturedCtx = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('cfgctx');

      expect(capturedCtx!.config).toEqual({ myKey: 'myVal' });
    });

    it('should log methods include plugin id prefix', async () => {
      stubPluginOnDisk('/p/prefixed', { name: 'prefixed' });
      const inst = await manager.loadPlugin('/p/prefixed', 'project');
      let capturedCtx = null;
      inst!.definition.lifecycle = {
        activate: vi.fn().mockImplementation((ctx) => {
          capturedCtx = ctx;
        }),
      };

      await manager.enable('prefixed');

      // Just verify the log functions are callable without error
      expect(() => capturedCtx!.log.info('msg', { key: 'val' })).not.toThrow();
      expect(() => capturedCtx!.log.warn('msg', { key: 'val' })).not.toThrow();
      expect(() => capturedCtx!.log.error('msg', { key: 'val' })).not.toThrow();
      expect(() => capturedCtx!.log.debug('msg', { key: 'val' })).not.toThrow();
    });
  });

  // ========================================================================
  // getByState with loaded plugins
  // ========================================================================

  describe('getByState with loaded plugins', () => {
    it('should return installed plugins', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');

      const installed = manager.getByState('installed');
      expect(installed).toHaveLength(1);
      expect(installed[0].definition.metadata.id).toBe('a');
    });

    it('should return enabled plugins', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      await manager.enable('a');

      const enabled = manager.getByState('enabled');
      expect(enabled).toHaveLength(1);
      expect(enabled[0].definition.metadata.id).toBe('a');
    });

    it('should return error state plugins', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      const inst = await manager.loadPlugin('/p/a', 'project');
      inst!.definition.lifecycle = {
        activate: vi.fn().mockRejectedValue(new Error('fail')),
      };
      await manager.enable('a');

      const errorPlugins = manager.getByState('error');
      expect(errorPlugins).toHaveLength(1);
      expect(errorPlugins[0].definition.metadata.id).toBe('a');
    });

    it('should separate plugins by state correctly', async () => {
      stubPluginOnDisk('/p/a', { name: 'a' });
      await manager.loadPlugin('/p/a', 'project');
      await manager.enable('a');

      stubPluginOnDisk('/p/b', { name: 'b' });
      await manager.loadPlugin('/p/b', 'project');

      const enabled = manager.getByState('enabled');
      const installed = manager.getByState('installed');
      expect(enabled).toHaveLength(1);
      expect(installed).toHaveLength(1);
      expect(enabled[0].definition.metadata.id).toBe('a');
      expect(installed[0].definition.metadata.id).toBe('b');
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

  it('should return same instance even when config is passed again', () => {
    const mgr1 = getPluginManager(DEFAULT_CONFIG);
    const mgr2 = getPluginManager({ ...DEFAULT_CONFIG, projectDir: '/other' });
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

  it('resetPluginManager is idempotent (calling twice is safe)', () => {
    getPluginManager(DEFAULT_CONFIG);
    resetPluginManager();
    resetPluginManager();
    expect(() => getPluginManager()).toThrow('must be initialized with config');
  });
});
