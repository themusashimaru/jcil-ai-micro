/**
 * GITHUB REPO CONTEXT TESTS
 *
 * Tests for repository context detection and fetching:
 * - detectRepoRequest (exported)
 * - fetchRepoContext (exported)
 * - getGitHubContextForMessage (exported)
 * - getLanguageFromPath (internal, tested indirectly)
 * - formatRepoContext (internal, tested indirectly)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — All defined INSIDE factories (hoisting-safe)
// ============================================================================

vi.mock('@/lib/connectors', () => ({
  cloneRepo: vi.fn(() =>
    Promise.resolve({
      success: true,
      files: [
        {
          path: 'src/index.ts',
          content: 'export const hello = "world";',
          size: 30,
          language: 'typescript',
        },
        {
          path: 'package.json',
          content: '{"name":"test"}',
          size: 15,
          language: 'json',
        },
      ],
      tree: [
        { path: 'src', type: 'tree', sha: 'sha1' },
        { path: 'src/index.ts', type: 'blob', sha: 'sha2' },
      ],
      truncated: false,
      totalFiles: 2,
      fetchedFiles: 2,
    })
  ),
  getRepoInfo: vi.fn(() =>
    Promise.resolve({
      name: 'my-repo',
      fullName: 'testuser/my-repo',
      description: 'A test repository',
      defaultBranch: 'main',
    })
  ),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('detectRepoRequest', () => {
  let detectRepoRequest: typeof import('./repoContext').detectRepoRequest;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./repoContext');
    detectRepoRequest = mod.detectRepoRequest;
  });

  // --- GitHub URL detection ---

  it('should detect GitHub URL in message', () => {
    const result = detectRepoRequest('Check https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
  });

  it('should detect GitHub URL without https prefix', () => {
    const result = detectRepoRequest('Look at github.com/myuser/myrepo please');
    expect(result.detected).toBe(true);
    expect(result.owner).toBe('myuser');
    expect(result.repo).toBe('myrepo');
  });

  it('should default to analyze action for bare URL', () => {
    const result = detectRepoRequest('https://github.com/owner/repo');
    expect(result.action).toBe('analyze');
  });

  // --- Action detection with URL ---

  it('should detect review action with URL', () => {
    const result = detectRepoRequest('review my code at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('review');
  });

  it('should detect analyze action with URL', () => {
    const result = detectRepoRequest('analyze the codebase at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('analyze');
  });

  it('should detect explain action with URL (matching pattern)', () => {
    const result = detectRepoRequest('explain my code at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('explain');
  });

  it('should fallback to analyze when explain pattern has extra words', () => {
    // "explain the code" does not match /explain\s+(?:my\s+)?(?:code)/ due to "the"
    const result = detectRepoRequest('explain the code at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('analyze');
  });

  it('should detect improve action with URL (matching pattern)', () => {
    const result = detectRepoRequest('improve my project at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('improve');
  });

  it('should fallback to analyze when improve pattern has extra words', () => {
    // "improve the project" does not match /improve\s+(?:my\s+)?(?:project)/ due to "the"
    const result = detectRepoRequest('improve the project at https://github.com/owner/repo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('analyze');
  });

  // --- Short format detection ---

  it('should detect short format owner/repo with action keyword', () => {
    const result = detectRepoRequest('review my code in testuser/myrepo');
    expect(result.detected).toBe(true);
    expect(result.owner).toBe('testuser');
    expect(result.repo).toBe('myrepo');
  });

  it('should not detect short format when pattern has extra words between keyword and subject', () => {
    // "review the code" does not match /review\s+(?:my\s+)?(?:code)/ due to "the"
    const result = detectRepoRequest('review the code in testuser/myrepo');
    expect(result.detected).toBe(false);
  });

  it('should not detect short format without action keyword', () => {
    const result = detectRepoRequest('something about testuser/myrepo here');
    expect(result.detected).toBe(false);
  });

  it('should skip false positive node_modules in short format', () => {
    const result = detectRepoRequest('review code in node_modules/package');
    expect(result.detected).toBe(false);
  });

  it('should skip false positive src in short format', () => {
    const result = detectRepoRequest('review the code in src/utils');
    expect(result.detected).toBe(false);
  });

  it('should skip false positive dist in short format', () => {
    const result = detectRepoRequest('review code in dist/bundle');
    expect(result.detected).toBe(false);
  });

  // --- No detection ---

  it('should return detected=false for non-repo messages', () => {
    const result = detectRepoRequest('What is the weather today?');
    expect(result.detected).toBe(false);
    expect(result.action).toBe('none');
  });

  it('should return detected=false for empty message', () => {
    const result = detectRepoRequest('');
    expect(result.detected).toBe(false);
  });

  // --- Action patterns ---

  it('should detect "code review" pattern', () => {
    const result = detectRepoRequest('I need a code review of https://github.com/user/repo');
    expect(result.action).toBe('review');
  });

  it('should detect "debug" pattern with short format', () => {
    const result = detectRepoRequest('help me debug my code in myuser/myproject');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('review');
  });

  it('should detect "refactor" pattern', () => {
    const result = detectRepoRequest('refactor https://github.com/user/repo');
    expect(result.action).toBe('improve');
  });

  it('should detect "what is wrong with" pattern', () => {
    const result = detectRepoRequest("what's wrong with https://github.com/user/repo");
    expect(result.action).toBe('review');
  });

  it('should detect "check my code" pattern with short format', () => {
    const result = detectRepoRequest('check my code at owner/myrepo');
    expect(result.detected).toBe(true);
    expect(result.action).toBe('review');
  });

  it('should detect "look at my repo" pattern', () => {
    const result = detectRepoRequest('look at my repo https://github.com/user/repo');
    expect(result.action).toBe('analyze');
  });
});

// ============================================================================
// fetchRepoContext
// ============================================================================

describe('fetchRepoContext', () => {
  let fetchRepoContext: typeof import('./repoContext').fetchRepoContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./repoContext');
    fetchRepoContext = mod.fetchRepoContext;
  });

  it('should fetch repo context successfully', async () => {
    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.success).toBe(true);
    expect(result.contextString).toContain('testuser/my-repo');
    expect(result.repoInfo?.name).toBe('my-repo');
  });

  it('should include repo description in context', async () => {
    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.contextString).toContain('A test repository');
  });

  it('should include stats in result', async () => {
    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.stats).toBeDefined();
    expect(result.stats!.totalFiles).toBe(2);
    expect(result.stats!.fetchedFiles).toBe(2);
    expect(result.stats!.truncated).toBe(false);
  });

  it('should return error when repo not found', async () => {
    const { getRepoInfo } = await import('@/lib/connectors');
    vi.mocked(getRepoInfo).mockResolvedValueOnce(null);

    const result = await fetchRepoContext('token', 'testuser', 'nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Repository not found');
  });

  it('should return error when clone fails', async () => {
    const { cloneRepo } = await import('@/lib/connectors');
    vi.mocked(cloneRepo).mockResolvedValueOnce({
      success: false,
      files: [],
      tree: [],
      truncated: false,
      totalFiles: 0,
      fetchedFiles: 0,
      error: 'Clone failed',
    });

    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Clone failed');
  });

  it('should pass focusOnSource option', async () => {
    await fetchRepoContext('token', 'testuser', 'my-repo', { focusOnSource: true });
    const { cloneRepo } = await import('@/lib/connectors');
    expect(vi.mocked(cloneRepo)).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        includePatterns: expect.arrayContaining(['*.ts', '*.tsx']),
      })
    );
  });

  it('should pass maxFiles option', async () => {
    await fetchRepoContext('token', 'testuser', 'my-repo', { maxFiles: 100 });
    const { cloneRepo } = await import('@/lib/connectors');
    expect(vi.mocked(cloneRepo)).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ maxFiles: 100 })
    );
  });

  it('should include file contents in context string', async () => {
    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.contextString).toContain('src/index.ts');
  });

  it('should include directory structure in context', async () => {
    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.contextString).toContain('Directory Structure');
    expect(result.contextString).toContain('src/');
  });

  it('should handle exceptions gracefully', async () => {
    const { getRepoInfo } = await import('@/lib/connectors');
    vi.mocked(getRepoInfo).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should handle non-Error exceptions', async () => {
    const { getRepoInfo } = await import('@/lib/connectors');
    vi.mocked(getRepoInfo).mockRejectedValueOnce('string error');

    const result = await fetchRepoContext('token', 'testuser', 'my-repo');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch repository');
  });
});

// ============================================================================
// getGitHubContextForMessage
// ============================================================================

describe('getGitHubContextForMessage', () => {
  let getGitHubContextForMessage: typeof import('./repoContext').getGitHubContextForMessage;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./repoContext');
    getGitHubContextForMessage = mod.getGitHubContextForMessage;
  });

  it('should return hasContext=false for non-repo messages', async () => {
    const result = await getGitHubContextForMessage('Hello world', 'token');
    expect(result.hasContext).toBe(false);
    expect(result.context).toBe('');
  });

  it('should return error when no github token', async () => {
    const result = await getGitHubContextForMessage('review https://github.com/user/repo', null);
    expect(result.hasContext).toBe(false);
    expect(result.error).toContain('GitHub not connected');
  });

  it('should fetch and return context for valid repo request', async () => {
    const result = await getGitHubContextForMessage(
      'review https://github.com/testuser/my-repo',
      'valid-token'
    );
    expect(result.hasContext).toBe(true);
    expect(result.context).toContain('testuser/my-repo');
  });

  it('should append review action prompt', async () => {
    const result = await getGitHubContextForMessage(
      'review my code at https://github.com/testuser/my-repo',
      'valid-token'
    );
    expect(result.context).toContain('review this code');
  });

  it('should append analyze action prompt', async () => {
    const result = await getGitHubContextForMessage(
      'analyze the code at https://github.com/testuser/my-repo',
      'valid-token'
    );
    expect(result.context).toContain('analyze this codebase');
  });

  it('should return error when fetchRepoContext fails', async () => {
    const { getRepoInfo } = await import('@/lib/connectors');
    vi.mocked(getRepoInfo).mockResolvedValueOnce(null);

    const result = await getGitHubContextForMessage(
      'review https://github.com/testuser/nonexistent',
      'valid-token'
    );
    expect(result.hasContext).toBe(false);
    expect(result.error).toContain('Repository not found');
  });
});

// ============================================================================
// Type exports
// ============================================================================

describe('RepoRequest type', () => {
  it('should have correct shape', () => {
    const request: import('./repoContext').RepoRequest = {
      detected: true,
      owner: 'user',
      repo: 'repo',
      action: 'review',
    };
    expect(request.detected).toBe(true);
    expect(request.action).toBe('review');
  });

  it('should support all action types', () => {
    const actions: import('./repoContext').RepoRequest['action'][] = [
      'review',
      'analyze',
      'explain',
      'improve',
      'none',
    ];
    expect(actions).toHaveLength(5);
  });
});

describe('RepoContext type', () => {
  it('should have correct shape', () => {
    const ctx: import('./repoContext').RepoContext = {
      success: true,
      contextString: 'content',
      repoInfo: {
        name: 'repo',
        fullName: 'user/repo',
        description: 'desc',
        defaultBranch: 'main',
      },
      stats: {
        totalFiles: 10,
        fetchedFiles: 5,
        truncated: false,
      },
    };
    expect(ctx.success).toBe(true);
    expect(ctx.repoInfo!.name).toBe('repo');
  });
});
