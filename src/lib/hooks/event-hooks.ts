/**
 * Event Hooks Manager
 *
 * Central manager for the event-driven hook system.
 * Matches Claude Code's hook system for full parity.
 *
 * Usage:
 * ```typescript
 * const hookManager = new HookManager({
 *   sessionId: 'session-123',
 *   workspaceId: 'workspace-456',
 *   projectDir: '/path/to/project',
 * });
 *
 * // Trigger hook before tool execution
 * const result = await hookManager.trigger('PreToolUse', {
 *   tool: 'execute_shell',
 *   toolInput: { command: 'git push' },
 * });
 *
 * if (result.blocked) {
 *   // Hook blocked the action
 *   console.log('Blocked:', result.blockReason);
 * }
 * ```
 */

import { loadHookConfig, validateHookConfig } from './hook-config';
import { executeHooks } from './hook-executor';
import { filterMatchingHooks } from './hook-matcher';
import type {
  HookConfig,
  HookContext,
  HookDefinition,
  HookEventType,
  HookExecutionOptions,
  HookResult,
} from './types';

// ============================================
// MANAGER CONFIGURATION
// ============================================

export interface HookManagerConfig {
  /** Session ID for context */
  sessionId: string;

  /** Workspace ID for context */
  workspaceId: string;

  /** Project directory to load config from */
  projectDir?: string;

  /** Custom hook configuration (overrides file-based) */
  hooks?: HookConfig;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================
// TRIGGER RESULT
// ============================================

export interface TriggerResult {
  /** Whether any hook was executed */
  executed: boolean;

  /** Whether the action was blocked by a hook */
  blocked: boolean;

  /** Reason for blocking (if blocked) */
  blockReason?: string;

  /** Whether there were warnings */
  warnings: string[];

  /** Individual hook results */
  results: HookResult[];

  /** Total duration of all hooks */
  duration: number;
}

// ============================================
// HOOK MANAGER
// ============================================

export class HookManager {
  private config: HookManagerConfig;
  private hooks: HookConfig;
  private executedOnceHooks: Set<string> = new Set();

  constructor(config: HookManagerConfig) {
    this.config = config;

    // Load hooks from file or use provided config
    if (config.hooks) {
      this.hooks = config.hooks;
    } else if (config.projectDir) {
      this.hooks = loadHookConfig(config.projectDir);
    } else {
      this.hooks = {};
    }

    // Validate configuration
    const validation = validateHookConfig(this.hooks);
    if (!validation.valid) {
      // eslint-disable-next-line no-console
      console.warn('Hook configuration validation errors:', validation.errors);
    }

    if (config.debug) {
      // eslint-disable-next-line no-console
      console.log('HookManager initialized with config:', this.hooks);
    }
  }

  /**
   * Trigger hooks for an event
   */
  async trigger(
    event: HookEventType,
    contextData: Partial<Omit<HookContext, 'event' | 'sessionId' | 'workspaceId'>> = {},
    options: HookExecutionOptions = {}
  ): Promise<TriggerResult> {
    const startTime = Date.now();

    // Build full context
    const context: HookContext = {
      event,
      sessionId: this.config.sessionId,
      workspaceId: this.config.workspaceId,
      ...contextData,
    };

    // Get hooks for this event type
    const eventHooks = this.hooks[event] || [];

    // Filter hooks that match the context
    const matchingHooks = filterMatchingHooks(eventHooks, context);

    // Filter out "once" hooks that have already been executed
    const hooksToRun = matchingHooks.filter((hook) => {
      if (hook.once && hook.id && this.executedOnceHooks.has(hook.id)) {
        return false;
      }
      return true;
    });

    if (hooksToRun.length === 0) {
      return {
        executed: false,
        blocked: false,
        warnings: [],
        results: [],
        duration: Date.now() - startTime,
      };
    }

    if (this.config.debug) {
      // eslint-disable-next-line no-console
      console.log(`Executing ${hooksToRun.length} hooks for event: ${event}`);
    }

    // Execute hooks
    const results = await executeHooks(hooksToRun, context, options);

    // Mark "once" hooks as executed
    for (const hook of hooksToRun) {
      if (hook.once && hook.id) {
        this.executedOnceHooks.add(hook.id);
      }
    }

    // Collect warnings and check for blocks
    const warnings: string[] = [];
    let blocked = false;
    let blockReason: string | undefined;

    for (const result of results) {
      if (result.action === 'warn') {
        warnings.push(result.error || result.output || 'Hook warning');
      }
      if (result.action === 'block') {
        blocked = true;
        blockReason = result.error || result.output || 'Hook blocked action';
        break;
      }
    }

    return {
      executed: true,
      blocked,
      blockReason,
      warnings,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Trigger PreToolUse hooks
   */
  async preToolUse(tool: string, toolInput: Record<string, unknown>): Promise<TriggerResult> {
    return this.trigger('PreToolUse', {
      tool,
      toolInput,
      filePath: (toolInput.path as string) || (toolInput.file as string),
    });
  }

  /**
   * Trigger PostToolUse hooks
   */
  async postToolUse(
    tool: string,
    toolInput: Record<string, unknown>,
    toolOutput: string,
    toolError?: string
  ): Promise<TriggerResult> {
    return this.trigger('PostToolUse', {
      tool,
      toolInput,
      toolOutput,
      toolError,
      filePath: (toolInput.path as string) || (toolInput.file as string),
    });
  }

  /**
   * Trigger UserPromptSubmit hooks
   */
  async userPromptSubmit(userPrompt: string): Promise<TriggerResult> {
    return this.trigger('UserPromptSubmit', { userPrompt });
  }

  /**
   * Trigger SessionStart hooks
   */
  async sessionStart(): Promise<TriggerResult> {
    return this.trigger('SessionStart');
  }

  /**
   * Trigger SessionEnd hooks
   */
  async sessionEnd(): Promise<TriggerResult> {
    return this.trigger('SessionEnd');
  }

  /**
   * Trigger PreCompact hooks
   */
  async preCompact(): Promise<TriggerResult> {
    return this.trigger('PreCompact');
  }

  /**
   * Add a hook dynamically
   */
  addHook(event: HookEventType, hook: HookDefinition): void {
    if (!this.hooks[event]) {
      this.hooks[event] = [];
    }
    this.hooks[event]!.push(hook);
  }

  /**
   * Remove a hook by ID
   */
  removeHook(event: HookEventType, hookId: string): boolean {
    const hooks = this.hooks[event];
    if (!hooks) return false;

    const index = hooks.findIndex((h) => h.id === hookId);
    if (index !== -1) {
      hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all hooks for an event
   */
  getHooks(event: HookEventType): HookDefinition[] {
    return this.hooks[event] || [];
  }

  /**
   * Get all configured hooks
   */
  getAllHooks(): HookConfig {
    return { ...this.hooks };
  }

  /**
   * Reset the executed once hooks tracker
   */
  resetOnceHooks(): void {
    this.executedOnceHooks.clear();
  }

  /**
   * Check if any hooks are configured for an event
   */
  hasHooks(event: HookEventType): boolean {
    return (this.hooks[event]?.length || 0) > 0;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let globalHookManager: HookManager | null = null;

/**
 * Get or create the global hook manager
 */
export function getHookManager(config?: HookManagerConfig): HookManager {
  if (!globalHookManager && config) {
    globalHookManager = new HookManager(config);
  }
  if (!globalHookManager) {
    throw new Error('HookManager not initialized. Call with config first.');
  }
  return globalHookManager;
}

/**
 * Reset the global hook manager
 */
export function resetHookManager(): void {
  globalHookManager = null;
}
