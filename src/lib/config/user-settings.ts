/**
 * USER SETTINGS SYSTEM
 *
 * Claude Code-compatible user settings.
 * Supports hierarchical configuration loading.
 *
 * Features:
 * - Theme preferences
 * - Model preferences
 * - Permission rules
 * - Custom prompts
 * - Tool configurations
 */

import { logger } from '@/lib/logger';
import * as path from 'path';

const log = logger('UserSettings');

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeSettings {
  /** Light or dark mode */
  mode: 'light' | 'dark' | 'system';
  /** Font size for editor */
  fontSize?: number;
  /** Font family */
  fontFamily?: string;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Enable minimap */
  minimap?: boolean;
  /** Tab size */
  tabSize?: number;
  /** Word wrap */
  wordWrap?: boolean;
}

export interface ModelSettings {
  /** Default model for chat */
  default: 'sonnet' | 'opus' | 'haiku';
  /** Model for quick tasks */
  quick?: 'sonnet' | 'haiku';
  /** Model for complex tasks */
  complex?: 'opus' | 'sonnet';
  /** Temperature setting (0-1) */
  temperature?: number;
  /** Max tokens for responses */
  maxTokens?: number;
}

export interface PermissionRule {
  /** Rule pattern (glob or exact) */
  pattern: string;
  /** Action: allow, deny, ask */
  action: 'allow' | 'deny' | 'ask';
  /** Optional reason for the rule */
  reason?: string;
}

export interface PermissionSettings {
  /** Auto-approve file reads */
  autoApproveReads?: boolean;
  /** Auto-approve file writes */
  autoApproveWrites?: boolean;
  /** Auto-approve shell commands */
  autoApproveShell?: boolean;
  /** Paths that are always allowed */
  allowedPaths?: string[];
  /** Paths that are always denied */
  deniedPaths?: string[];
  /** Custom permission rules */
  rules?: PermissionRule[];
}

export interface PromptSettings {
  /** Custom system prompt additions */
  systemPromptAdditions?: string;
  /** Custom tool use instructions */
  toolInstructions?: string;
  /** Personality adjustments */
  personality?: string;
  /** Language preference */
  language?: string;
}

export interface ToolSettings {
  /** Disabled tools */
  disabled?: string[];
  /** Tool-specific configurations */
  config?: Record<string, Record<string, unknown>>;
}

export interface UserSettings {
  /** Settings version for migration */
  version: number;
  /** Theme and UI settings */
  theme: ThemeSettings;
  /** Model preferences */
  model: ModelSettings;
  /** Permission rules */
  permissions: PermissionSettings;
  /** Prompt customizations */
  prompts: PromptSettings;
  /** Tool configurations */
  tools: ToolSettings;
  /** Custom key-value settings */
  custom?: Record<string, unknown>;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_SETTINGS: UserSettings = {
  version: 1,
  theme: {
    mode: 'system',
    fontSize: 14,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineNumbers: true,
    minimap: true,
    tabSize: 2,
    wordWrap: true,
  },
  model: {
    default: 'sonnet',
    quick: 'haiku',
    complex: 'opus',
    temperature: 0.7,
    maxTokens: 4096,
  },
  permissions: {
    autoApproveReads: true,
    autoApproveWrites: false,
    autoApproveShell: false,
    allowedPaths: [],
    deniedPaths: ['.env', '.env.*', '**/secrets/**', '**/credentials/**'],
    rules: [],
  },
  prompts: {
    systemPromptAdditions: '',
    toolInstructions: '',
    personality: '',
    language: 'en',
  },
  tools: {
    disabled: [],
    config: {},
  },
};

// ============================================================================
// SETTINGS LOADER
// ============================================================================

const SETTINGS_FILENAMES = ['settings.json', '.claude-settings.json', 'claude.config.json'];

export class SettingsLoader {
  private readFile: (path: string) => Promise<string>;
  private writeFile: (path: string, content: string) => Promise<void>;
  private fileExists: (path: string) => Promise<boolean>;

  private settings: UserSettings = { ...DEFAULT_SETTINGS };
  private settingsPath: string | null = null;

  constructor(
    readFile: (path: string) => Promise<string>,
    writeFile: (path: string, content: string) => Promise<void>,
    fileExists: (path: string) => Promise<boolean>
  ) {
    this.readFile = readFile;
    this.writeFile = writeFile;
    this.fileExists = fileExists;
  }

  /**
   * Load settings from all possible locations
   */
  async loadSettings(workspaceRoot: string): Promise<UserSettings> {
    // Reset to defaults
    this.settings = { ...DEFAULT_SETTINGS };

    // 1. Load home directory settings (global defaults)
    const homeDir = process.env.HOME || '/root';
    await this.loadSettingsFromDir(homeDir);

    // 2. Load workspace settings (overrides global)
    await this.loadSettingsFromDir(workspaceRoot);

    // 3. Load .claude directory settings (highest priority)
    await this.loadSettingsFromDir(path.join(workspaceRoot, '.claude'));

    log.info('Settings loaded', { path: this.settingsPath });
    return this.settings;
  }

  /**
   * Load settings from a directory
   */
  private async loadSettingsFromDir(dir: string): Promise<boolean> {
    for (const filename of SETTINGS_FILENAMES) {
      const filePath = path.join(dir, filename);
      try {
        if (await this.fileExists(filePath)) {
          const content = await this.readFile(filePath);
          const parsed = JSON.parse(content);
          this.mergeSettings(parsed);
          this.settingsPath = filePath;
          log.debug('Loaded settings from', { filePath });
          return true;
        }
      } catch (error) {
        log.warn('Failed to load settings', { filePath, error });
      }
    }
    return false;
  }

  /**
   * Deep merge settings
   */
  private mergeSettings(newSettings: Partial<UserSettings>): void {
    if (newSettings.theme) {
      this.settings.theme = { ...this.settings.theme, ...newSettings.theme };
    }
    if (newSettings.model) {
      this.settings.model = { ...this.settings.model, ...newSettings.model };
    }
    if (newSettings.permissions) {
      this.settings.permissions = { ...this.settings.permissions, ...newSettings.permissions };
      // Merge arrays instead of replacing
      if (newSettings.permissions.allowedPaths) {
        this.settings.permissions.allowedPaths = [
          ...(this.settings.permissions.allowedPaths || []),
          ...newSettings.permissions.allowedPaths,
        ];
      }
      if (newSettings.permissions.deniedPaths) {
        this.settings.permissions.deniedPaths = [
          ...(this.settings.permissions.deniedPaths || []),
          ...newSettings.permissions.deniedPaths,
        ];
      }
      if (newSettings.permissions.rules) {
        this.settings.permissions.rules = [
          ...(this.settings.permissions.rules || []),
          ...newSettings.permissions.rules,
        ];
      }
    }
    if (newSettings.prompts) {
      this.settings.prompts = { ...this.settings.prompts, ...newSettings.prompts };
    }
    if (newSettings.tools) {
      this.settings.tools = { ...this.settings.tools, ...newSettings.tools };
      if (newSettings.tools.disabled) {
        this.settings.tools.disabled = [
          ...(this.settings.tools.disabled || []),
          ...newSettings.tools.disabled,
        ];
      }
      if (newSettings.tools.config) {
        this.settings.tools.config = {
          ...(this.settings.tools.config || {}),
          ...newSettings.tools.config,
        };
      }
    }
    if (newSettings.custom) {
      this.settings.custom = { ...(this.settings.custom || {}), ...newSettings.custom };
    }
  }

  /**
   * Get current settings
   */
  getSettings(): UserSettings {
    return this.settings;
  }

  /**
   * Get a specific setting by path
   */
  getSetting<T>(path: string): T | undefined {
    const parts = path.split('.');
    let current: unknown = this.settings;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current as T;
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<UserSettings>, workspaceRoot: string): Promise<void> {
    this.mergeSettings(updates);

    // Save to workspace settings file
    const settingsPath = this.settingsPath || path.join(workspaceRoot, '.claude', 'settings.json');

    await this.writeFile(settingsPath, JSON.stringify(this.settings, null, 2));
    this.settingsPath = settingsPath;
  }

  /**
   * Check if a path is allowed based on permission rules
   */
  isPathAllowed(filePath: string): 'allow' | 'deny' | 'ask' {
    const perms = this.settings.permissions;

    // Check denied paths first
    if (perms.deniedPaths) {
      for (const pattern of perms.deniedPaths) {
        if (this.matchesPattern(filePath, pattern)) {
          return 'deny';
        }
      }
    }

    // Check allowed paths
    if (perms.allowedPaths) {
      for (const pattern of perms.allowedPaths) {
        if (this.matchesPattern(filePath, pattern)) {
          return 'allow';
        }
      }
    }

    // Check custom rules
    if (perms.rules) {
      for (const rule of perms.rules) {
        if (this.matchesPattern(filePath, rule.pattern)) {
          return rule.action;
        }
      }
    }

    // Default to ask
    return 'ask';
  }

  /**
   * Check if a tool is disabled
   */
  isToolDisabled(toolName: string): boolean {
    return this.settings.tools.disabled?.includes(toolName) || false;
  }

  /**
   * Get tool-specific config
   */
  getToolConfig(toolName: string): Record<string, unknown> | undefined {
    return this.settings.tools.config?.[toolName];
  }

  /**
   * Simple pattern matching (glob-like)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Exact match
    if (path === pattern) return true;

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*') // * matches anything
      .replace(/\?/g, '.'); // ? matches single char

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    } catch {
      return false;
    }
  }
}

// ============================================================================
// SETTINGS TOOLS
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';

/**
 * Get settings management tools for the workspace agent
 */
export function getSettingsTools(): Anthropic.Tool[] {
  return [
    {
      name: 'settings_get',
      description: 'Get current user settings or a specific setting by path.',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description:
              'Dot-separated path to a specific setting (e.g., "theme.mode", "model.default")',
          },
        },
        required: [],
      },
    },
    {
      name: 'settings_update',
      description: 'Update user settings. Changes are saved to the workspace settings file.',
      input_schema: {
        type: 'object' as const,
        properties: {
          theme: {
            type: 'object',
            description: 'Theme settings (mode, fontSize, fontFamily, etc.)',
          },
          model: {
            type: 'object',
            description: 'Model preferences (default, quick, complex, temperature, maxTokens)',
          },
          permissions: {
            type: 'object',
            description: 'Permission settings (autoApproveReads, allowedPaths, deniedPaths, rules)',
          },
          prompts: {
            type: 'object',
            description: 'Prompt customizations (systemPromptAdditions, personality, language)',
          },
          tools: {
            type: 'object',
            description: 'Tool configurations (disabled tools, tool-specific config)',
          },
        },
        required: [],
      },
    },
    {
      name: 'settings_reset',
      description: 'Reset settings to defaults.',
      input_schema: {
        type: 'object' as const,
        properties: {
          category: {
            type: 'string',
            enum: ['theme', 'model', 'permissions', 'prompts', 'tools', 'all'],
            description: 'Category to reset, or "all" for everything',
          },
        },
        required: ['category'],
      },
    },
  ];
}

/**
 * Execute a settings tool
 */
export async function executeSettingsTool(
  toolName: string,
  input: Record<string, unknown>,
  loader: SettingsLoader,
  workspaceRoot: string = '/workspace'
): Promise<string> {
  try {
    switch (toolName) {
      case 'settings_get': {
        const path = input.path as string | undefined;

        if (path) {
          const value = loader.getSetting(path);
          if (value === undefined) {
            return `Setting "${path}" not found`;
          }
          return `${path} = ${JSON.stringify(value, null, 2)}`;
        }

        // Return all settings
        return JSON.stringify(loader.getSettings(), null, 2);
      }

      case 'settings_update': {
        const updates: Partial<UserSettings> = {};

        if (input.theme) updates.theme = input.theme as ThemeSettings;
        if (input.model) updates.model = input.model as ModelSettings;
        if (input.permissions) updates.permissions = input.permissions as PermissionSettings;
        if (input.prompts) updates.prompts = input.prompts as PromptSettings;
        if (input.tools) updates.tools = input.tools as ToolSettings;

        if (Object.keys(updates).length === 0) {
          return 'No settings to update';
        }

        await loader.updateSettings(updates, workspaceRoot);
        return `Settings updated: ${Object.keys(updates).join(', ')}`;
      }

      case 'settings_reset': {
        const category = input.category as string;

        if (category === 'all') {
          await loader.updateSettings(DEFAULT_SETTINGS, workspaceRoot);
          return 'All settings reset to defaults';
        }

        const defaults: Record<string, unknown> = {
          theme: DEFAULT_SETTINGS.theme,
          model: DEFAULT_SETTINGS.model,
          permissions: DEFAULT_SETTINGS.permissions,
          prompts: DEFAULT_SETTINGS.prompts,
          tools: DEFAULT_SETTINGS.tools,
        };

        if (category in defaults) {
          const updates: Partial<UserSettings> = {};
          (updates as Record<string, unknown>)[category] = defaults[category];
          await loader.updateSettings(updates, workspaceRoot);
          return `${category} settings reset to defaults`;
        }

        return `Unknown category: ${category}`;
      }

      default:
        return `Unknown settings tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Settings tool error', { toolName, error });
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Check if a tool name is a settings tool
 */
export function isSettingsTool(toolName: string): boolean {
  return toolName.startsWith('settings_');
}

// ============================================================================
// SINGLETON
// ============================================================================

let loaderInstance: SettingsLoader | null = null;

/**
 * Get the singleton settings loader
 */
export function getSettingsLoader(
  readFile: (path: string) => Promise<string>,
  writeFile: (path: string, content: string) => Promise<void>,
  fileExists: (path: string) => Promise<boolean>
): SettingsLoader {
  if (!loaderInstance) {
    loaderInstance = new SettingsLoader(readFile, writeFile, fileExists);
  }
  return loaderInstance;
}

/**
 * Clear the settings loader instance
 */
export function clearSettingsLoader(): void {
  loaderInstance = null;
}
