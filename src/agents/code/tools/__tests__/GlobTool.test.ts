// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetContainerManager, mockSanitizeFilePath, mockSanitizeGlobPattern } = vi.hoisted(
  () => ({
    mockGetContainerManager: vi.fn(),
    mockSanitizeFilePath: vi.fn(),
    mockSanitizeGlobPattern: vi.fn(),
  })
);

vi.mock('@/lib/workspace/container', () => ({
  getContainerManager: () => mockGetContainerManager(),
}));

vi.mock('@/lib/workspace/security', () => ({
  sanitizeFilePath: (...args: unknown[]) => mockSanitizeFilePath(...args),
  sanitizeGlobPattern: (...args: unknown[]) => mockSanitizeGlobPattern(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { GlobTool, globTool } from '../GlobTool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(stdout = 'file1.ts\nfile2.ts\n') {
  return {
    executeCommand: vi.fn().mockResolvedValue({ stdout, stderr: '', exitCode: 0 }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GlobTool', () => {
  let tool: GlobTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GlobTool();
    tool.initialize({ workspaceId: 'ws-123' });
    mockSanitizeGlobPattern.mockImplementation((p) => p);
    mockSanitizeFilePath.mockImplementation((p) => p);
    mockGetContainerManager.mockReturnValue(makeContainer());
  });

  // =========================================================================
  // Properties
  // =========================================================================

  describe('properties', () => {
    it('should have name "glob"', () => {
      expect(tool.name).toBe('glob');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
    });
  });

  // =========================================================================
  // getDefinition
  // =========================================================================

  describe('getDefinition', () => {
    it('should return definition with name', () => {
      expect(tool.getDefinition().name).toBe('glob');
    });

    it('should require pattern parameter', () => {
      expect(tool.getDefinition().parameters.required).toContain('pattern');
    });

    it('should have pattern, cwd, ignore, maxResults properties', () => {
      const props = tool.getDefinition().parameters.properties;
      expect(props.pattern).toBeDefined();
      expect(props.cwd).toBeDefined();
      expect(props.ignore).toBeDefined();
      expect(props.maxResults).toBeDefined();
    });
  });

  // =========================================================================
  // execute
  // =========================================================================

  describe('execute', () => {
    it('should return files matching pattern', async () => {
      const result = await tool.execute({ pattern: '**/*.ts' });
      expect(result.success).toBe(true);
      expect(result.result.files).toContain('file1.ts');
      expect(result.result.files).toContain('file2.ts');
    });

    it('should return file count', async () => {
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.result.count).toBe(2);
    });

    it('should return pattern in result', async () => {
      const result = await tool.execute({ pattern: 'src/**/*.js' });
      expect(result.result.pattern).toBe('src/**/*.js');
    });

    it('should fail when pattern is missing', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required');
    });

    it('should fail when workspace not initialized', async () => {
      const uninitTool = new GlobTool();
      const result = await uninitTool.execute({ pattern: '*.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('workspace');
    });

    it('should fail when pattern is unsafe', async () => {
      mockSanitizeGlobPattern.mockReturnValue(null);
      const result = await tool.execute({ pattern: '../../../etc/passwd' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid glob pattern');
    });

    it('should default cwd to /workspace', async () => {
      await tool.execute({ pattern: '*.ts' });
      expect(mockSanitizeFilePath).toHaveBeenCalledWith('/workspace', '/workspace');
    });

    it('should use custom cwd', async () => {
      await tool.execute({ pattern: '*.ts', cwd: '/workspace/src' });
      expect(mockSanitizeFilePath).toHaveBeenCalledWith('/workspace/src', '/workspace');
    });

    it('should cap maxResults at 5000', async () => {
      mockGetContainerManager.mockReturnValue(makeContainer(''));
      await tool.execute({ pattern: '*.ts', maxResults: 10000 });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('head -5000');
    });

    it('should default maxResults to 1000', async () => {
      mockGetContainerManager.mockReturnValue(makeContainer(''));
      await tool.execute({ pattern: '*.ts' });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('head -1000');
    });

    it('should strip leading ./ from results', async () => {
      mockGetContainerManager.mockReturnValue(makeContainer('./src/app.ts\n./lib/utils.ts\n'));
      const result = await tool.execute({ pattern: '**/*.ts' });
      expect(result.result.files).toEqual(['src/app.ts', 'lib/utils.ts']);
    });

    it('should filter empty lines', async () => {
      mockGetContainerManager.mockReturnValue(makeContainer('file1.ts\n\n\nfile2.ts\n'));
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.result.files).toHaveLength(2);
    });

    it('should handle container errors', async () => {
      mockGetContainerManager.mockReturnValue({
        executeCommand: vi.fn().mockRejectedValue(new Error('Container down')),
      });
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Container down');
    });

    it('should include execution time in metadata', async () => {
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should set truncated flag when at max results', async () => {
      const files = Array.from({ length: 1000 }, (_, i) => `file${i}.ts`).join('\n');
      mockGetContainerManager.mockReturnValue(makeContainer(files));
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.result.truncated).toBe(true);
    });

    it('should not set truncated when below max', async () => {
      const result = await tool.execute({ pattern: '*.ts' });
      expect(result.result.truncated).toBe(false);
    });

    it('should use -path for ** patterns', async () => {
      await tool.execute({ pattern: '**/*.ts' });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('-path');
    });

    it('should use -name for simple patterns', async () => {
      await tool.execute({ pattern: '*.ts' });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('-name');
    });

    it('should exclude node_modules by default', async () => {
      await tool.execute({ pattern: '*.ts' });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('node_modules');
    });

    it('should exclude .git by default', async () => {
      await tool.execute({ pattern: '*.ts' });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('.git');
    });

    it('should apply ignore patterns', async () => {
      await tool.execute({ pattern: '*.ts', ignore: ['dist/**'] });
      const cmd = mockGetContainerManager().executeCommand.mock.calls[0][1];
      expect(cmd).toContain('dist');
    });
  });

  // =========================================================================
  // findMultiple
  // =========================================================================

  describe('findMultiple', () => {
    it('should search multiple patterns', async () => {
      const results = await tool.findMultiple(['*.ts', '*.js']);
      expect(results.size).toBe(2);
      expect(results.has('*.ts')).toBe(true);
      expect(results.has('*.js')).toBe(true);
    });

    it('should return results for each pattern', async () => {
      const results = await tool.findMultiple(['*.ts']);
      const tsResult = results.get('*.ts');
      expect(tsResult.success).toBe(true);
    });

    it('should handle empty patterns array', async () => {
      const results = await tool.findMultiple([]);
      expect(results.size).toBe(0);
    });
  });

  // =========================================================================
  // globTool singleton
  // =========================================================================

  describe('globTool singleton', () => {
    it('should be an instance of GlobTool', () => {
      expect(globTool).toBeInstanceOf(GlobTool);
    });

    it('should have name "glob"', () => {
      expect(globTool.name).toBe('glob');
    });
  });
});
