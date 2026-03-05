/**
 * CONNECTORS API ROUTE TESTS
 * ===========================
 * Comprehensive tests for GET and POST handlers in app/api/connectors/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

// Mock requireUser auth guard
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock Supabase client
const mockSupabaseSelect = vi.fn();
const mockSupabaseUpdate = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      mockSupabaseFrom(table);
      return {
        select: (cols: string) => {
          mockSupabaseSelect(cols);
          return {
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { github_token: 'encrypted-token', github_username: 'testuser' },
                }),
            }),
          };
        },
        update: (data: unknown) => {
          mockSupabaseUpdate(data);
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      };
    },
  }),
}));

// Mock crypto module
const mockDecrypt = vi.fn();
vi.mock('@/lib/security/crypto', () => {
  class EncryptionError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'EncryptionError';
      this.code = code;
    }
  }
  class DecryptionError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'DecryptionError';
      this.code = code;
    }
  }
  return {
    decrypt: (...args: unknown[]) => mockDecrypt(...args),
    EncryptionError,
    DecryptionError,
  };
});

// Mock connectors module
const mockIsConnectorsEnabled = vi.fn();
const mockListUserRepos = vi.fn();
const mockCreateRepository = vi.fn();
const mockPushFiles = vi.fn();
const mockCloneRepo = vi.fn();
const mockGetRepoTree = vi.fn();
const mockGetFileContent = vi.fn();
const mockGetRepoInfo = vi.fn();
const mockGetBranches = vi.fn();
const mockGetCommits = vi.fn();
const mockCreateBranch = vi.fn();
const mockCreatePullRequest = vi.fn();
const mockCompareBranches = vi.fn();
const mockParseGitHubUrl = vi.fn();

vi.mock('@/lib/connectors', () => ({
  isConnectorsEnabled: () => mockIsConnectorsEnabled(),
  listUserRepos: (...args: unknown[]) => mockListUserRepos(...args),
  createRepository: (...args: unknown[]) => mockCreateRepository(...args),
  pushFiles: (...args: unknown[]) => mockPushFiles(...args),
  cloneRepo: (...args: unknown[]) => mockCloneRepo(...args),
  getRepoTree: (...args: unknown[]) => mockGetRepoTree(...args),
  getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
  getRepoInfo: (...args: unknown[]) => mockGetRepoInfo(...args),
  getBranches: (...args: unknown[]) => mockGetBranches(...args),
  getCommits: (...args: unknown[]) => mockGetCommits(...args),
  createBranch: (...args: unknown[]) => mockCreateBranch(...args),
  createPullRequest: (...args: unknown[]) => mockCreatePullRequest(...args),
  compareBranches: (...args: unknown[]) => mockCompareBranches(...args),
  parseGitHubUrl: (...args: unknown[]) => mockParseGitHubUrl(...args),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import { GET, POST } from './route';

// ========================================
// HELPERS
// ========================================

function makeGetRequest(action?: string): NextRequest {
  const url = action
    ? `http://localhost:3000/api/connectors?action=${action}`
    : 'http://localhost:3000/api/connectors';
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/connectors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const FAKE_USER = {
  authorized: true as const,
  user: { id: 'user-123', email: 'test@example.com' },
  supabase: {},
};

const AUTH_REJECTED = {
  authorized: false as const,
  response: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
};

/** Set up default happy-path mocks */
function setupDefaults() {
  mockIsConnectorsEnabled.mockReturnValue(true);
  mockRequireUser.mockResolvedValue(FAKE_USER);
  mockDecrypt.mockReturnValue('ghp_decrypted_token');
}

// ========================================
// TESTS
// ========================================

describe('Connectors API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ========================================
  // CONNECTORS DISABLED
  // ========================================

  describe('when connectors are disabled', () => {
    beforeEach(() => {
      mockIsConnectorsEnabled.mockReturnValue(false);
    });

    it('GET returns 503 service unavailable', async () => {
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('not enabled');
    });

    it('POST returns 503 service unavailable', async () => {
      const res = await POST(makePostRequest({ action: 'listRepos' }));
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.ok).toBe(false);
    });
  });

  // ========================================
  // AUTH GUARD
  // ========================================

  describe('authentication', () => {
    it('GET rejects unauthenticated requests', async () => {
      mockRequireUser.mockResolvedValue(AUTH_REJECTED);
      const res = await GET(makeGetRequest());
      expect(res.status).toBe(401);
    });

    it('POST rejects unauthenticated requests', async () => {
      mockRequireUser.mockResolvedValue(AUTH_REJECTED);
      const res = await POST(makePostRequest({ action: 'listRepos' }));
      expect(res.status).toBe(401);
    });

    it('GET calls requireUser without request (no CSRF)', async () => {
      await GET(makeGetRequest());
      expect(mockRequireUser).toHaveBeenCalledWith();
    });

    it('POST calls requireUser with request (CSRF check)', async () => {
      const req = makePostRequest({ action: 'listRepos' });
      await POST(req);
      expect(mockRequireUser).toHaveBeenCalledWith(req);
    });
  });

  // ========================================
  // GET — status (default action)
  // ========================================

  describe('GET ?action=status (default)', () => {
    it('returns connected status when token exists', async () => {
      const res = await GET(makeGetRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.connectors).toHaveLength(1);
      expect(body.data.connectors[0].type).toBe('github');
      expect(body.data.connectors[0].status).toBe('connected');
      expect(body.data.connectors[0].metadata.username).toBe('testuser');
    });

    it('returns disconnected status when no token', async () => {
      mockDecrypt.mockImplementation(() => {
        throw new Error('no token');
      });
      // Need to also mock the DB to return no token
      vi.mocked(mockDecrypt).mockClear();

      // Re-mock supabase to return null token
      const _origFrom = mockSupabaseFrom;
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({ data: { github_token: null, github_username: null } }),
              }),
            }),
          }),
        }),
      }));

      // Instead, let's just test with a decryption error that leads to null token
      // The function catches errors and returns token: null
      const { DecryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new DecryptionError('bad', 'INVALID_FORMAT');
      });

      const res = await GET(makeGetRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.connectors[0].status).toBe('disconnected');
      expect(body.data.connectors[0].metadata).toBeUndefined();
    });
  });

  // ========================================
  // GET — github-status
  // ========================================

  describe('GET ?action=github-status', () => {
    it('returns connected=true with username when token exists', async () => {
      const res = await GET(makeGetRequest('github-status'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.connected).toBe(true);
      expect(body.data.username).toBe('testuser');
    });

    it('returns connected=false with error when no token', async () => {
      const { DecryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new DecryptionError('bad', 'INVALID_FORMAT');
      });

      const res = await GET(makeGetRequest('github-status'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.connected).toBe(false);
      expect(body.data.error).toBeTruthy();
    });
  });

  // ========================================
  // GET — github-repos
  // ========================================

  describe('GET ?action=github-repos', () => {
    it('returns repos when token exists', async () => {
      const fakeRepos = [{ name: 'repo1' }, { name: 'repo2' }];
      mockListUserRepos.mockResolvedValue(fakeRepos);

      const res = await GET(makeGetRequest('github-repos'));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.repos).toEqual(fakeRepos);
      expect(mockListUserRepos).toHaveBeenCalledWith('ghp_decrypted_token');
    });

    it('returns 400 when no token', async () => {
      const { DecryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new DecryptionError('bad', 'INVALID_FORMAT');
      });

      const res = await GET(makeGetRequest('github-repos'));
      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // GET — invalid action
  // ========================================

  describe('GET invalid action', () => {
    it('returns 400 for unknown action', async () => {
      const res = await GET(makeGetRequest('nonexistent-action'));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Invalid action');
    });
  });

  // ========================================
  // GET — error handling
  // ========================================

  describe('GET error handling', () => {
    it('returns 500 when listUserRepos throws', async () => {
      mockListUserRepos.mockRejectedValue(new Error('GitHub API error'));

      const res = await GET(makeGetRequest('github-repos'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Connector operation failed');
    });
  });

  // ========================================
  // TOKEN DECRYPTION ERRORS
  // ========================================

  describe('token decryption error handling', () => {
    it('handles EncryptionError with NO_KEY code', async () => {
      const { EncryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new EncryptionError('No key', 'NO_KEY');
      });

      const res = await GET(makeGetRequest('github-status'));
      const body = await res.json();

      expect(body.data.connected).toBe(false);
      expect(body.data.error).toContain('encryption not configured');
    });

    it('handles DecryptionError by clearing token from DB', async () => {
      const { DecryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new DecryptionError('bad data', 'INVALID_FORMAT');
      });

      const res = await GET(makeGetRequest('github-status'));
      const body = await res.json();

      expect(body.data.connected).toBe(false);
      expect(body.data.error).toContain('expired');
      // Verify the token was cleared in DB
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        github_token: null,
        github_username: null,
      });
    });

    it('handles unexpected decryption errors', async () => {
      mockDecrypt.mockImplementation(() => {
        throw new TypeError('something unexpected');
      });

      const res = await GET(makeGetRequest('github-status'));
      const body = await res.json();

      expect(body.data.connected).toBe(false);
      expect(body.data.error).toContain('Failed to access GitHub token');
    });
  });

  // ========================================
  // POST — no token
  // ========================================

  describe('POST without GitHub token', () => {
    it('returns 400 when token decryption fails', async () => {
      const { DecryptionError } = await import('@/lib/security/crypto');
      mockDecrypt.mockImplementation(() => {
        throw new DecryptionError('bad', 'INVALID_FORMAT');
      });

      const res = await POST(makePostRequest({ action: 'listRepos' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
    });
  });

  // ========================================
  // POST — listRepos
  // ========================================

  describe('POST action=listRepos', () => {
    it('returns repos list', async () => {
      const fakeRepos = [{ name: 'my-repo', full_name: 'user/my-repo' }];
      mockListUserRepos.mockResolvedValue(fakeRepos);

      const res = await POST(makePostRequest({ action: 'listRepos' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.repos).toEqual(fakeRepos);
    });
  });

  // ========================================
  // POST — pushFiles / push-files
  // ========================================

  describe('POST action=pushFiles', () => {
    const validPush = {
      action: 'pushFiles',
      owner: 'testowner',
      repo: 'testrepo',
      branch: 'main',
      message: 'test commit',
      files: [{ path: 'file.txt', content: 'hello' }],
    };

    it('pushes files successfully', async () => {
      mockPushFiles.mockResolvedValue({
        success: true,
        commitSha: 'abc123',
        repoUrl: 'https://github.com/testowner/testrepo',
      });

      const res = await POST(makePostRequest(validPush));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.commitSha).toBe('abc123');
      expect(body.data.repoUrl).toBe('https://github.com/testowner/testrepo');
    });

    it('also works with push-files action name', async () => {
      mockPushFiles.mockResolvedValue({ success: true, commitSha: 'abc123', repoUrl: 'url' });

      const res = await POST(makePostRequest({ ...validPush, action: 'push-files' }));
      expect(res.status).toBe(200);
    });

    it('returns 400 when owner is missing', async () => {
      const res = await POST(
        makePostRequest({
          action: 'pushFiles',
          repo: 'r',
          message: 'm',
          files: [{ path: 'f', content: 'c' }],
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('owner');
    });

    it('returns 400 when files array is empty', async () => {
      const res = await POST(makePostRequest({ ...validPush, files: [] }));
      expect(res.status).toBe(400);
    });

    it('returns 400 when message is missing', async () => {
      const { message: _message, ...noMessage } = validPush;
      const res = await POST(makePostRequest(noMessage));
      expect(res.status).toBe(400);
    });

    it('returns 500 when push fails', async () => {
      mockPushFiles.mockResolvedValue({ success: false, error: 'Push rejected' });

      const res = await POST(makePostRequest(validPush));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Push');
    });
  });

  // ========================================
  // POST — create-repo
  // ========================================

  describe('POST action=create-repo', () => {
    it('creates repository successfully', async () => {
      const fakeRepo = { id: 1, name: 'new-repo', full_name: 'user/new-repo' };
      mockCreateRepository.mockResolvedValue(fakeRepo);

      const res = await POST(
        makePostRequest({
          action: 'create-repo',
          name: 'new-repo',
          description: 'A test repo',
          isPrivate: true,
        })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.repo).toEqual(fakeRepo);
      expect(mockCreateRepository).toHaveBeenCalledWith('ghp_decrypted_token', {
        name: 'new-repo',
        description: 'A test repo',
        private: true,
        autoInit: true,
      });
    });

    it('returns 400 when name is missing', async () => {
      const res = await POST(makePostRequest({ action: 'create-repo' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('name');
    });

    it('returns 500 when createRepository returns null', async () => {
      mockCreateRepository.mockResolvedValue(null);

      const res = await POST(makePostRequest({ action: 'create-repo', name: 'bad-repo' }));
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — clone-repo / cloneRepo
  // ========================================

  describe('POST action=clone-repo', () => {
    it('clones repo by owner/repo', async () => {
      const cloneResult = { success: true, files: [{ path: 'README.md', content: '# Hello' }] };
      mockCloneRepo.mockResolvedValue(cloneResult);

      const res = await POST(makePostRequest({ action: 'clone-repo', owner: 'o', repo: 'r' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('clones repo by URL', async () => {
      mockParseGitHubUrl.mockReturnValue({ owner: 'url-owner', repo: 'url-repo' });
      mockCloneRepo.mockResolvedValue({ success: true, files: [] });

      const res = await POST(
        makePostRequest({ action: 'cloneRepo', url: 'https://github.com/url-owner/url-repo' })
      );

      expect(res.status).toBe(200);
      expect(mockParseGitHubUrl).toHaveBeenCalledWith('https://github.com/url-owner/url-repo');
    });

    it('returns 400 for invalid GitHub URL', async () => {
      mockParseGitHubUrl.mockReturnValue(null);

      const res = await POST(makePostRequest({ action: 'clone-repo', url: 'not-a-url' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid GitHub URL');
    });

    it('returns 400 when neither owner/repo nor url provided', async () => {
      const res = await POST(makePostRequest({ action: 'clone-repo' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('owner and repo required');
    });

    it('returns 500 when clone fails', async () => {
      mockCloneRepo.mockResolvedValue({ success: false, error: 'Not found' });

      const res = await POST(makePostRequest({ action: 'clone-repo', owner: 'o', repo: 'r' }));
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — get-tree / getTree
  // ========================================

  describe('POST action=get-tree', () => {
    it('returns repo tree', async () => {
      const tree = { tree: [{ path: 'src', type: 'tree' }], truncated: false };
      mockGetRepoTree.mockResolvedValue(tree);

      const res = await POST(makePostRequest({ action: 'get-tree', owner: 'o', repo: 'r' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('supports URL input', async () => {
      mockParseGitHubUrl.mockReturnValue({ owner: 'u', repo: 'r' });
      mockGetRepoTree.mockResolvedValue({ tree: [] });

      const res = await POST(makePostRequest({ action: 'getTree', url: 'https://github.com/u/r' }));
      expect(res.status).toBe(200);
    });

    it('returns 400 when owner/repo missing', async () => {
      const res = await POST(makePostRequest({ action: 'get-tree' }));
      expect(res.status).toBe(400);
    });

    it('returns 500 when getRepoTree returns null', async () => {
      mockGetRepoTree.mockResolvedValue(null);

      const res = await POST(makePostRequest({ action: 'get-tree', owner: 'o', repo: 'r' }));
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — get-file / getFile
  // ========================================

  describe('POST action=get-file', () => {
    it('returns file content', async () => {
      const fileData = { content: 'hello world', encoding: 'utf-8' };
      mockGetFileContent.mockResolvedValue(fileData);

      const res = await POST(
        makePostRequest({ action: 'get-file', owner: 'o', repo: 'r', path: 'README.md' })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('returns 400 when path is missing', async () => {
      const res = await POST(makePostRequest({ action: 'getFile', owner: 'o', repo: 'r' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('path required');
    });

    it('returns 404 when file not found', async () => {
      mockGetFileContent.mockResolvedValue(null);

      const res = await POST(
        makePostRequest({ action: 'get-file', owner: 'o', repo: 'r', path: 'nope.txt' })
      );
      expect(res.status).toBe(404);
    });
  });

  // ========================================
  // POST — get-repo-info / getRepoInfo
  // ========================================

  describe('POST action=get-repo-info', () => {
    it('returns repo info', async () => {
      const info = { name: 'my-repo', description: 'A repo', stargazers_count: 10 };
      mockGetRepoInfo.mockResolvedValue(info);

      const res = await POST(makePostRequest({ action: 'get-repo-info', owner: 'o', repo: 'r' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('supports URL input', async () => {
      mockParseGitHubUrl.mockReturnValue({ owner: 'u', repo: 'r' });
      mockGetRepoInfo.mockResolvedValue({ name: 'r' });

      const res = await POST(
        makePostRequest({ action: 'getRepoInfo', url: 'https://github.com/u/r' })
      );
      expect(res.status).toBe(200);
    });

    it('returns 400 without owner/repo', async () => {
      const res = await POST(makePostRequest({ action: 'get-repo-info' }));
      expect(res.status).toBe(400);
    });

    it('returns 404 when repo not found', async () => {
      mockGetRepoInfo.mockResolvedValue(null);

      const res = await POST(makePostRequest({ action: 'get-repo-info', owner: 'o', repo: 'r' }));
      expect(res.status).toBe(404);
    });
  });

  // ========================================
  // POST — get-branches / getBranches
  // ========================================

  describe('POST action=get-branches', () => {
    it('returns branches', async () => {
      const branches = [{ name: 'main' }, { name: 'develop' }];
      mockGetBranches.mockResolvedValue(branches);

      const res = await POST(makePostRequest({ action: 'get-branches', owner: 'o', repo: 'r' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.branches).toEqual(branches);
    });

    it('returns 400 without owner/repo', async () => {
      const res = await POST(makePostRequest({ action: 'getBranches', owner: 'o' }));
      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // POST — get-commits / getCommits
  // ========================================

  describe('POST action=get-commits', () => {
    it('returns commits', async () => {
      const commits = [{ sha: 'abc', message: 'init' }];
      mockGetCommits.mockResolvedValue(commits);

      const res = await POST(makePostRequest({ action: 'get-commits', owner: 'o', repo: 'r' }));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.commits).toEqual(commits);
    });

    it('uses default limit of 20', async () => {
      mockGetCommits.mockResolvedValue([]);

      await POST(makePostRequest({ action: 'getCommits', owner: 'o', repo: 'r' }));
      expect(mockGetCommits).toHaveBeenCalledWith('ghp_decrypted_token', 'o', 'r', undefined, 20);
    });

    it('passes custom limit and branch', async () => {
      mockGetCommits.mockResolvedValue([]);

      await POST(
        makePostRequest({ action: 'get-commits', owner: 'o', repo: 'r', branch: 'dev', limit: 5 })
      );
      expect(mockGetCommits).toHaveBeenCalledWith('ghp_decrypted_token', 'o', 'r', 'dev', 5);
    });

    it('returns 400 without owner/repo', async () => {
      const res = await POST(makePostRequest({ action: 'get-commits' }));
      expect(res.status).toBe(400);
    });
  });

  // ========================================
  // POST — create-branch / createBranch
  // ========================================

  describe('POST action=create-branch', () => {
    it('creates branch successfully', async () => {
      mockCreateBranch.mockResolvedValue({ success: true, ref: 'refs/heads/feature' });

      const res = await POST(
        makePostRequest({ action: 'create-branch', owner: 'o', repo: 'r', branchName: 'feature' })
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('returns 400 when branchName is missing', async () => {
      const res = await POST(makePostRequest({ action: 'createBranch', owner: 'o', repo: 'r' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('branchName required');
    });

    it('returns 500 when branch creation fails', async () => {
      mockCreateBranch.mockResolvedValue({ success: false, error: 'Branch exists' });

      const res = await POST(
        makePostRequest({ action: 'create-branch', owner: 'o', repo: 'r', branchName: 'main' })
      );
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — create-pr / createPR
  // ========================================

  describe('POST action=create-pr', () => {
    const validPR = {
      action: 'create-pr',
      owner: 'o',
      repo: 'r',
      title: 'My PR',
      head: 'feature',
      base: 'main',
    };

    it('creates PR successfully', async () => {
      mockCreatePullRequest.mockResolvedValue({
        success: true,
        number: 42,
        url: 'https://github.com/o/r/pull/42',
      });

      const res = await POST(makePostRequest(validPR));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mockCreatePullRequest).toHaveBeenCalledWith('ghp_decrypted_token', {
        owner: 'o',
        repo: 'r',
        title: 'My PR',
        body: '',
        head: 'feature',
        base: 'main',
        draft: undefined,
      });
    });

    it('passes body and draft through', async () => {
      mockCreatePullRequest.mockResolvedValue({ success: true });

      await POST(
        makePostRequest({ ...validPR, action: 'createPR', body: 'PR description', draft: true })
      );
      expect(mockCreatePullRequest).toHaveBeenCalledWith(
        'ghp_decrypted_token',
        expect.objectContaining({
          body: 'PR description',
          draft: true,
        })
      );
    });

    it('returns 400 when title is missing', async () => {
      const { title: _title, ...noTitle } = validPR;
      const res = await POST(makePostRequest(noTitle));
      expect(res.status).toBe(400);
    });

    it('returns 400 when head is missing', async () => {
      const { head: _head, ...noHead } = validPR;
      const res = await POST(makePostRequest(noHead));
      expect(res.status).toBe(400);
    });

    it('returns 400 when base is missing', async () => {
      const { base: _base, ...noBase } = validPR;
      const res = await POST(makePostRequest(noBase));
      expect(res.status).toBe(400);
    });

    it('returns 500 when PR creation fails', async () => {
      mockCreatePullRequest.mockResolvedValue({ success: false, error: 'Conflict' });

      const res = await POST(makePostRequest(validPR));
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — compare-branches / compareBranches
  // ========================================

  describe('POST action=compare-branches', () => {
    const validCompare = {
      action: 'compare-branches',
      owner: 'o',
      repo: 'r',
      base: 'main',
      head: 'feature',
    };

    it('compares branches successfully', async () => {
      const comparison = { ahead_by: 3, behind_by: 0, files: [] };
      mockCompareBranches.mockResolvedValue(comparison);

      const res = await POST(makePostRequest(validCompare));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it('also works with compareBranches action name', async () => {
      mockCompareBranches.mockResolvedValue({});

      const res = await POST(makePostRequest({ ...validCompare, action: 'compareBranches' }));
      expect(res.status).toBe(200);
    });

    it('returns 400 when base is missing', async () => {
      const { base: _base2, ...noBase } = validCompare;
      const res = await POST(makePostRequest(noBase));
      expect(res.status).toBe(400);
    });

    it('returns 400 when head is missing', async () => {
      const { head: _head2, ...noHead } = validCompare;
      const res = await POST(makePostRequest(noHead));
      expect(res.status).toBe(400);
    });

    it('returns 500 when comparison returns null', async () => {
      mockCompareBranches.mockResolvedValue(null);

      const res = await POST(makePostRequest(validCompare));
      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // POST — invalid action
  // ========================================

  describe('POST invalid action', () => {
    it('returns 400 for unknown action', async () => {
      const res = await POST(makePostRequest({ action: 'fly-to-moon' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid action');
    });
  });

  // ========================================
  // POST — error handling
  // ========================================

  describe('POST error handling', () => {
    it('returns 500 when an action throws', async () => {
      mockListUserRepos.mockRejectedValue(new Error('Network error'));

      const res = await POST(makePostRequest({ action: 'listRepos' }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Connector operation failed');
    });

    it('returns 500 when request.json() throws (bad JSON)', async () => {
      const req = new NextRequest('http://localhost:3000/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json{{{',
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });
});
