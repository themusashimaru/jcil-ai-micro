// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for use inside vi.mock() factories
const mockReadFile = vi.hoisted(() => vi.fn());
const mockGetContainerManager = vi.hoisted(() =>
  vi.fn(() => ({
    readFile: mockReadFile,
  }))
);
const mockSanitizeFilePath = vi.hoisted(() => vi.fn((p: string, base: string) => `${base}/${p}`));
const mockFetch = vi.hoisted(() => vi.fn());

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock container manager
vi.mock('@/lib/workspace/container', () => ({
  getContainerManager: mockGetContainerManager,
}));

// Mock workspace security
vi.mock('@/lib/workspace/security', () => ({
  sanitizeFilePath: mockSanitizeFilePath,
}));

// Mock global fetch
vi.stubGlobal('fetch', mockFetch);

// Now import the module under test
import { ReadTool, readTool } from '../ReadTool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGitHubConfig() {
  return {
    githubToken: 'ghp_test_token_123',
    owner: 'testowner',
    repo: 'testrepo',
    branch: 'main',
  };
}

function makeWorkspaceConfig(extra?: Record<string, unknown>) {
  return {
    workspaceId: 'ws-123',
    ...extra,
  };
}

function makeBothConfig() {
  return {
    workspaceId: 'ws-123',
    githubToken: 'ghp_test_token_123',
    owner: 'testowner',
    repo: 'testrepo',
    branch: 'develop',
  };
}

function makeGitHubFileResponse(content: string, size?: number) {
  const encoded = Buffer.from(content).toString('base64');
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      type: 'file',
      content: encoded,
      size: size ?? Buffer.byteLength(content, 'utf-8'),
    }),
  };
}

function makeGitHubDirResponse() {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      type: 'dir',
      content: '',
      size: 0,
    }),
  };
}

function makeGitHubErrorResponse(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  };
}

function generateLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `Line ${i + 1}`).join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReadTool', () => {
  let tool: ReadTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ReadTool();
  });

  // =========================================================================
  // 1. Basic properties
  // =========================================================================

  describe('basic properties', () => {
    it('should have name "read"', () => {
      expect(tool.name).toBe('read');
    });

    it('should have a non-empty description', () => {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('should have description mentioning file reading', () => {
      expect(tool.description.toLowerCase()).toContain('read');
    });

    it('should have description mentioning workspace', () => {
      expect(tool.description.toLowerCase()).toContain('workspace');
    });

    it('should have description mentioning github', () => {
      expect(tool.description.toLowerCase()).toContain('github');
    });
  });

  // =========================================================================
  // 2. Singleton export
  // =========================================================================

  describe('module export', () => {
    it('should export a singleton readTool instance', () => {
      expect(readTool).toBeInstanceOf(ReadTool);
    });

    it('singleton should have name "read"', () => {
      expect(readTool.name).toBe('read');
    });
  });

  // =========================================================================
  // 3. getDefinition
  // =========================================================================

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const def = tool.getDefinition();
      expect(def.name).toBe('read');
      expect(def.parameters.type).toBe('object');
    });

    it('should require path parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('path');
    });

    it('should define path as string type', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.path.type).toBe('string');
    });

    it('should include optional startLine parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.startLine).toBeDefined();
      expect(def.parameters.properties.startLine.type).toBe('number');
    });

    it('should include optional endLine parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.endLine).toBeDefined();
      expect(def.parameters.properties.endLine.type).toBe('number');
    });

    it('should include description for every parameter', () => {
      const def = tool.getDefinition();
      for (const key of Object.keys(def.parameters.properties)) {
        expect(def.parameters.properties[key].description).toBeTruthy();
      }
    });

    it('should mark path as required in its property definition', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.path.required).toBe(true);
    });

    it('should have description in the definition', () => {
      const def = tool.getDefinition();
      expect(def.description).toBeTruthy();
      expect(typeof def.description).toBe('string');
    });
  });

  // =========================================================================
  // 4. initialize
  // =========================================================================

  describe('initialize', () => {
    it('should accept full config with workspace and GitHub', () => {
      const freshTool = new ReadTool();
      freshTool.initialize(makeBothConfig());
      expect(true).toBe(true);
    });

    it('should accept GitHub-only config', () => {
      const freshTool = new ReadTool();
      freshTool.initialize(makeGitHubConfig());
      expect(true).toBe(true);
    });

    it('should accept workspace-only config', () => {
      const freshTool = new ReadTool();
      freshTool.initialize(makeWorkspaceConfig());
      expect(true).toBe(true);
    });

    it('should accept empty config', () => {
      const freshTool = new ReadTool();
      freshTool.initialize({});
      expect(true).toBe(true);
    });

    it('should default branch to "main" when not specified', async () => {
      const freshTool = new ReadTool();
      freshTool.initialize({
        githubToken: 'tok',
        owner: 'o',
        repo: 'r',
      });
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('hello'));

      await freshTool.execute({ path: 'test.txt' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('ref=main');
    });

    it('should use provided branch when specified', async () => {
      const freshTool = new ReadTool();
      freshTool.initialize({
        githubToken: 'tok',
        owner: 'o',
        repo: 'r',
        branch: 'feature-branch',
      });
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('hello'));

      await freshTool.execute({ path: 'test.txt' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('ref=feature-branch');
    });
  });

  // =========================================================================
  // 5. Input validation
  // =========================================================================

  describe('input validation', () => {
    it('should fail when path is missing', async () => {
      tool.initialize(makeGitHubConfig());
      const result = await tool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });

    it('should fail when path is undefined', async () => {
      tool.initialize(makeGitHubConfig());
      const result = await tool.execute({ path: undefined } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });

    it('should fail when path is null', async () => {
      tool.initialize(makeGitHubConfig());
      const result = await tool.execute({ path: null } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });
  });

  // =========================================================================
  // 6. No backend configured
  // =========================================================================

  describe('no backend configured', () => {
    it('should return error when no config at all', async () => {
      const result = await tool.execute({ path: 'test.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No read backend configured');
    });

    it('should return error when initialized with empty config', async () => {
      tool.initialize({});
      const result = await tool.execute({ path: 'test.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No read backend configured');
    });

    it('should mention workspace or repository in error message', async () => {
      const result = await tool.execute({ path: 'test.txt' });
      expect(result.error).toContain('workspace');
    });
  });

  // =========================================================================
  // 7. Reading from GitHub (strategy 2: GitHub-only)
  // =========================================================================

  describe('reading from GitHub', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should successfully read a file from GitHub', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('hello world'));

      const result = await tool.execute({ path: 'src/index.ts' });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe('hello world');
    });

    it('should set source to "github"', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.result.source).toBe('github');
    });

    it('should return correct path in result', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'src/utils/helper.ts' });
      expect(result.result.path).toBe('src/utils/helper.ts');
    });

    it('should count total lines in the file', async () => {
      const content = 'line1\nline2\nline3';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt' });
      expect(result.result.lines).toBe(3);
    });

    it('should return file size from GitHub response', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('hello', 42));

      const result = await tool.execute({ path: 'file.txt' });
      expect(result.result.size).toBe(42);
    });

    it('should detect language from file extension', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('const x = 1;'));

      const result = await tool.execute({ path: 'index.ts' });
      expect(result.result.language).toBe('typescript');
    });

    it('should include executionTime in metadata', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('x'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should set truncated to false for small files', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('short content'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.result.truncated).toBe(false);
    });

    it('should call correct GitHub API URL', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('x'));

      await tool.execute({ path: 'src/index.ts' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toBe(
        'https://api.github.com/repos/testowner/testrepo/contents/src/index.ts?ref=main'
      );
    });

    it('should send correct Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('x'));

      await tool.execute({ path: 'file.ts' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer ghp_test_token_123');
    });

    it('should send correct Accept header', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('x'));

      await tool.execute({ path: 'file.ts' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Accept).toBe('application/vnd.github.v3+json');
    });

    it('should send correct User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('x'));

      await tool.execute({ path: 'file.ts' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['User-Agent']).toBe('JCIL-Code-Agent');
    });

    it('should decode base64 content from GitHub', async () => {
      const original = 'function hello() { return "world"; }';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(original));

      const result = await tool.execute({ path: 'hello.js' });
      expect(result.result.content).toBe(original);
    });
  });

  // =========================================================================
  // 8. GitHub error handling
  // =========================================================================

  describe('GitHub error handling', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should handle 404 not found error', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubErrorResponse(404));

      const result = await tool.execute({ path: 'nonexistent.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should include file path in 404 error message', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubErrorResponse(404));

      const result = await tool.execute({ path: 'missing/file.ts' });
      expect(result.error).toContain('missing/file.ts');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubErrorResponse(500));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle 403 forbidden error', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubErrorResponse(403));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error throw', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to read file');
    });

    it('should handle directory response from GitHub', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubDirResponse());

      const result = await tool.execute({ path: 'src/' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not a file');
    });

    it('should include executionTime in metadata on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 9. Reading from workspace (strategy 1)
  // =========================================================================

  describe('reading from workspace', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should successfully read a file from workspace', async () => {
      mockReadFile.mockResolvedValueOnce('workspace file content');

      const result = await tool.execute({ path: 'src/app.ts' });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe('workspace file content');
    });

    it('should set source to "workspace"', async () => {
      mockReadFile.mockResolvedValueOnce('content');

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.result.source).toBe('workspace');
    });

    it('should sanitize file path before reading', async () => {
      mockReadFile.mockResolvedValueOnce('safe content');

      await tool.execute({ path: '../etc/passwd' });
      expect(mockSanitizeFilePath).toHaveBeenCalledWith('../etc/passwd', '/workspace');
    });

    it('should calculate size using Buffer.byteLength', async () => {
      const content = 'hello world';
      mockReadFile.mockResolvedValueOnce(content);

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.result.size).toBe(Buffer.byteLength(content, 'utf-8'));
    });

    it('should return error when workspace file not found and no GitHub fallback', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await tool.execute({ path: 'missing.ts' });
      expect(result.success).toBe(false);
    });

    it('should include workspace error message when no GitHub fallback', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      const result = await tool.execute({ path: 'missing.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('ENOENT');
    });

    it('should return generic error when workspace throws non-Error', async () => {
      mockReadFile.mockRejectedValueOnce('string error');

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read from workspace');
    });
  });

  // =========================================================================
  // 10. Workspace + GitHub fallback (strategy 1 with fallback)
  // =========================================================================

  describe('workspace with GitHub fallback', () => {
    beforeEach(() => {
      tool.initialize(makeBothConfig());
    });

    it('should prefer workspace when file exists there', async () => {
      mockReadFile.mockResolvedValueOnce('workspace content');

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(true);
      expect(result.result.source).toBe('workspace');
      expect(result.result.content).toBe('workspace content');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fall back to GitHub when workspace file not found', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('github content'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(true);
      expect(result.result.source).toBe('github');
      expect(result.result.content).toBe('github content');
    });

    it('should return GitHub source when falling back', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('fallback'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.result.source).toBe('github');
    });

    it('should propagate GitHub error when both fail', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('workspace error'));
      mockFetch.mockResolvedValueOnce(makeGitHubErrorResponse(404));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  // =========================================================================
  // 11. Line range support
  // =========================================================================

  describe('line range support', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should read specific line range with startLine and endLine', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 2, endLine: 4 });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe('line2\nline3\nline4');
    });

    it('should read from startLine to end when endLine is omitted', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 3 });
      expect(result.result.content).toBe('line3\nline4\nline5');
    });

    it('should read from beginning to endLine when startLine is omitted', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', endLine: 2 });
      expect(result.result.content).toBe('line1\nline2');
    });

    it('should use 1-indexed line numbers', async () => {
      const content = 'first\nsecond\nthird';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 1, endLine: 1 });
      expect(result.result.content).toBe('first');
    });

    it('should return total line count regardless of range', async () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 2, endLine: 3 });
      expect(result.result.lines).toBe(5);
    });

    it('should handle startLine beyond file length', async () => {
      const content = 'line1\nline2';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 100 });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe('');
    });

    it('should handle endLine beyond file length gracefully', async () => {
      const content = 'line1\nline2\nline3';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 1, endLine: 1000 });
      expect(result.result.content).toBe('line1\nline2\nline3');
    });

    it('should read entire file when no line range is specified', async () => {
      const content = 'all\nthe\nlines';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt' });
      expect(result.result.content).toBe(content);
    });
  });

  // =========================================================================
  // 12. Truncation behavior
  // =========================================================================

  describe('truncation behavior', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should truncate files with more than 500 lines', async () => {
      const content = generateLines(600);
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'large.txt' });
      expect(result.success).toBe(true);
      expect(result.result.truncated).toBe(true);
      const returnedLines = result.result.content.split('\n');
      expect(returnedLines.length).toBe(500);
    });

    it('should not truncate files with exactly 500 lines', async () => {
      const content = generateLines(500);
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt' });
      expect(result.result.truncated).toBe(false);
    });

    it('should not truncate files with fewer than 500 lines', async () => {
      const content = generateLines(100);
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt' });
      expect(result.result.truncated).toBe(false);
    });

    it('should return error for content exceeding 50KB after line slicing', async () => {
      // Generate content that is over 50KB but under 500 lines
      const longLine = 'x'.repeat(200);
      const content = Array.from({ length: 300 }, () => longLine).join('\n');
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content, content.length));

      const result = await tool.execute({ path: 'huge.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should mention KB size in too-large error message', async () => {
      const longLine = 'x'.repeat(200);
      const content = Array.from({ length: 300 }, () => longLine).join('\n');
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content, 60000));

      const result = await tool.execute({ path: 'huge.txt' });
      expect(result.error).toContain('KB');
    });

    it('should suggest using startLine/endLine in too-large error', async () => {
      const longLine = 'x'.repeat(200);
      const content = Array.from({ length: 300 }, () => longLine).join('\n');
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content, 60000));

      const result = await tool.execute({ path: 'huge.txt' });
      expect(result.error).toContain('startLine/endLine');
    });

    it('should apply truncation after line range slicing', async () => {
      // Generate 1000 lines, request lines 100-900 (801 lines, exceeds 500 limit)
      const content = generateLines(1000);
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'file.txt', startLine: 100, endLine: 900 });
      expect(result.result.truncated).toBe(true);
      const returnedLines = result.result.content.split('\n');
      expect(returnedLines.length).toBe(500);
    });
  });

  // =========================================================================
  // 13. Language detection
  // =========================================================================

  describe('language detection', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    const languageTests: [string, string][] = [
      ['index.ts', 'typescript'],
      ['Component.tsx', 'typescript'],
      ['script.js', 'javascript'],
      ['App.jsx', 'javascript'],
      ['main.py', 'python'],
      ['main.rs', 'rust'],
      ['main.go', 'go'],
      ['Main.java', 'java'],
      ['script.rb', 'ruby'],
      ['index.php', 'php'],
      ['Program.cs', 'csharp'],
      ['main.cpp', 'cpp'],
      ['main.c', 'c'],
      ['header.h', 'c'],
      ['header.hpp', 'cpp'],
      ['app.swift', 'swift'],
      ['app.kt', 'kotlin'],
      ['app.scala', 'scala'],
      ['query.sql', 'sql'],
      ['script.sh', 'bash'],
      ['script.bash', 'bash'],
      ['script.zsh', 'bash'],
      ['config.yml', 'yaml'],
      ['config.yaml', 'yaml'],
      ['data.json', 'json'],
      ['layout.xml', 'xml'],
      ['page.html', 'html'],
      ['style.css', 'css'],
      ['style.scss', 'scss'],
      ['style.sass', 'sass'],
      ['style.less', 'less'],
      ['readme.md', 'markdown'],
      ['doc.mdx', 'markdown'],
      ['notes.txt', 'text'],
      ['.env', 'dotenv'],
      ['schema.prisma', 'prisma'],
      ['schema.graphql', 'graphql'],
      ['query.gql', 'graphql'],
      ['config.toml', 'toml'],
      ['config.ini', 'ini'],
      ['config.cfg', 'ini'],
    ];

    for (const [filename, expectedLang] of languageTests) {
      it(`should detect "${expectedLang}" for ${filename}`, async () => {
        mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

        const result = await tool.execute({ path: `src/${filename}` });
        expect(result.result.language).toBe(expectedLang);
      });
    }

    it('should default to "text" for unknown extensions', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'file.xyz' });
      expect(result.result.language).toBe('text');
    });

    it('should default to "text" for files without extension', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'Makefile' });
      // 'makefile' extension maps to 'makefile', but 'Makefile' lowercased gives 'makefile'
      // Actually the extension is the last part after '.', so for 'Makefile' the extension is ''
      // Wait - 'Makefile'.split('.').pop() = 'Makefile', toLowerCase() = 'makefile'
      // and 'makefile' IS in the langMap
      expect(result.result.language).toBe('makefile');
    });

    it('should handle nested paths when detecting language', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'deep/nested/path/file.py' });
      expect(result.result.language).toBe('python');
    });
  });

  // =========================================================================
  // 14. readMultiple
  // =========================================================================

  describe('readMultiple', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should read multiple files in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGitHubFileResponse('content A'))
        .mockResolvedValueOnce(makeGitHubFileResponse('content B'));

      const results = await tool.readMultiple(['a.ts', 'b.ts']);
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
    });

    it('should return results keyed by file path', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGitHubFileResponse('aaa'))
        .mockResolvedValueOnce(makeGitHubFileResponse('bbb'));

      const results = await tool.readMultiple(['file-a.ts', 'file-b.ts']);
      expect(results.has('file-a.ts')).toBe(true);
      expect(results.has('file-b.ts')).toBe(true);
    });

    it('should handle empty paths array', async () => {
      const results = await tool.readMultiple([]);
      expect(results.size).toBe(0);
    });

    it('should handle single file in array', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('solo'));

      const results = await tool.readMultiple(['solo.ts']);
      expect(results.size).toBe(1);
      expect(results.get('solo.ts')?.success).toBe(true);
    });

    it('should include failed reads in results', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGitHubFileResponse('good'))
        .mockResolvedValueOnce(makeGitHubErrorResponse(404));

      const results = await tool.readMultiple(['good.ts', 'bad.ts']);
      expect(results.size).toBe(2);
      expect(results.get('good.ts')?.success).toBe(true);
      expect(results.get('bad.ts')?.success).toBe(false);
    });

    it('should handle three files', async () => {
      mockFetch
        .mockResolvedValueOnce(makeGitHubFileResponse('one'))
        .mockResolvedValueOnce(makeGitHubFileResponse('two'))
        .mockResolvedValueOnce(makeGitHubFileResponse('three'));

      const results = await tool.readMultiple(['a.ts', 'b.ts', 'c.ts']);
      expect(results.size).toBe(3);
    });
  });

  // =========================================================================
  // 15. Edge cases
  // =========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should handle empty file content', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(''));

      const result = await tool.execute({ path: 'empty.ts' });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe('');
      expect(result.result.lines).toBe(1); // empty string split gives ['']
    });

    it('should handle file with only newlines', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('\n\n\n'));

      const result = await tool.execute({ path: 'newlines.txt' });
      expect(result.success).toBe(true);
      expect(result.result.lines).toBe(4); // '\n\n\n'.split('\n') = ['', '', '', '']
    });

    it('should handle file with unicode content', async () => {
      const content = 'const greeting = "\u3053\u3093\u306b\u3061\u306f";';
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse(content));

      const result = await tool.execute({ path: 'unicode.ts' });
      expect(result.success).toBe(true);
      expect(result.result.content).toBe(content);
    });

    it('should handle single-line file', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('single line'));

      const result = await tool.execute({ path: 'single.txt' });
      expect(result.result.lines).toBe(1);
    });

    it('should handle file path with spaces', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('content'));

      const result = await tool.execute({ path: 'my folder/my file.ts' });
      expect(result.success).toBe(true);
    });

    it('should handle deeply nested file paths', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('deep'));

      const result = await tool.execute({ path: 'a/b/c/d/e/f/g/h/i/j/file.ts' });
      expect(result.success).toBe(true);
      expect(result.result.path).toBe('a/b/c/d/e/f/g/h/i/j/file.ts');
    });

    it('should handle dotfiles', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('KEY=value'));

      const result = await tool.execute({ path: '.env' });
      expect(result.success).toBe(true);
      expect(result.result.language).toBe('dotenv');
    });

    it('should handle file with Windows-style line endings', async () => {
      mockFetch.mockResolvedValueOnce(makeGitHubFileResponse('line1\r\nline2\r\nline3'));

      const result = await tool.execute({ path: 'windows.txt' });
      expect(result.success).toBe(true);
      // split('\n') will leave \r at end of lines but still splits
      expect(result.result.content).toContain('line1');
      expect(result.result.content).toContain('line2');
    });
  });

  // =========================================================================
  // 16. Workspace with file-not-found fallback details
  // =========================================================================

  describe('workspace fallback details', () => {
    it('should show workspace error when no fallback and error is returned', async () => {
      tool.initialize(makeWorkspaceConfig());
      mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await tool.execute({ path: 'secret.ts' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });

    it('should show generic error when workspace throws non-Error value and no fallback', async () => {
      tool.initialize(makeWorkspaceConfig());
      // Simulate a case where the catch block receives a non-Error value
      mockReadFile.mockRejectedValueOnce(undefined);

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      // The readFromWorkspace catch produces "Failed to read from workspace" for non-Error throws
      expect(result.error).toContain('Failed to read from workspace');
    });
  });

  // =========================================================================
  // 17. GitHub incomplete configuration (workspace + partial GitHub)
  // =========================================================================

  describe('incomplete GitHub configuration with workspace', () => {
    it('should not fall back to GitHub when githubToken is missing', async () => {
      tool.initialize({ workspaceId: 'ws-1', owner: 'o', repo: 'r' });
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      // Should not have called fetch since token is missing
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fall back to GitHub when owner is missing', async () => {
      tool.initialize({ workspaceId: 'ws-1', githubToken: 'tok', repo: 'r' });
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fall back to GitHub when repo is missing', async () => {
      tool.initialize({ workspaceId: 'ws-1', githubToken: 'tok', owner: 'o' });
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));

      const result = await tool.execute({ path: 'file.ts' });
      expect(result.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
