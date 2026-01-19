/**
 * Event-Driven Hook System Types
 *
 * Matches Claude Code's hook system for extensibility.
 * Hooks can intercept tool execution, validate inputs, and modify behavior.
 */

// ============================================
// HOOK EVENT TYPES
// ============================================

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop';

// ============================================
// HOOK MATCHER
// ============================================

export interface HookMatcher {
  /** Tool name to match (supports glob patterns) */
  tool?: string;

  /** Command pattern to match (for Bash tool) */
  command?: string;

  /** File path pattern to match (for file operations) */
  path?: string;

  /** Match all tools */
  all?: boolean;
}

// ============================================
// HOOK ACTIONS
// ============================================

export type HookOnFailure = 'block' | 'warn' | 'continue';

export interface HookAction {
  /** Bash command to execute */
  command?: string;

  /** Prompt to send to Claude for decision */
  prompt?: string;

  /** What to do if the hook fails (exit code != 0) */
  onFailure?: HookOnFailure;

  /** Only run this hook once per session */
  once?: boolean;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// ============================================
// HOOK DEFINITION
// ============================================

export interface HookDefinition extends HookAction {
  /** Unique identifier */
  id?: string;

  /** Human-readable description */
  description?: string;

  /** Matcher for when this hook should run */
  matcher?: HookMatcher;

  /** Whether this hook is enabled */
  enabled?: boolean;
}

// ============================================
// HOOK CONFIGURATION
// ============================================

export interface HookConfig {
  /** Hooks to run before tool execution */
  PreToolUse?: HookDefinition[];

  /** Hooks to run after tool execution */
  PostToolUse?: HookDefinition[];

  /** Hooks to run before permission prompts */
  PermissionRequest?: HookDefinition[];

  /** Hooks to run before processing user input */
  UserPromptSubmit?: HookDefinition[];

  /** Hooks to run when session starts */
  SessionStart?: HookDefinition[];

  /** Hooks to run when session ends */
  SessionEnd?: HookDefinition[];

  /** Hooks to run before context compaction */
  PreCompact?: HookDefinition[];

  /** Custom notification hooks */
  Notification?: HookDefinition[];

  /** Hooks to run before stopping */
  Stop?: HookDefinition[];

  /** Hooks to run before subagent stops */
  SubagentStop?: HookDefinition[];
}

// ============================================
// HOOK CONTEXT
// ============================================

export interface HookContext {
  /** Event type that triggered this hook */
  event: HookEventType;

  /** Session ID */
  sessionId: string;

  /** Workspace ID */
  workspaceId: string;

  /** Tool name (for tool events) */
  tool?: string;

  /** Tool input (for tool events) */
  toolInput?: Record<string, unknown>;

  /** Tool output (for PostToolUse) */
  toolOutput?: string;

  /** Tool error (for PostToolUse if failed) */
  toolError?: string;

  /** User prompt (for UserPromptSubmit) */
  userPrompt?: string;

  /** File path (for file operations) */
  filePath?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// HOOK RESULT
// ============================================

export interface HookResult {
  /** Hook that was executed */
  hookId: string;

  /** Whether the hook succeeded */
  success: boolean;

  /** Exit code from bash command */
  exitCode?: number;

  /** Output from the hook */
  output?: string;

  /** Error message if failed */
  error?: string;

  /** Action to take based on result */
  action: 'continue' | 'block' | 'warn';

  /** Modified context (if hook modified it) */
  modifiedContext?: Partial<HookContext>;

  /** Duration in milliseconds */
  duration?: number;
}

// ============================================
// HOOK EXECUTION OPTIONS
// ============================================

export interface HookExecutionOptions {
  /** Skip hooks with these IDs */
  skipHooks?: string[];

  /** Force run even if hook was already run (for once: true) */
  forceRun?: boolean;

  /** Additional environment variables */
  env?: Record<string, string>;

  /** Working directory */
  cwd?: string;
}
