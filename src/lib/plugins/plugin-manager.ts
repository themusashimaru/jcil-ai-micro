/**
 * Plugin Manager
 *
 * Central manager for loading, enabling, and managing plugins.
 */

import { EventEmitter } from 'events';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import type {
  PluginDefinition,
  PluginInstance,
  PluginState,
  PluginRegistry,
  PluginContext,
  PluginEvent,
  PluginEventListener,
  PluginManifest,
} from './types';

const log = logger('plugins');

// ============================================================================
// CONSTANTS
// ============================================================================

const PROJECT_PLUGINS_DIR = '.claude/plugins';
const USER_PLUGINS_DIR = join(process.env.HOME || '~', '.claude', 'plugins');

// ============================================================================
// PLUGIN LOADER
// ============================================================================

/**
 * Load a plugin manifest from a directory
 */
function loadPluginManifest(pluginDir: string): PluginManifest | null {
  const packagePath = join(pluginDir, 'package.json');

  if (!existsSync(packagePath)) {
    return null;
  }

  try {
    const content = readFileSync(packagePath, 'utf-8');
    return JSON.parse(content) as PluginManifest;
  } catch {
    log.warn('Failed to load plugin manifest', { pluginDir });
    return null;
  }
}

/**
 * Load a plugin definition from a directory
 */
async function loadPluginDefinition(
  pluginDir: string,
  manifest: PluginManifest
): Promise<PluginDefinition | null> {
  const entryPoint = manifest.codelab?.main || 'index.js';
  const entryPath = join(pluginDir, entryPoint);

  // For now, return a definition based on manifest
  // In a full implementation, we would dynamically import the entry point
  const definition: PluginDefinition = {
    metadata: {
      id: manifest.name,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: typeof manifest.author === 'string' ? manifest.author : manifest.author?.name,
      homepage: manifest.homepage,
      license: manifest.license,
      engineVersion: manifest.codelab?.engineVersion,
      dependencies: manifest.codelab?.dependencies,
      keywords: manifest.keywords,
    },
    tools: [],
    commands: [],
    hooks: [],
    mcpServers: [],
  };

  // If there's a contributes section, we could load those
  if (manifest.codelab?.contributes) {
    log.info('Plugin contributes', {
      id: manifest.name,
      contributes: manifest.codelab.contributes,
    });
  }

  // Try to dynamically import the plugin (only in Node.js environment)
  if (existsSync(entryPath)) {
    try {
      // Dynamic import would go here in production
      log.debug('Plugin entry point found', { path: entryPath });
    } catch {
      log.warn('Failed to load plugin entry', { path: entryPath });
    }
  }

  return definition;
}

// ============================================================================
// PLUGIN MANAGER
// ============================================================================

export class PluginManager extends EventEmitter implements PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map();
  private projectDir: string;
  private userId: string;
  private workspaceId: string;
  private sessionId: string;

  constructor(config: {
    projectDir: string;
    userId: string;
    workspaceId: string;
    sessionId: string;
  }) {
    super();
    this.projectDir = config.projectDir;
    this.userId = config.userId;
    this.workspaceId = config.workspaceId;
    this.sessionId = config.sessionId;

    log.info('PluginManager initialized', { projectDir: config.projectDir });
  }

  // ============================================================================
  // REGISTRY IMPLEMENTATION
  // ============================================================================

  getAll(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  get(id: string): PluginInstance | undefined {
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  getByState(state: PluginState): PluginInstance[] {
    return this.getAll().filter((p) => p.state === state);
  }

  getByTool(toolName: string): PluginInstance | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.definition.tools?.some((t) => t.name === toolName)) {
        return plugin;
      }
    }
    return undefined;
  }

  getByCommand(commandName: string): PluginInstance | undefined {
    for (const plugin of this.plugins.values()) {
      if (plugin.definition.commands?.some((c) => c.name === commandName)) {
        return plugin;
      }
    }
    return undefined;
  }

  // ============================================================================
  // PLUGIN LIFECYCLE
  // ============================================================================

  /**
   * Load all plugins from project and user directories
   */
  async loadAll(): Promise<void> {
    // Load project plugins
    const projectPluginsDir = join(this.projectDir, PROJECT_PLUGINS_DIR);
    if (existsSync(projectPluginsDir)) {
      await this.loadFromDirectory(projectPluginsDir, 'project');
    }

    // Load user plugins
    if (existsSync(USER_PLUGINS_DIR)) {
      await this.loadFromDirectory(USER_PLUGINS_DIR, 'user');
    }

    log.info('All plugins loaded', { count: this.plugins.size });
  }

  /**
   * Load plugins from a directory
   */
  private async loadFromDirectory(dir: string, scope: 'project' | 'user'): Promise<void> {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginDir = join(dir, entry.name);
          await this.loadPlugin(pluginDir, scope);
        }
      }
    } catch {
      log.warn('Failed to read plugins directory', { dir });
    }
  }

  /**
   * Load a single plugin from a directory
   */
  async loadPlugin(pluginDir: string, scope: 'project' | 'user'): Promise<PluginInstance | null> {
    const manifest = loadPluginManifest(pluginDir);
    if (!manifest) {
      return null;
    }

    const definition = await loadPluginDefinition(pluginDir, manifest);
    if (!definition) {
      return null;
    }

    // Check for existing plugin
    if (this.plugins.has(definition.metadata.id)) {
      const existing = this.plugins.get(definition.metadata.id)!;
      // Project plugins override user plugins
      if (existing.scope === 'user' && scope === 'project') {
        log.info('Overriding user plugin with project plugin', {
          id: definition.metadata.id,
        });
      } else if (existing.scope === 'project' && scope === 'user') {
        // User plugin won't override project plugin
        return null;
      }
    }

    const instance: PluginInstance = {
      definition,
      state: 'installed',
      sourcePath: pluginDir,
      scope,
      config: definition.configSchema?.default || {},
      installedAt: new Date(),
    };

    this.plugins.set(definition.metadata.id, instance);
    this.emit('plugin:installed', {
      type: 'plugin:installed',
      pluginId: definition.metadata.id,
      timestamp: new Date(),
    } as PluginEvent);

    log.info('Plugin loaded', {
      id: definition.metadata.id,
      version: definition.metadata.version,
      scope,
    });

    return instance;
  }

  /**
   * Enable a plugin
   */
  async enable(id: string): Promise<boolean> {
    const instance = this.plugins.get(id);
    if (!instance) {
      log.warn('Plugin not found', { id });
      return false;
    }

    if (instance.state === 'enabled') {
      return true;
    }

    const context = this.createPluginContext(instance);

    try {
      // Call activate lifecycle hook if defined
      if (instance.definition.lifecycle?.activate) {
        await instance.definition.lifecycle.activate(context);
      }

      instance.state = 'enabled';
      instance.enabledAt = new Date();

      this.emit('plugin:enabled', {
        type: 'plugin:enabled',
        pluginId: id,
        timestamp: new Date(),
      } as PluginEvent);

      log.info('Plugin enabled', { id });
      return true;
    } catch (error) {
      instance.state = 'error';
      instance.error = error instanceof Error ? error.message : 'Unknown error';

      this.emit('plugin:error', {
        type: 'plugin:error',
        pluginId: id,
        data: { error: instance.error },
        timestamp: new Date(),
      } as PluginEvent);

      log.error('Failed to enable plugin', { id, error: instance.error });
      return false;
    }
  }

  /**
   * Disable a plugin
   */
  async disable(id: string): Promise<boolean> {
    const instance = this.plugins.get(id);
    if (!instance) {
      return false;
    }

    if (instance.state !== 'enabled') {
      return true;
    }

    const context = this.createPluginContext(instance);

    try {
      // Call deactivate lifecycle hook if defined
      if (instance.definition.lifecycle?.deactivate) {
        await instance.definition.lifecycle.deactivate(context);
      }

      instance.state = 'disabled';

      this.emit('plugin:disabled', {
        type: 'plugin:disabled',
        pluginId: id,
        timestamp: new Date(),
      } as PluginEvent);

      log.info('Plugin disabled', { id });
      return true;
    } catch (error) {
      log.error('Error disabling plugin', {
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(id: string): Promise<boolean> {
    const instance = this.plugins.get(id);
    if (!instance) {
      return false;
    }

    // Disable first if enabled
    if (instance.state === 'enabled') {
      await this.disable(id);
    }

    this.plugins.delete(id);

    this.emit('plugin:uninstalled', {
      type: 'plugin:uninstalled',
      pluginId: id,
      timestamp: new Date(),
    } as PluginEvent);

    log.info('Plugin uninstalled', { id });
    return true;
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(id: string, config: Record<string, unknown>): Promise<boolean> {
    const instance = this.plugins.get(id);
    if (!instance) {
      return false;
    }

    const oldConfig = { ...instance.config };
    instance.config = { ...instance.config, ...config };

    // Call onConfigChange lifecycle hook if defined and plugin is enabled
    if (instance.state === 'enabled' && instance.definition.lifecycle?.onConfigChange) {
      const context = this.createPluginContext(instance);
      try {
        await instance.definition.lifecycle.onConfigChange(instance.config, context);
      } catch (error) {
        // Revert config on error
        instance.config = oldConfig;
        log.error('Config change failed', {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    }

    this.emit('plugin:configChanged', {
      type: 'plugin:configChanged',
      pluginId: id,
      data: { oldConfig, newConfig: instance.config },
      timestamp: new Date(),
    } as PluginEvent);

    return true;
  }

  // ============================================================================
  // PLUGIN CAPABILITIES
  // ============================================================================

  /**
   * Get all tools from enabled plugins
   */
  getAllTools(): Array<{
    pluginId: string;
    tool: NonNullable<PluginDefinition['tools']>[number];
  }> {
    const tools: Array<{
      pluginId: string;
      tool: NonNullable<PluginDefinition['tools']>[number];
    }> = [];

    for (const plugin of this.getByState('enabled')) {
      for (const tool of plugin.definition.tools || []) {
        tools.push({ pluginId: plugin.definition.metadata.id, tool });
      }
    }

    return tools;
  }

  /**
   * Get all commands from enabled plugins
   */
  getAllCommands(): Array<{
    pluginId: string;
    command: NonNullable<PluginDefinition['commands']>[number];
  }> {
    const commands: Array<{
      pluginId: string;
      command: NonNullable<PluginDefinition['commands']>[number];
    }> = [];

    for (const plugin of this.getByState('enabled')) {
      for (const command of plugin.definition.commands || []) {
        commands.push({ pluginId: plugin.definition.metadata.id, command });
      }
    }

    return commands;
  }

  /**
   * Get all hooks from enabled plugins
   */
  getAllHooks(): Array<{
    pluginId: string;
    hook: NonNullable<PluginDefinition['hooks']>[number];
  }> {
    const hooks: Array<{
      pluginId: string;
      hook: NonNullable<PluginDefinition['hooks']>[number];
    }> = [];

    for (const plugin of this.getByState('enabled')) {
      for (const hook of plugin.definition.hooks || []) {
        hooks.push({ pluginId: plugin.definition.metadata.id, hook });
      }
    }

    return hooks;
  }

  /**
   * Get all MCP servers from enabled plugins
   */
  getAllMCPServers(): Array<{
    pluginId: string;
    server: NonNullable<PluginDefinition['mcpServers']>[number];
  }> {
    const servers: Array<{
      pluginId: string;
      server: NonNullable<PluginDefinition['mcpServers']>[number];
    }> = [];

    for (const plugin of this.getByState('enabled')) {
      for (const server of plugin.definition.mcpServers || []) {
        servers.push({ pluginId: plugin.definition.metadata.id, server });
      }
    }

    return servers;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Create plugin context for lifecycle hooks
   */
  private createPluginContext(instance: PluginInstance): PluginContext {
    return {
      workspaceId: this.workspaceId,
      userId: this.userId,
      sessionId: this.sessionId,
      config: instance.config,
      log: {
        info: (message, data) => log.info(`[${instance.definition.metadata.id}] ${message}`, data),
        warn: (message, data) => log.warn(`[${instance.definition.metadata.id}] ${message}`, data),
        error: (message, data) =>
          log.error(`[${instance.definition.metadata.id}] ${message}`, data),
        debug: (message, data) =>
          log.debug(`[${instance.definition.metadata.id}] ${message}`, data),
      },
      services: {
        executeShell: async () => ({
          stdout: '',
          stderr: 'Not implemented in context',
          exitCode: 1,
        }),
        readFile: async () => 'Not implemented in context',
        writeFile: async () => {},
        searchFiles: async () => [],
      },
    };
  }

  /**
   * Add event listener
   */
  onPluginEvent(listener: PluginEventListener): void {
    this.on('plugin:installed', listener);
    this.on('plugin:enabled', listener);
    this.on('plugin:disabled', listener);
    this.on('plugin:uninstalled', listener);
    this.on('plugin:error', listener);
    this.on('plugin:configChanged', listener);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let pluginManagerInstance: PluginManager | null = null;

export function getPluginManager(config?: {
  projectDir: string;
  userId: string;
  workspaceId: string;
  sessionId: string;
}): PluginManager {
  if (!pluginManagerInstance) {
    if (!config) {
      throw new Error('PluginManager must be initialized with config');
    }
    pluginManagerInstance = new PluginManager(config);
  }
  return pluginManagerInstance;
}

export function resetPluginManager(): void {
  pluginManagerInstance = null;
}
