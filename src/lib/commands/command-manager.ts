/**
 * Command Manager
 *
 * Central manager for custom slash commands.
 * Handles loading, caching, and execution of commands.
 */

import { loadCommands, loadCommand } from './command-loader';
import { executeCommand, generateHelpText } from './command-executor';
import type {
  CommandDefinition,
  CommandExecutionInput,
  CommandExecutionResult,
  CommandRegistry,
} from './types';

// ============================================
// BUILT-IN COMMANDS
// ============================================

const BUILT_IN_COMMANDS: CommandDefinition[] = [
  {
    metadata: {
      name: 'help',
      description: 'Show available commands',
      hidden: false,
    },
    content: 'Show all available slash commands and their descriptions.',
    sourcePath: 'built-in',
    scope: 'project',
  },
  {
    metadata: {
      name: 'clear',
      description: 'Clear the conversation',
      hidden: false,
    },
    content: 'Clear the current conversation and start fresh.',
    sourcePath: 'built-in',
    scope: 'project',
  },
  {
    metadata: {
      name: 'compact',
      description: 'Compact the conversation context',
      hidden: false,
    },
    content: 'Compact the conversation to reduce token usage.',
    sourcePath: 'built-in',
    scope: 'project',
  },
];

// ============================================
// COMMAND MANAGER
// ============================================

export interface CommandManagerConfig {
  /** Project directory to load commands from */
  projectDir: string;

  /** Session ID for execution context */
  sessionId: string;

  /** Workspace ID for execution context */
  workspaceId: string;

  /** Include built-in commands */
  includeBuiltIns?: boolean;
}

export class CommandManager implements CommandRegistry {
  private config: CommandManagerConfig;
  private commands: Map<string, CommandDefinition> = new Map();
  private loaded = false;

  constructor(config: CommandManagerConfig) {
    this.config = config;

    // Add built-in commands if enabled
    if (config.includeBuiltIns !== false) {
      for (const cmd of BUILT_IN_COMMANDS) {
        this.commands.set(cmd.metadata.name, cmd);
      }
    }
  }

  /**
   * Load commands from disk
   */
  async reload(): Promise<void> {
    const customCommands = loadCommands(this.config.projectDir);

    // Clear non-built-in commands
    for (const [name, cmd] of this.commands) {
      if (cmd.sourcePath !== 'built-in') {
        this.commands.delete(name);
      }
    }

    // Add custom commands
    for (const cmd of customCommands) {
      this.commands.set(cmd.metadata.name, cmd);
    }

    this.loaded = true;
  }

  /**
   * Ensure commands are loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.reload();
    }
  }

  /**
   * Get all available commands
   */
  getAll(): CommandDefinition[] {
    // Synchronous version for simple use
    return Array.from(this.commands.values()).filter((cmd) => !cmd.metadata.hidden);
  }

  /**
   * Get a command by name
   */
  get(name: string): CommandDefinition | undefined {
    // Check cache first
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }

    // Try to load from disk
    const cmd = loadCommand(this.config.projectDir, name);
    if (cmd) {
      this.commands.set(name, cmd);
    }
    return cmd;
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name) || !!loadCommand(this.config.projectDir, name);
  }

  /**
   * Get commands by tag
   */
  getByTag(tag: string): CommandDefinition[] {
    return this.getAll().filter((cmd) => cmd.metadata.tags?.includes(tag));
  }

  /**
   * Get help text for a command
   */
  getHelp(name: string): string | undefined {
    const cmd = this.get(name);
    if (!cmd) return undefined;
    return generateHelpText(cmd);
  }

  /**
   * Execute a command
   */
  async execute(
    name: string,
    args: string,
    options: { cwd?: string } = {}
  ): Promise<CommandExecutionResult | null> {
    const command = this.get(name);
    if (!command) {
      return null;
    }

    const input: CommandExecutionInput = {
      arguments: args,
      positionalArgs: [],
      namedArgs: {},
      sessionId: this.config.sessionId,
      workspaceId: this.config.workspaceId,
      cwd: options.cwd,
    };

    return executeCommand(command, input);
  }

  /**
   * Parse a message for slash commands
   * Returns the command and remaining content, or null if not a command
   */
  parseMessage(message: string): {
    command: string;
    args: string;
    isCommand: boolean;
  } | null {
    const trimmed = message.trim();

    // Must start with /
    if (!trimmed.startsWith('/')) {
      return null;
    }

    // Extract command name and arguments
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
      // Just the command, no arguments
      return {
        command: trimmed.slice(1),
        args: '',
        isCommand: true,
      };
    }

    return {
      command: trimmed.slice(1, spaceIndex),
      args: trimmed.slice(spaceIndex + 1),
      isCommand: true,
    };
  }

  /**
   * Generate help for all commands
   */
  generateFullHelp(): string {
    const commands = this.getAll();
    let help = '# Available Commands\n\n';

    // Group by tags
    const tagged = new Map<string, CommandDefinition[]>();
    const untagged: CommandDefinition[] = [];

    for (const cmd of commands) {
      if (cmd.metadata.tags && cmd.metadata.tags.length > 0) {
        for (const tag of cmd.metadata.tags) {
          if (!tagged.has(tag)) {
            tagged.set(tag, []);
          }
          tagged.get(tag)!.push(cmd);
        }
      } else {
        untagged.push(cmd);
      }
    }

    // Output tagged commands
    for (const [tag, cmds] of tagged) {
      help += `## ${tag}\n\n`;
      for (const cmd of cmds) {
        help += `- **/${cmd.metadata.name}**`;
        if (cmd.metadata.description) {
          help += ` - ${cmd.metadata.description}`;
        }
        help += '\n';
      }
      help += '\n';
    }

    // Output untagged commands
    if (untagged.length > 0) {
      help += '## Other\n\n';
      for (const cmd of untagged) {
        help += `- **/${cmd.metadata.name}**`;
        if (cmd.metadata.description) {
          help += ` - ${cmd.metadata.description}`;
        }
        help += '\n';
      }
    }

    return help;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let globalCommandManager: CommandManager | null = null;

/**
 * Get or create the global command manager
 */
export function getCommandManager(config?: CommandManagerConfig): CommandManager {
  if (!globalCommandManager && config) {
    globalCommandManager = new CommandManager(config);
  }
  if (!globalCommandManager) {
    throw new Error('CommandManager not initialized. Call with config first.');
  }
  return globalCommandManager;
}

/**
 * Reset the global command manager
 */
export function resetCommandManager(): void {
  globalCommandManager = null;
}
