/**
 * SLASH COMMANDS
 *
 * Simple command shortcuts for common user actions
 * Commands start with / and trigger specialized prompts
 */

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  handler: (args: string) => string; // Returns the prompt to send to AI
}

export const SLASH_COMMANDS: Record<string, SlashCommand> = {
  pray: {
    name: 'pray',
    description: 'Generate a heartfelt prayer',
    usage: '/pray [topic or intention]',
    handler: (args) => {
      const topic = args.trim() || 'general blessing and guidance';
      return `Please write a heartfelt, reverent prayer about: ${topic}

The prayer should:
- Be sincere and from the heart
- Include relevant scripture references if appropriate
- Be suitable for personal devotion or group prayer
- End with "Amen"

Please write the prayer now.`;
    },
  },

  verse: {
    name: 'verse',
    description: 'Find relevant Bible verses',
    usage: '/verse [topic or situation]',
    handler: (args) => {
      const topic = args.trim() || 'encouragement';
      return `Please find 3-5 Bible verses that relate to: ${topic}

For each verse:
1. Quote the full verse with the reference (Book Chapter:Verse)
2. Briefly explain how it applies to this topic
3. Use a well-known translation (NIV, ESV, or KJV)

Focus on verses that would be encouraging and applicable.`;
    },
  },

  study: {
    name: 'study',
    description: 'Start a Bible study on a passage or topic',
    usage: '/study [book, chapter, or topic]',
    handler: (args) => {
      const topic = args.trim() || 'the Sermon on the Mount';
      return `Please create a Bible study guide for: ${topic}

Include:
1. **Context**: Historical and literary background
2. **Key Verses**: The main passages with explanations
3. **Themes**: Major themes and their significance
4. **Application**: How this applies to daily life today
5. **Reflection Questions**: 3-5 questions for personal reflection
6. **Prayer Points**: Suggested prayer topics based on the study

Make it accessible for both new believers and mature Christians.`;
    },
  },

  devotional: {
    name: 'devotional',
    description: 'Generate a daily devotional',
    usage: '/devotional [optional theme]',
    handler: (args) => {
      const theme = args.trim();
      const themePrompt = theme ? `with a focus on: ${theme}` : 'for today';
      return `Please write a short daily devotional ${themePrompt}.

Include:
1. **Scripture**: A key verse for the day
2. **Reflection**: A 2-3 paragraph meditation on the verse
3. **Application**: One practical way to apply this today
4. **Prayer**: A brief closing prayer

Keep it encouraging and uplifting, suitable for morning devotion time.`;
    },
  },

  encourage: {
    name: 'encourage',
    description: 'Get words of encouragement',
    usage: '/encourage [situation]',
    handler: (args) => {
      const situation = args.trim() || 'a difficult time';
      return `I'm going through ${situation}. Please provide Christian encouragement.

Include:
- Relevant scripture that speaks to this situation
- Words of comfort and hope
- Reminder of God's promises
- A short prayer for strength

Be warm, compassionate, and faith-affirming.`;
    },
  },

  summarize: {
    name: 'summarize',
    description: 'Summarize our conversation',
    usage: '/summarize',
    handler: () => {
      return `Please summarize our conversation so far.

Include:
1. **Main Topics**: What we discussed
2. **Key Points**: Important insights or decisions
3. **Action Items**: Any tasks or next steps mentioned
4. **Follow-up**: Suggested topics to explore further

Keep it concise but comprehensive.`;
    },
  },

  help: {
    name: 'help',
    description: 'Show available commands',
    usage: '/help',
    handler: () => {
      // This is handled specially in parseSlashCommand
      return '';
    },
  },
};

export interface ParsedCommand {
  isCommand: boolean;
  command?: string;
  args?: string;
  prompt?: string;
  helpText?: string;
}

/**
 * Parse a message to check if it's a slash command
 */
export function parseSlashCommand(message: string): ParsedCommand {
  const trimmed = message.trim();

  // Check if it starts with /
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  // Parse command and args
  const match = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (!match) {
    return { isCommand: false };
  }

  const commandName = match[1].toLowerCase();
  const args = match[2] || '';

  // Handle /help specially
  if (commandName === 'help') {
    const helpText = generateHelpText();
    return {
      isCommand: true,
      command: 'help',
      helpText,
    };
  }

  // Look up the command
  const command = SLASH_COMMANDS[commandName];
  if (!command) {
    // Unknown command - suggest help
    return {
      isCommand: true,
      command: commandName,
      helpText: `Unknown command: /${commandName}\n\nType /help to see available commands.`,
    };
  }

  // Generate the prompt
  const prompt = command.handler(args);

  return {
    isCommand: true,
    command: commandName,
    args,
    prompt,
  };
}

/**
 * Generate help text listing all commands
 */
function generateHelpText(): string {
  const commands = Object.values(SLASH_COMMANDS)
    .filter(cmd => cmd.name !== 'help')
    .map(cmd => `**${cmd.usage}**\n${cmd.description}`)
    .join('\n\n');

  return `## Available Commands

${commands}

---
*Type any command to get started!*`;
}

/**
 * Get command suggestions for autocomplete
 */
export function getCommandSuggestions(partial: string): string[] {
  const search = partial.toLowerCase().replace('/', '');
  return Object.keys(SLASH_COMMANDS)
    .filter(name => name.startsWith(search))
    .map(name => `/${name}`);
}
