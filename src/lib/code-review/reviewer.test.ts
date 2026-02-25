import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'Good PR overall. Minor issues found.',
                overallRating: 'approve',
                comments: [
                  {
                    file: 'src/app.ts',
                    line: 42,
                    severity: 'warning',
                    category: 'security',
                    message: 'Validate input before use',
                    suggestion: 'Use zod schema',
                  },
                  {
                    file: 'src/app.ts',
                    severity: 'praise',
                    category: 'general',
                    message: 'Good error handling',
                  },
                ],
                securityConcerns: ['Input validation needed'],
                performanceConcerns: [],
                recommendations: ['Add input validation'],
              }),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  fetchPRInfo,
  fetchPRDiff,
  reviewPR,
  formatReviewAsMarkdown,
  postReviewToGitHub,
} from './reviewer';
import type { PRInfo, FileDiff, CodeReviewResult, ReviewComment, ReviewOptions } from './types';

// ----- Test data -----
const mockPRInfo: PRInfo = {
  number: 42,
  title: 'Add user authentication',
  description: 'Implements login and signup',
  author: 'testuser',
  baseBranch: 'main',
  headBranch: 'feat/auth',
  filesChanged: 3,
  additions: 100,
  deletions: 20,
  url: 'https://github.com/owner/repo/pull/42',
};

const mockDiffs: FileDiff[] = [
  {
    filename: 'src/auth.ts',
    status: 'added',
    additions: 50,
    deletions: 0,
    patch: '@@ -0,0 +1,50 @@\n+export function login() { }',
  },
  {
    filename: 'src/routes.ts',
    status: 'modified',
    additions: 30,
    deletions: 10,
    patch: '@@ -10,5 +10,25 @@\n-old code\n+new code',
  },
];

describe('fetchPRInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and parse PR info from GitHub', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          number: 42,
          title: 'Test PR',
          body: 'Description',
          user: { login: 'testuser' },
          base: { ref: 'main' },
          head: { ref: 'feat/test' },
          changed_files: 3,
          additions: 100,
          deletions: 20,
          html_url: 'https://github.com/owner/repo/pull/42',
        }),
    });

    const result = await fetchPRInfo('owner', 'repo', 42, 'token123');
    expect(result).not.toBeNull();
    expect(result!.number).toBe(42);
    expect(result!.title).toBe('Test PR');
    expect(result!.author).toBe('testuser');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/42',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token123',
        }),
      })
    );
  });

  it('should return null when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await fetchPRInfo('owner', 'repo', 42, 'token');
    expect(result).toBeNull();
  });

  it('should return null on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchPRInfo('owner', 'repo', 42, 'token');
    expect(result).toBeNull();
  });

  it('should handle missing optional fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          number: 1,
          title: 'PR',
          body: null,
          user: null,
          base: null,
          head: null,
          changed_files: null,
          additions: null,
          deletions: null,
          html_url: '',
        }),
    });

    const result = await fetchPRInfo('owner', 'repo', 1, 'token');
    expect(result!.description).toBe('');
    expect(result!.author).toBe('unknown');
    expect(result!.baseBranch).toBe('main');
    expect(result!.headBranch).toBe('unknown');
  });
});

describe('fetchPRDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and parse PR file diffs', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            filename: 'src/app.ts',
            status: 'modified',
            additions: 10,
            deletions: 5,
            patch: '@@ some diff',
            previous_filename: undefined,
          },
        ]),
    });

    const diffs = await fetchPRDiff('owner', 'repo', 42, 'token');
    expect(diffs).toHaveLength(1);
    expect(diffs[0].filename).toBe('src/app.ts');
    expect(diffs[0].status).toBe('modified');
  });

  it('should return empty array on error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));
    const diffs = await fetchPRDiff('owner', 'repo', 42, 'token');
    expect(diffs).toEqual([]);
  });

  it('should return empty array when response not ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const diffs = await fetchPRDiff('owner', 'repo', 42, 'token');
    expect(diffs).toEqual([]);
  });

  it('should handle files without patch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([{ filename: 'binary.png', status: 'added', additions: 0, deletions: 0 }]),
    });

    const diffs = await fetchPRDiff('owner', 'repo', 42, 'token');
    expect(diffs[0].patch).toBe('');
  });
});

describe('reviewPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform a code review and return structured result', async () => {
    const result = await reviewPR(mockPRInfo, mockDiffs);

    expect(result.summary).toBeDefined();
    expect(result.overallRating).toBe('approve');
    expect(result.comments).toBeInstanceOf(Array);
    expect(result.statistics).toBeDefined();
    expect(result.statistics.warnings).toBeGreaterThanOrEqual(0);
    expect(result.securityConcerns).toBeInstanceOf(Array);
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  it('should respect maxComments option', async () => {
    const result = await reviewPR(mockPRInfo, mockDiffs, { maxComments: 1 });
    expect(result.comments.length).toBeLessThanOrEqual(1);
  });

  it('should filter line comments when includeLineComments=false', async () => {
    const result = await reviewPR(mockPRInfo, mockDiffs, { includeLineComments: false });
    // Comments with a line number should be filtered out
    for (const c of result.comments) {
      expect(c.line).toBeUndefined();
    }
  });

  it('should handle API errors by throwing', async () => {
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockRejectedValue(new Error('API error')),
        },
      })),
    }));
    vi.doMock('@/lib/logger', () => ({
      logger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
    }));

    const { reviewPR: reviewFn } = await import('./reviewer');
    await expect(reviewFn(mockPRInfo, mockDiffs)).rejects.toThrow('API error');
  });

  it('should create fallback review when JSON parsing fails', async () => {
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => ({
      default: vi.fn().mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'This is not JSON at all.' }],
          }),
        },
      })),
    }));
    vi.doMock('@/lib/logger', () => ({
      logger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
    }));

    const { reviewPR: reviewFn } = await import('./reviewer');
    const result = await reviewFn(mockPRInfo, mockDiffs);
    expect(result.summary).toContain('Review completed');
    expect(result.overallRating).toBe('comment');
    expect(result.comments[0].category).toBe('general');
  });
});

describe('formatReviewAsMarkdown', () => {
  it('should format review result as markdown', () => {
    const review: CodeReviewResult = {
      summary: 'Good PR overall',
      overallRating: 'approve',
      comments: [
        {
          file: 'src/app.ts',
          line: 10,
          severity: 'warning',
          category: 'security',
          message: 'Validate input',
        },
        { file: 'src/app.ts', severity: 'praise', category: 'general', message: 'Nice!' },
        {
          file: 'src/other.ts',
          severity: 'suggestion',
          category: 'style',
          message: 'Use const',
          suggestion: 'const x = 1;',
        },
      ],
      statistics: { criticalIssues: 0, warnings: 1, suggestions: 1, praises: 1 },
      securityConcerns: ['Input validation needed'],
      performanceConcerns: ['N+1 query'],
      recommendations: ['Add tests'],
    };

    const md = formatReviewAsMarkdown(review, mockPRInfo);
    expect(md).toContain('Code Review: Add user authentication');
    expect(md).toContain('APPROVE');
    expect(md).toContain('Good PR overall');
    expect(md).toContain('Input validation needed');
    expect(md).toContain('N+1 query');
    expect(md).toContain('src/app.ts');
    expect(md).toContain('src/other.ts');
    expect(md).toContain('Suggestion');
    expect(md).toContain('const x = 1;');
    expect(md).toContain('Add tests');
  });

  it('should handle review with no comments', () => {
    const review: CodeReviewResult = {
      summary: 'Clean',
      overallRating: 'approve',
      comments: [],
      statistics: { criticalIssues: 0, warnings: 0, suggestions: 0, praises: 0 },
      securityConcerns: [],
      performanceConcerns: [],
      recommendations: [],
    };

    const md = formatReviewAsMarkdown(review, mockPRInfo);
    expect(md).toContain('Clean');
    expect(md).not.toContain('Comments');
  });
});

describe('postReviewToGitHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should post review to GitHub and return true on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const review: CodeReviewResult = {
      summary: 'LGTM',
      overallRating: 'approve',
      comments: [],
      statistics: { criticalIssues: 0, warnings: 0, suggestions: 0, praises: 0 },
      securityConcerns: [],
      performanceConcerns: [],
      recommendations: ['Add tests'],
    };

    const result = await postReviewToGitHub('owner', 'repo', 42, review, 'token');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/pulls/42/reviews',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      })
    );
  });

  it('should return false on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const review: CodeReviewResult = {
      summary: 'Review',
      overallRating: 'comment',
      comments: [],
      statistics: { criticalIssues: 0, warnings: 0, suggestions: 0, praises: 0 },
      securityConcerns: [],
      performanceConcerns: [],
      recommendations: [],
    };

    const result = await postReviewToGitHub('owner', 'repo', 42, review, 'token');
    expect(result).toBe(false);
  });

  it('should map request-changes rating to REQUEST_CHANGES event', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const review: CodeReviewResult = {
      summary: 'Needs changes',
      overallRating: 'request-changes',
      comments: [],
      statistics: { criticalIssues: 2, warnings: 0, suggestions: 0, praises: 0 },
      securityConcerns: [],
      performanceConcerns: [],
      recommendations: [],
    };

    await postReviewToGitHub('owner', 'repo', 42, review, 'token');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.event).toBe('REQUEST_CHANGES');
  });
});

describe('Type exports', () => {
  it('should export ReviewOptions shape', () => {
    const opts: ReviewOptions = {
      focusAreas: ['security', 'performance'],
      maxComments: 10,
      includeLineComments: true,
      strictMode: false,
    };
    expect(opts.focusAreas).toHaveLength(2);
  });

  it('should export ReviewComment shape', () => {
    const comment: ReviewComment = {
      file: 'test.ts',
      severity: 'critical',
      category: 'bug',
      message: 'Null pointer',
    };
    expect(comment.severity).toBe('critical');
  });
});
