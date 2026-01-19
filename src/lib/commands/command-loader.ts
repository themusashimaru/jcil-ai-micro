/**
 * Command Loader
 *
 * Loads custom slash commands from:
 * - .claude/commands/ (project scope)
 * - ~/.claude/commands/ (user scope)
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';
import type { CommandDefinition, CommandMetadata } from './types';

// ============================================
// CONSTANTS
// ============================================

const PROJECT_COMMANDS_DIR = '.claude/commands';
const USER_COMMANDS_DIR = join(homedir(), '.claude', 'commands');

// ============================================
// FRONTMATTER PARSING
// ============================================

interface ParsedCommand {
  metadata: Partial<CommandMetadata>;
  content: string;
}

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): ParsedCommand {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      content: content.trim(),
    };
  }

  const [, frontmatter, body] = match;
  const metadata: Partial<CommandMetadata> = {};

  // Parse YAML-like frontmatter (simple key: value pairs)
  const lines = frontmatter.split('\n');
  let currentKey = '';
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle array items
    if (trimmed.startsWith('- ') && inArray) {
      const value = trimmed.slice(2).trim();

      // Check if it's an object (argument definition)
      if (currentKey === 'arguments') {
        // Parse argument object
        const argMatch = value.match(/^name:\s*(.+)/);
        if (argMatch) {
          // This is a simple case, handle complex objects separately
          currentArray.push(value);
        } else {
          currentArray.push(value);
        }
      } else {
        currentArray.push(value);
      }
      continue;
    }

    // Handle key: value pairs
    const keyValueMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyValueMatch) {
      // Save previous array if any
      if (inArray && currentKey) {
        (metadata as Record<string, unknown>)[currentKey] = currentArray;
      }

      const [, key, value] = keyValueMatch;
      currentKey = key;

      if (value === '') {
        // Start of an array
        inArray = true;
        currentArray = [];
      } else {
        // Simple value
        inArray = false;
        (metadata as Record<string, unknown>)[key] = parseValue(value);
      }
    }
  }

  // Save final array if any
  if (inArray && currentKey) {
    (metadata as Record<string, unknown>)[currentKey] = currentArray;
  }

  return {
    metadata,
    content: body.trim(),
  };
}

/**
 * Parse a YAML value
 */
function parseValue(value: string): string | boolean | number {
  const trimmed = value.trim();

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Number
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') return num;

  // String (remove quotes if present)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

// ============================================
// COMMAND LOADING
// ============================================

/**
 * Load commands from a directory
 */
function loadCommandsFromDir(dir: string, scope: 'project' | 'user'): CommandDefinition[] {
  const commands: CommandDefinition[] = [];

  if (!existsSync(dir)) {
    return commands;
  }

  try {
    const files = readdirSync(dir);

    for (const file of files) {
      // Only process markdown files
      if (extname(file) !== '.md') continue;

      const filepath = join(dir, file);
      const name = basename(file, '.md');

      try {
        const content = readFileSync(filepath, 'utf-8');
        const { metadata, content: body } = parseFrontmatter(content);

        commands.push({
          metadata: {
            name,
            description: metadata.description,
            arguments: parseArguments(metadata.arguments),
            thinking: metadata.thinking as boolean | undefined,
            preCommand: metadata.preCommand as string | undefined,
            include: metadata.include as string[] | undefined,
            hidden: metadata.hidden as boolean | undefined,
            tags: metadata.tags as string[] | undefined,
          },
          content: body,
          sourcePath: filepath,
          scope,
        });
      } catch {
        // Skip files that can't be read
        continue;
      }
    }
  } catch {
    // Directory read error
    return commands;
  }

  return commands;
}

/**
 * Parse arguments from frontmatter
 */
function parseArguments(args: unknown): CommandMetadata['arguments'] {
  if (!args || !Array.isArray(args)) return undefined;

  return args.map((arg) => {
    if (typeof arg === 'string') {
      return { name: arg };
    }
    if (typeof arg === 'object' && arg !== null) {
      return {
        name: ((arg as Record<string, unknown>).name as string) || 'arg',
        description: (arg as Record<string, unknown>).description as string | undefined,
        required: (arg as Record<string, unknown>).required as boolean | undefined,
        default: (arg as Record<string, unknown>).default as string | undefined,
      };
    }
    return { name: String(arg) };
  });
}

/**
 * Load all commands from project and user directories
 */
export function loadCommands(projectDir: string): CommandDefinition[] {
  const projectCommands = loadCommandsFromDir(join(projectDir, PROJECT_COMMANDS_DIR), 'project');

  const userCommands = loadCommandsFromDir(USER_COMMANDS_DIR, 'user');

  // Project commands take precedence over user commands
  const commandMap = new Map<string, CommandDefinition>();

  // Add user commands first
  for (const cmd of userCommands) {
    commandMap.set(cmd.metadata.name, cmd);
  }

  // Override with project commands
  for (const cmd of projectCommands) {
    commandMap.set(cmd.metadata.name, cmd);
  }

  return Array.from(commandMap.values());
}

/**
 * Load a single command by name
 */
export function loadCommand(projectDir: string, name: string): CommandDefinition | undefined {
  // Check project directory first
  const projectPath = join(projectDir, PROJECT_COMMANDS_DIR, `${name}.md`);
  if (existsSync(projectPath)) {
    try {
      const content = readFileSync(projectPath, 'utf-8');
      const { metadata, content: body } = parseFrontmatter(content);
      return {
        metadata: {
          name,
          ...metadata,
          arguments: parseArguments(metadata.arguments),
        },
        content: body,
        sourcePath: projectPath,
        scope: 'project',
      };
    } catch {
      // Fall through to user directory
    }
  }

  // Check user directory
  const userPath = join(USER_COMMANDS_DIR, `${name}.md`);
  if (existsSync(userPath)) {
    try {
      const content = readFileSync(userPath, 'utf-8');
      const { metadata, content: body } = parseFrontmatter(content);
      return {
        metadata: {
          name,
          ...metadata,
          arguments: parseArguments(metadata.arguments),
        },
        content: body,
        sourcePath: userPath,
        scope: 'user',
      };
    } catch {
      // Command not found
    }
  }

  return undefined;
}

/**
 * Get the project commands directory
 */
export function getProjectCommandsDir(projectDir: string): string {
  return join(projectDir, PROJECT_COMMANDS_DIR);
}

/**
 * Get the user commands directory
 */
export function getUserCommandsDir(): string {
  return USER_COMMANDS_DIR;
}
