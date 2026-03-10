/**
 * Plugin System Types
 *
 * Foundation types for extensible plugin architecture.
 * Plugins can add tools, commands, hooks, and MCP servers.
 */

import type { HookDefinition, HookEventType } from '../hooks/types';

// ============================================================================
// PLUGIN METADATA
// ============================================================================

export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Plugin version (semver) */
  version: string;

  /** Short description */
  description?: string;

  /** Plugin author */
  author?: string;

  /** Plugin homepage or repository URL */
  homepage?: string;

  /** License identifier */
  license?: string;

  /** Required Code Lab version */
  engineVersion?: string;

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];

  /** Plugin keywords/tags for discovery */
  keywords?: string[];
}

// ============================================================================
// PLUGIN CAPABILITIES
// ============================================================================

export interface PluginTool {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** JSON Schema for input */
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };

  /** Execute the tool */
  execute: (input: Record<string, unknown>, context: PluginContext) => Promise<string>;
}

export interface PluginCommand {
  /** Command name (without slash) */
  name: string;

  /** Command description */
  description: string;

  /** Optional argument definitions */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
    default?: string;
  }>;

  /** Command prompt template */
  prompt: string;

  /** Tags for categorization */
  tags?: string[];
}

export interface PluginHook {
  /** Event type to hook into */
  event: HookEventType;

  /** Hook definition */
  hook: HookDefinition;
}

export interface PluginMCPServer {
  /** Server name */
  name: string;

  /** Server command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Server description */
  description?: string;
}

// ============================================================================
// PLUGIN CONTEXT
// ============================================================================

export interface PluginContext {
  /** Current workspace ID */
  workspaceId: string;

  /** Current user ID */
  userId: string;

  /** Current session ID */
  sessionId: string;

  /** Plugin configuration */
  config: Record<string, unknown>;

  /** Logger for the plugin */
  log: {
    info: (message: string, data?: Record<string, unknown>) => void;
    warn: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug: (message: string, data?: Record<string, unknown>) => void;
  };

  /** Access to core services */
  services: {
    executeShell: (
      command: string
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    searchFiles: (pattern: string) => Promise<string[]>;
  };
}

// ============================================================================
// PLUGIN DEFINITION
// ============================================================================

export interface PluginDefinition {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Tools provided by this plugin */
  tools?: PluginTool[];

  /** Commands provided by this plugin */
  commands?: PluginCommand[];

  /** Hooks provided by this plugin */
  hooks?: PluginHook[];

  /** MCP servers provided by this plugin */
  mcpServers?: PluginMCPServer[];

  /** Plugin lifecycle hooks */
  lifecycle?: {
    /** Called when plugin is activated */
    activate?: (context: PluginContext) => Promise<void>;

    /** Called when plugin is deactivated */
    deactivate?: (context: PluginContext) => Promise<void>;

    /** Called when plugin configuration changes */
    onConfigChange?: (newConfig: Record<string, unknown>, context: PluginContext) => Promise<void>;
  };

  /** Default configuration schema */
  configSchema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    default?: Record<string, unknown>;
  };
}

// ============================================================================
// PLUGIN STATE
// ============================================================================

export type PluginState = 'installed' | 'enabled' | 'disabled' | 'error';

export interface PluginInstance {
  /** Plugin definition */
  definition: PluginDefinition;

  /** Current state */
  state: PluginState;

  /** Plugin source path */
  sourcePath: string;

  /** Scope: local to project or global */
  scope: 'project' | 'user';

  /** Current configuration */
  config: Record<string, unknown>;

  /** Error message if state is 'error' */
  error?: string;

  /** When the plugin was installed */
  installedAt: Date;

  /** When the plugin was last enabled */
  enabledAt?: Date;
}

// ============================================================================
// PLUGIN REGISTRY
// ============================================================================

export interface PluginRegistry {
  /** Get all registered plugins */
  getAll(): PluginInstance[];

  /** Get a plugin by ID */
  get(id: string): PluginInstance | undefined;

  /** Check if a plugin is registered */
  has(id: string): boolean;

  /** Get plugins by state */
  getByState(state: PluginState): PluginInstance[];

  /** Get plugins providing a specific tool */
  getByTool(toolName: string): PluginInstance | undefined;

  /** Get plugins providing a specific command */
  getByCommand(commandName: string): PluginInstance | undefined;
}

// ============================================================================
// PLUGIN EVENTS
// ============================================================================

export type PluginEventType =
  | 'plugin:installed'
  | 'plugin:enabled'
  | 'plugin:disabled'
  | 'plugin:uninstalled'
  | 'plugin:error'
  | 'plugin:configChanged';

export interface PluginEvent {
  type: PluginEventType;
  pluginId: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export type PluginEventListener = (event: PluginEvent) => void;

// ============================================================================
// PLUGIN MANIFEST (package.json extension)
// ============================================================================

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  homepage?: string;
  repository?: string | { type: string; url: string };
  keywords?: string[];

  /** Code Lab specific configuration */
  codelab?: {
    /** Plugin entry point */
    main?: string;

    /** Required engine version */
    engineVersion?: string;

    /** Plugin dependencies */
    dependencies?: string[];

    /** Activation events */
    activationEvents?: string[];

    /** Contributes section */
    contributes?: {
      tools?: string[];
      commands?: string[];
      hooks?: string[];
      mcpServers?: string[];
      configuration?: {
        title: string;
        properties: Record<string, unknown>;
      };
    };
  };
}
