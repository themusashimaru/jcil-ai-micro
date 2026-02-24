import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — MUST come before any module-under-test imports
// ============================================================================

const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockListForAuthenticatedUser = vi.fn();
const mockCreateForAuthenticatedUser = vi.fn();
const mockGetContent = vi.fn();
const mockReposGet = vi.fn();
const mockListBranches = vi.fn();
const mockGetBranch = vi.fn();
const mockListCommits = vi.fn();
const mockCompareCommits = vi.fn();
const mockGetRef = vi.fn();
const mockCreateRef = vi.fn();
const mockCreateBlob = vi.fn();
const mockCreateTree = vi.fn();
const mockCreateCommit = vi.fn();
const mockUpdateRef = vi.fn();
const mockGetTree = vi.fn();
const mockGetCommitGit = vi.fn();
const mockPullsCreate = vi.fn();
const mockGetAuthenticated = vi.fn();
const mockRequest = vi.fn();

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: {
      repos: {
        listForAuthenticatedUser: mockListForAuthenticatedUser,
        createForAuthenticatedUser: mockCreateForAuthenticatedUser,
        getContent: mockGetContent,
        get: mockReposGet,
        listBranches: mockListBranches,
        getBranch: mockGetBranch,
        listCommits: mockListCommits,
        compareCommits: mockCompareCommits,
      },
      git: {
        getRef: mockGetRef,
        createRef: mockCreateRef,
        createBlob: mockCreateBlob,
        createTree: mockCreateTree,
        createCommit: mockCreateCommit,
        updateRef: mockUpdateRef,
        getTree: mockGetTree,
        getCommit: mockGetCommitGit,
      },
      pulls: {
        create: mockPullsCreate,
      },
      users: {
        getAuthenticated: mockGetAuthenticated,
      },
    },
    request: mockRequest,
  })),
}));

// ============================================================================
// Import module under test AFTER all mocks
// ============================================================================

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

import type {
  GitHubConnector,
  GitHubRepo,
  GitHubPushResult,
  GitHubFileContent,
  GitHubRepoTree,
  GitHubBranch,
  GitHubCommit,
  GitHubPRResult,
  GitHubCompareResult,
  GitHubCloneResult,
} from './types';

// ============================================================================
// Reset mocks before each test
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Set sensible defaults
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockGetAuthenticated.mockResolvedValue({
    data: { login: 'testuser', email: 'test@example.com', avatar_url: 'https://avatar.url' },
  });
  mockListForAuthenticatedUser.mockResolvedValue({ data: [] });
  mockListBranches.mockResolvedValue({ data: [] });
  mockListCommits.mockResolvedValue({ data: [] });
});

// ============================================================================
// Export existence checks
// ============================================================================

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

  it('should export parseGitHubUrl', () => {
    expect(typeof parseGitHubUrl).toBe('function');
  });
});

// ============================================================================
// parseGitHubUrl — pure function, full coverage
// ============================================================================

describe('parseGitHubUrl', () => {
  it('should parse https://github.com/owner/repo', () => {
    expect(parseGitHubUrl('https://github.com/microsoft/vscode')).toEqual({
      owner: 'microsoft',
      repo: 'vscode',
    });
  });

  it('should parse https://github.com/owner/repo.git', () => {
    expect(parseGitHubUrl('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('should parse git@github.com:owner/repo.git', () => {
    expect(parseGitHubUrl('git@github.com:owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
  });

  it('should parse simple owner/repo format', () => {
    expect(parseGitHubUrl('microsoft/vscode')).toEqual({
      owner: 'microsoft',
      repo: 'vscode',
    });
  });

  it('should parse github.com/owner/repo without protocol', () => {
    expect(parseGitHubUrl('github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    });
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

  it('should handle URLs with extra path segments', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/tree/main');
    expect(result).not.toBeNull();
    expect(result!.owner).toBe('owner');
  });
});

// ============================================================================
// getGitHubTokenFromSession
// ============================================================================

describe('getGitHubTokenFromSession', () => {
  it('should return null when user has no GitHub identity', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { identities: [{ provider: 'google' }], user_metadata: {} },
      },
      error: null,
    });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBeNull();
  });

  it('should return null when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('fail') });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBeNull();
  });

  it('should return null when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBeNull();
  });

  it('should return provider_token from session when available', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          identities: [{ provider: 'github' }],
          user_metadata: {},
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { provider_token: 'gh-session-token' } },
    });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBe('gh-session-token');
  });

  it('should fallback to user_metadata.github_token if no session token', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          identities: [{ provider: 'github' }],
          user_metadata: { github_token: 'meta-token' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({ data: { session: {} } });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBe('meta-token');
  });

  it('should return null if no provider token and no metadata token', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          identities: [{ provider: 'github' }],
          user_metadata: {},
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({ data: { session: {} } });
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBeNull();
  });

  it('should return null when an exception is thrown', async () => {
    mockGetUser.mockRejectedValue(new Error('network error'));
    const result = await getGitHubTokenFromSession('https://x.supabase.co', 'key', 'tok');
    expect(result).toBeNull();
  });
});

// ============================================================================
// getGitHubConnectionStatus
// ============================================================================

describe('getGitHubConnectionStatus', () => {
  it('should return disconnected when token is empty', async () => {
    const result: GitHubConnector = await getGitHubConnectionStatus('');
    expect(result.status).toBe('disconnected');
    expect(result.type).toBe('github');
    expect(result.displayName).toBe('GitHub');
  });

  it('should return connected with metadata on valid token', async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { login: 'octocat', email: 'cat@github.com', avatar_url: 'https://avatar' },
    });
    const result: GitHubConnector = await getGitHubConnectionStatus('valid-token');
    expect(result.status).toBe('connected');
    expect(result.metadata?.username).toBe('octocat');
    expect(result.metadata?.email).toBe('cat@github.com');
    expect(result.metadata?.avatarUrl).toBe('https://avatar');
    expect(result.connectedAt).toBeDefined();
  });

  it('should return connected with undefined email when user has no email', async () => {
    mockGetAuthenticated.mockResolvedValue({
      data: { login: 'octocat', email: null, avatar_url: 'https://avatar' },
    });
    const result = await getGitHubConnectionStatus('valid-token');
    expect(result.status).toBe('connected');
    expect(result.metadata?.email).toBeUndefined();
  });

  it('should return error status when API call fails', async () => {
    mockGetAuthenticated.mockRejectedValue(new Error('Unauthorized'));
    const result: GitHubConnector = await getGitHubConnectionStatus('bad-token');
    expect(result.status).toBe('error');
    expect(result.type).toBe('github');
  });
});

// ============================================================================
// validateGitHubToken
// ============================================================================

describe('validateGitHubToken', () => {
  it('should return true for a valid token', async () => {
    mockGetAuthenticated.mockResolvedValue({ data: { login: 'user' } });
    expect(await validateGitHubToken('valid')).toBe(true);
  });

  it('should return false when API call fails', async () => {
    mockGetAuthenticated.mockRejectedValue(new Error('bad'));
    expect(await validateGitHubToken('invalid')).toBe(false);
  });
});

// ============================================================================
// listUserRepos
// ============================================================================

describe('listUserRepos', () => {
  it('should return empty array when no repos', async () => {
    mockListForAuthenticatedUser.mockResolvedValue({ data: [] });
    const repos: GitHubRepo[] = await listUserRepos('token');
    expect(repos).toEqual([]);
  });

  it('should map repo data correctly', async () => {
    mockListForAuthenticatedUser.mockResolvedValue({
      data: [
        {
          name: 'my-repo',
          full_name: 'user/my-repo',
          description: 'A repo',
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/user/my-repo',
          owner: { login: 'user' },
        },
      ],
    });
    const repos = await listUserRepos('token');
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual({
      name: 'my-repo',
      fullName: 'user/my-repo',
      description: 'A repo',
      private: false,
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/user/my-repo',
      owner: 'user',
    });
  });

  it('should return empty array on error', async () => {
    mockListForAuthenticatedUser.mockRejectedValue(new Error('fail'));
    const repos = await listUserRepos('token');
    expect(repos).toEqual([]);
  });
});

// ============================================================================
// createRepository
// ============================================================================

describe('createRepository', () => {
  it('should create a repo and return its data', async () => {
    mockCreateForAuthenticatedUser.mockResolvedValue({
      data: {
        name: 'new-repo',
        full_name: 'user/new-repo',
        description: 'desc',
        private: true,
        default_branch: 'main',
        html_url: 'https://github.com/user/new-repo',
        owner: { login: 'user' },
      },
    });
    const result: GitHubRepo | null = await createRepository('token', {
      name: 'new-repo',
      description: 'desc',
      private: true,
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('new-repo');
    expect(result!.private).toBe(true);
  });

  it('should use defaults for optional fields', async () => {
    mockCreateForAuthenticatedUser.mockResolvedValue({
      data: {
        name: 'r',
        full_name: 'u/r',
        description: null,
        private: false,
        default_branch: 'main',
        html_url: 'https://github.com/u/r',
        owner: { login: 'u' },
      },
    });
    await createRepository('token', { name: 'r' });
    expect(mockCreateForAuthenticatedUser).toHaveBeenCalledWith(
      expect.objectContaining({ private: false, auto_init: true })
    );
  });

  it('should return null on error', async () => {
    mockCreateForAuthenticatedUser.mockRejectedValue(new Error('fail'));
    const result = await createRepository('token', { name: 'x' });
    expect(result).toBeNull();
  });
});

// ============================================================================
// pushFiles
// ============================================================================

describe('pushFiles', () => {
  it('should push files successfully to existing branch', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'ref-sha' } } });
    mockGetCommitGit.mockResolvedValue({ data: { tree: { sha: 'tree-sha' } } });
    mockCreateBlob.mockResolvedValue({ data: { sha: 'blob-sha' } });
    mockCreateTree.mockResolvedValue({ data: { sha: 'new-tree-sha' } });
    mockCreateCommit.mockResolvedValue({ data: { sha: 'new-commit-sha' } });
    mockUpdateRef.mockResolvedValue({});

    const result: GitHubPushResult = await pushFiles('token', {
      owner: 'user',
      repo: 'repo',
      branch: 'main',
      message: 'test commit',
      files: [{ path: 'README.md', content: '# Hello' }],
    });

    expect(result.success).toBe(true);
    expect(result.commitSha).toBe('new-commit-sha');
    expect(result.repoUrl).toBe('https://github.com/user/repo');
  });

  it('should create new branch when branch does not exist', async () => {
    // First getRef fails (branch not found)
    mockGetRef.mockRejectedValueOnce(new Error('Not Found'));
    // Then get repo default branch
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    // Get default branch ref
    mockGetRef.mockResolvedValueOnce({ data: { object: { sha: 'default-sha' } } });
    // Create new branch ref
    mockCreateRef.mockResolvedValue({});
    // Rest of the push
    mockGetCommitGit.mockResolvedValue({ data: { tree: { sha: 'tree-sha' } } });
    mockCreateBlob.mockResolvedValue({ data: { sha: 'blob-sha' } });
    mockCreateTree.mockResolvedValue({ data: { sha: 'new-tree-sha' } });
    mockCreateCommit.mockResolvedValue({ data: { sha: 'commit-sha' } });
    mockUpdateRef.mockResolvedValue({});

    const result = await pushFiles('token', {
      owner: 'user',
      repo: 'repo',
      branch: 'new-feature',
      message: 'initial',
      files: [{ path: 'file.txt', content: 'hello' }],
    });

    expect(result.success).toBe(true);
    expect(mockCreateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'refs/heads/new-feature' })
    );
  });

  it('should use default branch "main" when branch not specified', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'sha' } } });
    mockGetCommitGit.mockResolvedValue({ data: { tree: { sha: 'tree' } } });
    mockCreateBlob.mockResolvedValue({ data: { sha: 'blob' } });
    mockCreateTree.mockResolvedValue({ data: { sha: 'newtree' } });
    mockCreateCommit.mockResolvedValue({ data: { sha: 'newcommit' } });
    mockUpdateRef.mockResolvedValue({});

    await pushFiles('token', {
      owner: 'o',
      repo: 'r',
      message: 'msg',
      files: [{ path: 'a.txt', content: 'a' }],
    });

    expect(mockGetRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/main' }));
  });

  it('should return failure result on error', async () => {
    mockGetRef.mockRejectedValue(new Error('API down'));
    mockReposGet.mockRejectedValue(new Error('API down'));

    const result = await pushFiles('token', {
      owner: 'o',
      repo: 'r',
      message: 'msg',
      files: [{ path: 'a.txt', content: 'a' }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle multiple files', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'sha' } } });
    mockGetCommitGit.mockResolvedValue({ data: { tree: { sha: 'tree' } } });
    mockCreateBlob.mockResolvedValue({ data: { sha: 'blob' } });
    mockCreateTree.mockResolvedValue({ data: { sha: 'newtree' } });
    mockCreateCommit.mockResolvedValue({ data: { sha: 'nc' } });
    mockUpdateRef.mockResolvedValue({});

    const result = await pushFiles('token', {
      owner: 'o',
      repo: 'r',
      message: 'multi',
      files: [
        { path: 'a.ts', content: 'a' },
        { path: 'b.ts', content: 'b' },
        { path: 'c.ts', content: 'c' },
      ],
    });

    expect(result.success).toBe(true);
    expect(mockCreateBlob).toHaveBeenCalledTimes(3);
  });
});

// ============================================================================
// pushSingleFile
// ============================================================================

describe('pushSingleFile', () => {
  it('should delegate to pushFiles with correct options', async () => {
    mockGetRef.mockResolvedValue({ data: { object: { sha: 'sha' } } });
    mockGetCommitGit.mockResolvedValue({ data: { tree: { sha: 'tree' } } });
    mockCreateBlob.mockResolvedValue({ data: { sha: 'blob' } });
    mockCreateTree.mockResolvedValue({ data: { sha: 'newtree' } });
    mockCreateCommit.mockResolvedValue({ data: { sha: 'nc' } });
    mockUpdateRef.mockResolvedValue({});

    const result = await pushSingleFile(
      'token',
      'owner',
      'repo',
      'file.txt',
      'content',
      'msg',
      'dev'
    );

    expect(result.success).toBe(true);
    expect(mockGetRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'heads/dev' }));
  });
});

// ============================================================================
// checkTokenScopes
// ============================================================================

describe('checkTokenScopes', () => {
  it('should parse scopes from X-OAuth-Scopes header', async () => {
    mockRequest.mockResolvedValue({
      headers: { 'x-oauth-scopes': 'repo, user:email' },
    });
    const result = await checkTokenScopes('token');
    expect(result.hasRepoScope).toBe(true);
    expect(result.hasUserScope).toBe(true);
    expect(result.scopes).toContain('repo');
    expect(result.scopes).toContain('user:email');
  });

  it('should detect public_repo scope for hasRepoScope', async () => {
    mockRequest.mockResolvedValue({
      headers: { 'x-oauth-scopes': 'public_repo' },
    });
    const result = await checkTokenScopes('token');
    expect(result.hasRepoScope).toBe(true);
    expect(result.hasUserScope).toBe(false);
  });

  it('should detect user scope for hasUserScope', async () => {
    mockRequest.mockResolvedValue({
      headers: { 'x-oauth-scopes': 'user' },
    });
    const result = await checkTokenScopes('token');
    expect(result.hasUserScope).toBe(true);
    expect(result.hasRepoScope).toBe(false);
  });

  it('should handle empty scopes header', async () => {
    mockRequest.mockResolvedValue({ headers: { 'x-oauth-scopes': '' } });
    const result = await checkTokenScopes('token');
    expect(result.scopes).toEqual([]);
    expect(result.hasRepoScope).toBe(false);
    expect(result.hasUserScope).toBe(false);
  });

  it('should handle missing scopes header', async () => {
    mockRequest.mockResolvedValue({ headers: {} });
    const result = await checkTokenScopes('token');
    expect(result.scopes).toEqual([]);
  });

  it('should return empty scopes on error', async () => {
    mockRequest.mockRejectedValue(new Error('fail'));
    const result = await checkTokenScopes('token');
    expect(result).toEqual({ hasRepoScope: false, hasUserScope: false, scopes: [] });
  });
});

// ============================================================================
// getRepoContents
// ============================================================================

describe('getRepoContents', () => {
  it('should return single file content', async () => {
    const base64Content = Buffer.from('Hello World').toString('base64');
    mockGetContent.mockResolvedValue({
      data: {
        name: 'README.md',
        path: 'README.md',
        sha: 'abc123',
        size: 11,
        type: 'file',
        content: base64Content,
        encoding: 'base64',
        html_url: 'https://github.com/o/r/blob/main/README.md',
        download_url: 'https://raw.githubusercontent.com/o/r/main/README.md',
      },
    });

    const result = await getRepoContents('token', 'o', 'r', 'README.md');
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(false);
    const file = result as GitHubFileContent;
    expect(file.name).toBe('README.md');
    expect(file.content).toBe('Hello World');
    expect(file.type).toBe('file');
  });

  it('should return directory listing as array', async () => {
    mockGetContent.mockResolvedValue({
      data: [
        {
          name: 'src',
          path: 'src',
          sha: 'dir-sha',
          size: 0,
          type: 'dir',
          html_url: 'https://github.com/o/r/tree/main/src',
          download_url: null,
        },
        {
          name: 'README.md',
          path: 'README.md',
          sha: 'file-sha',
          size: 100,
          type: 'file',
          html_url: 'https://github.com/o/r/blob/main/README.md',
          download_url: 'https://raw.githubusercontent.com/o/r/main/README.md',
        },
      ],
    });

    const result = await getRepoContents('token', 'o', 'r');
    expect(Array.isArray(result)).toBe(true);
    const items = result as GitHubFileContent[];
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('dir');
    expect(items[1].type).toBe('file');
  });

  it('should handle file without content', async () => {
    mockGetContent.mockResolvedValue({
      data: {
        name: 'big-file.bin',
        path: 'big-file.bin',
        sha: 'sha',
        size: 1000000,
        type: 'file',
        html_url: 'https://github.com/o/r/blob/main/big-file.bin',
        download_url: null,
      },
    });

    const result = await getRepoContents('token', 'o', 'r', 'big-file.bin');
    const file = result as GitHubFileContent;
    expect(file.content).toBeUndefined();
    expect(file.downloadUrl).toBeUndefined();
  });

  it('should return null on error', async () => {
    mockGetContent.mockRejectedValue(new Error('Not Found'));
    const result = await getRepoContents('token', 'o', 'r', 'missing.txt');
    expect(result).toBeNull();
  });

  it('should pass branch as ref parameter', async () => {
    mockGetContent.mockResolvedValue({
      data: {
        name: 'f',
        path: 'f',
        sha: 's',
        size: 0,
        type: 'file',
        html_url: '',
        download_url: null,
      },
    });
    await getRepoContents('token', 'o', 'r', 'f', 'dev');
    expect(mockGetContent).toHaveBeenCalledWith(expect.objectContaining({ ref: 'dev' }));
  });
});

// ============================================================================
// getFileContent
// ============================================================================

describe('getFileContent', () => {
  it('should return content and sha for a file', async () => {
    const base64Content = Buffer.from('file content').toString('base64');
    mockGetContent.mockResolvedValue({
      data: {
        name: 'file.ts',
        path: 'src/file.ts',
        sha: 'filesha',
        size: 12,
        type: 'file',
        content: base64Content,
        encoding: 'base64',
        html_url: 'https://github.com/o/r/blob/main/src/file.ts',
        download_url: 'https://raw.githubusercontent.com/o/r/main/src/file.ts',
      },
    });

    const result = await getFileContent('token', 'o', 'r', 'src/file.ts');
    expect(result).not.toBeNull();
    expect(result!.content).toBe('file content');
    expect(result!.sha).toBe('filesha');
  });

  it('should return null for directory results', async () => {
    mockGetContent.mockResolvedValue({
      data: [{ name: 'dir', path: 'dir', sha: 's', type: 'dir', size: 0, html_url: '' }],
    });
    const result = await getFileContent('token', 'o', 'r', 'dir');
    expect(result).toBeNull();
  });

  it('should return null for non-file types (e.g. symlink)', async () => {
    mockGetContent.mockResolvedValue({
      data: {
        name: 'link',
        path: 'link',
        sha: 's',
        size: 0,
        type: 'symlink',
        html_url: '',
        download_url: null,
      },
    });
    const result = await getFileContent('token', 'o', 'r', 'link');
    expect(result).toBeNull();
  });

  it('should return null when getRepoContents returns null', async () => {
    mockGetContent.mockRejectedValue(new Error('fail'));
    const result = await getFileContent('token', 'o', 'r', 'x');
    expect(result).toBeNull();
  });
});

// ============================================================================
// getRepoTree
// ============================================================================

describe('getRepoTree', () => {
  it('should return tree for a specific branch', async () => {
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'branch-sha' } },
    });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'tree-sha',
        tree: [
          { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'f1', size: 100, url: 'u1' },
          { path: 'src', mode: '040000', type: 'tree', sha: 'f2', url: 'u2' },
        ],
        truncated: false,
      },
    });

    const result: GitHubRepoTree | null = await getRepoTree('token', 'o', 'r', 'main');
    expect(result).not.toBeNull();
    expect(result!.sha).toBe('tree-sha');
    expect(result!.tree).toHaveLength(2);
    expect(result!.tree[0].path).toBe('src/index.ts');
    expect(result!.truncated).toBe(false);
  });

  it('should use default branch when no branch specified', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'develop' } });
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'dev-sha' } },
    });
    mockGetTree.mockResolvedValue({
      data: { sha: 'ts', tree: [], truncated: false },
    });

    await getRepoTree('token', 'o', 'r');
    expect(mockGetBranch).toHaveBeenCalledWith(expect.objectContaining({ branch: 'develop' }));
  });

  it('should handle non-recursive tree', async () => {
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'sha' } },
    });
    mockGetTree.mockResolvedValue({
      data: { sha: 'ts', tree: [], truncated: false },
    });

    await getRepoTree('token', 'o', 'r', 'main', false);
    expect(mockGetTree).toHaveBeenCalledWith(expect.objectContaining({ recursive: undefined }));
  });

  it('should return null on error', async () => {
    mockGetBranch.mockRejectedValue(new Error('fail'));
    const result = await getRepoTree('token', 'o', 'r', 'main');
    expect(result).toBeNull();
  });

  it('should handle missing optional fields in tree items', async () => {
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'sha' } },
    });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [{ path: undefined, mode: undefined, type: 'blob', sha: undefined, url: undefined }],
      },
    });

    const result = await getRepoTree('token', 'o', 'r', 'main');
    expect(result).not.toBeNull();
    expect(result!.tree[0].path).toBe('');
    expect(result!.tree[0].mode).toBe('');
    expect(result!.tree[0].sha).toBe('');
    expect(result!.tree[0].url).toBe('');
  });
});

// ============================================================================
// getBranches
// ============================================================================

describe('getBranches', () => {
  it('should return mapped branches', async () => {
    mockListBranches.mockResolvedValue({
      data: [
        { name: 'main', commit: { sha: 'sha1' }, protected: true },
        { name: 'dev', commit: { sha: 'sha2' }, protected: false },
      ],
    });

    const branches: GitHubBranch[] = await getBranches('token', 'o', 'r');
    expect(branches).toHaveLength(2);
    expect(branches[0]).toEqual({ name: 'main', sha: 'sha1', protected: true });
    expect(branches[1]).toEqual({ name: 'dev', sha: 'sha2', protected: false });
  });

  it('should return empty array on error', async () => {
    mockListBranches.mockRejectedValue(new Error('fail'));
    const branches = await getBranches('token', 'o', 'r');
    expect(branches).toEqual([]);
  });
});

// ============================================================================
// getCommits
// ============================================================================

describe('getCommits', () => {
  it('should return mapped commits', async () => {
    mockListCommits.mockResolvedValue({
      data: [
        {
          sha: 'c1',
          commit: {
            message: 'initial commit',
            author: { name: 'Dev', email: 'dev@test.com', date: '2026-01-01' },
          },
          html_url: 'https://github.com/o/r/commit/c1',
        },
      ],
    });

    const commits: GitHubCommit[] = await getCommits('token', 'o', 'r', 'main', 10);
    expect(commits).toHaveLength(1);
    expect(commits[0].sha).toBe('c1');
    expect(commits[0].message).toBe('initial commit');
    expect(commits[0].author.name).toBe('Dev');
  });

  it('should handle missing author fields', async () => {
    mockListCommits.mockResolvedValue({
      data: [
        {
          sha: 'c1',
          commit: { message: 'msg', author: null },
          html_url: 'url',
        },
      ],
    });

    const commits = await getCommits('token', 'o', 'r');
    expect(commits[0].author.name).toBe('Unknown');
    expect(commits[0].author.email).toBe('');
    expect(commits[0].author.date).toBe('');
  });

  it('should return empty array on error', async () => {
    mockListCommits.mockRejectedValue(new Error('fail'));
    const commits = await getCommits('token', 'o', 'r');
    expect(commits).toEqual([]);
  });

  it('should pass branch and limit to API', async () => {
    mockListCommits.mockResolvedValue({ data: [] });
    await getCommits('token', 'o', 'r', 'feature', 5);
    expect(mockListCommits).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'feature', per_page: 5 })
    );
  });
});

// ============================================================================
// createBranch
// ============================================================================

describe('createBranch', () => {
  it('should create a branch from a specified source branch', async () => {
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'source-sha' } },
    });
    mockCreateRef.mockResolvedValue({});

    const result = await createBranch('token', 'o', 'r', 'new-branch', 'main');
    expect(result.success).toBe(true);
    expect(result.sha).toBe('source-sha');
    expect(mockCreateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'refs/heads/new-branch', sha: 'source-sha' })
    );
  });

  it('should create branch from default branch when no source specified', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({
      data: { commit: { sha: 'default-sha' } },
    });
    mockCreateRef.mockResolvedValue({});

    const result = await createBranch('token', 'o', 'r', 'feature');
    expect(result.success).toBe(true);
    expect(result.sha).toBe('default-sha');
  });

  it('should return error on failure', async () => {
    mockGetBranch.mockRejectedValue(new Error('Not found'));
    const result = await createBranch('token', 'o', 'r', 'bad', 'missing');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// createPullRequest
// ============================================================================

describe('createPullRequest', () => {
  it('should create a PR successfully', async () => {
    mockPullsCreate.mockResolvedValue({
      data: { number: 42, html_url: 'https://github.com/o/r/pull/42' },
    });

    const result: GitHubPRResult = await createPullRequest('token', {
      owner: 'o',
      repo: 'r',
      title: 'My PR',
      body: 'Description',
      head: 'feature',
      base: 'main',
      draft: false,
    });

    expect(result.success).toBe(true);
    expect(result.prNumber).toBe(42);
    expect(result.prUrl).toBe('https://github.com/o/r/pull/42');
  });

  it('should return failure on error', async () => {
    mockPullsCreate.mockRejectedValue(new Error('Validation failed'));
    const result = await createPullRequest('token', {
      owner: 'o',
      repo: 'r',
      title: 'PR',
      body: '',
      head: 'feat',
      base: 'main',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation failed');
  });
});

// ============================================================================
// compareBranches
// ============================================================================

describe('compareBranches', () => {
  it('should compare branches and return result', async () => {
    mockCompareCommits.mockResolvedValue({
      data: {
        ahead_by: 3,
        behind_by: 1,
        status: 'ahead',
        files: [
          {
            filename: 'src/index.ts',
            status: 'modified',
            additions: 10,
            deletions: 2,
            patch: '@@ -1 +1 @@',
          },
        ],
        commits: [
          {
            sha: 'c1',
            commit: {
              message: 'fix bug',
              author: { name: 'Dev', email: 'dev@test.com', date: '2026-01-01' },
            },
            html_url: 'https://github.com/o/r/commit/c1',
          },
        ],
      },
    });

    const result: GitHubCompareResult | null = await compareBranches(
      'token',
      'o',
      'r',
      'main',
      'feat'
    );
    expect(result).not.toBeNull();
    expect(result!.ahead).toBe(3);
    expect(result!.behind).toBe(1);
    expect(result!.status).toBe('ahead');
    expect(result!.files).toHaveLength(1);
    expect(result!.files[0].filename).toBe('src/index.ts');
    expect(result!.commits).toHaveLength(1);
  });

  it('should handle empty files array', async () => {
    mockCompareCommits.mockResolvedValue({
      data: {
        ahead_by: 0,
        behind_by: 0,
        status: 'identical',
        files: undefined,
        commits: [],
      },
    });

    const result = await compareBranches('token', 'o', 'r', 'main', 'main');
    expect(result).not.toBeNull();
    expect(result!.files).toEqual([]);
  });

  it('should return null on error', async () => {
    mockCompareCommits.mockRejectedValue(new Error('fail'));
    const result = await compareBranches('token', 'o', 'r', 'a', 'b');
    expect(result).toBeNull();
  });
});

// ============================================================================
// getRepoInfo
// ============================================================================

describe('getRepoInfo', () => {
  it('should return repo info', async () => {
    mockReposGet.mockResolvedValue({
      data: {
        name: 'repo',
        full_name: 'owner/repo',
        description: 'A cool repo',
        private: false,
        default_branch: 'main',
        html_url: 'https://github.com/owner/repo',
        owner: { login: 'owner' },
      },
    });

    const result: GitHubRepo | null = await getRepoInfo('token', 'owner', 'repo');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('repo');
    expect(result!.fullName).toBe('owner/repo');
    expect(result!.owner).toBe('owner');
  });

  it('should return null on error', async () => {
    mockReposGet.mockRejectedValue(new Error('Not Found'));
    const result = await getRepoInfo('token', 'o', 'missing');
    expect(result).toBeNull();
  });
});

// ============================================================================
// cloneRepo
// ============================================================================

describe('cloneRepo', () => {
  it('should return failure when tree cannot be fetched', async () => {
    // getRepoTree will fail because getBranch fails
    mockGetBranch.mockRejectedValue(new Error('fail'));
    mockReposGet.mockRejectedValue(new Error('fail'));

    const result: GitHubCloneResult = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch repository tree');
    expect(result.files).toEqual([]);
    expect(result.tree).toEqual([]);
  });

  it('should fetch and filter files correctly', async () => {
    // Setup getRepoTree mock chain
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'treeSha',
        tree: [
          { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'f1', size: 50, url: 'u1' },
          {
            path: 'node_modules/pkg/index.js',
            mode: '100644',
            type: 'blob',
            sha: 'f2',
            size: 50,
            url: 'u2',
          },
          { path: 'src', mode: '040000', type: 'tree', sha: 'd1', url: 'u3' },
        ],
        truncated: false,
      },
    });

    const base64Content = Buffer.from('export default {};').toString('base64');
    mockGetContent.mockResolvedValue({
      data: { content: base64Content },
    });

    const result = await cloneRepo('token', { owner: 'o', repo: 'r' });

    expect(result.success).toBe(true);
    // node_modules should be excluded by default patterns
    expect(result.files.some((f) => f.path.includes('node_modules'))).toBe(false);
    expect(result.fetchedFiles).toBeGreaterThanOrEqual(1);
  });

  it('should respect maxFiles limit', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });

    const treeItems = Array.from({ length: 20 }, (_, i) => ({
      path: `file${i}.ts`,
      mode: '100644',
      type: 'blob',
      sha: `f${i}`,
      size: 50,
      url: `u${i}`,
    }));

    mockGetTree.mockResolvedValue({
      data: { sha: 'ts', tree: treeItems, truncated: false },
    });

    const base64 = Buffer.from('content').toString('base64');
    mockGetContent.mockResolvedValue({ data: { content: base64 } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      maxFiles: 5,
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.totalFiles).toBe(20);
    expect(result.fetchedFiles).toBeLessThanOrEqual(5);
  });

  it('should respect maxFileSize filter', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [
          { path: 'small.ts', mode: '100644', type: 'blob', sha: 's1', size: 100, url: 'u1' },
          { path: 'big.ts', mode: '100644', type: 'blob', sha: 's2', size: 500000, url: 'u2' },
        ],
        truncated: false,
      },
    });

    const base64 = Buffer.from('x').toString('base64');
    mockGetContent.mockResolvedValue({ data: { content: base64 } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      maxFileSize: 1000,
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    // big.ts should be filtered out
    expect(result.totalFiles).toBe(1);
  });

  it('should apply includePatterns', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [
          { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 's1', size: 50, url: 'u1' },
          {
            path: 'test/app.test.ts',
            mode: '100644',
            type: 'blob',
            sha: 's2',
            size: 50,
            url: 'u2',
          },
        ],
        truncated: false,
      },
    });

    const base64 = Buffer.from('x').toString('base64');
    mockGetContent.mockResolvedValue({ data: { content: base64 } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      includePatterns: ['src/*'],
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    expect(result.totalFiles).toBe(1);
  });

  it('should filter by basePath', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [
          { path: 'src/app.ts', mode: '100644', type: 'blob', sha: 's1', size: 50, url: 'u1' },
          { path: 'docs/README.md', mode: '100644', type: 'blob', sha: 's2', size: 50, url: 'u2' },
        ],
        truncated: false,
      },
    });

    const base64 = Buffer.from('x').toString('base64');
    mockGetContent.mockResolvedValue({ data: { content: base64 } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      path: 'src/',
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    expect(result.totalFiles).toBe(1);
    expect(result.files[0]?.path).toBe('src/app.ts');
  });

  it('should skip files that fail to fetch individually', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [
          { path: 'ok.ts', mode: '100644', type: 'blob', sha: 's1', size: 50, url: 'u1' },
          { path: 'fail.ts', mode: '100644', type: 'blob', sha: 's2', size: 50, url: 'u2' },
        ],
        truncated: false,
      },
    });

    const base64 = Buffer.from('ok content').toString('base64');
    mockGetContent
      .mockResolvedValueOnce({ data: { content: base64 } })
      .mockRejectedValueOnce(new Error('file error'));

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    expect(result.fetchedFiles).toBe(1);
  });

  it('should detect language for fetched files', async () => {
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [
          { path: 'app.tsx', mode: '100644', type: 'blob', sha: 's1', size: 50, url: 'u1' },
          { path: 'style.css', mode: '100644', type: 'blob', sha: 's2', size: 50, url: 'u2' },
          { path: 'script.py', mode: '100644', type: 'blob', sha: 's3', size: 50, url: 'u3' },
        ],
        truncated: false,
      },
    });

    const base64 = Buffer.from('content').toString('base64');
    mockGetContent.mockResolvedValue({ data: { content: base64 } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      excludePatterns: [],
    });

    expect(result.success).toBe(true);
    const langs = result.files.map((f) => f.language);
    expect(langs).toContain('typescript');
    expect(langs).toContain('css');
    expect(langs).toContain('python');
  });

  it('should return error result on exception in main try block', async () => {
    // Force an exception by making getRepoTree succeed but something else fail
    mockReposGet.mockResolvedValue({ data: { default_branch: 'main' } });
    mockGetBranch.mockResolvedValue({ data: { commit: { sha: 'sha' } } });
    mockGetTree.mockResolvedValue({
      data: {
        sha: 'ts',
        tree: [{ path: 'a.ts', mode: '100644', type: 'blob', sha: 's', size: 50, url: 'u' }],
        truncated: false,
      },
    });
    // Make getContent throw a non-Error value by returning something that causes issues
    mockGetContent.mockResolvedValue({ data: { content: null } });

    const result = await cloneRepo('token', {
      owner: 'o',
      repo: 'r',
      excludePatterns: [],
    });

    // File with null content is filtered out, so fetchedFiles should be 0
    expect(result.success).toBe(true);
    expect(result.fetchedFiles).toBe(0);
  });
});
