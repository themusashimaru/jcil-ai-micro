/**
 * Plugin System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginManager, resetPluginManager, getPluginManager } from './plugin-manager';
import type { PluginDefinition, PluginInstance } from './types';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ============================================
// PLUGIN MANAGER TESTS
// ============================================

describe('PluginManager', () => {
  let manager: PluginManager;

  beforeEach(() => {
    resetPluginManager();
    manager = new PluginManager({
      projectDir: '/tmp/test-project',
      userId: 'test-user',
      workspaceId: 'test-workspace',
      sessionId: 'test-session',
    });
  });

  describe('Registry Operations', () => {
    it('should start with no plugins', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(manager.get('nonexistent')).toBeUndefined();
    });

    it('should check if plugin exists', () => {
      expect(manager.has('nonexistent')).toBe(false);
    });

    it('should get plugins by state', () => {
      expect(manager.getByState('enabled')).toEqual([]);
      expect(manager.getByState('installed')).toEqual([]);
    });

    it('should return undefined for non-existent tool', () => {
      expect(manager.getByTool('nonexistent')).toBeUndefined();
    });

    it('should return undefined for non-existent command', () => {
      expect(manager.getByCommand('nonexistent')).toBeUndefined();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should fail to enable non-existent plugin', async () => {
      const result = await manager.enable('nonexistent');
      expect(result).toBe(false);
    });

    it('should fail to disable non-existent plugin', async () => {
      const result = await manager.disable('nonexistent');
      expect(result).toBe(false);
    });

    it('should fail to uninstall non-existent plugin', async () => {
      const result = await manager.uninstall('nonexistent');
      expect(result).toBe(false);
    });

    it('should fail to update config for non-existent plugin', async () => {
      const result = await manager.updateConfig('nonexistent', { key: 'value' });
      expect(result).toBe(false);
    });
  });

  describe('Plugin Capabilities', () => {
    it('should return empty tools array when no plugins enabled', () => {
      expect(manager.getAllTools()).toEqual([]);
    });

    it('should return empty commands array when no plugins enabled', () => {
      expect(manager.getAllCommands()).toEqual([]);
    });

    it('should return empty hooks array when no plugins enabled', () => {
      expect(manager.getAllHooks()).toEqual([]);
    });

    it('should return empty MCP servers array when no plugins enabled', () => {
      expect(manager.getAllMCPServers()).toEqual([]);
    });
  });

  describe('Event Handling', () => {
    it('should allow adding event listener', () => {
      const listener = vi.fn();
      manager.onPluginEvent(listener);
      // Listener should be registered but not called yet
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// SINGLETON TESTS
// ============================================

describe('getPluginManager', () => {
  beforeEach(() => {
    resetPluginManager();
  });

  it('should throw error when accessed without config', () => {
    expect(() => getPluginManager()).toThrow('must be initialized with config');
  });

  it('should return singleton instance', () => {
    const config = {
      projectDir: '/tmp/test',
      userId: 'user',
      workspaceId: 'workspace',
      sessionId: 'session',
    };

    const mgr1 = getPluginManager(config);
    const mgr2 = getPluginManager();

    expect(mgr1).toBe(mgr2);
  });

  it('should reset singleton', () => {
    const config = {
      projectDir: '/tmp/test',
      userId: 'user',
      workspaceId: 'workspace',
      sessionId: 'session',
    };

    getPluginManager(config); // Initialize the singleton
    resetPluginManager();

    expect(() => getPluginManager()).toThrow('must be initialized with config');
  });
});

// ============================================
// PLUGIN DEFINITION TESTS
// ============================================

describe('PluginDefinition', () => {
  it('should create a valid plugin definition', () => {
    const definition: PluginDefinition = {
      metadata: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
      },
      tools: [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
            required: ['input'],
          },
          execute: async (input, _context) => {
            return `Executed with ${JSON.stringify(input)}`;
          },
        },
      ],
      commands: [
        {
          name: 'test',
          description: 'A test command',
          prompt: 'Test command prompt',
        },
      ],
    };

    expect(definition.metadata.id).toBe('test-plugin');
    expect(definition.tools).toHaveLength(1);
    expect(definition.commands).toHaveLength(1);
  });

  it('should support lifecycle hooks', () => {
    const activateFn = vi.fn();
    const deactivateFn = vi.fn();

    const definition: PluginDefinition = {
      metadata: {
        id: 'lifecycle-plugin',
        name: 'Lifecycle Plugin',
        version: '1.0.0',
      },
      lifecycle: {
        activate: activateFn,
        deactivate: deactivateFn,
      },
    };

    expect(definition.lifecycle?.activate).toBe(activateFn);
    expect(definition.lifecycle?.deactivate).toBe(deactivateFn);
  });

  it('should support config schema', () => {
    const definition: PluginDefinition = {
      metadata: {
        id: 'config-plugin',
        name: 'Config Plugin',
        version: '1.0.0',
      },
      configSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          timeout: { type: 'number' },
        },
        default: {
          enabled: true,
          timeout: 5000,
        },
      },
    };

    expect(definition.configSchema?.default).toEqual({
      enabled: true,
      timeout: 5000,
    });
  });
});

// ============================================
// PLUGIN INSTANCE TESTS
// ============================================

describe('PluginInstance', () => {
  it('should create a valid plugin instance', () => {
    const definition: PluginDefinition = {
      metadata: {
        id: 'instance-test',
        name: 'Instance Test',
        version: '1.0.0',
      },
    };

    const instance: PluginInstance = {
      definition,
      state: 'installed',
      sourcePath: '/path/to/plugin',
      scope: 'project',
      config: {},
      installedAt: new Date(),
    };

    expect(instance.state).toBe('installed');
    expect(instance.scope).toBe('project');
  });

  it('should support all plugin states', () => {
    const states: PluginInstance['state'][] = ['installed', 'enabled', 'disabled', 'error'];

    for (const state of states) {
      const instance: PluginInstance = {
        definition: {
          metadata: { id: 'test', name: 'Test', version: '1.0.0' },
        },
        state,
        sourcePath: '/path',
        scope: 'user',
        config: {},
        installedAt: new Date(),
      };

      expect(instance.state).toBe(state);
    }
  });

  it('should support error state with message', () => {
    const instance: PluginInstance = {
      definition: {
        metadata: { id: 'error-test', name: 'Error Test', version: '1.0.0' },
      },
      state: 'error',
      sourcePath: '/path',
      scope: 'project',
      config: {},
      installedAt: new Date(),
      error: 'Failed to load plugin',
    };

    expect(instance.state).toBe('error');
    expect(instance.error).toBe('Failed to load plugin');
  });
});
