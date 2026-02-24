import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}));

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        listForAuthenticatedUser: vi.fn().mockResolvedValue({ data: [] }),
        createForAuthenticatedUser: vi.fn(),
        getContent: vi.fn(),
        get: vi.fn(),
        listBranches: vi.fn().mockResolvedValue({ data: [] }),
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
        compareCommits: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
      git: {
        getRef: vi.fn(),
        createRef: vi.fn(),
        createBlob: vi.fn(),
        createTree: vi.fn(),
        createCommit: vi.fn(),
        updateRef: vi.fn(),
        getTree: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
      },
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({ data: { login: 'testuser' } }),
      },
    },
    request: vi.fn(),
  })),
}));

import {
  getGitHubTokenFromSession,
  getGitHubConnectionStatus,
  validateGitHubToken,
  listUserRepos,
  createRepository,
  pushFiles,
  pushSingleFile,
  checkTokenScopes,
  getRepoContents,
  getFileContent,
  getRepoTree,
  getBranches,
  getCommits,
  cloneRepo,
  createBranch,
  createPullRequest,
  compareBranches,
  getRepoInfo,
  parseGitHubUrl,
} from './github';

// -------------------------------------------------------------------
// parseGitHubUrl (pure function - full test coverage)
// -------------------------------------------------------------------
describe('parseGitHubUrl', () => {
  it('should parse https://github.com/owner/repo', () => {
    const result = parseGitHubUrl('https://github.com/microsoft/vscode');
    expect(result).toEqual({ owner: 'microsoft', repo: 'vscode' });
  });

  it('should parse https://github.com/owner/repo.git', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse git@github.com:owner/repo.git', () => {
    const result = parseGitHubUrl('git@github.com:owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should parse simple owner/repo format', () => {
    const result = parseGitHubUrl('microsoft/vscode');
    expect(result).toEqual({ owner: 'microsoft', repo: 'vscode' });
  });

  it('should parse github.com/owner/repo without https', () => {
    const result = parseGitHubUrl('github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('should return null for invalid URLs', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseGitHubUrl('')).toBeNull();
  });

  it('should return null for just a single word', () => {
    expect(parseGitHubUrl('foobar')).toBeNull();
  });

  it('should handle URLs with trailing slashes or extra paths', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/tree/main');
    expect(result).not.toBeNull();
    expect(result!.owner).toBe('owner');
  });
});

// -------------------------------------------------------------------
// Export existence checks
// -------------------------------------------------------------------
describe('GitHub connector exports', () => {
  it('should export getGitHubTokenFromSession', () => {
    expect(typeof getGitHubTokenFromSession).toBe('function');
  });

  it('should export getGitHubConnectionStatus', () => {
    expect(typeof getGitHubConnectionStatus).toBe('function');
  });

  it('should export validateGitHubToken', () => {
    expect(typeof validateGitHubToken).toBe('function');
  });

  it('should export listUserRepos', () => {
    expect(typeof listUserRepos).toBe('function');
  });

  it('should export createRepository', () => {
    expect(typeof createRepository).toBe('function');
  });

  it('should export pushFiles', () => {
    expect(typeof pushFiles).toBe('function');
  });

  it('should export pushSingleFile', () => {
    expect(typeof pushSingleFile).toBe('function');
  });

  it('should export checkTokenScopes', () => {
    expect(typeof checkTokenScopes).toBe('function');
  });

  it('should export getRepoContents', () => {
    expect(typeof getRepoContents).toBe('function');
  });

  it('should export getFileContent', () => {
    expect(typeof getFileContent).toBe('function');
  });

  it('should export getRepoTree', () => {
    expect(typeof getRepoTree).toBe('function');
  });

  it('should export getBranches', () => {
    expect(typeof getBranches).toBe('function');
  });

  it('should export getCommits', () => {
    expect(typeof getCommits).toBe('function');
  });

  it('should export cloneRepo', () => {
    expect(typeof cloneRepo).toBe('function');
  });

  it('should export createBranch', () => {
    expect(typeof createBranch).toBe('function');
  });

  it('should export createPullRequest', () => {
    expect(typeof createPullRequest).toBe('function');
  });

  it('should export compareBranches', () => {
    expect(typeof compareBranches).toBe('function');
  });

  it('should export getRepoInfo', () => {
    expect(typeof getRepoInfo).toBe('function');
  });
});

// -------------------------------------------------------------------
// getGitHubTokenFromSession
// -------------------------------------------------------------------
describe('getGitHubTokenFromSession', () => {
  it('should return null when user has no GitHub identity', async () => {
    const result = await getGitHubTokenFromSession('https://example.supabase.co', 'key', 'token');
    expect(result).toBeNull();
  });
});

// -------------------------------------------------------------------
// validateGitHubToken
// -------------------------------------------------------------------
describe('validateGitHubToken', () => {
  it('should return true for a valid token', async () => {
    const result = await validateGitHubToken('valid-token');
    expect(result).toBe(true);
  });
});

// -------------------------------------------------------------------
// listUserRepos
// -------------------------------------------------------------------
describe('listUserRepos', () => {
  it('should return array of repos', async () => {
    const repos = await listUserRepos('test-token');
    expect(Array.isArray(repos)).toBe(true);
  });
});
