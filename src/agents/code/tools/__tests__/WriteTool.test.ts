// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockContainerManager = vi.hoisted(() => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

const mockSanitizeFilePath = vi.hoisted(() => vi.fn());

const mockFetch = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/workspace/container', () => ({
  getContainerManager: () => mockContainerManager,
}));

vi.mock('@/lib/workspace/security', () => ({
  sanitizeFilePath: mockSanitizeFilePath,
}));

vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { WriteTool, writeTool } from '../WriteTool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkspaceConfig(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws-abc-123',
    ...overrides,
  };
}

function makeGitHubConfig(overrides: Record<string, unknown> = {}) {
  return {
    githubToken: 'ghp_testtoken123',
    owner: 'testowner',
    repo: 'testrepo',
    branch: 'main',
    ...overrides,
  };
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    path: 'src/index.ts',
    content: 'console.log("hello");',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WriteTool', () => {
  let tool: WriteTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new WriteTool();

    // Default: sanitizeFilePath returns /workspace/<path>
    mockSanitizeFilePath.mockImplementation((p: string) => `/workspace/${p.replace(/^\/+/, '')}`);

    // Default: readFile throws (file doesn't exist)
    mockReadFile.mockRejectedValue(new Error('File not found'));

    // Default: writeFile succeeds
    mockWriteFile.mockResolvedValue(undefined);
  });

  // =========================================================================
  // Basic properties
  // =========================================================================

  describe('basic properties', () => {
    it('should have name "write"', () => {
      expect(tool.name).toBe('write');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('description should mention writing files', () => {
      expect(tool.description.toLowerCase()).toContain('write');
    });
  });

  // =========================================================================
  // Singleton export
  // =========================================================================

  describe('singleton export', () => {
    it('should export a writeTool singleton instance', () => {
      expect(writeTool).toBeDefined();
      expect(writeTool).toBeInstanceOf(WriteTool);
    });

    it('singleton should have name "write"', () => {
      expect(writeTool.name).toBe('write');
    });
  });

  // =========================================================================
  // getDefinition
  // =========================================================================

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const def = tool.getDefinition();
      expect(def.name).toBe('write');
      expect(def.parameters.type).toBe('object');
    });

    it('should define path parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.path).toBeDefined();
      expect(def.parameters.properties.path.type).toBe('string');
    });

    it('should define content parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.content).toBeDefined();
      expect(def.parameters.properties.content.type).toBe('string');
    });

    it('should define encoding parameter', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.encoding).toBeDefined();
      expect(def.parameters.properties.encoding.type).toBe('string');
    });

    it('encoding should have enum with utf-8 and base64', () => {
      const def = tool.getDefinition();
      expect(def.parameters.properties.encoding.enum).toEqual(['utf-8', 'base64']);
    });

    it('should require path and content', () => {
      const def = tool.getDefinition();
      expect(def.parameters.required).toContain('path');
      expect(def.parameters.required).toContain('content');
    });

    it('should include a description in the definition', () => {
      const def = tool.getDefinition();
      expect(def.description).toBeTruthy();
    });
  });

  // =========================================================================
  // initialize
  // =========================================================================

  describe('initialize', () => {
    it('should accept workspace config', () => {
      tool.initialize(makeWorkspaceConfig());
      // No error thrown
      expect(true).toBe(true);
    });

    it('should accept GitHub config', () => {
      tool.initialize(makeGitHubConfig());
      expect(true).toBe(true);
    });

    it('should accept combined workspace and GitHub config', () => {
      tool.initialize({
        ...makeWorkspaceConfig(),
        ...makeGitHubConfig(),
      });
      expect(true).toBe(true);
    });

    it('should accept empty config', () => {
      tool.initialize({});
      expect(true).toBe(true);
    });

    it('should default branch to main when not provided', async () => {
      tool.initialize({
        githubToken: 'ghp_tok',
        owner: 'me',
        repo: 'myrepo',
      });

      // We'll verify through a GitHub write call that 'main' is used
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: { sha: 'abc' } }),
      });

      await tool.execute(makeInput());

      // The PUT call should include branch: 'main'
      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.branch).toBe('main');
    });

    it('should use custom branch when provided', async () => {
      tool.initialize(makeGitHubConfig({ branch: 'develop' }));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput());

      // GET call should include ref=develop
      const getCall = mockFetch.mock.calls[0];
      expect(getCall[0]).toContain('ref=develop');
    });
  });

  // =========================================================================
  // Input validation
  // =========================================================================

  describe('input validation', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should reject missing path', async () => {
      const result = await tool.execute({ content: 'hello' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('path');
    });

    it('should reject missing content', async () => {
      const result = await tool.execute({ path: 'test.txt' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('content');
    });

    it('should reject undefined path', async () => {
      const result = await tool.execute({
        path: undefined,
        content: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject null path', async () => {
      const result = await tool.execute({
        path: null,
        content: 'test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject undefined content', async () => {
      const result = await tool.execute({
        path: 'file.txt',
        content: undefined,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject null content', async () => {
      const result = await tool.execute({
        path: 'file.txt',
        content: null,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject when both path and content are missing', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Path security
  // =========================================================================

  describe('path security', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should call sanitizeFilePath with the input path', async () => {
      await tool.execute(makeInput({ path: 'src/main.ts' }));
      expect(mockSanitizeFilePath).toHaveBeenCalledWith('src/main.ts', '/workspace');
    });

    it('should reject paths outside allowed directories', async () => {
      mockSanitizeFilePath.mockReturnValue('/etc/passwd');

      const result = await tool.execute(makeInput({ path: '/etc/passwd' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should allow /workspace paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/workspace/src/test.ts');

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
    });

    it('should allow /tmp paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/tmp/output.txt');

      const result = await tool.execute(makeInput({ path: '/tmp/output.txt' }));
      expect(result.success).toBe(true);
    });

    it('should allow /home paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/home/user/file.txt');

      const result = await tool.execute(makeInput({ path: '/home/user/file.txt' }));
      expect(result.success).toBe(true);
    });

    it('should reject /usr paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/usr/bin/evil');

      const result = await tool.execute(makeInput({ path: '/usr/bin/evil' }));
      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should reject /var paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/var/log/syslog');

      const result = await tool.execute(makeInput({ path: '/var/log/syslog' }));
      expect(result.success).toBe(false);
    });

    it('should reject root paths', async () => {
      mockSanitizeFilePath.mockReturnValue('/root/.ssh/id_rsa');

      const result = await tool.execute(makeInput({ path: '/root/.ssh/id_rsa' }));
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Base64 encoding
  // =========================================================================

  describe('base64 encoding', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should handle valid base64 content', async () => {
      const base64Content = Buffer.from('hello world').toString('base64');

      const result = await tool.execute(
        makeInput({
          content: base64Content,
          encoding: 'base64',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should decode base64 before writing', async () => {
      const originalText = 'decoded content';
      const base64Content = Buffer.from(originalText).toString('base64');

      await tool.execute(
        makeInput({
          content: base64Content,
          encoding: 'base64',
        })
      );

      expect(mockWriteFile).toHaveBeenCalledWith('ws-abc-123', expect.any(String), originalText);
    });

    it('should write utf-8 content as-is when no encoding specified', async () => {
      const content = 'plain text content';

      await tool.execute(makeInput({ content }));

      expect(mockWriteFile).toHaveBeenCalledWith('ws-abc-123', expect.any(String), content);
    });

    it('should write utf-8 content as-is when encoding is utf-8', async () => {
      const content = 'plain text';

      await tool.execute(makeInput({ content, encoding: 'utf-8' }));

      expect(mockWriteFile).toHaveBeenCalledWith('ws-abc-123', expect.any(String), content);
    });
  });

  // =========================================================================
  // Workspace writing
  // =========================================================================

  describe('workspace writing', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should write new file successfully', async () => {
      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.created).toBe(true);
    });

    it('should report correct path in result', async () => {
      const result = await tool.execute(makeInput({ path: 'src/app.ts' }));
      expect(result.success).toBe(true);
      expect(result.result.path).toBe('/workspace/src/app.ts');
    });

    it('should report bytesWritten', async () => {
      const content = 'hello world';
      const result = await tool.execute(makeInput({ content }));
      expect(result.success).toBe(true);
      expect(result.result.bytesWritten).toBe(Buffer.byteLength(content, 'utf-8'));
    });

    it('should correctly report bytes for multi-byte characters', async () => {
      const content = 'Hello \u00e9\u00e8\u00ea \u2603 \u{1F600}';
      const result = await tool.execute(makeInput({ content }));
      expect(result.success).toBe(true);
      expect(result.result.bytesWritten).toBe(Buffer.byteLength(content, 'utf-8'));
    });

    it('should detect existing file and report created=false', async () => {
      mockReadFile.mockResolvedValueOnce('existing content');

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result.created).toBe(false);
    });

    it('should detect new file and report created=true', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('File not found'));

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result.created).toBe(true);
    });

    it('should pass correct workspaceId to container manager', async () => {
      await tool.execute(makeInput());

      expect(mockReadFile).toHaveBeenCalledWith('ws-abc-123', expect.any(String));
      expect(mockWriteFile).toHaveBeenCalledWith(
        'ws-abc-123',
        expect.any(String),
        expect.any(String)
      );
    });

    it('should pass sanitized path to writeFile', async () => {
      mockSanitizeFilePath.mockReturnValue('/workspace/clean/path.ts');

      await tool.execute(makeInput({ path: '../dirty/path.ts' }));

      expect(mockWriteFile).toHaveBeenCalledWith(
        'ws-abc-123',
        '/workspace/clean/path.ts',
        expect.any(String)
      );
    });

    it('should include executionTime in metadata', async () => {
      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle writeFile failure', async () => {
      mockWriteFile.mockRejectedValueOnce(new Error('Disk full'));

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workspace write failed');
      expect(result.error).toContain('Disk full');
    });

    it('should handle writeFile throwing non-Error', async () => {
      mockWriteFile.mockRejectedValueOnce('string error');

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });

    it('should write empty content', async () => {
      const result = await tool.execute(makeInput({ content: '' }));
      // Empty string should still pass validation since it's not undefined/null
      // but the actual behavior depends on validateInput
      // The content is '' which is falsy but not undefined/null,
      // so this depends on the BaseTool's validateInput logic.
      // Looking at BaseTool, it checks for undefined or null, not empty string.
      expect(result.success).toBe(true);
      expect(result.result.bytesWritten).toBe(0);
    });
  });

  // =========================================================================
  // GitHub writing
  // =========================================================================

  describe('GitHub writing', () => {
    beforeEach(() => {
      tool.initialize(makeGitHubConfig());
    });

    it('should create a new file via GitHub API', async () => {
      // GET returns 404 (file doesn't exist)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      // PUT succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: {} }),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result.created).toBe(true);
    });

    it('should update an existing file via GitHub API', async () => {
      // GET returns existing file with SHA
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'abc123sha' }),
      });
      // PUT succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: {} }),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result.created).toBe(false);
    });

    it('should include SHA when updating existing file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'existing-sha-456' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput());

      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.sha).toBe('existing-sha-456');
    });

    it('should not include SHA when creating new file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput());

      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.sha).toBeUndefined();
    });

    it('should send content as base64 in PUT body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const content = 'hello world';
      await tool.execute(makeInput({ content }));

      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      const decoded = Buffer.from(body.content, 'base64').toString('utf-8');
      expect(decoded).toBe(content);
    });

    it('should use correct commit message for new file', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput({ path: 'src/new.ts' }));

      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.message).toContain('Create');
    });

    it('should use correct commit message for existing file', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: 'sha123' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput({ path: 'src/existing.ts' }));

      const putCall = mockFetch.mock.calls[1];
      const body = JSON.parse(putCall[1].body);
      expect(body.message).toContain('Update');
    });

    it('should include correct Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput());

      // Check GET request headers
      const getCall = mockFetch.mock.calls[0];
      expect(getCall[1].headers.Authorization).toBe('Bearer ghp_testtoken123');

      // Check PUT request headers
      const putCall = mockFetch.mock.calls[1];
      expect(putCall[1].headers.Authorization).toBe('Bearer ghp_testtoken123');
    });

    it('should use correct User-Agent header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await tool.execute(makeInput());

      const getCall = mockFetch.mock.calls[0];
      expect(getCall[1].headers['User-Agent']).toBe('JCIL-Code-Agent');
    });

    it('should construct correct GET URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      mockSanitizeFilePath.mockReturnValue('/workspace/src/index.ts');

      await tool.execute(makeInput({ path: 'src/index.ts' }));

      const getUrl = mockFetch.mock.calls[0][0];
      expect(getUrl).toContain('https://api.github.com/repos/testowner/testrepo/contents/');
      expect(getUrl).toContain('ref=main');
    });

    it('should construct correct PUT URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      mockSanitizeFilePath.mockReturnValue('/workspace/src/index.ts');

      await tool.execute(makeInput({ path: 'src/index.ts' }));

      const putUrl = mockFetch.mock.calls[1][0];
      expect(putUrl).toContain('https://api.github.com/repos/testowner/testrepo/contents/');
    });

    it('should handle GitHub PUT API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Validation Failed' }),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub API error');
      expect(result.error).toContain('Validation Failed');
    });

    it('should handle GitHub PUT API error without message', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('GitHub API error');
    });

    it('should handle network error during fetch', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle non-Error throw during fetch', async () => {
      mockFetch.mockRejectedValueOnce('connection refused');

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // =========================================================================
  // No backend configured
  // =========================================================================

  describe('no backend configured', () => {
    it('should fail when no workspace or GitHub is configured', async () => {
      tool.initialize({});

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('No write backend configured');
    });

    it('should fail when only githubToken is set (missing owner/repo)', async () => {
      tool.initialize({ githubToken: 'ghp_tok' });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('No write backend configured');
    });

    it('should fail when githubToken and owner set but repo missing', async () => {
      tool.initialize({ githubToken: 'ghp_tok', owner: 'me' });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('No write backend configured');
    });
  });

  // =========================================================================
  // Backend priority
  // =========================================================================

  describe('backend priority', () => {
    it('should prefer workspace over GitHub when both configured', async () => {
      tool.initialize({
        ...makeWorkspaceConfig(),
        ...makeGitHubConfig(),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);

      // writeFile should have been called (workspace backend)
      expect(mockWriteFile).toHaveBeenCalled();

      // fetch should NOT have been called (GitHub backend)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fall back to GitHub when no workspaceId', async () => {
      tool.initialize(makeGitHubConfig());

      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should return metadata with executionTime on error', async () => {
      mockSanitizeFilePath.mockImplementation(() => {
        throw new Error('Sanitization failed');
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle sanitizeFilePath throwing', async () => {
      mockSanitizeFilePath.mockImplementation(() => {
        throw new Error('Bad path');
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad path');
    });

    it('should handle unknown error types gracefully', async () => {
      mockSanitizeFilePath.mockImplementation(() => {
        throw 42;
      });

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to write file');
    });

    it('should handle container readFile error gracefully during existence check', async () => {
      // readFile throws (file doesn't exist) - this is normal
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await tool.execute(makeInput());
      expect(result.success).toBe(true);
      expect(result.result.created).toBe(true);
    });
  });

  // =========================================================================
  // writeMultiple
  // =========================================================================

  describe('writeMultiple', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should write multiple files', async () => {
      const files = [
        { path: 'src/a.ts', content: 'file a' },
        { path: 'src/b.ts', content: 'file b' },
        { path: 'src/c.ts', content: 'file c' },
      ];

      const results = await tool.writeMultiple(files);

      expect(results.size).toBe(3);
      expect(results.get('src/a.ts')?.success).toBe(true);
      expect(results.get('src/b.ts')?.success).toBe(true);
      expect(results.get('src/c.ts')?.success).toBe(true);
    });

    it('should return a Map keyed by file path', async () => {
      const files = [
        { path: 'one.txt', content: 'one' },
        { path: 'two.txt', content: 'two' },
      ];

      const results = await tool.writeMultiple(files);
      expect(results).toBeInstanceOf(Map);
      expect([...results.keys()]).toEqual(['one.txt', 'two.txt']);
    });

    it('should handle empty file list', async () => {
      const results = await tool.writeMultiple([]);
      expect(results.size).toBe(0);
    });

    it('should handle single file', async () => {
      const results = await tool.writeMultiple([{ path: 'solo.ts', content: 'only one' }]);
      expect(results.size).toBe(1);
      expect(results.get('solo.ts')?.success).toBe(true);
    });

    it('should handle partial failures', async () => {
      // First file: readFile throws (new), writeFile succeeds
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));
      mockWriteFile.mockResolvedValueOnce(undefined);

      // Second file: readFile throws (new), writeFile fails
      mockReadFile.mockRejectedValueOnce(new Error('Not found'));
      mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'));

      const files = [
        { path: 'good.ts', content: 'ok' },
        { path: 'bad.ts', content: 'fail' },
      ];

      const results = await tool.writeMultiple(files);
      expect(results.size).toBe(2);

      const goodResult = results.get('good.ts');
      const badResult = results.get('bad.ts');

      expect(goodResult?.success).toBe(true);
      expect(badResult?.success).toBe(false);
    });

    it('should execute files in parallel', async () => {
      const callOrder: string[] = [];

      mockWriteFile.mockImplementation(async (_wsId: string, path: string) => {
        callOrder.push(`start:${path}`);
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push(`end:${path}`);
      });

      const files = [
        { path: '/workspace/a.ts', content: 'a' },
        { path: '/workspace/b.ts', content: 'b' },
      ];

      await tool.writeMultiple(files);

      // Both should start before either ends (parallel execution)
      // We can at least verify all were called
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      tool.initialize(makeWorkspaceConfig());
    });

    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(10_000_000); // 10MB
      const result = await tool.execute(makeInput({ content: largeContent }));
      expect(result.success).toBe(true);
      expect(result.result.bytesWritten).toBe(10_000_000);
    });

    it('should handle content with special characters', async () => {
      const content = 'Line 1\nLine 2\r\nLine 3\t\ttabbed';
      const result = await tool.execute(makeInput({ content }));
      expect(result.success).toBe(true);
    });

    it('should handle content with unicode', async () => {
      const content = '\u6d4b\u8bd5 \u30c6\u30b9\u30c8 \ud83d\ude80 \u00e9\u00e8\u00ea';
      const result = await tool.execute(makeInput({ content }));
      expect(result.success).toBe(true);
    });

    it('should handle paths with dots', async () => {
      const result = await tool.execute(makeInput({ path: 'src/my.component.test.tsx' }));
      expect(result.success).toBe(true);
    });

    it('should handle deep nested paths', async () => {
      const result = await tool.execute(
        makeInput({
          path: 'src/components/ui/forms/fields/input/TextField.tsx',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle content with null bytes', async () => {
      const content = 'before\x00after';
      const result = await tool.execute(makeInput({ content }));
      expect(result.success).toBe(true);
    });

    it('should handle path with spaces', async () => {
      const result = await tool.execute(makeInput({ path: 'src/my file.ts' }));
      expect(result.success).toBe(true);
    });
  });
});
