import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGitHub, isGitHubAvailable, githubTool } from './github-tool';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'gh-1', name: 'github', arguments: args, sessionId: 'test-session' };
}

function mockGithubAPI(data: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map([['content-type', 'application/json']]),
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  delete process.env.GITHUB_TOKEN;
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('githubTool metadata', () => {
  it('should have correct name', () => {
    expect(githubTool.name).toBe('github');
  });

  it('should require action', () => {
    expect(githubTool.parameters.required).toContain('action');
  });

  it('should have correct action enum', () => {
    const props = githubTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.action.enum).toContain('search_code');
    expect(props.action.enum).toContain('search_repos');
    expect(props.action.enum).toContain('search_issues');
    expect(props.action.enum).toContain('get_file');
    expect(props.action.enum).toContain('list_dir');
    expect(props.action.enum).toContain('get_repo');
  });
});

describe('isGitHubAvailable', () => {
  it('should return true', () => {
    expect(isGitHubAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeGitHub - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeGitHub({
      id: 'x',
      name: 'wrong_tool',
      arguments: { action: 'search_code', query: 'test' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error for unknown action', async () => {
    const res = await executeGitHub(makeCall({ action: 'invalid_action' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown action');
  });

  it('should error for search_code without query', async () => {
    const res = await executeGitHub(makeCall({ action: 'search_code' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Query required');
  });

  it('should error for search_repos without query', async () => {
    const res = await executeGitHub(makeCall({ action: 'search_repos' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Query required');
  });

  it('should error for search_issues without query', async () => {
    const res = await executeGitHub(makeCall({ action: 'search_issues' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Query required');
  });

  it('should error for get_file without owner/repo/path', async () => {
    const res = await executeGitHub(makeCall({ action: 'get_file' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Owner, repo, and path required');
  });

  it('should error for list_dir without owner/repo', async () => {
    const res = await executeGitHub(makeCall({ action: 'list_dir' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Owner and repo required');
  });

  it('should error for get_repo without owner/repo', async () => {
    const res = await executeGitHub(makeCall({ action: 'get_repo' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Owner and repo required');
  });

  it('should error for list_repos without token', async () => {
    const res = await executeGitHub(makeCall({ action: 'list_repos' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('GitHub connection required');
  });

  it('should error for get_structure without token', async () => {
    const res = await executeGitHub(
      makeCall({ action: 'get_structure', owner: 'foo', repo: 'bar' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('GitHub connection required');
  });

  it('should error for get_context without token', async () => {
    const res = await executeGitHub(makeCall({ action: 'get_context', owner: 'foo', repo: 'bar' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('GitHub connection required');
  });

  it('should return toolCallId', async () => {
    const res = await executeGitHub(makeCall({ action: 'invalid' }));
    expect(res.toolCallId).toBe('gh-1');
  });
});

// -------------------------------------------------------------------
// search_code
// -------------------------------------------------------------------
describe('executeGitHub - search_code', () => {
  it('should search code and format results', async () => {
    mockGithubAPI({
      total_count: 2,
      items: [
        {
          name: 'util.ts',
          path: 'src/util.ts',
          repository: { full_name: 'user/repo', html_url: 'https://github.com/user/repo' },
          html_url: 'https://github.com/user/repo/blob/main/src/util.ts',
        },
        {
          name: 'helper.ts',
          path: 'lib/helper.ts',
          repository: { full_name: 'user/repo2', html_url: 'https://github.com/user/repo2' },
          html_url: 'https://github.com/user/repo2/blob/main/lib/helper.ts',
        },
      ],
    });

    const res = await executeGitHub(makeCall({ action: 'search_code', query: 'useState' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Found 2 code matches');
    expect(res.content).toContain('user/repo');
    expect(res.content).toContain('src/util.ts');
  });

  it('should handle no results', async () => {
    mockGithubAPI({ total_count: 0, items: [] });
    const res = await executeGitHub(
      makeCall({ action: 'search_code', query: 'nonexistent123456' })
    );
    expect(res.content).toContain('No code matches found');
  });
});

// -------------------------------------------------------------------
// search_repos
// -------------------------------------------------------------------
describe('executeGitHub - search_repos', () => {
  it('should search repos and format results', async () => {
    mockGithubAPI({
      total_count: 1,
      items: [
        {
          full_name: 'facebook/react',
          description: 'A JavaScript library for building UIs',
          html_url: 'https://github.com/facebook/react',
          stargazers_count: 200000,
          language: 'JavaScript',
          updated_at: '2026-02-24',
        },
      ],
    });

    const res = await executeGitHub(makeCall({ action: 'search_repos', query: 'react' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('facebook/react');
    expect(res.content).toContain('200000 stars');
    expect(res.content).toContain('JavaScript');
  });

  it('should handle no repos found', async () => {
    mockGithubAPI({ total_count: 0, items: [] });
    const res = await executeGitHub(makeCall({ action: 'search_repos', query: 'zzzznoexist' }));
    expect(res.content).toContain('No repositories found');
  });
});

// -------------------------------------------------------------------
// search_issues
// -------------------------------------------------------------------
describe('executeGitHub - search_issues', () => {
  it('should search issues and format results', async () => {
    mockGithubAPI({
      total_count: 1,
      items: [
        {
          title: 'Bug: memory leak',
          number: 42,
          state: 'open',
          html_url: 'https://github.com/user/repo/issues/42',
          user: { login: 'devuser' },
          created_at: '2026-01-15',
          repository_url: 'https://api.github.com/repos/user/repo',
        },
      ],
    });

    const res = await executeGitHub(makeCall({ action: 'search_issues', query: 'memory leak' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Bug: memory leak');
    expect(res.content).toContain('#42');
    expect(res.content).toContain('devuser');
    expect(res.content).toContain('Issue');
  });

  it('should detect pull requests', async () => {
    mockGithubAPI({
      total_count: 1,
      items: [
        {
          title: 'Fix: performance',
          number: 10,
          state: 'closed',
          html_url: 'https://github.com/user/repo/pull/10',
          user: { login: 'dev' },
          created_at: '2026-01-01',
          repository_url: 'https://api.github.com/repos/user/repo',
          pull_request: { url: 'https://...' },
        },
      ],
    });

    const res = await executeGitHub(makeCall({ action: 'search_issues', query: 'perf' }));
    expect(res.content).toContain('PR');
  });
});

// -------------------------------------------------------------------
// get_file
// -------------------------------------------------------------------
describe('executeGitHub - get_file', () => {
  it('should get file content', async () => {
    mockGithubAPI({
      type: 'file',
      content: Buffer.from('console.log("hello")').toString('base64'),
      encoding: 'base64',
      size: 20,
      html_url: 'https://github.com/user/repo/blob/main/index.ts',
    });

    const res = await executeGitHub(
      makeCall({ action: 'get_file', owner: 'user', repo: 'repo', path: 'index.ts' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('console.log("hello")');
    expect(res.content).toContain('20 bytes');
  });

  it('should handle directory instead of file', async () => {
    mockGithubAPI({ type: 'dir' });
    const res = await executeGitHub(
      makeCall({ action: 'get_file', owner: 'user', repo: 'repo', path: 'src' })
    );
    expect(res.content).toContain('not a file');
  });
});

// -------------------------------------------------------------------
// list_dir
// -------------------------------------------------------------------
describe('executeGitHub - list_dir', () => {
  it('should list directory contents', async () => {
    mockGithubAPI([
      { name: 'src', type: 'dir', size: 0, path: 'src' },
      { name: 'README.md', type: 'file', size: 450, path: 'README.md' },
      { name: 'package.json', type: 'file', size: 1200, path: 'package.json' },
    ]);

    const res = await executeGitHub(makeCall({ action: 'list_dir', owner: 'user', repo: 'repo' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('src');
    expect(res.content).toContain('README.md');
    expect(res.content).toContain('450 bytes');
  });
});

// -------------------------------------------------------------------
// get_repo
// -------------------------------------------------------------------
describe('executeGitHub - get_repo', () => {
  it('should get repo info', async () => {
    mockGithubAPI({
      full_name: 'user/repo',
      description: 'A cool project',
      html_url: 'https://github.com/user/repo',
      stargazers_count: 100,
      forks_count: 20,
      open_issues_count: 5,
      language: 'TypeScript',
      default_branch: 'main',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2026-02-24T00:00:00Z',
      topics: ['typescript', 'react'],
      license: { name: 'MIT' },
    });

    const res = await executeGitHub(makeCall({ action: 'get_repo', owner: 'user', repo: 'repo' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('user/repo');
    expect(res.content).toContain('A cool project');
    expect(res.content).toContain('100');
    expect(res.content).toContain('TypeScript');
    expect(res.content).toContain('MIT');
    expect(res.content).toContain('typescript, react');
  });
});

// -------------------------------------------------------------------
// API error handling
// -------------------------------------------------------------------
describe('executeGitHub - API errors', () => {
  it('should handle 404', async () => {
    mockGithubAPI(null, 404);
    const res = await executeGitHub(
      makeCall({ action: 'get_repo', owner: 'user', repo: 'notfound' })
    );
    expect(res.content).toContain('Not found');
  });

  it('should handle 403 rate limit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Map([['x-ratelimit-remaining', '0']]),
      json: () => Promise.resolve({}),
    });
    const res = await executeGitHub(makeCall({ action: 'get_repo', owner: 'user', repo: 'repo' }));
    expect(res.content).toContain('rate limit');
  });

  it('should handle 403 forbidden', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Map(),
      json: () => Promise.resolve({}),
    });
    const res = await executeGitHub(
      makeCall({ action: 'get_repo', owner: 'user', repo: 'private-repo' })
    );
    expect(res.content).toContain('forbidden');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));
    const res = await executeGitHub(makeCall({ action: 'search_code', query: 'test' }));
    expect(res.content).toContain('Network failed');
  });

  it('should handle timeout', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));
    const res = await executeGitHub(makeCall({ action: 'search_code', query: 'test' }));
    expect(res.content).toContain('timed out');
  });

  it('should handle string arguments', async () => {
    mockGithubAPI({ total_count: 0, items: [] });
    const res = await executeGitHub({
      id: 'gh-2',
      name: 'github',
      arguments: JSON.stringify({ action: 'search_code', query: 'test' }),
      sessionId: 'test-session',
    });
    expect(res.toolCallId).toBe('gh-2');
  });
});

// -------------------------------------------------------------------
// Token resolution
// -------------------------------------------------------------------
describe('executeGitHub - token resolution', () => {
  it('should use GITHUB_TOKEN env var', async () => {
    process.env.GITHUB_TOKEN = 'env-token-123';
    mockGithubAPI({ total_count: 0, items: [] });

    await executeGitHub(makeCall({ action: 'search_code', query: 'test' }));

    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers.Authorization).toBe('Bearer env-token-123');

    delete process.env.GITHUB_TOKEN;
  });

  it('should prefer user token over env token', async () => {
    process.env.GITHUB_TOKEN = 'env-token';
    mockGithubAPI({ total_count: 0, items: [] });

    await executeGitHub(
      makeCall({ action: 'search_code', query: 'test', _githubToken: 'user-token-456' })
    );

    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers.Authorization).toBe('Bearer user-token-456');

    delete process.env.GITHUB_TOKEN;
  });

  it('should work without token', async () => {
    mockGithubAPI({ total_count: 0, items: [] });

    await executeGitHub(makeCall({ action: 'search_code', query: 'test' }));

    const [, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchOptions.headers.Authorization).toBeUndefined();
  });
});
