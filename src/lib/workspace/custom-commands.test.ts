import { describe, it, expect, vi } from 'vitest';
import {
  loadCommandsFromDirectory,
  executeCommand,
  getCustomCommandTools,
  isCustomCommandTool,
  type CustomCommand,
} from './custom-commands';

// Mock supabase (needed by loadCommandsFromDatabase)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => Promise.resolve({ data: [], error: null }),
          is: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      upsert: () => Promise.resolve({}),
      delete: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({}),
            is: () => Promise.resolve({}),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: (_supabase: unknown, _table: string) => ({
    select: () => ({
      eq: () => ({
        or: () => Promise.resolve({ data: [], error: null }),
        is: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    upsert: () => Promise.resolve({}),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// -------------------------------------------------------------------
// loadCommandsFromDirectory
// -------------------------------------------------------------------
describe('loadCommandsFromDirectory', () => {
  it('should load commands from .md files', async () => {
    const readFile = vi.fn().mockResolvedValue('Fix the $ARGUMENTS issue');
    const listDir = vi.fn().mockResolvedValue(['fix-bug.md', 'deploy.md', 'readme.txt']);

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands).toHaveLength(2);
    expect(commands[0].name).toBe('fix-bug');
    expect(commands[0].source).toBe('file');
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it('should parse frontmatter', async () => {
    const content = `---
name: deploy-prod
description: Deploy to production
---
Deploy the application to production environment.`;
    const readFile = vi.fn().mockResolvedValue(content);
    const listDir = vi.fn().mockResolvedValue(['deploy.md']);

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands[0].name).toBe('deploy-prod');
    expect(commands[0].description).toBe('Deploy to production');
    expect(commands[0].promptTemplate).toBe('Deploy the application to production environment.');
  });

  it('should use filename as name when no frontmatter', async () => {
    const readFile = vi.fn().mockResolvedValue('Just a template');
    const listDir = vi.fn().mockResolvedValue(['my-cmd.md']);

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands[0].name).toBe('my-cmd');
    expect(commands[0].description).toContain('Custom command');
  });

  it('should set workspaceId on commands', async () => {
    const readFile = vi.fn().mockResolvedValue('Template');
    const listDir = vi.fn().mockResolvedValue(['test.md']);

    const commands = await loadCommandsFromDirectory('ws-123', readFile, listDir);
    expect(commands[0].workspaceId).toBe('ws-123');
  });

  it('should return empty array when directory not found', async () => {
    const readFile = vi.fn();
    const listDir = vi.fn().mockRejectedValue(new Error('ENOENT'));

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands).toHaveLength(0);
  });

  it('should skip files that fail to read', async () => {
    const readFile = vi
      .fn()
      .mockResolvedValueOnce('Good template')
      .mockRejectedValueOnce(new Error('read error'));
    const listDir = vi.fn().mockResolvedValue(['good.md', 'bad.md']);

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('good');
  });

  it('should skip empty template files', async () => {
    const content = `---
name: empty
description: Empty command
---
`;
    const readFile = vi.fn().mockResolvedValue(content);
    const listDir = vi.fn().mockResolvedValue(['empty.md']);

    const commands = await loadCommandsFromDirectory('ws1', readFile, listDir);
    expect(commands).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// executeCommand
// -------------------------------------------------------------------
describe('executeCommand', () => {
  it('should substitute $ARGUMENTS', () => {
    const cmd: CustomCommand = {
      name: 'fix',
      description: 'Fix issues',
      promptTemplate: 'Fix the following: $ARGUMENTS',
      parameters: [],
      enabled: true,
      source: 'file',
    };
    expect(executeCommand(cmd, 'login bug')).toBe('Fix the following: login bug');
  });

  it('should replace multiple occurrences', () => {
    const cmd: CustomCommand = {
      name: 'test',
      description: 'Test',
      promptTemplate: 'Run $ARGUMENTS and verify $ARGUMENTS works',
      parameters: [],
      enabled: true,
      source: 'file',
    };
    expect(executeCommand(cmd, 'auth')).toBe('Run auth and verify auth works');
  });

  it('should return template as-is when no $ARGUMENTS', () => {
    const cmd: CustomCommand = {
      name: 'deploy',
      description: 'Deploy',
      promptTemplate: 'Deploy to production',
      parameters: [],
      enabled: true,
      source: 'file',
    };
    expect(executeCommand(cmd, 'anything')).toBe('Deploy to production');
  });
});

// -------------------------------------------------------------------
// isCustomCommandTool
// -------------------------------------------------------------------
describe('isCustomCommandTool', () => {
  it('should return true for command_ prefixed tools', () => {
    expect(isCustomCommandTool('command_list')).toBe(true);
    expect(isCustomCommandTool('command_create')).toBe(true);
    expect(isCustomCommandTool('command_delete')).toBe(true);
  });

  it('should return false for non-command tools', () => {
    expect(isCustomCommandTool('other')).toBe(false);
    expect(isCustomCommandTool('hooks_list')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getCustomCommandTools
// -------------------------------------------------------------------
describe('getCustomCommandTools', () => {
  it('should return 3 tools', () => {
    const tools = getCustomCommandTools();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(['command_list', 'command_create', 'command_delete']);
  });

  it('should require name and prompt_template for create', () => {
    const tools = getCustomCommandTools();
    const create = tools.find((t) => t.name === 'command_create')!;
    expect(create.input_schema.required).toContain('name');
    expect(create.input_schema.required).toContain('prompt_template');
  });

  it('should require name for delete', () => {
    const tools = getCustomCommandTools();
    const del = tools.find((t) => t.name === 'command_delete')!;
    expect(del.input_schema.required).toContain('name');
  });
});
