/**
 * Event-Driven Hook System
 *
 * Provides Claude Code-compatible hook functionality for:
 * - PreToolUse / PostToolUse: Before/after tool execution
 * - PermissionRequest: Before permission prompts
 * - UserPromptSubmit: Before processing user input
 * - SessionStart / SessionEnd: Session lifecycle
 * - PreCompact: Before context compaction
 * - Notification: Custom notifications
 *
 * @example
 * ```typescript
 * import { HookManager } from '@/lib/hooks';
 *
 * const hooks = new HookManager({
 *   sessionId: 'session-123',
 *   workspaceId: 'workspace-456',
 *   projectDir: '/path/to/project',
 * });
 *
 * // Before running a tool
 * const result = await hooks.preToolUse('execute_shell', { command: 'git push' });
 * if (result.blocked) {
 *   console.log('Blocked by hook:', result.blockReason);
 *   return;
 * }
 *
 * // After running a tool
 * await hooks.postToolUse('execute_shell', { command: 'git push' }, 'Success');
 * ```
 */

// Core exports
export { HookManager, getHookManager, resetHookManager } from './event-hooks';
export type { HookManagerConfig, TriggerResult } from './event-hooks';

// Configuration exports
export {
  loadHookConfig,
  parseHookConfig,
  validateHookConfig,
  getDefaultHooks,
} from './hook-config';

// Matcher exports
export {
  matchesHook,
  matchPattern,
  filterMatchingHooks,
  createMatcher,
  parsePermissionPattern,
} from './hook-matcher';

// Executor exports
export { executeHook, executeHooks, expandVariables } from './hook-executor';

// Type exports
export type {
  HookEventType,
  HookMatcher,
  HookOnFailure,
  HookAction,
  HookDefinition,
  HookConfig,
  HookContext,
  HookResult,
  HookExecutionOptions,
} from './types';
