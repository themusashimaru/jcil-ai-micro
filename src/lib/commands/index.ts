/**
 * Custom Slash Commands System
 *
 * Provides Claude Code-compatible custom command functionality:
 * - Project commands: .claude/commands/*.md
 * - User commands: ~/.claude/commands/*.md
 * - Argument templating: $ARGUMENTS, $1, $2, etc.
 * - File references: @file.ts
 * - Pre-command execution
 *
 * @example
 * ```typescript
 * import { CommandManager } from '@/lib/commands';
 *
 * const commands = new CommandManager({
 *   projectDir: '/path/to/project',
 *   sessionId: 'session-123',
 *   workspaceId: 'workspace-456',
 * });
 *
 * // Check if message is a command
 * const parsed = commands.parseMessage('/review src/index.ts');
 * if (parsed?.isCommand) {
 *   const result = await commands.execute(parsed.command, parsed.args);
 *   console.log(result.prompt); // Expanded prompt to send to Claude
 * }
 * ```
 */

// Core exports
export { CommandManager, getCommandManager, resetCommandManager } from './command-manager';
export type { CommandManagerConfig } from './command-manager';

// Loader exports
export {
  loadCommands,
  loadCommand,
  getProjectCommandsDir,
  getUserCommandsDir,
} from './command-loader';

// Executor exports
export {
  executeCommand,
  parseArguments,
  expandVariables,
  expandFileReferences,
  generateHelpText,
} from './command-executor';

// Type exports
export type {
  CommandArgument,
  CommandMetadata,
  CommandDefinition,
  CommandExecutionInput,
  CommandExecutionResult,
  CommandRegistry,
} from './types';
