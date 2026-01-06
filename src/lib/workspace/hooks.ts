/**
 * CODE LAB HOOKS SYSTEM
 *
 * Provides Claude Code-like hooks for executing custom commands:
 * - Pre-tool hooks (before tool execution)
 * - Post-tool hooks (after tool execution)
 * - Session hooks (on session start/end)
 * - User prompt hooks (before processing user input)
 *
 * Preferences are persisted to code_lab_user_hooks table
 */

import { createClient } from '@/lib/supabase/server';

export type HookEvent =
  | 'pre_tool'
  | 'post_tool'
  | 'session_start'
  | 'session_end'
  | 'user_prompt_submit'
  | 'assistant_response';

export type HookAction = 'allow' | 'block' | 'modify';

export interface HookConfig {
  id: string;
  name: string;
  description?: string;
  event: HookEvent;
  toolPattern?: string; // Glob pattern for tool names (for pre/post_tool events)
  command: string;
  args?: string[];
  timeout?: number; // ms
  enabled: boolean;
  action?: HookAction; // What to do based on exit code
  blockMessage?: string; // Message to show when blocking
}

export interface HookResult {
  hookId: string;
  hookName: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  action: HookAction;
  blocked: boolean;
  blockMessage?: string;
  modifiedInput?: unknown;
  duration: number;
}

export interface HookContext {
  event: HookEvent;
  sessionId: string;
  userId: string;
  workspaceId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  userPrompt?: string;
  assistantResponse?: string;
}

/**
 * Default hooks configuration
 */
export const DEFAULT_HOOKS: HookConfig[] = [
  {
    id: 'pre-commit-lint',
    name: 'Pre-commit Lint',
    description: 'Run linter before git commits',
    event: 'pre_tool',
    toolPattern: 'git_commit',
    command: 'npm',
    args: ['run', 'lint', '--if-present'],
    timeout: 60000,
    enabled: false,
    action: 'block',
    blockMessage: 'Linting failed. Please fix lint errors before committing.',
  },
  {
    id: 'pre-commit-test',
    name: 'Pre-commit Test',
    description: 'Run tests before git commits',
    event: 'pre_tool',
    toolPattern: 'git_commit',
    command: 'npm',
    args: ['test', '--if-present'],
    timeout: 120000,
    enabled: false,
    action: 'block',
    blockMessage: 'Tests failed. Please fix failing tests before committing.',
  },
  {
    id: 'post-write-format',
    name: 'Post-write Format',
    description: 'Format files after writing',
    event: 'post_tool',
    toolPattern: 'write_file',
    command: 'npx',
    args: ['prettier', '--write'],
    timeout: 30000,
    enabled: false,
    action: 'allow',
  },
  {
    id: 'session-start-deps',
    name: 'Session Start Dependencies',
    description: 'Install dependencies on session start',
    event: 'session_start',
    command: 'npm',
    args: ['install', '--if-present'],
    timeout: 120000,
    enabled: false,
    action: 'allow',
  },
];

/**
 * Check if a tool name matches a glob pattern
 */
function matchesToolPattern(toolName: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(toolName);
}

/**
 * Hooks Manager
 * Manages hook configuration and execution
 */
export class HooksManager {
  private hooks: Map<string, HookConfig> = new Map();
  private executeCommand: ((cmd: string, timeout?: number) => Promise<{ stdout: string; stderr: string; exitCode: number }>) | null = null;
  private userId: string | null = null;
  private preferencesLoaded = false;

  constructor() {
    // Initialize with default hooks (disabled by default)
    DEFAULT_HOOKS.forEach(hook => {
      this.hooks.set(hook.id, { ...hook });
    });
  }

  /**
   * Load user preferences from database
   */
  async loadUserPreferences(userId: string): Promise<void> {
    if (this.preferencesLoaded && this.userId === userId) return;

    this.userId = userId;

    // Type for the database row (table not in generated types yet)
    type HookPref = { hook_id: string; enabled: boolean; custom_config: Record<string, unknown> | null };

    try {
      const supabase = await createClient();
      // Cast to any since table is not in generated types yet
      const result = await (supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => Promise<{ data: HookPref[] | null; error: unknown }>
          }
        }
      })
        .from('code_lab_user_hooks')
        .select('hook_id, enabled, custom_config')
        .eq('user_id', userId);

      const { data, error } = result;

      if (error) throw error;

      // Apply user preferences to default hooks
      if (data) {
        for (const pref of data) {
          const hook = this.hooks.get(pref.hook_id);
          if (hook) {
            hook.enabled = pref.enabled;
            // Apply custom config if present
            if (pref.custom_config) {
              Object.assign(hook, pref.custom_config);
            }
          } else if (pref.custom_config) {
            // Custom user hook
            this.hooks.set(pref.hook_id, {
              id: pref.hook_id,
              enabled: pref.enabled,
              ...pref.custom_config,
            } as HookConfig);
          }
        }
      }

      this.preferencesLoaded = true;
    } catch {
      // Silently fail - use defaults
      this.preferencesLoaded = true;
    }
  }

  /**
   * Save hook preference to database
   */
  private async saveHookPreference(hookId: string, enabled: boolean, customConfig?: Partial<HookConfig>): Promise<void> {
    if (!this.userId) return;

    try {
      const supabase = await createClient();
      // Cast to any since table is not in generated types yet
      await (supabase as unknown as { from: (table: string) => { upsert: (data: unknown, opts: unknown) => Promise<unknown> } })
        .from('code_lab_user_hooks')
        .upsert({
          user_id: this.userId,
          hook_id: hookId,
          enabled,
          custom_config: customConfig || null,
        }, {
          onConflict: 'user_id,hook_id',
        });
    } catch {
      // Silently fail - preference not saved but hook still works
    }
  }

  /**
   * Set the command executor (provided by container)
   */
  setCommandExecutor(executor: (cmd: string, timeout?: number) => Promise<{ stdout: string; stderr: string; exitCode: number }>): void {
    this.executeCommand = executor;
  }

  /**
   * Add or update a hook (persists to database for custom hooks)
   */
  async addHook(config: HookConfig): Promise<void> {
    this.hooks.set(config.id, config);
    // Persist custom hooks to database
    const isDefaultHook = DEFAULT_HOOKS.some(h => h.id === config.id);
    if (!isDefaultHook) {
      await this.saveHookPreference(config.id, config.enabled, config);
    }
  }

  /**
   * Remove a hook
   */
  removeHook(hookId: string): boolean {
    return this.hooks.delete(hookId);
  }

  /**
   * Enable a hook (persists to database)
   */
  async enableHook(hookId: string): Promise<boolean> {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = true;
      await this.saveHookPreference(hookId, true);
      return true;
    }
    return false;
  }

  /**
   * Disable a hook (persists to database)
   */
  async disableHook(hookId: string): Promise<boolean> {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.enabled = false;
      await this.saveHookPreference(hookId, false);
      return true;
    }
    return false;
  }

  /**
   * Get all hooks
   */
  getHooks(): HookConfig[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks for a specific event
   */
  getHooksForEvent(event: HookEvent, toolName?: string): HookConfig[] {
    return Array.from(this.hooks.values()).filter(hook => {
      if (!hook.enabled) return false;
      if (hook.event !== event) return false;

      // For tool-specific events, check the pattern
      if ((event === 'pre_tool' || event === 'post_tool') && hook.toolPattern && toolName) {
        return matchesToolPattern(toolName, hook.toolPattern);
      }

      return true;
    });
  }

  /**
   * Execute a hook
   */
  async executeHook(hook: HookConfig, context: HookContext): Promise<HookResult> {
    const startTime = Date.now();

    if (!this.executeCommand) {
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: 'Hook executor not configured',
        action: 'allow',
        blocked: false,
        duration: Date.now() - startTime,
      };
    }

    try {
      // Build command with args
      let cmd = hook.command;
      if (hook.args && hook.args.length > 0) {
        // Substitute context variables in args
        const processedArgs = hook.args.map(arg => {
          return arg
            .replace('${TOOL_NAME}', context.toolName || '')
            .replace('${SESSION_ID}', context.sessionId)
            .replace('${USER_ID}', context.userId)
            .replace('${WORKSPACE_ID}', context.workspaceId || '');
        });
        cmd += ' ' + processedArgs.join(' ');
      }

      // Execute the command
      const result = await this.executeCommand(cmd, hook.timeout || 30000);

      const success = result.exitCode === 0;
      const action = hook.action || 'allow';
      const blocked = !success && action === 'block';

      return {
        hookId: hook.id,
        hookName: hook.name,
        success,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        action,
        blocked,
        blockMessage: blocked ? hook.blockMessage : undefined,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        action: hook.action || 'allow',
        blocked: hook.action === 'block',
        blockMessage: hook.action === 'block' ? hook.blockMessage : undefined,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Run all hooks for an event
   */
  async runHooks(event: HookEvent, context: HookContext): Promise<{
    results: HookResult[];
    blocked: boolean;
    blockMessage?: string;
  }> {
    const hooks = this.getHooksForEvent(event, context.toolName);
    const results: HookResult[] = [];
    let blocked = false;
    let blockMessage: string | undefined;

    for (const hook of hooks) {
      const result = await this.executeHook(hook, context);
      results.push(result);

      if (result.blocked) {
        blocked = true;
        blockMessage = result.blockMessage;
        break; // Stop on first blocking hook
      }
    }

    return { results, blocked, blockMessage };
  }
}

// Singleton instance
let hooksManager: HooksManager | null = null;

export function getHooksManager(): HooksManager {
  if (!hooksManager) {
    hooksManager = new HooksManager();
  }
  return hooksManager;
}

/**
 * Hook configuration tools for the workspace agent
 */
export function getHooksTools() {
  return [
    {
      name: 'hooks_list',
      description: 'List all configured hooks and their status.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'hooks_enable',
      description: 'Enable a hook by ID. Common hooks: pre-commit-lint, pre-commit-test, post-write-format, session-start-deps.',
      input_schema: {
        type: 'object' as const,
        properties: {
          hook_id: {
            type: 'string',
            description: 'The ID of the hook to enable',
          },
        },
        required: ['hook_id'],
      },
    },
    {
      name: 'hooks_disable',
      description: 'Disable a hook by ID.',
      input_schema: {
        type: 'object' as const,
        properties: {
          hook_id: {
            type: 'string',
            description: 'The ID of the hook to disable',
          },
        },
        required: ['hook_id'],
      },
    },
    {
      name: 'hooks_create',
      description: 'Create a custom hook. Hooks run commands in response to events.',
      input_schema: {
        type: 'object' as const,
        properties: {
          id: {
            type: 'string',
            description: 'Unique ID for the hook',
          },
          name: {
            type: 'string',
            description: 'Display name for the hook',
          },
          event: {
            type: 'string',
            enum: ['pre_tool', 'post_tool', 'session_start', 'session_end', 'user_prompt_submit'],
            description: 'Event that triggers the hook',
          },
          command: {
            type: 'string',
            description: 'Command to execute',
          },
          tool_pattern: {
            type: 'string',
            description: 'Glob pattern for tool names (for pre/post_tool events)',
          },
          action: {
            type: 'string',
            enum: ['allow', 'block'],
            description: 'Action on failure (default: allow)',
          },
          block_message: {
            type: 'string',
            description: 'Message to show when blocking',
          },
        },
        required: ['id', 'name', 'event', 'command'],
      },
    },
  ];
}
