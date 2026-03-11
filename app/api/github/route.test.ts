/**
 * GITHUB API ROUTE TESTS
 * =======================
 * Comprehensive tests for GET and POST handlers in app/api/github/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

// Mock admin guard
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock GitHub client
const mockIsGitHubConfigured = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockListRepositories = vi.fn();
const mockListContents = vi.fn();
const mockGetFileContent = vi.fn();
const mockCreateOrUpdateFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockListBranches = vi.fn();
const mockCreateBranch = vi.fn();
const mockCreatePullRequest = vi.fn();
const mockSearchCode = vi.fn();

vi.mock('@/lib/github/client', () => ({
  isGitHubConfigured: () => mockIsGitHubConfigured(),
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
  listRepositories: () => mockListRepositories(),
  listContents: (...args: unknown[]) => mockListContents(...args),
  getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
  createOrUpdateFile: (...args: unknown[]) => mockCreateOrUpdateFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  listBranches: (...args: unknown[]) => mockListBranches(...args),
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
  createPullRequest: (...args: unknown[]) => mockCreatePullRequest(...args),
  searchCode: (...args: unknown[]) => mockSearchCode(...args),
}));

// CSRF is built into requireAdmin — no separate mock needed

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ========================================
// HELPERS
// ========================================

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/github');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/github', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Configure mocks so the request passes auth (admin user).
 */
function setupAdminAuth(): void {
  mockRequireAdmin.mockResolvedValue({
    authorized: true,
    user: { id: 'user-123', email: 'admin@test.com' },
    response: undefined,
  });
}

/**
 * Configure mocks so the request fails auth (no user).
 */
function setupUnauthenticated(): void {
  mockRequireAdmin.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 }),
  });
}

/**
 * Configure mocks so the user is authenticated but not admin.
 */
function setupNonAdmin(): void {
  mockRequireAdmin.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Admin access required' }), { status: 403 }),
  });
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

// ========================================
// TESTS
// ========================================

describe('GitHub API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: GitHub is configured
    mockIsGitHubConfigured.mockReturnValue(true);
  });

  // ----------------------------------------
  // AUTH GUARD TESTS
  // ----------------------------------------
  describe('Auth Guard', () => {
    it('GET returns 401 for unauthenticated users', async () => {
      setupUnauthenticated();
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'status' }));
      expect(response!.status).toBe(401);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
    }, 30_000);

    it('GET returns 403 for non-admin users', async () => {
      setupNonAdmin();
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'status' }));
      expect(response!.status).toBe(403);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
    });

    it('POST returns 401 for unauthenticated users', async () => {
      setupUnauthenticated();
      const { POST } = await import('./route');
      const response = await POST(makePostRequest({ action: 'createBranch' }));
      expect(response!.status).toBe(401);
    });

    it('POST returns 403 for non-admin users', async () => {
      setupNonAdmin();
      const { POST } = await import('./route');
      const response = await POST(makePostRequest({ action: 'createBranch' }));
      expect(response!.status).toBe(403);
    });
  });

  // ----------------------------------------
  // CSRF TESTS (POST only — CSRF is built into requireAdmin)
  // ----------------------------------------
  describe('CSRF Protection', () => {
    it('POST rejects when requireAdmin fails (includes CSRF check)', async () => {
      mockRequireAdmin.mockResolvedValue({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'CSRF validation failed' }), { status: 403 }),
      });
      const { POST } = await import('./route');
      const response = await POST(makePostRequest({ action: 'createBranch' }));
      expect(response!.status).toBe(403);
    });
  });

  // ----------------------------------------
  // GITHUB NOT CONFIGURED
  // ----------------------------------------
  describe('GitHub Not Configured', () => {
    beforeEach(() => {
      setupAdminAuth();
      mockIsGitHubConfigured.mockReturnValue(false);
    });

    it('GET returns 503 when GitHub is not configured', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'status' }));
      expect(response!.status).toBe(503);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('GitHub not configured');
    });

    it('POST returns 503 when GitHub is not configured', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createBranch',
          owner: 'o',
          repo: 'r',
          branchName: 'b',
          fromSha: 's',
        })
      );
      expect(response!.status).toBe(503);
    });
  });

  // ----------------------------------------
  // GET ACTIONS
  // ----------------------------------------
  describe('GET - status', () => {
    beforeEach(() => setupAdminAuth());

    it('returns authenticated user info', async () => {
      mockGetAuthenticatedUser.mockResolvedValue({ login: 'octocat', name: 'The Octocat' });
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'status' }));
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      const data = body.data as Record<string, unknown>;
      expect(data.configured).toBe(true);
      expect(data.user).toBe('octocat');
      expect(data.name).toBe('The Octocat');
    });
  });

  describe('GET - repos', () => {
    beforeEach(() => setupAdminAuth());

    it('returns list of repositories', async () => {
      const repos = [{ name: 'repo1' }, { name: 'repo2' }];
      mockListRepositories.mockResolvedValue(repos);
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'repos' }));
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).repos).toEqual(repos);
    });
  });

  describe('GET - contents', () => {
    beforeEach(() => setupAdminAuth());

    it('returns directory contents', async () => {
      const contents = [{ name: 'file.ts', type: 'file' }];
      mockListContents.mockResolvedValue(contents);
      const { GET } = await import('./route');
      const response = await GET(
        makeGetRequest({ action: 'contents', owner: 'org', repo: 'myrepo', path: 'src' })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect(mockListContents).toHaveBeenCalledWith('org', 'myrepo', 'src', undefined);
    });

    it('passes ref parameter when provided', async () => {
      mockListContents.mockResolvedValue([]);
      const { GET } = await import('./route');
      await GET(
        makeGetRequest({
          action: 'contents',
          owner: 'org',
          repo: 'myrepo',
          path: 'src',
          ref: 'feature-branch',
        })
      );
      expect(mockListContents).toHaveBeenCalledWith('org', 'myrepo', 'src', 'feature-branch');
    });

    it('returns 400 when owner is missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'contents', repo: 'myrepo' }));
      expect(response!.status).toBe(400);
    });

    it('returns 400 when repo is missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'contents', owner: 'org' }));
      expect(response!.status).toBe(400);
    });
  });

  describe('GET - file', () => {
    beforeEach(() => setupAdminAuth());

    it('returns file content', async () => {
      const file = { content: 'hello world', sha: 'abc123' };
      mockGetFileContent.mockResolvedValue(file);
      const { GET } = await import('./route');
      const response = await GET(
        makeGetRequest({ action: 'file', owner: 'org', repo: 'myrepo', path: 'README.md' })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).file).toEqual(file);
    });

    it('returns 404 when file is not found', async () => {
      mockGetFileContent.mockResolvedValue(null);
      const { GET } = await import('./route');
      const response = await GET(
        makeGetRequest({ action: 'file', owner: 'org', repo: 'myrepo', path: 'missing.txt' })
      );
      expect(response!.status).toBe(404);
    });

    it('returns 400 when path is missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'file', owner: 'org', repo: 'myrepo' }));
      expect(response!.status).toBe(400);
    });

    it('returns 400 when owner and repo are missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'file', path: 'README.md' }));
      expect(response!.status).toBe(400);
    });
  });

  describe('GET - branches', () => {
    beforeEach(() => setupAdminAuth());

    it('returns list of branches', async () => {
      const branches = [{ name: 'main' }, { name: 'develop' }];
      mockListBranches.mockResolvedValue(branches);
      const { GET } = await import('./route');
      const response = await GET(
        makeGetRequest({ action: 'branches', owner: 'org', repo: 'myrepo' })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).branches).toEqual(branches);
    });

    it('returns 400 when owner is missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'branches', repo: 'myrepo' }));
      expect(response!.status).toBe(400);
    });
  });

  describe('GET - search', () => {
    beforeEach(() => setupAdminAuth());

    it('returns search results', async () => {
      const results = [{ path: 'src/index.ts', content: 'match' }];
      mockSearchCode.mockResolvedValue(results);
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'search', q: 'import React' }));
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).results).toEqual(results);
    });

    it('passes owner and repo to searchCode when provided', async () => {
      mockSearchCode.mockResolvedValue([]);
      const { GET } = await import('./route');
      await GET(makeGetRequest({ action: 'search', q: 'test', owner: 'org', repo: 'myrepo' }));
      expect(mockSearchCode).toHaveBeenCalledWith('test', 'org', 'myrepo');
    });

    it('returns 400 when query is missing', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'search' }));
      expect(response!.status).toBe(400);
    });
  });

  describe('GET - invalid action', () => {
    beforeEach(() => setupAdminAuth());

    it('returns 400 for unknown action', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'unknown' }));
      expect(response!.status).toBe(400);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
    });

    it('returns 400 when no action is provided', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({}));
      expect(response!.status).toBe(400);
    });
  });

  describe('GET - error handling', () => {
    beforeEach(() => setupAdminAuth());

    it('returns 500 when a GitHub client call throws', async () => {
      mockGetAuthenticatedUser.mockRejectedValue(new Error('GitHub API down'));
      const { GET } = await import('./route');
      const response = await GET(makeGetRequest({ action: 'status' }));
      expect(response!.status).toBe(500);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('GitHub API error');
    });
  });

  // ----------------------------------------
  // POST ACTIONS
  // ----------------------------------------
  describe('POST - createOrUpdate', () => {
    beforeEach(() => setupAdminAuth());

    it('creates or updates a file', async () => {
      const result = { sha: 'new-sha', path: 'src/index.ts' };
      mockCreateOrUpdateFile.mockResolvedValue(result);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createOrUpdate',
          owner: 'org',
          repo: 'myrepo',
          path: 'src/index.ts',
          content: 'console.log("hello")',
          message: 'Add index file',
          sha: 'old-sha',
          branch: 'main',
        })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      const data = body.data as Record<string, unknown>;
      expect(data.success).toBe(true);
      expect(data.sha).toBe('new-sha');
      expect(mockCreateOrUpdateFile).toHaveBeenCalledWith(
        'org',
        'myrepo',
        'src/index.ts',
        'console.log("hello")',
        'Add index file',
        'old-sha',
        'main'
      );
    });

    it('returns 500 when createOrUpdateFile returns null', async () => {
      mockCreateOrUpdateFile.mockResolvedValue(null);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createOrUpdate',
          owner: 'org',
          repo: 'myrepo',
          path: 'file.ts',
          content: 'code',
          message: 'commit msg',
        })
      );
      expect(response!.status).toBe(500);
    });

    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createOrUpdate',
          owner: 'org',
          repo: 'myrepo',
          // missing path, content, message
        })
      );
      expect(response!.status).toBe(400);
    });

    it('accepts content with empty string value', async () => {
      mockCreateOrUpdateFile.mockResolvedValue({ sha: 's' });
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createOrUpdate',
          owner: 'org',
          repo: 'myrepo',
          path: 'empty.ts',
          content: '',
          message: 'Empty file',
        })
      );
      // content === '' is not undefined, so it should pass validation
      expect(response!.status).toBe(200);
    });
  });

  describe('POST - delete', () => {
    beforeEach(() => setupAdminAuth());

    it('deletes a file', async () => {
      mockDeleteFile.mockResolvedValue(true);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'delete',
          owner: 'org',
          repo: 'myrepo',
          path: 'old-file.ts',
          sha: 'file-sha',
          message: 'Remove old file',
        })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).success).toBe(true);
    });

    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'delete',
          owner: 'org',
          repo: 'myrepo',
          // missing path, sha, message
        })
      );
      expect(response!.status).toBe(400);
    });
  });

  describe('POST - createBranch', () => {
    beforeEach(() => setupAdminAuth());

    it('creates a branch', async () => {
      mockCreateBranch.mockResolvedValue(true);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createBranch',
          owner: 'org',
          repo: 'myrepo',
          branchName: 'feature/new',
          fromSha: 'base-sha',
        })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      expect((body.data as Record<string, unknown>).success).toBe(true);
    });

    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createBranch',
          owner: 'org',
          repo: 'myrepo',
          // missing branchName, fromSha
        })
      );
      expect(response!.status).toBe(400);
    });
  });

  describe('POST - createPR', () => {
    beforeEach(() => setupAdminAuth());

    it('creates a pull request', async () => {
      const pr = { number: 42, html_url: 'https://github.com/org/repo/pull/42' };
      mockCreatePullRequest.mockResolvedValue(pr);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createPR',
          owner: 'org',
          repo: 'myrepo',
          title: 'My PR',
          body: 'Description here',
          head: 'feature/new',
          base: 'main',
        })
      );
      expect(response!.status).toBe(200);
      const body = await parseJson(response!);
      expect(body.ok).toBe(true);
      const data = body.data as Record<string, unknown>;
      expect(data.success).toBe(true);
      expect(data.number).toBe(42);
      expect(mockCreatePullRequest).toHaveBeenCalledWith(
        'org',
        'myrepo',
        'My PR',
        'Description here',
        'feature/new',
        'main'
      );
    });

    it('uses empty string for body when not provided', async () => {
      mockCreatePullRequest.mockResolvedValue({ number: 1, html_url: 'url' });
      const { POST } = await import('./route');
      await POST(
        makePostRequest({
          action: 'createPR',
          owner: 'org',
          repo: 'myrepo',
          title: 'My PR',
          head: 'feature',
          base: 'main',
        })
      );
      expect(mockCreatePullRequest).toHaveBeenCalledWith(
        'org',
        'myrepo',
        'My PR',
        '',
        'feature',
        'main'
      );
    });

    it('returns 500 when createPullRequest returns null', async () => {
      mockCreatePullRequest.mockResolvedValue(null);
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createPR',
          owner: 'org',
          repo: 'myrepo',
          title: 'My PR',
          head: 'feature',
          base: 'main',
        })
      );
      expect(response!.status).toBe(500);
    });

    it('returns 400 when required fields are missing', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createPR',
          owner: 'org',
          repo: 'myrepo',
          // missing title, head, base
        })
      );
      expect(response!.status).toBe(400);
    });
  });

  describe('POST - invalid action', () => {
    beforeEach(() => setupAdminAuth());

    it('returns 400 for unknown action', async () => {
      const { POST } = await import('./route');
      const response = await POST(makePostRequest({ action: 'invalidAction' }));
      expect(response!.status).toBe(400);
    });
  });

  describe('POST - error handling', () => {
    beforeEach(() => setupAdminAuth());

    it('returns 500 when a GitHub client call throws', async () => {
      mockCreateBranch.mockRejectedValue(new Error('Network error'));
      const { POST } = await import('./route');
      const response = await POST(
        makePostRequest({
          action: 'createBranch',
          owner: 'org',
          repo: 'myrepo',
          branchName: 'feat',
          fromSha: 'sha',
        })
      );
      expect(response!.status).toBe(500);
      const body = await parseJson(response!);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('GitHub API error');
    });
  });
});
