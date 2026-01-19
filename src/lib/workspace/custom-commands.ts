/**
 * CUSTOM SLASH COMMANDS
 *
 * Load and execute user-defined slash commands from .claude/commands/ directory.
 * Claude Code Parity: Supports custom command files with prompt templates.
 */

import { logger } from '@/lib/logger';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const log = logger('CustomCommands');

// ============================================================================
// TYPES
// ============================================================================

export interface CustomCommand {
  name: string;
  description: string;
  promptTemplate: string;
  parameters: CommandParameter[];
  enabled: boolean;
  source: 'file' | 'db';
  workspaceId?: string;
}

export interface CommandParameter {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

// ============================================================================
// COMMAND CACHE
// ============================================================================

const commandCache = new Map<string, CustomCommand[]>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

// ============================================================================
// COMMAND LOADING
// ============================================================================

export async function loadCommandsFromDirectory(
  workspaceId: string,
  readFile: (path: string) => Promise<string>,
  listDir: (path: string) => Promise<string[]>
): Promise<CustomCommand[]> {
  const commands: CustomCommand[] = [];
  const commandsDir = '/workspace/.claude/commands';

  try {
    const files = await listDir(commandsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of mdFiles) {
      try {
        const content = await readFile(commandsDir + '/' + file);
        const command = parseCommandFile(content, file);
        if (command) {
          command.workspaceId = workspaceId;
          commands.push(command);
        }
      } catch (error) {
        log.warn('Failed to load command file', { file, error });
      }
    }
  } catch {
    log.debug('No .claude/commands directory found');
  }

  return commands;
}

function parseCommandFile(content: string, filename: string): CustomCommand | null {
  try {
    const baseName = filename.replace(/\.md$/, '');
    let name = baseName;
    let description = 'Custom command: ' + baseName;
    let template = content;

    // Simple frontmatter parsing
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      const frontmatter = match[1];
      template = match[2].trim();

      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      if (nameMatch) name = nameMatch[1].trim();

      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (descMatch) description = descMatch[1].trim();
    }

    if (!template) return null;

    return {
      name,
      description,
      promptTemplate: template,
      parameters: [],
      enabled: true,
      source: 'file',
    };
  } catch {
    return null;
  }
}

export async function loadCommandsFromDatabase(
  userId: string,
  workspaceId?: string
): Promise<CustomCommand[]> {
  try {
    const supabase = await createSupabaseClient();

    let query = supabase
      .from('custom_slash_commands')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true);

    if (workspaceId) {
      query = query.or('workspace_id.is.null,workspace_id.eq.' + workspaceId);
    } else {
      query = query.is('workspace_id', null);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (query as any);

    if (error) {
      log.error('Failed to load commands from database', { error });
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      name: row.name,
      description: row.description || '',
      promptTemplate: row.prompt_template,
      parameters: (row.parameters as CommandParameter[]) || [],
      enabled: row.enabled,
      source: 'db' as const,
      workspaceId: row.workspace_id,
    }));
  } catch (error) {
    log.error('Database error loading commands', { error });
    return [];
  }
}

export async function getCustomCommands(
  userId: string,
  workspaceId: string,
  readFile?: (path: string) => Promise<string>,
  listDir?: (path: string) => Promise<string[]>
): Promise<CustomCommand[]> {
  const cacheKey = userId + ':' + workspaceId;
  const cachedTime = cacheTimestamps.get(cacheKey);

  if (cachedTime && Date.now() - cachedTime < CACHE_TTL_MS) {
    const cached = commandCache.get(cacheKey);
    if (cached) return cached;
  }

  const [fileCommands, dbCommands] = await Promise.all([
    readFile && listDir
      ? loadCommandsFromDirectory(workspaceId, readFile, listDir)
      : Promise.resolve([]),
    loadCommandsFromDatabase(userId, workspaceId),
  ]);

  const commandMap = new Map<string, CustomCommand>();
  for (const cmd of dbCommands) commandMap.set(cmd.name, cmd);
  for (const cmd of fileCommands) commandMap.set(cmd.name, cmd);

  const commands = Array.from(commandMap.values());
  commandCache.set(cacheKey, commands);
  cacheTimestamps.set(cacheKey, Date.now());

  return commands;
}

export function executeCommand(command: CustomCommand, args: string): string {
  return command.promptTemplate.replace(/\$ARGUMENTS/g, args);
}

// ============================================================================
// COMMAND MANAGEMENT
// ============================================================================

export async function saveCommand(
  userId: string,
  command: Omit<CustomCommand, 'source' | 'enabled'> & { enabled?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('custom_slash_commands') as any).upsert(
      {
        user_id: userId,
        workspace_id: command.workspaceId || null,
        name: command.name,
        description: command.description,
        prompt_template: command.promptTemplate,
        parameters: command.parameters,
        enabled: command.enabled ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,workspace_id,name' }
    );

    // Invalidate cache
    for (const key of commandCache.keys()) {
      if (key.startsWith(userId + ':')) {
        commandCache.delete(key);
        cacheTimestamps.delete(key);
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function deleteCommand(
  userId: string,
  commandName: string,
  workspaceId?: string
): Promise<boolean> {
  try {
    const supabase = await createSupabaseClient();

    let query = supabase
      .from('custom_slash_commands')
      .delete()
      .eq('user_id', userId)
      .eq('name', commandName);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    } else {
      query = query.is('workspace_id', null);
    }

    await query;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export function getCustomCommandTools(): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return [
    {
      name: 'command_list',
      description: 'List all available custom slash commands.',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'command_create',
      description: 'Create a new custom slash command.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Command name (without leading slash)' },
          description: { type: 'string', description: 'What the command does' },
          prompt_template: {
            type: 'string',
            description: 'Prompt template. Use $ARGUMENTS for arguments.',
          },
        },
        required: ['name', 'prompt_template'],
      },
    },
    {
      name: 'command_delete',
      description: 'Delete a custom slash command.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Command name to delete' },
        },
        required: ['name'],
      },
    },
  ];
}

export function isCustomCommandTool(name: string): boolean {
  return name.startsWith('command_');
}

export async function executeCustomCommandTool(
  name: string,
  input: Record<string, unknown>,
  context: {
    userId: string;
    workspaceId: string;
    readFile?: (path: string) => Promise<string>;
  }
): Promise<string> {
  switch (name) {
    case 'command_list': {
      const commands = await getCustomCommands(context.userId, context.workspaceId);
      if (commands.length === 0) {
        return 'No custom commands found. Create one with command_create or add files to .claude/commands/';
      }
      const lines = ['**Custom Commands:**\n'];
      for (const cmd of commands) {
        const icon = cmd.source === 'file' ? '📁' : '💾';
        lines.push(icon + ' **/' + cmd.name + '** - ' + cmd.description);
      }
      return lines.join('\n');
    }

    case 'command_create': {
      const cmdName = input.name as string;
      const description = (input.description as string) || '';
      const promptTemplate = input.prompt_template as string;

      if (!cmdName || !promptTemplate) {
        return 'Error: name and prompt_template required';
      }

      const result = await saveCommand(context.userId, {
        name: cmdName,
        description,
        promptTemplate,
        parameters: [],
        workspaceId: context.workspaceId,
      });

      return result.success ? 'Command **/' + cmdName + '** created.' : 'Error: ' + result.error;
    }

    case 'command_delete': {
      const cmdName = input.name as string;
      if (!cmdName) return 'Error: name required';

      const success = await deleteCommand(context.userId, cmdName, context.workspaceId);
      return success ? 'Command **/' + cmdName + '** deleted.' : 'Failed to delete command.';
    }

    default:
      return 'Unknown command tool: ' + name;
  }
}
