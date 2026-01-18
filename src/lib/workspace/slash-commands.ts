/**
 * SLASH COMMANDS FOR CODE LAB
 *
 * Provides Claude Code-like slash commands:
 * /fix - Fix errors in the codebase
 * /test - Run tests
 * /build - Run build
 * /commit - Commit changes
 * /push - Push to remote
 * /review - Code review
 * /explain - Explain code
 * /workspace - Manage workspace
 */

export interface SlashCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string, context: CommandContext) => string;
}

export interface CommandContext {
  userId: string;
  sessionId: string;
  workspaceId?: string;
  repo?: {
    owner: string;
    name: string;
    branch: string;
  };
}

export interface ParsedCommand {
  command: SlashCommand;
  args: string;
  rawInput: string;
}

// ============================================
// COMMAND DEFINITIONS
// ============================================

const commands: SlashCommand[] = [
  {
    name: 'fix',
    aliases: ['f', 'repair'],
    description: 'Fix errors, bugs, or issues in the code',
    usage: '/fix [description of the issue]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Find and fix any errors in the codebase. Check for type errors, linting issues, and bugs. Run the build and fix any failures.';
      }
      return `Fix the following issue: ${args}. Analyze the code, identify the root cause, and implement a fix. Run tests to verify the fix works.`;
    },
  },
  {
    name: 'test',
    aliases: ['t', 'tests'],
    description: 'Run tests and fix any failures',
    usage: '/test [specific test or pattern]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Run the test suite for this project. If any tests fail, analyze the failures and fix them.';
      }
      return `Run tests matching: ${args}. Analyze any failures and fix them.`;
    },
  },
  {
    name: 'build',
    aliases: ['b'],
    description: 'Run the build and fix any errors',
    usage: '/build',
    handler: () => {
      return 'Run the build for this project. If the build fails, analyze the errors and fix them. Keep building until it succeeds.';
    },
  },
  {
    name: 'commit',
    aliases: ['c', 'save'],
    description: 'Commit current changes with a message',
    usage: '/commit [message]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Stage all changes and create a commit. Analyze the changes and generate an appropriate commit message. Follow conventional commit style.';
      }
      return `Stage all changes and create a commit with the message: "${args}"`;
    },
  },
  {
    name: 'push',
    aliases: ['p'],
    description: 'Push commits to remote',
    usage: '/push [branch]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Push all commits to the remote repository on the current branch.';
      }
      return `Push commits to the remote repository on branch: ${args}`;
    },
  },
  {
    name: 'review',
    aliases: ['r', 'check'],
    description: 'Review code for issues and improvements',
    usage: '/review [file or area]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Review the codebase for issues, bugs, security vulnerabilities, and potential improvements. Provide a detailed analysis with recommendations.';
      }
      return `Review the code in: ${args}. Look for bugs, security issues, performance problems, and suggest improvements.`;
    },
  },
  {
    name: 'explain',
    aliases: ['e', 'what'],
    description: 'Explain how code works',
    usage: '/explain [file, function, or concept]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Explain the overall architecture and structure of this codebase. Describe the main components and how they interact.';
      }
      return `Explain how this works: ${args}. Provide a clear explanation with code examples if helpful.`;
    },
  },
  {
    name: 'refactor',
    aliases: ['rf', 'clean'],
    description: 'Refactor code for better quality',
    usage: '/refactor [file or area]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Identify areas of the codebase that could be refactored for better readability, maintainability, or performance. Implement the refactoring.';
      }
      return `Refactor: ${args}. Improve code quality while maintaining functionality. Run tests to ensure nothing breaks.`;
    },
  },
  {
    name: 'install',
    aliases: ['i', 'add'],
    description: 'Install packages or dependencies',
    usage: '/install [package names]',
    handler: (args) => {
      if (!args.trim()) {
        return 'Install all project dependencies based on package.json, requirements.txt, or other dependency files.';
      }
      return `Install the following packages: ${args}. Update dependency files accordingly.`;
    },
  },
  {
    name: 'workspace',
    aliases: ['ws', 'sandbox'],
    description: 'Enable sandbox execution mode',
    usage: '/workspace',
    handler: () => {
      return '/workspace - This enables sandbox execution mode. I can now run shell commands, read/write files, and execute code in an isolated environment.';
    },
  },
  {
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    usage: '/help [command]',
    handler: (args) => {
      if (args.trim()) {
        const cmd = findCommand(args.trim());
        if (cmd) {
          return `**/${cmd.name}** - ${cmd.description}\n\nUsage: \`${cmd.usage}\`\n\nAliases: ${cmd.aliases.map((a) => '/' + a).join(', ')}`;
        }
        return `Unknown command: /${args.trim()}. Type /help to see all commands.`;
      }

      let helpText = '**Available Commands:**\n\n';
      commands.forEach((cmd) => {
        helpText += `\`/${cmd.name}\` - ${cmd.description}\n`;
      });
      helpText += '\n*Type /help [command] for more details about a specific command.*';
      return helpText;
    },
  },
  // ============================================
  // SESSION COMMANDS (Claude Code Parity)
  // ============================================
  {
    name: 'clear',
    aliases: ['cls'],
    description: 'Clear the chat history',
    usage: '/clear',
    handler: () => {
      return '[CLEAR_HISTORY]';
    },
  },
  {
    name: 'compact',
    aliases: ['summarize'],
    description: 'Summarize and compact context to free up space',
    usage: '/compact',
    handler: () => {
      return '[COMPACT_CONTEXT] Summarize the conversation history so far, preserving key context but reducing length.';
    },
  },
  {
    name: 'reset',
    aliases: [],
    description: 'Reset the session state',
    usage: '/reset',
    handler: () => {
      return '[RESET_SESSION] Clear history and reset all session preferences to defaults.';
    },
  },
  // ============================================
  // GIT COMMANDS (Claude Code Parity)
  // ============================================
  {
    name: 'diff',
    aliases: ['d', 'changes'],
    description: 'Show current uncommitted changes',
    usage: '/diff [file]',
    handler: (args) => {
      if (args.trim()) {
        return `Show the git diff for: ${args}`;
      }
      return 'Show all current uncommitted changes using git diff.';
    },
  },
  {
    name: 'status',
    aliases: ['st'],
    description: 'Show git status',
    usage: '/status',
    handler: () => {
      return 'Show the current git status including branch, staged, and unstaged changes.';
    },
  },
  {
    name: 'undo',
    aliases: ['u'],
    description: 'Undo last file change or unstage files',
    usage: '/undo [file]',
    handler: (args) => {
      if (args.trim()) {
        return `Undo changes to: ${args}. Restore it to the last committed version.`;
      }
      return 'Unstage all currently staged changes.';
    },
  },
  // ============================================
  // MODEL COMMANDS (Claude Code Parity)
  // ============================================
  {
    name: 'model',
    aliases: ['m'],
    description: 'Switch AI model (sonnet, opus, haiku)',
    usage: '/model <sonnet|opus|haiku>',
    handler: (args) => {
      const model = args.trim().toLowerCase();
      const validModels = ['sonnet', 'opus', 'haiku'];
      if (!model) {
        return 'Available models: sonnet (recommended), opus (most capable), haiku (fastest)\n\nUsage: /model <name>';
      }
      if (!validModels.includes(model)) {
        return `Invalid model: ${model}. Choose from: ${validModels.join(', ')}`;
      }
      return `[MODEL_SWITCH:${model}] Switch to Claude ${model.charAt(0).toUpperCase() + model.slice(1)}.`;
    },
  },
  // ============================================
  // HELP COMMANDS (Claude Code Parity)
  // ============================================
  {
    name: 'bug',
    aliases: ['issue', 'report'],
    description: 'Report a bug or issue',
    usage: '/bug <description>',
    handler: (args) => {
      if (!args.trim()) {
        return 'Please describe the bug: /bug <description>\n\nOr visit: https://github.com/anthropics/claude-code/issues';
      }
      return `[BUG_REPORT] Bug reported: ${args}\n\nThank you! To file a formal report, visit: https://github.com/anthropics/claude-code/issues/new`;
    },
  },
];

// ============================================
// COMMAND PARSING
// ============================================

/**
 * Find a command by name or alias
 */
function findCommand(nameOrAlias: string): SlashCommand | undefined {
  const lower = nameOrAlias.toLowerCase().replace(/^\//, '');
  return commands.find((cmd) => cmd.name === lower || cmd.aliases.includes(lower));
}

/**
 * Parse a message to check if it contains a slash command
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  // Check if starts with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Extract command and args
  const spaceIndex = trimmed.indexOf(' ');
  let commandName: string;
  let args: string;

  if (spaceIndex === -1) {
    commandName = trimmed.substring(1);
    args = '';
  } else {
    commandName = trimmed.substring(1, spaceIndex);
    args = trimmed.substring(spaceIndex + 1);
  }

  const command = findCommand(commandName);
  if (!command) {
    return null;
  }

  return {
    command,
    args,
    rawInput: trimmed,
  };
}

/**
 * Process a slash command and return the enhanced prompt
 */
export function processSlashCommand(input: string, context: CommandContext): string | null {
  const parsed = parseSlashCommand(input);
  if (!parsed) {
    return null;
  }

  return parsed.command.handler(parsed.args, context);
}

/**
 * Check if input is a slash command
 */
export function isSlashCommand(input: string): boolean {
  return parseSlashCommand(input) !== null;
}

/**
 * Get autocomplete suggestions for slash commands
 */
export function getCommandSuggestions(input: string): SlashCommand[] {
  if (!input.startsWith('/')) {
    return [];
  }

  const query = input.substring(1).toLowerCase();
  if (!query) {
    return commands;
  }

  return commands.filter(
    (cmd) =>
      cmd.name.startsWith(query) ||
      cmd.aliases.some((a) => a.startsWith(query)) ||
      cmd.description.toLowerCase().includes(query)
  );
}

/**
 * Get all available commands
 */
export function getAllCommands(): SlashCommand[] {
  return commands;
}
