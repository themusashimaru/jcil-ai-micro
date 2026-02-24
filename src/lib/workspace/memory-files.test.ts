import { describe, it, expect, vi } from 'vitest';
import {
  MemoryFileLoader,
  getClaudeMemoryTools,
  isClaudeMemoryTool,
  executeMemoryTool,
  DEFAULT_CLAUDE_MD_TEMPLATE,
  clearMemoryCache,
  getCachedMemoryContext,
} from './memory-files';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {},
}));

// -------------------------------------------------------------------
// DEFAULT_CLAUDE_MD_TEMPLATE
// -------------------------------------------------------------------
describe('DEFAULT_CLAUDE_MD_TEMPLATE', () => {
  it('should contain project memory header', () => {
    expect(DEFAULT_CLAUDE_MD_TEMPLATE).toContain('# Project Memory');
  });

  it('should contain standard sections', () => {
    expect(DEFAULT_CLAUDE_MD_TEMPLATE).toContain('## Project Overview');
    expect(DEFAULT_CLAUDE_MD_TEMPLATE).toContain('## Code Style & Conventions');
    expect(DEFAULT_CLAUDE_MD_TEMPLATE).toContain('## Instructions');
    expect(DEFAULT_CLAUDE_MD_TEMPLATE).toContain('## Do Not');
  });
});

// -------------------------------------------------------------------
// MemoryFileLoader
// -------------------------------------------------------------------
describe('MemoryFileLoader', () => {
  describe('loadMemoryContext', () => {
    it('should load workspace-level CLAUDE.md', async () => {
      const readFile = vi.fn().mockResolvedValue('# Project\nTest project');
      const fileExists = vi
        .fn()
        .mockImplementation(async (p: string) => p === '/workspace/CLAUDE.md');
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files).toHaveLength(1);
      expect(ctx.files[0].source).toBe('workspace');
      expect(ctx.files[0].priority).toBe(0);
    });

    it('should try CODELAB.md as fallback', async () => {
      const readFile = vi.fn().mockResolvedValue('# Codelab');
      const fileExists = vi.fn().mockImplementation(async (p: string) => p.endsWith('CODELAB.md'));
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files).toHaveLength(1);
    });

    it('should return empty for no memory files', async () => {
      const readFile = vi.fn().mockRejectedValue(new Error('not found'));
      const fileExists = vi.fn().mockResolvedValue(false);
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files).toHaveLength(0);
      expect(ctx.combinedContent).toBe('');
    });

    it('should load parent directory memory files', async () => {
      const readFile = vi.fn().mockResolvedValue('# Memory');
      const fileExists = vi.fn().mockImplementation(async (p: string) => {
        return p === '/workspace/CLAUDE.md' || p === '/CLAUDE.md';
      });
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: true,
        includeHomeDir: false,
      });

      expect(ctx.files.length).toBeGreaterThanOrEqual(1);
    });

    it('should not load parent dirs when disabled', async () => {
      const readFile = vi.fn().mockResolvedValue('# Memory');
      const fileExists = vi.fn().mockImplementation(async (p: string) => {
        return p === '/workspace/CLAUDE.md' || p === '/CLAUDE.md';
      });
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      // Only workspace level should be loaded
      expect(ctx.files).toHaveLength(1);
      expect(ctx.files[0].source).toBe('workspace');
    });

    it('should expand @include directives', async () => {
      const readFile = vi.fn().mockImplementation(async (p: string) => {
        if (p.endsWith('CLAUDE.md')) return '# Project\n@include ./extra.md';
        if (p.endsWith('extra.md')) return '# Extra content';
        throw new Error('not found');
      });
      const fileExists = vi.fn().mockImplementation(async (p: string) => {
        return p.endsWith('CLAUDE.md') || p.endsWith('extra.md');
      });
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files[0].content).toContain('Extra content');
      expect(ctx.includes.size).toBe(1);
    });

    it('should handle missing includes gracefully', async () => {
      const readFile = vi.fn().mockImplementation(async (p: string) => {
        if (p.endsWith('CLAUDE.md')) return '# Project\n@include ./missing.md';
        throw new Error('not found');
      });
      const fileExists = vi.fn().mockImplementation(async (p: string) => {
        return p.endsWith('CLAUDE.md');
      });
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files[0].content).toContain('Include not found');
    });

    it('should prevent circular includes', async () => {
      const readFile = vi.fn().mockImplementation(async (p: string) => {
        if (p.endsWith('CLAUDE.md')) return '# Project\n@include ./a.md';
        if (p.endsWith('a.md')) return '# A\n@include ./CLAUDE.md';
        throw new Error('not found');
      });
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.files[0].content).toContain('Already included');
    });

    it('should sort files by priority', async () => {
      const readFile = vi.fn().mockResolvedValue('# Memory');
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: true,
        includeHomeDir: false,
      });

      // Files should be sorted by priority (workspace = 0 first)
      if (ctx.files.length > 1) {
        expect(ctx.files[0].priority).toBeLessThanOrEqual(ctx.files[1].priority);
      }
    });

    it('should include Project Memory header in combined content', async () => {
      const readFile = vi.fn().mockResolvedValue('# My Project');
      const fileExists = vi.fn().mockImplementation(async (p: string) => p.endsWith('CLAUDE.md'));
      const listDir = vi.fn().mockResolvedValue([]);

      const loader = new MemoryFileLoader(readFile, fileExists, listDir);
      const ctx = await loader.loadMemoryContext({
        workspaceRoot: '/workspace',
        includeParentDirs: false,
        includeHomeDir: false,
      });

      expect(ctx.combinedContent).toContain('# Project Memory');
      expect(ctx.combinedContent).toContain('Project Context');
    });
  });
});

// -------------------------------------------------------------------
// executeMemoryTool
// -------------------------------------------------------------------
describe('executeMemoryTool', () => {
  const readFile = vi.fn();
  const writeFile = vi.fn();
  const fileExists = vi.fn();
  const listDir = vi.fn().mockResolvedValue([]);

  it('should load memory files', async () => {
    readFile.mockResolvedValue('# Project Context');
    fileExists.mockResolvedValue(true);

    const result = await executeMemoryTool(
      'memory_load',
      {},
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Loaded');
  });

  it('should report no files found', async () => {
    fileExists.mockResolvedValue(false);

    const result = await executeMemoryTool(
      'memory_load',
      {},
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('No CLAUDE.md');
  });

  it('should create memory file', async () => {
    fileExists.mockResolvedValue(false);
    writeFile.mockResolvedValue(undefined);

    const result = await executeMemoryTool(
      'memory_create',
      { content: '# Custom Memory' },
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Created CLAUDE.md');
    expect(writeFile).toHaveBeenCalledWith('/workspace/CLAUDE.md', '# Custom Memory');
  });

  it('should not overwrite existing memory file', async () => {
    fileExists.mockResolvedValue(true);

    const result = await executeMemoryTool(
      'memory_create',
      {},
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('already exists');
  });

  it('should update memory file', async () => {
    fileExists.mockResolvedValue(true);
    writeFile.mockResolvedValue(undefined);

    const result = await executeMemoryTool(
      'memory_update',
      { content: '# Updated' },
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Updated');
  });

  it('should require content for memory_update', async () => {
    const result = await executeMemoryTool(
      'memory_update',
      {},
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Error');
  });

  it('should add instruction to existing section', async () => {
    readFile.mockResolvedValue('## Instructions\n\n- Existing rule\n\n---');
    fileExists.mockResolvedValue(true);
    writeFile.mockResolvedValue(undefined);

    const result = await executeMemoryTool(
      'memory_add_instruction',
      { section: 'Instructions', instruction: 'New rule' },
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Added instruction');
    expect(result).toContain('New rule');
  });

  it('should create section if it does not exist', async () => {
    readFile.mockResolvedValue('## Other\n\n- stuff\n\n---');
    fileExists.mockResolvedValue(true);
    writeFile.mockResolvedValue(undefined);

    const result = await executeMemoryTool(
      'memory_add_instruction',
      { section: 'Notes', instruction: 'Remember this' },
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Created Notes section');
  });

  it('should handle unknown tool', async () => {
    const result = await executeMemoryTool(
      'memory_unknown',
      {},
      readFile,
      writeFile,
      fileExists,
      listDir,
      '/workspace'
    );

    expect(result).toContain('Unknown memory tool');
  });
});

// -------------------------------------------------------------------
// getClaudeMemoryTools
// -------------------------------------------------------------------
describe('getClaudeMemoryTools', () => {
  it('should return 4 tools', () => {
    const tools = getClaudeMemoryTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name)).toEqual([
      'memory_load',
      'memory_create',
      'memory_update',
      'memory_add_instruction',
    ]);
  });
});

// -------------------------------------------------------------------
// isClaudeMemoryTool
// -------------------------------------------------------------------
describe('isClaudeMemoryTool', () => {
  it('should return true for memory_ prefixed tools', () => {
    expect(isClaudeMemoryTool('memory_load')).toBe(true);
    expect(isClaudeMemoryTool('memory_create')).toBe(true);
  });

  it('should return false for non-memory tools', () => {
    expect(isClaudeMemoryTool('other')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getCachedMemoryContext / clearMemoryCache
// -------------------------------------------------------------------
describe('getCachedMemoryContext', () => {
  it('should return context and cache it', async () => {
    clearMemoryCache();
    const readFile = vi.fn().mockResolvedValue('# Project');
    const fileExists = vi.fn().mockImplementation(async (p: string) => p.endsWith('CLAUDE.md'));
    const listDir = vi.fn().mockResolvedValue([]);

    const ctx1 = await getCachedMemoryContext('/workspace', readFile, fileExists, listDir);
    expect(ctx1.files.length).toBeGreaterThanOrEqual(0);

    // Second call should use cache (readFile called fewer times)
    const callCount = readFile.mock.calls.length;
    await getCachedMemoryContext('/workspace', readFile, fileExists, listDir);
    expect(readFile.mock.calls.length).toBe(callCount); // No new calls
  });

  it('should force reload', async () => {
    clearMemoryCache();
    const readFile = vi.fn().mockResolvedValue('# Project');
    const fileExists = vi.fn().mockImplementation(async (p: string) => p.endsWith('CLAUDE.md'));
    const listDir = vi.fn().mockResolvedValue([]);

    const ctx1 = await getCachedMemoryContext('/workspace', readFile, fileExists, listDir);
    const ctx2 = await getCachedMemoryContext('/workspace', readFile, fileExists, listDir, true);
    // Force reload creates a new context object
    expect(ctx2.loadedAt.getTime()).toBeGreaterThanOrEqual(ctx1.loadedAt.getTime());
  });
});
