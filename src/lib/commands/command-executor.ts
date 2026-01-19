/**
 * Command Executor
 *
 * Executes custom slash commands by:
 * 1. Parsing arguments
 * 2. Expanding variables
 * 3. Including referenced files
 * 4. Running pre-commands
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { minimatch } from 'minimatch';
import type { CommandDefinition, CommandExecutionInput, CommandExecutionResult } from './types';

const execAsync = promisify(exec);

// ============================================
// ARGUMENT PARSING
// ============================================

/**
 * Parse command arguments from a string
 */
export function parseArguments(argsString: string): {
  positional: string[];
  named: Record<string, string>;
} {
  const positional: string[] = [];
  const named: Record<string, string> = {};

  if (!argsString.trim()) {
    return { positional, named };
  }

  // Tokenize respecting quotes
  const tokens = tokenize(argsString);

  for (const token of tokens) {
    // Named argument: --key=value or --key value
    if (token.startsWith('--')) {
      const equalsIndex = token.indexOf('=');
      if (equalsIndex !== -1) {
        const key = token.slice(2, equalsIndex);
        const value = token.slice(equalsIndex + 1);
        named[key] = value;
      } else {
        // Next token is the value
        const key = token.slice(2);
        named[key] = 'true'; // Flag style
      }
    } else {
      positional.push(token);
    }
  }

  return { positional, named };
}

/**
 * Tokenize a string respecting quotes
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

// ============================================
// VARIABLE EXPANSION
// ============================================

/**
 * Expand variables in command content
 */
export function expandVariables(content: string, input: CommandExecutionInput): string {
  let result = content;

  // $ARGUMENTS - full arguments string
  result = result.replace(/\$ARGUMENTS|\$\{ARGUMENTS\}/g, input.arguments);

  // $1, $2, etc. - positional arguments
  for (let i = 0; i < input.positionalArgs.length; i++) {
    const regex = new RegExp(`\\$${i + 1}|\\$\\{${i + 1}\\}`, 'g');
    result = result.replace(regex, input.positionalArgs[i]);
  }

  // Replace remaining positional placeholders with empty string
  result = result.replace(/\$\d+|\$\{\d+\}/g, '');

  // Named arguments: $name or ${name}
  for (const [key, value] of Object.entries(input.namedArgs)) {
    const regex = new RegExp(`\\$${key}|\\$\\{${key}\\}`, 'g');
    result = result.replace(regex, value);
  }

  // Session and workspace IDs
  result = result.replace(/\$SESSION_ID|\$\{SESSION_ID\}/g, input.sessionId);
  result = result.replace(/\$WORKSPACE_ID|\$\{WORKSPACE_ID\}/g, input.workspaceId);
  result = result.replace(/\$CWD|\$\{CWD\}/g, input.cwd || process.cwd());

  return result;
}

// ============================================
// FILE REFERENCES
// ============================================

/**
 * Simple glob matching for files in a directory
 */
function matchFiles(dir: string, pattern: string): string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        const relativePath = fullPath.slice(dir.length + 1);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (minimatch(relativePath, pattern) || minimatch(entry.name, pattern)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return results;
}

/**
 * Expand file references (@file.ts) in content
 */
export async function expandFileReferences(
  content: string,
  baseDir: string
): Promise<{ content: string; files: string[] }> {
  const fileReferenceRegex = /@([\w\/\.\-\*]+)/g;
  const files: string[] = [];
  let result = content;

  const matches = [...content.matchAll(fileReferenceRegex)];

  for (const match of matches) {
    const pattern = match[1];

    // Handle glob patterns
    if (pattern.includes('*')) {
      try {
        const matchedFiles = matchFiles(baseDir, pattern);
        const fileContents: string[] = [];

        for (const file of matchedFiles) {
          if (existsSync(file)) {
            const fileContent = readFileSync(file, 'utf-8');
            fileContents.push(`// File: ${file}\n${fileContent}`);
            files.push(file);
          }
        }

        result = result.replace(match[0], fileContents.join('\n\n'));
      } catch {
        // Keep the reference as-is if matching fails
      }
    } else {
      // Single file reference
      const filePath = join(baseDir, pattern);
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, 'utf-8');
        result = result.replace(match[0], `// File: ${pattern}\n${fileContent}`);
        files.push(filePath);
      }
    }
  }

  return { content: result, files };
}

// ============================================
// COMMAND EXECUTION
// ============================================

/**
 * Execute a custom command
 */
export async function executeCommand(
  command: CommandDefinition,
  input: CommandExecutionInput
): Promise<CommandExecutionResult> {
  const { positional, named } = parseArguments(input.arguments);

  const fullInput: CommandExecutionInput = {
    ...input,
    positionalArgs: positional,
    namedArgs: named,
  };

  // Expand variables in content
  let prompt = expandVariables(command.content, fullInput);

  // Expand file references
  const baseDir = dirname(command.sourcePath);
  const { content: expandedContent, files } = await expandFileReferences(
    prompt,
    input.cwd || baseDir
  );
  prompt = expandedContent;

  // Include additional files from metadata
  const includedFiles = [...files];
  if (command.metadata.include) {
    for (const includePattern of command.metadata.include) {
      const searchDir = input.cwd || baseDir;
      try {
        const matchedFiles = matchFiles(searchDir, includePattern);
        for (const file of matchedFiles) {
          if (existsSync(file) && !includedFiles.includes(file)) {
            const fileContent = readFileSync(file, 'utf-8');
            prompt += `\n\n// Included: ${file}\n${fileContent}`;
            includedFiles.push(file);
          }
        }
      } catch {
        // Skip failed includes
      }
    }
  }

  // Run pre-command if specified
  let preCommandOutput: string | undefined;
  if (command.metadata.preCommand) {
    try {
      const { stdout, stderr } = await execAsync(command.metadata.preCommand, {
        cwd: input.cwd || baseDir,
        timeout: 30000,
      });
      preCommandOutput = stdout + (stderr ? `\n${stderr}` : '');
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      preCommandOutput = `Pre-command failed: ${execError.stdout || ''} ${execError.stderr || ''}`;
    }
  }

  return {
    prompt,
    includedFiles,
    preCommandOutput,
    metadata: command.metadata,
  };
}

/**
 * Generate help text for a command
 */
export function generateHelpText(command: CommandDefinition): string {
  const { metadata } = command;
  let help = `/${metadata.name}`;

  if (metadata.description) {
    help += ` - ${metadata.description}`;
  }

  help += '\n';

  if (metadata.arguments && metadata.arguments.length > 0) {
    help += '\nArguments:\n';
    for (const arg of metadata.arguments) {
      const required = arg.required ? ' (required)' : '';
      const defaultVal = arg.default ? ` [default: ${arg.default}]` : '';
      help += `  ${arg.name}${required}${defaultVal}`;
      if (arg.description) {
        help += ` - ${arg.description}`;
      }
      help += '\n';
    }
  }

  if (metadata.tags && metadata.tags.length > 0) {
    help += `\nTags: ${metadata.tags.join(', ')}\n`;
  }

  help += `\nSource: ${command.sourcePath} (${command.scope})\n`;

  return help;
}
