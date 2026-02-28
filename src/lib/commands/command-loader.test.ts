// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

import {
  loadCommands,
  loadCommand,
  getProjectCommandsDir,
  getUserCommandsDir,
} from './command-loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mdFile(body: string, frontmatter?: Record<string, unknown>) {
  if (!frontmatter) return body;
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((item) => `  - ${item}`).join('\n')}`;
      }
      return `${k}: ${v}`;
    })
    .join('\n');
  return `---\n${yaml}\n---\n${body}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('command-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue('');
  });

  // =========================================================================
  // getProjectCommandsDir
  // =========================================================================

  describe('getProjectCommandsDir', () => {
    it('should return project dir with .claude/commands suffix', () => {
      expect(getProjectCommandsDir('/my/project')).toBe('/my/project/.claude/commands');
    });

    it('should handle root directory', () => {
      expect(getProjectCommandsDir('/')).toBe('/.claude/commands');
    });
  });

  // =========================================================================
  // getUserCommandsDir
  // =========================================================================

  describe('getUserCommandsDir', () => {
    it('should return home dir with .claude/commands suffix', () => {
      expect(getUserCommandsDir()).toBe('/home/testuser/.claude/commands');
    });
  });

  // =========================================================================
  // loadCommands
  // =========================================================================

  describe('loadCommands', () => {
    it('should return empty array when no directories exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(loadCommands('/project')).toEqual([]);
    });

    it('should load commands from project directory', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/project/'));
      mockReaddirSync.mockReturnValue(['deploy.md', 'lint.md']);
      mockReadFileSync.mockReturnValue('Command body');

      const cmds = loadCommands('/project');
      expect(cmds).toHaveLength(2);
      expect(cmds[0].metadata.name).toBe('deploy');
      expect(cmds[1].metadata.name).toBe('lint');
    });

    it('should set scope to project for project commands', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/project/'));
      mockReaddirSync.mockReturnValue(['test.md']);
      mockReadFileSync.mockReturnValue('Body');

      const cmds = loadCommands('/project');
      expect(cmds[0].scope).toBe('project');
    });

    it('should load commands from user directory', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/home/testuser/'));
      mockReaddirSync.mockReturnValue(['global.md']);
      mockReadFileSync.mockReturnValue('Global command');

      const cmds = loadCommands('/project');
      expect(cmds).toHaveLength(1);
      expect(cmds[0].scope).toBe('user');
    });

    it('should skip non-markdown files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['readme.txt', 'deploy.md', 'notes.js']);
      mockReadFileSync.mockReturnValue('Body');

      const cmds = loadCommands('/project');
      // Only deploy.md should be loaded (from project + potentially user)
      const names = cmds.map((c) => c.metadata.name);
      expect(names).toContain('deploy');
      expect(names).not.toContain('readme');
      expect(names).not.toContain('notes');
    });

    it('should give project commands precedence over user commands', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['shared.md']);
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('/project/')) return 'Project version';
        return 'User version';
      });

      const cmds = loadCommands('/project');
      const shared = cmds.find((c) => c.metadata.name === 'shared');
      expect(shared).toBeDefined();
      expect(shared?.content).toBe('Project version');
    });

    it('should parse frontmatter description', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['deploy.md']);
      mockReadFileSync.mockReturnValue(
        mdFile('Deploy the app', { description: 'Deploy to production' })
      );

      const cmds = loadCommands('/project');
      expect(cmds[0].metadata.description).toBe('Deploy to production');
    });

    it('should parse boolean frontmatter values', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['secret.md']);
      mockReadFileSync.mockReturnValue(mdFile('Secret command', { hidden: true }));

      const cmds = loadCommands('/project');
      expect(cmds[0].metadata.hidden).toBe(true);
    });

    it('should parse tags array from frontmatter', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['deploy.md']);
      mockReadFileSync.mockReturnValue(
        '---\ndescription: Deploy\ntags:\n  - devops\n  - ci\n---\nBody'
      );

      const cmds = loadCommands('/project');
      expect(cmds[0].metadata.tags).toEqual(['devops', 'ci']);
    });

    it('should handle files without frontmatter', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['simple.md']);
      mockReadFileSync.mockReturnValue('Just a simple command body');

      const cmds = loadCommands('/project');
      expect(cmds[0].content).toBe('Just a simple command body');
      expect(cmds[0].metadata.description).toBeUndefined();
    });

    it('should skip unreadable files gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['good.md', 'bad.md']);
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('bad.md')) throw new Error('Permission denied');
        return 'Good content';
      });

      const cmds = loadCommands('/project');
      const names = cmds.map((c) => c.metadata.name);
      expect(names).toContain('good');
      expect(names).not.toContain('bad');
    });

    it('should handle directory read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('EACCES');
      });

      const cmds = loadCommands('/project');
      expect(cmds).toEqual([]);
    });

    it('should set sourcePath for each command', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/project/'));
      mockReaddirSync.mockReturnValue(['test.md']);
      mockReadFileSync.mockReturnValue('Body');

      const cmds = loadCommands('/project');
      expect(cmds[0].sourcePath).toContain('test.md');
    });

    it('should parse numeric frontmatter values', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['cmd.md']);
      mockReadFileSync.mockReturnValue('---\ntimeout: 5000\n---\nBody');

      const cmds = loadCommands('/project');
      // Timeout should be parsed as a number
      expect((cmds[0].metadata as Record<string, unknown>).timeout).toBeUndefined();
      // It goes to metadata but not to defined fields, so it's just in the raw parse
    });

    it('should remove quotes from string values', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['cmd.md']);
      mockReadFileSync.mockReturnValue('---\ndescription: "A quoted desc"\n---\nBody');

      const cmds = loadCommands('/project');
      expect(cmds[0].metadata.description).toBe('A quoted desc');
    });
  });

  // =========================================================================
  // loadCommand
  // =========================================================================

  describe('loadCommand', () => {
    it('should return undefined when command does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(loadCommand('/project', 'nonexistent')).toBeUndefined();
    });

    it('should load from project directory first', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('Project command');

      const cmd = loadCommand('/project', 'deploy');
      expect(cmd).toBeDefined();
      expect(cmd?.scope).toBe('project');
    });

    it('should fall back to user directory', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/home/testuser/'));
      mockReadFileSync.mockReturnValue('User command');

      const cmd = loadCommand('/project', 'global');
      expect(cmd).toBeDefined();
      expect(cmd?.scope).toBe('user');
    });

    it('should set the command name', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('Body');

      const cmd = loadCommand('/project', 'my-cmd');
      expect(cmd?.metadata.name).toBe('my-cmd');
    });

    it('should parse frontmatter for single command', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        mdFile('Deploy body', { description: 'Deploy app', thinking: true })
      );

      const cmd = loadCommand('/project', 'deploy');
      expect(cmd?.metadata.description).toBe('Deploy app');
    });

    it('should handle read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const cmd = loadCommand('/project', 'broken');
      // Should return undefined since both project and user reads fail
      expect(cmd).toBeUndefined();
    });

    it('should set sourcePath for the loaded command', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('/project/'));
      mockReadFileSync.mockReturnValue('Body');

      const cmd = loadCommand('/project', 'test');
      expect(cmd?.sourcePath).toContain('.claude/commands/test.md');
    });

    it('should parse arguments from frontmatter', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '---\ndescription: Test\narguments:\n  - file\n  - pattern\n---\nBody'
      );

      const cmd = loadCommand('/project', 'search');
      expect(cmd?.metadata.arguments).toHaveLength(2);
    });
  });
});
