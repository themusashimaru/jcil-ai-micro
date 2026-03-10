// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchTool, searchTool } from '../SearchTool';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock minimatch — keep real logic for glob matching tests
vi.mock('minimatch', () => ({
  minimatch: vi.fn((filename: string, pattern: string, _opts: unknown) => {
    // Simple glob simulation for tests
    if (pattern === '*') return true;
    if (pattern === '*.ts') return filename.endsWith('.ts');
    if (pattern === '*.py') return filename.endsWith('.py');
    if (pattern === '*.tsx') return filename.endsWith('.tsx');
    if (pattern === '*.js') return filename.endsWith('.js');
    if (pattern === 'src/**') return filename.startsWith('src/');
    if (pattern === '*.test.ts') return filename.endsWith('.test.ts');
    if (pattern === '*.spec.ts') return filename.endsWith('.spec.ts');
    if (pattern === '{*.ts,*.tsx}') return filename.endsWith('.ts') || filename.endsWith('.tsx');
    if (pattern === '[A-Z]*.ts') return /^[A-Z].*\.ts$/.test(filename);
    if (pattern === '!*.js') return !filename.endsWith('.js');
    if (pattern === '.env') return filename === '.env';
    if (pattern === '.hidden') return filename === '.hidden';
    return filename.toLowerCase().includes(pattern.toLowerCase());
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGitHubConfig() {
  return {
    githubToken: 'ghp_test123',
    owner: 'testowner',
    repo: 'testrepo',
  };
}

function makeContentSearchResponse(items: unknown[], totalCount?: number) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      items,
      total_count: totalCount ?? items.length,
    }),
  };
}

function makeTreeResponse(tree: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ tree }),
  };
}

function makeErrorResponse(status: number) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchTool', () => {
  let tool: SearchTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new SearchTool();
    tool.initialize(makeGitHubConfig());
  });

  // =========================================================================
  // 1. Basic properties
  // =========================================================================

  describe('basic properties', () => {
    it('should have name "search"', () => {
      expect(tool.name).toBe('search');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('should have description mentioning codebase search', () => {
      expect(tool.description.toLowerCase()).toContain('search');
    });
  });

  // =========================================================================
  // 2. Singleton export
  // =========================================================================

  describe('module export', () => {
    it('should export a singleton searchTool instance', () => {
      expect(searchTool).toBeInstanceOf(SearchTool);
    });

    it('singleton should have name "search"', () => {
      expect(searchTool.name).toBe('search');
    });
  });

  // =========================================================================
  // 3. getDefinition
  // =========================================================================

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const def = tool.getDefinition();
      expect(def.name).toBe('search');
      expect(def.parameters.type).toBe('object');
    });

    it('should require query parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('query');
    });

    it('should require type parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('type');
    });

    it('should define query as string type', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.query.type).toBe('string');
    });

    it('should define type with enum values', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.type.enum).toEqual(['content', 'filename', 'symbol']);
    });

    it('should include optional path parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.path).toBeDefined();
      expect(def.parameters.properties.path.type).toBe('string');
    });

    it('should include optional filePattern parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.filePattern).toBeDefined();
    });

    it('should include optional maxResults parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.maxResults).toBeDefined();
      expect(def.parameters.properties.maxResults.type).toBe('number');
    });

    it('should include description for every parameter', () => {
      const def = tool.getDefinition();
      for (const key of Object.keys(def.parameters.properties)) {
        expect(def.parameters.properties[key].description).toBeTruthy();
      }
    });
  });

  // =========================================================================
  // 4. initialize
  // =========================================================================

  describe('initialize', () => {
    it('should accept full GitHub config', () => {
      const freshTool = new SearchTool();
      freshTool.initialize(makeGitHubConfig());
      // No throw = success
      expect(true).toBe(true);
    });

    it('should accept partial config without token', () => {
      const freshTool = new SearchTool();
      freshTool.initialize({ owner: 'o', repo: 'r' });
      expect(true).toBe(true);
    });

    it('should accept empty config', () => {
      const freshTool = new SearchTool();
      freshTool.initialize({});
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // 5. Input validation
  // =========================================================================

  describe('input validation', () => {
    it('should fail when query is missing', async () => {
      const result = await tool.execute({ type: 'content' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('query');
    });

    it('should fail when type is missing', async () => {
      const result = await tool.execute({ query: 'test' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should fail when both query and type are missing', async () => {
      const result = await tool.execute({} as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should fail when query is null', async () => {
      const result = await tool.execute({ query: null, type: 'content' } as any);
      expect(result.success).toBe(false);
    });

    it('should fail when type is null', async () => {
      const result = await tool.execute({ query: 'test', type: null } as any);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 6. GitHub not configured
  // =========================================================================

  describe('GitHub not configured', () => {
    it('should return error when no config at all', async () => {
      const freshTool = new SearchTool();
      const result = await freshTool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub not configured');
    });

    it('should return error when token is missing', async () => {
      const freshTool = new SearchTool();
      freshTool.initialize({ owner: 'o', repo: 'r' });
      const result = await freshTool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub not configured');
    });

    it('should return error when owner is missing', async () => {
      const freshTool = new SearchTool();
      freshTool.initialize({ githubToken: 'tok', repo: 'r' });
      const result = await freshTool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub not configured');
    });

    it('should return error when repo is missing', async () => {
      const freshTool = new SearchTool();
      freshTool.initialize({ githubToken: 'tok', owner: 'o' });
      const result = await freshTool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub not configured');
    });
  });

  // =========================================================================
  // 7. Content search
  // =========================================================================

  describe('content search', () => {
    it('should return matches for valid content search', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([
          {
            path: 'src/index.ts',
            text_matches: [{ fragment: 'hello world', matches: [{ indices: [0, 5] }] }],
          },
        ])
      );

      const result = await tool.execute({ query: 'hello', type: 'content' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(1);
      expect(result.result.matches[0].path).toBe('src/index.ts');
    });

    it('should set line to 1 for content matches', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([
          { path: 'a.ts', text_matches: [{ fragment: 'x', matches: [{ indices: [0] }] }] },
        ])
      );

      const result = await tool.execute({ query: 'x', type: 'content' });
      expect(result.result.matches[0].line).toBe(1);
    });

    it('should extract column from text_match indices', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([
          { path: 'a.ts', text_matches: [{ fragment: 'test', matches: [{ indices: [5] }] }] },
        ])
      );

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.matches[0].column).toBe(5);
    });

    it('should default column to 0 when no indices', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([
          { path: 'a.ts', text_matches: [{ fragment: 'test', matches: [] }] },
        ])
      );

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.matches[0].column).toBe(0);
    });

    it('should handle items with no text_matches', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([{ path: 'b.ts' }]));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(true);
      expect(result.result.matches[0].content).toBe('');
      expect(result.result.matches[0].column).toBe(0);
    });

    it('should pass path filter in GitHub query', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content', path: 'src/lib' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('path:src/lib'));
    });

    it('should pass filePattern as extension filter', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content', filePattern: '*.ts' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('extension:ts'));
    });

    it('should not add extension filter for complex glob patterns', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content', filePattern: '**/*.ts' });
      const calledUrl = mockFetch.mock.calls[0][0];
      // '**/' still contains '*', so extension filter should not be added
      expect(calledUrl).not.toContain(encodeURIComponent('extension:**/'));
    });

    it('should use custom maxResults', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content', maxResults: 5 });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('per_page=5');
    });

    it('should default maxResults to 20', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('per_page=20');
    });

    it('should set truncated to true when totalCount > maxResults', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([{ path: 'a.ts', text_matches: [] }], 100)
      );

      const result = await tool.execute({ query: 'test', type: 'content', maxResults: 5 });
      expect(result.result.truncated).toBe(true);
    });

    it('should set truncated to false when totalCount <= maxResults', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([{ path: 'a.ts', text_matches: [] }], 1)
      );

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.truncated).toBe(false);
    });

    it('should include searchTime in result', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should include executionTime in metadata', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should set empty context on content matches', async () => {
      mockFetch.mockResolvedValueOnce(
        makeContentSearchResponse([
          { path: 'a.ts', text_matches: [{ fragment: 'line', matches: [{ indices: [0] }] }] },
        ])
      );

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.matches[0].context).toEqual({ before: '', after: '' });
    });

    it('should send correct Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer ghp_test123');
    });

    it('should send text-match Accept header', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Accept).toBe('application/vnd.github.v3.text-match+json');
    });

    it('should send correct User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content' });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['User-Agent']).toBe('JCIL-Code-Agent');
    });

    it('should handle empty items array from API', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'nothinghere', type: 'content' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(0);
    });

    it('should handle missing items in API response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ total_count: 0 }),
      });

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(0);
    });
  });

  // =========================================================================
  // 8. Content search - error handling
  // =========================================================================

  describe('content search - error handling', () => {
    it('should handle 403 rate limit error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(403));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });

    it('should handle 404 error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle non-Error throw', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Search failed');
    });

    it('should include executionTime in metadata on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fail'));

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 9. Filename search
  // =========================================================================

  describe('filename search', () => {
    it('should return matching files by name substring', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'blob', path: 'src/SearchTool.ts' },
          { type: 'blob', path: 'src/BashTool.ts' },
          { type: 'blob', path: 'README.md' },
        ])
      );

      const result = await tool.execute({ query: 'Tool', type: 'filename' });
      expect(result.success).toBe(true);
      expect(result.result.matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should be case-insensitive for filename search', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([{ type: 'blob', path: 'src/MyFile.ts' }]));

      const result = await tool.execute({ query: 'myfile', type: 'filename' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(1);
    });

    it('should filter by path when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'blob', path: 'src/utils/helper.ts' },
          { type: 'blob', path: 'lib/helper.ts' },
        ])
      );

      const result = await tool.execute({ query: 'helper', type: 'filename', path: 'src/' });
      expect(result.success).toBe(true);
      // Only the file under src/ should match
      for (const match of result.result.matches) {
        expect(match.path.startsWith('src/')).toBe(true);
      }
    });

    it('should skip non-blob items (directories)', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'tree', path: 'src/tools' },
          { type: 'blob', path: 'src/tools/SearchTool.ts' },
        ])
      );

      const result = await tool.execute({ query: 'tools', type: 'filename' });
      expect(result.success).toBe(true);
      // Only the blob should be returned
      for (const match of result.result.matches) {
        expect(match.path).not.toBe('src/tools');
      }
    });

    it('should set line and column to 0 for filename matches', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([{ type: 'blob', path: 'src/index.ts' }]));

      const result = await tool.execute({ query: 'index', type: 'filename' });
      expect(result.result.matches[0].line).toBe(0);
      expect(result.result.matches[0].column).toBe(0);
    });

    it('should set content to full path for filename matches', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([{ type: 'blob', path: 'src/index.ts' }]));

      const result = await tool.execute({ query: 'index', type: 'filename' });
      expect(result.result.matches[0].content).toBe('src/index.ts');
    });

    it('should respect maxResults for filename search', async () => {
      const tree = Array.from({ length: 50 }, (_, i) => ({
        type: 'blob',
        path: `src/file${i}.ts`,
      }));
      mockFetch.mockResolvedValueOnce(makeTreeResponse(tree));

      const result = await tool.execute({ query: 'file', type: 'filename', maxResults: 3 });
      expect(result.result.matches.length).toBeLessThanOrEqual(3);
    });

    it('should use glob matching for filename patterns', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'blob', path: 'src/helper.ts' },
          { type: 'blob', path: 'src/helper.py' },
        ])
      );

      const result = await tool.execute({ query: '*.ts', type: 'filename' });
      expect(result.success).toBe(true);
      expect(result.result.matches.some((m: any) => m.path === 'src/helper.ts')).toBe(true);
    });

    it('should handle empty tree response', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([]));

      const result = await tool.execute({ query: 'anything', type: 'filename' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(0);
    });

    it('should handle missing tree in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });

      const result = await tool.execute({ query: 'test', type: 'filename' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(0);
    });

    it('should use tree API URL with recursive=1', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([]));

      await tool.execute({ query: 'test', type: 'filename' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/git/trees/HEAD?recursive=1');
    });

    it('should throw on API error during filename search', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      const result = await tool.execute({ query: 'test', type: 'filename' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should set empty context for filename matches', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([{ type: 'blob', path: 'file.ts' }]));

      const result = await tool.execute({ query: 'file', type: 'filename' });
      expect(result.result.matches[0].context).toEqual({ before: '', after: '' });
    });
  });

  // =========================================================================
  // 10. Symbol search
  // =========================================================================

  describe('symbol search', () => {
    it('should search for function, const, and let patterns', async () => {
      // Symbol search calls searchContent up to 3 times
      mockFetch.mockResolvedValue(makeContentSearchResponse([]));

      await tool.execute({ query: 'myFunc', type: 'symbol' });
      // Should have called fetch for up to 3 symbol patterns
      expect(mockFetch).toHaveBeenCalled();
      const callCount = mockFetch.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(3);
    });

    it('should combine results from multiple symbol patterns', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeContentSearchResponse([
            {
              path: 'a.ts',
              text_matches: [{ fragment: 'function myFunc', matches: [{ indices: [0] }] }],
            },
          ])
        )
        .mockResolvedValueOnce(
          makeContentSearchResponse([
            {
              path: 'b.ts',
              text_matches: [{ fragment: 'const myFunc', matches: [{ indices: [0] }] }],
            },
          ])
        )
        .mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'myFunc', type: 'symbol' });
      expect(result.success).toBe(true);
      expect(result.result.matches.length).toBe(2);
    });

    it('should deduplicate results by path', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeContentSearchResponse([
            {
              path: 'same.ts',
              text_matches: [{ fragment: 'function x', matches: [{ indices: [0] }] }],
            },
          ])
        )
        .mockResolvedValueOnce(
          makeContentSearchResponse([
            {
              path: 'same.ts',
              text_matches: [{ fragment: 'const x', matches: [{ indices: [0] }] }],
            },
          ])
        )
        .mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'x', type: 'symbol' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(1);
      expect(result.result.matches[0].path).toBe('same.ts');
    });

    it('should respect maxResults in symbol search', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        path: `file${i}.ts`,
        text_matches: [{ fragment: `function f${i}`, matches: [{ indices: [0] }] }],
      }));

      mockFetch
        .mockResolvedValueOnce(makeContentSearchResponse(items))
        .mockResolvedValueOnce(makeContentSearchResponse([]))
        .mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'f', type: 'symbol', maxResults: 2 });
      expect(result.result.matches.length).toBeLessThanOrEqual(2);
    });

    it('should pass path filter to symbol search', async () => {
      mockFetch.mockResolvedValue(makeContentSearchResponse([]));

      await tool.execute({ query: 'myFunc', type: 'symbol', path: 'src/lib' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('path:src/lib'));
    });

    it('should pass filePattern to symbol search', async () => {
      mockFetch.mockResolvedValue(makeContentSearchResponse([]));

      await tool.execute({ query: 'myFunc', type: 'symbol', filePattern: '*.ts' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('extension:ts'));
    });

    it('should tolerate individual pattern search failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(
          makeContentSearchResponse([
            { path: 'a.ts', text_matches: [{ fragment: 'const x', matches: [{ indices: [0] }] }] },
          ])
        )
        .mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'x', type: 'symbol' });
      expect(result.success).toBe(true);
      expect(result.result.matches.length).toBeGreaterThanOrEqual(1);
    });

    it('should succeed with empty results when all patterns fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      const result = await tool.execute({ query: 'x', type: 'symbol' });
      expect(result.success).toBe(true);
      expect(result.result.matches).toHaveLength(0);
    });
  });

  // =========================================================================
  // 11. Unknown search type
  // =========================================================================

  describe('unknown search type', () => {
    it('should return error for unknown type', async () => {
      const result = await tool.execute({ query: 'test', type: 'regex' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown search type');
    });

    it('should include the unknown type in error message', async () => {
      const result = await tool.execute({ query: 'test', type: 'foobar' } as any);
      expect(result.error).toContain('foobar');
    });
  });

  // =========================================================================
  // 12. getFileTree
  // =========================================================================

  describe('getFileTree', () => {
    it('should return list of file paths', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'blob', path: 'src/index.ts' },
          { type: 'blob', path: 'src/util.ts' },
          { type: 'tree', path: 'src' },
        ])
      );

      const files = await tool.getFileTree();
      expect(files).toEqual(['src/index.ts', 'src/util.ts']);
    });

    it('should filter by path when provided', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'blob', path: 'src/index.ts' },
          { type: 'blob', path: 'lib/helper.ts' },
        ])
      );

      const files = await tool.getFileTree('src/');
      expect(files).toEqual(['src/index.ts']);
    });

    it('should return empty array when no files match', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([{ type: 'tree', path: 'src' }]));

      const files = await tool.getFileTree();
      expect(files).toEqual([]);
    });

    it('should throw when GitHub not configured', async () => {
      const freshTool = new SearchTool();
      await expect(freshTool.getFileTree()).rejects.toThrow('GitHub not configured');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      await expect(tool.getFileTree()).rejects.toThrow('GitHub API error: 500');
    });

    it('should handle missing tree in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      });

      const files = await tool.getFileTree();
      expect(files).toEqual([]);
    });

    it('should call correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([]));

      await tool.getFileTree();
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toBe(
        'https://api.github.com/repos/testowner/testrepo/git/trees/HEAD?recursive=1'
      );
    });

    it('should send correct headers', async () => {
      mockFetch.mockResolvedValueOnce(makeTreeResponse([]));

      await tool.getFileTree();
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer ghp_test123');
      expect(headers.Accept).toBe('application/vnd.github.v3+json');
      expect(headers['User-Agent']).toBe('JCIL-Code-Agent');
    });

    it('should only return blobs, not trees', async () => {
      mockFetch.mockResolvedValueOnce(
        makeTreeResponse([
          { type: 'tree', path: 'src' },
          { type: 'tree', path: 'lib' },
          { type: 'blob', path: 'package.json' },
          { type: 'commit', path: 'submodule' },
        ])
      );

      const files = await tool.getFileTree();
      expect(files).toEqual(['package.json']);
    });
  });

  // =========================================================================
  // 13. Edge cases & integration-style tests
  // =========================================================================

  describe('edge cases', () => {
    it('should handle special characters in query', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'foo.bar()', type: 'content' });
      expect(result.success).toBe(true);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('foo.bar()'));
    });

    it('should handle unicode in query', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const result = await tool.execute({ query: 'こんにちは', type: 'content' });
      expect(result.success).toBe(true);
    });

    it('should handle very long query strings', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      const longQuery = 'a'.repeat(500);
      const result = await tool.execute({ query: longQuery, type: 'content' });
      expect(result.success).toBe(true);
    });

    it('should include repo info in search query URL', async () => {
      mockFetch.mockResolvedValueOnce(makeContentSearchResponse([]));

      await tool.execute({ query: 'test', type: 'content' });
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain(encodeURIComponent('repo:testowner/testrepo'));
    });

    it('should handle totalCount of 0 gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ items: [], total_count: 0 }),
      });

      const result = await tool.execute({ query: 'nothing', type: 'content' });
      expect(result.result.totalCount).toBe(0);
      expect(result.result.truncated).toBe(false);
    });

    it('should handle missing total_count in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ items: [] }),
      });

      const result = await tool.execute({ query: 'test', type: 'content' });
      expect(result.result.totalCount).toBe(0);
    });
  });
});
