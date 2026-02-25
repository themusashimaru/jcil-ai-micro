/**
 * GITHUB CLIENT TESTS
 *
 * Tests for GitHub API client functions:
 * - isGitHubConfigured
 * - getAuthenticatedUser
 * - listRepositories
 * - listContents
 * - getFileContent
 * - createOrUpdateFile
 * - deleteFile
 * - listBranches
 * - createBranch
 * - createPullRequest
 * - searchCode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — All defined INSIDE factories (hoisting-safe)
// ============================================================================

vi.mock('octokit', () => {
  const mockGetAuthenticated = vi.fn(() =>
    Promise.resolve({ data: { login: 'testuser', name: 'Test User' } })
  );
  const mockListForAuthenticatedUser = vi.fn(() =>
    Promise.resolve({
      data: [
        {
          name: 'my-repo',
          full_name: 'testuser/my-repo',
          description: 'A test repo',
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/testuser/my-repo',
        },
      ],
    })
  );
  const mockGetContent = vi.fn(() =>
    Promise.resolve({
      data: {
        name: 'index.ts',
        path: 'src/index.ts',
        type: 'file',
        size: 100,
        sha: 'abc123',
        content: Buffer.from('console.log("hello")').toString('base64'),
        encoding: 'base64',
      },
    })
  );
  const mockCreateOrUpdateFileContents = vi.fn(() =>
    Promise.resolve({
      data: {
        content: { sha: 'new-sha-123' },
        commit: { sha: 'commit-sha-456' },
      },
    })
  );
  const mockDeleteFile = vi.fn(() => Promise.resolve({}));
  const mockListBranches = vi.fn(() =>
    Promise.resolve({
      data: [
        { name: 'main', commit: { sha: 'sha-main' }, protected: true },
        { name: 'dev', commit: { sha: 'sha-dev' }, protected: false },
      ],
    })
  );
  const mockCreateRef = vi.fn(() => Promise.resolve({}));
  const mockCreatePR = vi.fn(() =>
    Promise.resolve({
      data: { number: 42, html_url: 'https://github.com/testuser/my-repo/pull/42' },
    })
  );
  const mockSearchCode = vi.fn(() =>
    Promise.resolve({
      data: {
        items: [
          {
            path: 'src/utils.ts',
            repository: { full_name: 'testuser/my-repo' },
            html_url: 'https://github.com/testuser/my-repo/blob/main/src/utils.ts',
          },
        ],
      },
    })
  );

  return {
    Octokit: vi.fn(() => ({
      rest: {
        users: { getAuthenticated: mockGetAuthenticated },
        repos: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
          getContent: mockGetContent,
          createOrUpdateFileContents: mockCreateOrUpdateFileContents,
          deleteFile: mockDeleteFile,
          listBranches: mockListBranches,
        },
        git: { createRef: mockCreateRef },
        pulls: { create: mockCreatePR },
        search: { code: mockSearchCode },
      },
    })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the mocked Octokit constructor without TS2344 issues.
 * Octokit's complex constructor type doesn't satisfy vi.mocked's constraint,
 * so we cast through unknown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMockedOctokit(): Promise<ReturnType<typeof vi.fn>> {
  const { Octokit } = await import('octokit');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Octokit as any;
}

// ============================================================================
// TESTS
// ============================================================================

describe('GitHub Client', () => {
  let mod: typeof import('./client');

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset GITHUB_PAT for each test
    process.env.GITHUB_PAT = 'test-token';
    mod = await import('./client');
  });

  // --------------------------------------------------------------------------
  // isGitHubConfigured
  // --------------------------------------------------------------------------

  describe('isGitHubConfigured', () => {
    it('should return true when GITHUB_PAT is set', () => {
      process.env.GITHUB_PAT = 'some-token';
      expect(mod.isGitHubConfigured()).toBe(true);
    });

    it('should return false when GITHUB_PAT is not set', () => {
      delete process.env.GITHUB_PAT;
      expect(mod.isGitHubConfigured()).toBe(false);
    });

    it('should return false when GITHUB_PAT is empty string', () => {
      process.env.GITHUB_PAT = '';
      expect(mod.isGitHubConfigured()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getAuthenticatedUser
  // --------------------------------------------------------------------------

  describe('getAuthenticatedUser', () => {
    it('should return user data when authenticated', async () => {
      const user = await mod.getAuthenticatedUser();
      expect(user).toEqual({ login: 'testuser', name: 'Test User' });
    });

    it('should return null when no token configured', async () => {
      delete process.env.GITHUB_PAT;
      const user = await mod.getAuthenticatedUser();
      expect(user).toBeNull();
    });

    it('should return null on API error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          users: {
            getAuthenticated: vi.fn(() => Promise.reject(new Error('API error'))),
          },
        },
      }));
      const user = await mod.getAuthenticatedUser();
      expect(user).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // listRepositories
  // --------------------------------------------------------------------------

  describe('listRepositories', () => {
    it('should return list of repositories', async () => {
      const repos = await mod.listRepositories();
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('my-repo');
      expect(repos[0].full_name).toBe('testuser/my-repo');
      expect(repos[0].html_url).toBe('https://github.com/testuser/my-repo');
    });

    it('should return empty array when no token', async () => {
      delete process.env.GITHUB_PAT;
      const repos = await mod.listRepositories();
      expect(repos).toEqual([]);
    });

    it('should pass options to API call', async () => {
      await mod.listRepositories({ type: 'private', sort: 'created', per_page: 10 });
      const mockedOctokit = await getMockedOctokit();
      const instance = mockedOctokit.mock.results[0]?.value;
      expect(instance.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        type: 'private',
        sort: 'created',
        per_page: 10,
      });
    });

    it('should use default options when none provided', async () => {
      await mod.listRepositories();
      const mockedOctokit = await getMockedOctokit();
      const instance = mockedOctokit.mock.results[0]?.value;
      expect(instance.rest.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        type: 'owner',
        sort: 'updated',
        per_page: 30,
      });
    });

    it('should return empty array on API error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            listForAuthenticatedUser: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const repos = await mod.listRepositories();
      expect(repos).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // listContents
  // --------------------------------------------------------------------------

  describe('listContents', () => {
    it('should return single file as array', async () => {
      const files = await mod.listContents('testuser', 'my-repo', 'src/index.ts');
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('index.ts');
      expect(files[0].sha).toBe('abc123');
    });

    it('should return empty array when no token', async () => {
      delete process.env.GITHUB_PAT;
      const files = await mod.listContents('testuser', 'my-repo');
      expect(files).toEqual([]);
    });

    it('should handle array response (directory listing)', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            getContent: vi.fn(() =>
              Promise.resolve({
                data: [
                  { name: 'file1.ts', path: 'src/file1.ts', type: 'file', size: 50, sha: 'sha1' },
                  { name: 'utils', path: 'src/utils', type: 'dir', size: 0, sha: 'sha2' },
                ],
              })
            ),
          },
        },
      }));
      const files = await mod.listContents('testuser', 'my-repo', 'src');
      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('file');
      expect(files[1].type).toBe('dir');
    });

    it('should return empty array on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            getContent: vi.fn(() => Promise.reject(new Error('Not found'))),
          },
        },
      }));
      const files = await mod.listContents('testuser', 'my-repo', 'nonexistent');
      expect(files).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getFileContent
  // --------------------------------------------------------------------------

  describe('getFileContent', () => {
    it('should decode base64 content', async () => {
      const file = await mod.getFileContent('testuser', 'my-repo', 'src/index.ts');
      expect(file).not.toBeNull();
      expect(file!.content).toBe('console.log("hello")');
      expect(file!.sha).toBe('abc123');
    });

    it('should return null when no token', async () => {
      delete process.env.GITHUB_PAT;
      const file = await mod.getFileContent('testuser', 'my-repo', 'src/index.ts');
      expect(file).toBeNull();
    });

    it('should return null for array data (directory)', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            getContent: vi.fn(() =>
              Promise.resolve({ data: [{ name: 'file.ts', path: 'file.ts', type: 'file' }] })
            ),
          },
        },
      }));
      const file = await mod.getFileContent('testuser', 'my-repo', 'src');
      expect(file).toBeNull();
    });

    it('should return null on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            getContent: vi.fn(() => Promise.reject(new Error('Not found'))),
          },
        },
      }));
      const file = await mod.getFileContent('testuser', 'my-repo', 'missing.ts');
      expect(file).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // createOrUpdateFile
  // --------------------------------------------------------------------------

  describe('createOrUpdateFile', () => {
    it('should create a new file', async () => {
      const result = await mod.createOrUpdateFile(
        'testuser',
        'my-repo',
        'new-file.ts',
        'console.log("new")',
        'Add new file'
      );
      expect(result).not.toBeNull();
      expect(result!.sha).toBe('new-sha-123');
      expect(result!.commit).toBe('commit-sha-456');
    });

    it('should return null when no token', async () => {
      delete process.env.GITHUB_PAT;
      const result = await mod.createOrUpdateFile(
        'testuser',
        'my-repo',
        'file.ts',
        'content',
        'msg'
      );
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            createOrUpdateFileContents: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const result = await mod.createOrUpdateFile(
        'testuser',
        'my-repo',
        'file.ts',
        'content',
        'msg'
      );
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // deleteFile
  // --------------------------------------------------------------------------

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const result = await mod.deleteFile(
        'testuser',
        'my-repo',
        'old-file.ts',
        'sha-to-delete',
        'Remove old file'
      );
      expect(result).toBe(true);
    });

    it('should return false when no token', async () => {
      delete process.env.GITHUB_PAT;
      const result = await mod.deleteFile('testuser', 'my-repo', 'file.ts', 'sha', 'msg');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            deleteFile: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const result = await mod.deleteFile('testuser', 'my-repo', 'file.ts', 'sha', 'msg');
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // listBranches
  // --------------------------------------------------------------------------

  describe('listBranches', () => {
    it('should return branch list', async () => {
      const branches = await mod.listBranches('testuser', 'my-repo');
      expect(branches).toHaveLength(2);
      expect(branches[0]).toEqual({ name: 'main', sha: 'sha-main', protected: true });
      expect(branches[1]).toEqual({ name: 'dev', sha: 'sha-dev', protected: false });
    });

    it('should return empty array when no token', async () => {
      delete process.env.GITHUB_PAT;
      const branches = await mod.listBranches('testuser', 'my-repo');
      expect(branches).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          repos: {
            listBranches: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const branches = await mod.listBranches('testuser', 'my-repo');
      expect(branches).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // createBranch
  // --------------------------------------------------------------------------

  describe('createBranch', () => {
    it('should create a branch successfully', async () => {
      const result = await mod.createBranch('testuser', 'my-repo', 'feature-branch', 'sha-main');
      expect(result).toBe(true);
    });

    it('should return false when no token', async () => {
      delete process.env.GITHUB_PAT;
      const result = await mod.createBranch('testuser', 'my-repo', 'branch', 'sha');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          git: {
            createRef: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const result = await mod.createBranch('testuser', 'my-repo', 'branch', 'sha');
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // createPullRequest
  // --------------------------------------------------------------------------

  describe('createPullRequest', () => {
    it('should create a PR and return number and url', async () => {
      const result = await mod.createPullRequest(
        'testuser',
        'my-repo',
        'Add feature',
        'Description of changes',
        'feature-branch',
        'main'
      );
      expect(result).not.toBeNull();
      expect(result!.number).toBe(42);
      expect(result!.html_url).toBe('https://github.com/testuser/my-repo/pull/42');
    });

    it('should return null when no token', async () => {
      delete process.env.GITHUB_PAT;
      const result = await mod.createPullRequest(
        'testuser',
        'my-repo',
        'title',
        'body',
        'head',
        'base'
      );
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          pulls: {
            create: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const result = await mod.createPullRequest(
        'testuser',
        'my-repo',
        'title',
        'body',
        'head',
        'base'
      );
      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // searchCode
  // --------------------------------------------------------------------------

  describe('searchCode', () => {
    it('should search code and return results', async () => {
      const results = await mod.searchCode('console.log');
      expect(results).toHaveLength(1);
      expect(results[0].path).toBe('src/utils.ts');
      expect(results[0].repository).toBe('testuser/my-repo');
    });

    it('should add repo filter to query when owner and repo given', async () => {
      await mod.searchCode('test query', 'owner1', 'repo1');
      const mockedOctokit = await getMockedOctokit();
      const instance = mockedOctokit.mock.results[0]?.value;
      expect(instance.rest.search.code).toHaveBeenCalledWith({
        q: 'test query repo:owner1/repo1',
        per_page: 20,
      });
    });

    it('should add user filter when only owner given', async () => {
      await mod.searchCode('test query', 'owner1');
      const mockedOctokit = await getMockedOctokit();
      const instance = mockedOctokit.mock.results[0]?.value;
      expect(instance.rest.search.code).toHaveBeenCalledWith({
        q: 'test query user:owner1',
        per_page: 20,
      });
    });

    it('should return empty array when no token', async () => {
      delete process.env.GITHUB_PAT;
      const results = await mod.searchCode('test');
      expect(results).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const mockedOctokit = await getMockedOctokit();
      mockedOctokit.mockImplementationOnce(() => ({
        rest: {
          search: {
            code: vi.fn(() => Promise.reject(new Error('Fail'))),
          },
        },
      }));
      const results = await mod.searchCode('test');
      expect(results).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Type exports
  // --------------------------------------------------------------------------

  describe('type exports', () => {
    it('should export GitHubRepo interface shape', () => {
      const repo: import('./client').GitHubRepo = {
        name: 'test',
        full_name: 'user/test',
        description: null,
        private: false,
        default_branch: 'main',
        html_url: 'https://github.com/user/test',
      };
      expect(repo.name).toBe('test');
    });

    it('should export GitHubFile interface shape', () => {
      const file: import('./client').GitHubFile = {
        name: 'file.ts',
        path: 'src/file.ts',
        type: 'file',
        size: 100,
        sha: 'abc',
      };
      expect(file.type).toBe('file');
    });

    it('should export GitHubFileContent interface shape', () => {
      const content: import('./client').GitHubFileContent = {
        name: 'file.ts',
        path: 'src/file.ts',
        content: 'code',
        sha: 'abc',
        encoding: 'base64',
      };
      expect(content.encoding).toBe('base64');
    });
  });
});
