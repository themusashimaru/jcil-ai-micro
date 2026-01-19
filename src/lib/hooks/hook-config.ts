/**
 * Hook Configuration Loader
 *
 * Loads hook configuration from various sources:
 * - .claude/hooks.json (project level)
 * - .claude/settings.json (hooks section)
 * - Environment variables
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { HookConfig, HookDefinition, HookEventType } from './types';

// ============================================
// CONFIGURATION PATHS
// ============================================

const CONFIG_FILENAMES = ['.claude/hooks.json', '.claude/settings.json', 'claude.hooks.json'];

// ============================================
// LOADER
// ============================================

/**
 * Load hook configuration from project directory
 */
export function loadHookConfig(projectDir: string): HookConfig {
  const config: HookConfig = {};

  for (const filename of CONFIG_FILENAMES) {
    const filepath = join(projectDir, filename);

    if (existsSync(filepath)) {
      try {
        const content = readFileSync(filepath, 'utf-8');
        const parsed = JSON.parse(content);

        // Check if this is a settings file with hooks section
        const hooksSection = parsed.hooks || parsed;

        // Merge configurations
        mergeHookConfig(config, hooksSection);
      } catch (error) {
        console.error(`Failed to load hook config from ${filepath}:`, error);
      }
    }
  }

  return config;
}

/**
 * Load hook configuration from a JSON string
 */
export function parseHookConfig(json: string): HookConfig {
  try {
    const parsed = JSON.parse(json);
    return normalizeHookConfig(parsed.hooks || parsed);
  } catch (error) {
    console.error('Failed to parse hook config:', error);
    return {};
  }
}

/**
 * Merge hook configurations
 */
function mergeHookConfig(target: HookConfig, source: Partial<HookConfig>): void {
  const eventTypes: HookEventType[] = [
    'PreToolUse',
    'PostToolUse',
    'PermissionRequest',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
    'Notification',
    'Stop',
    'SubagentStop',
  ];

  for (const eventType of eventTypes) {
    if (source[eventType]) {
      if (!target[eventType]) {
        target[eventType] = [];
      }
      target[eventType]!.push(...source[eventType]!);
    }
  }
}

/**
 * Normalize hook configuration
 */
function normalizeHookConfig(config: Partial<HookConfig>): HookConfig {
  const normalized: HookConfig = {};

  const eventTypes: HookEventType[] = [
    'PreToolUse',
    'PostToolUse',
    'PermissionRequest',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
    'Notification',
    'Stop',
    'SubagentStop',
  ];

  for (const eventType of eventTypes) {
    if (config[eventType]) {
      normalized[eventType] = config[eventType]!.map(normalizeHookDefinition);
    }
  }

  return normalized;
}

/**
 * Normalize a hook definition
 */
function normalizeHookDefinition(hook: HookDefinition): HookDefinition {
  return {
    id: hook.id || generateHookId(hook),
    description: hook.description,
    matcher: hook.matcher,
    command: hook.command,
    prompt: hook.prompt,
    onFailure: hook.onFailure || 'continue',
    once: hook.once || false,
    timeout: hook.timeout || 30000,
    enabled: hook.enabled !== false,
  };
}

/**
 * Generate a unique ID for a hook
 */
function generateHookId(hook: HookDefinition): string {
  const base = hook.command || hook.prompt || hook.description || 'hook';
  const hash = simpleHash(base);
  return `hook_${hash}`;
}

/**
 * Simple string hash
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================
// DEFAULT HOOKS
// ============================================

/**
 * Get default hooks for common use cases
 */
export function getDefaultHooks(): HookConfig {
  return {
    // Example: Run tests before git push
    PreToolUse: [
      {
        id: 'pre-push-tests',
        description: 'Run tests before git push',
        matcher: { tool: 'execute_shell', command: 'git push*' },
        command: 'npm test',
        onFailure: 'warn',
        enabled: false, // Disabled by default
      },
    ],

    // Example: Format files after edit
    PostToolUse: [
      {
        id: 'post-edit-format',
        description: 'Format file after edit',
        matcher: { tool: 'edit_file' },
        command: 'prettier --write $FILE_PATH',
        onFailure: 'continue',
        enabled: false,
      },
    ],

    // Example: Log session start
    SessionStart: [
      {
        id: 'session-start-log',
        description: 'Log session start',
        command: 'echo "Session started: $SESSION_ID"',
        once: true,
        enabled: false,
      },
    ],
  };
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate hook configuration
 */
export function validateHookConfig(config: HookConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const eventTypes: HookEventType[] = [
    'PreToolUse',
    'PostToolUse',
    'PermissionRequest',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'PreCompact',
    'Notification',
    'Stop',
    'SubagentStop',
  ];

  for (const eventType of eventTypes) {
    const hooks = config[eventType];
    if (hooks) {
      for (let i = 0; i < hooks.length; i++) {
        const hook = hooks[i];
        const prefix = `${eventType}[${i}]`;

        // Must have command or prompt
        if (!hook.command && !hook.prompt) {
          errors.push(`${prefix}: Must have either 'command' or 'prompt'`);
        }

        // Validate onFailure
        if (hook.onFailure && !['block', 'warn', 'continue'].includes(hook.onFailure)) {
          errors.push(`${prefix}: Invalid onFailure value: ${hook.onFailure}`);
        }

        // Validate timeout
        if (hook.timeout !== undefined && (hook.timeout < 0 || hook.timeout > 600000)) {
          errors.push(`${prefix}: Timeout must be between 0 and 600000ms`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
