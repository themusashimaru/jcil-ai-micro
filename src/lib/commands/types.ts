/**
 * Custom Slash Commands Types
 *
 * Matches Claude Code's custom commands for full parity.
 * Commands are defined in .claude/commands/ as markdown files.
 */

// ============================================
// COMMAND METADATA
// ============================================

export interface CommandArgument {
  /** Argument name */
  name: string;

  /** Description for help text */
  description?: string;

  /** Whether this argument is required */
  required?: boolean;

  /** Default value if not provided */
  default?: string;
}

export interface CommandMetadata {
  /** Command name (derived from filename) */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Command arguments */
  arguments?: CommandArgument[];

  /** Whether to show extended thinking */
  thinking?: boolean;

  /** Bash command to run before the command */
  preCommand?: string;

  /** File references to include */
  include?: string[];

  /** Whether this command is hidden from help */
  hidden?: boolean;

  /** Tags for categorization */
  tags?: string[];
}

// ============================================
// COMMAND DEFINITION
// ============================================

export interface CommandDefinition {
  /** Command metadata from frontmatter */
  metadata: CommandMetadata;

  /** Command content (the prompt template) */
  content: string;

  /** Source file path */
  sourcePath: string;

  /** Scope: project or user */
  scope: 'project' | 'user';
}

// ============================================
// COMMAND EXECUTION
// ============================================

export interface CommandExecutionInput {
  /** Raw arguments string */
  arguments: string;

  /** Parsed positional arguments */
  positionalArgs: string[];

  /** Named arguments (--key=value) */
  namedArgs: Record<string, string>;

  /** Session ID for context */
  sessionId: string;

  /** Workspace ID for context */
  workspaceId: string;

  /** Current working directory */
  cwd?: string;
}

export interface CommandExecutionResult {
  /** The expanded prompt to send to Claude */
  prompt: string;

  /** Files that were included via @ references */
  includedFiles: string[];

  /** Pre-command output (if any) */
  preCommandOutput?: string;

  /** Metadata about the command */
  metadata: CommandMetadata;
}

// ============================================
// COMMAND REGISTRY
// ============================================

export interface CommandRegistry {
  /** Get all available commands */
  getAll(): CommandDefinition[];

  /** Get a command by name */
  get(name: string): CommandDefinition | undefined;

  /** Check if a command exists */
  has(name: string): boolean;

  /** Get commands by tag */
  getByTag(tag: string): CommandDefinition[];

  /** Get help text for a command */
  getHelp(name: string): string | undefined;

  /** Reload commands from disk */
  reload(): Promise<void>;
}
