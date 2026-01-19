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
          return `## /${cmd.name}\n\n${cmd.description}\n\n**Usage:** \`${cmd.usage}\`\n\n**Aliases:** ${cmd.aliases.length ? cmd.aliases.map((a) => '`/' + a + '`').join(', ') : '*none*'}`;
        }
        return `Unknown command: \`/${args.trim()}\`. Type \`/help\` to see all commands.`;
      }

      // Beautiful categorized help output like Claude Code
      return `# Code Lab Commands

## Development
| Command | Description |
|---------|-------------|
| \`/fix\` | Fix errors, bugs, or issues in the code |
| \`/test\` | Run tests and fix any failures |
| \`/build\` | Run the build and fix any errors |
| \`/refactor\` | Refactor code for better quality |
| \`/review\` | Review code for issues and improvements |
| \`/explain\` | Explain how code works |
| \`/install\` | Install packages or dependencies |

## Git Operations
| Command | Description |
|---------|-------------|
| \`/commit\` | Commit current changes with a message |
| \`/push\` | Push commits to remote |
| \`/diff\` | Show current uncommitted changes |
| \`/status\` | Show git status |
| \`/undo\` | Undo last file change or unstage files |

## Session
| Command | Description |
|---------|-------------|
| \`/clear\` | Clear the chat history |
| \`/compact\` | Summarize and compact context to free up space |
| \`/reset\` | Reset the session state |
| \`/model\` | Switch AI model (sonnet, opus, haiku) |
| \`/workspace\` | Enable sandbox execution mode |
| \`/rename\` | Rename the current session |
| \`/rewind\` | Rewind file changes to a checkpoint |

## Customization
| Command | Description |
|---------|-------------|
| \`/style\` | Change output style (concise, verbose, markdown, minimal) |
| \`/vim\` | Toggle vim mode for the editor |

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| \`⌘ M\` | Toggle model selector |
| \`⌘ K\` | Open command palette |
| \`⌘ Shift P\` | Toggle workspace panel |
| \`⌘ Enter\` | Send message |
| \`Escape\` | Cancel streaming |

---
*Type \`/help <command>\` for details about a specific command.*`;
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
  // ============================================
  // OUTPUT STYLE COMMANDS (Claude Code Parity)
  // ============================================
  {
    name: 'style',
    aliases: ['output', 'format'],
    description: 'Change output style (concise, verbose, markdown, minimal)',
    usage: '/style <concise|verbose|markdown|minimal>',
    handler: (args) => {
      const style = args.trim().toLowerCase();
      const validStyles = ['concise', 'verbose', 'markdown', 'minimal'];

      if (!style) {
        return `## Output Styles

| Style | Description |
|-------|-------------|
| \`concise\` | Brief, focused responses (default) |
| \`verbose\` | Detailed explanations with full context |
| \`markdown\` | Rich formatting with headers and sections |
| \`minimal\` | Bare essentials only - no decorations |

**Usage:** \`/style <name>\`
**Current:** Check your settings with \`/style current\``;
      }

      if (style === 'current') {
        return '[STYLE_GET] Get current output style setting.';
      }

      if (!validStyles.includes(style)) {
        return `Invalid style: "${style}". Choose from: ${validStyles.join(', ')}`;
      }

      return `[STYLE_SWITCH:${style}] Output style changed to ${style}.`;
    },
  },
  // ============================================
  // VIM MODE COMMAND (Claude Code Parity)
  // ============================================
  {
    name: 'vim',
    aliases: ['vi'],
    description: 'Toggle vim mode for the editor',
    usage: '/vim [on|off]',
    handler: (args) => {
      const mode = args.trim().toLowerCase();

      if (!mode) {
        return '[VIM_TOGGLE] Toggle vim mode for the editor.';
      }

      if (mode === 'on' || mode === 'enable') {
        return '[VIM_ENABLE] Vim mode enabled. Use hjkl for navigation, i for insert, Esc for normal mode.';
      }

      if (mode === 'off' || mode === 'disable') {
        return '[VIM_DISABLE] Vim mode disabled. Standard editor shortcuts restored.';
      }

      return `Invalid vim mode: "${mode}". Use: /vim on, /vim off, or /vim to toggle.`;
    },
  },
  // ============================================
  // RENAME COMMAND (Claude Code Parity)
  // ============================================
  {
    name: 'rename',
    aliases: ['name', 'title'],
    description: 'Rename the current session',
    usage: '/rename <new name>',
    handler: (args) => {
      const name = args.trim();

      if (!name) {
        return 'Please provide a new name: /rename <new name>';
      }

      return `[SESSION_RENAME:${name}] Session renamed to "${name}".`;
    },
  },
  // ============================================
  // REWIND COMMAND (Claude Code Parity)
  // ============================================
  {
    name: 'rewind',
    aliases: ['undo-all', 'rollback'],
    description: 'Rewind file changes to a previous checkpoint',
    usage: '/rewind [number of changes]',
    handler: (args) => {
      const count = args.trim();

      if (!count) {
        return '[REWIND_SHOW] Show available checkpoints and recent file changes.';
      }

      const num = parseInt(count, 10);
      if (isNaN(num) || num < 1) {
        return `Invalid number: "${count}". Use a positive integer like: /rewind 3`;
      }

      return `[REWIND:${num}] Reverting last ${num} file change(s).`;
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
