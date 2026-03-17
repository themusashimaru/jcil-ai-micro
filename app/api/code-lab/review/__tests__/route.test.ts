import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockRateLimiters = {
  codeLabEdit: vi.fn().mockResolvedValue({ allowed: true }),
};
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: mockRateLimiters,
}));

vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

const mockFetchPRInfo = vi.fn();
const mockFetchPRDiff = vi.fn();
const mockReviewPR = vi.fn();
const mockFormatReviewAsMarkdown = vi.fn();
const mockPostReviewToGitHub = vi.fn();
vi.mock('@/lib/code-review', () => ({
  fetchPRInfo: (...args: unknown[]) => mockFetchPRInfo(...args),
  fetchPRDiff: (...args: unknown[]) => mockFetchPRDiff(...args),
  reviewPR: (...args: unknown[]) => mockReviewPR(...args),
  formatReviewAsMarkdown: (...args: unknown[]) => mockFormatReviewAsMarkdown(...args),
  postReviewToGitHub: (...args: unknown[]) => mockPostReviewToGitHub(...args),
}));

const mockSafeDecrypt = vi.fn();
vi.mock('@/lib/security/crypto', () => ({
  safeDecrypt: (...args: unknown[]) => mockSafeDecrypt(...args),
}));

const mockAdminSupabaseSingle = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: (...args: unknown[]) => mockAdminSupabaseSingle(...args),
        }),
      }),
    }),
  }),
}));

// Import after mocks
const { GET, POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function createGetRequest(queryParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/code-lab/review');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, { method: 'GET' });
}

function createPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/code-lab/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

function mock401() {
  return new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
    status: 401,
  });
}

const mockPRInfo = {
  number: 42,
  title: 'Add feature X',
  author: 'testuser',
  state: 'open',
  additions: 50,
  deletions: 10,
  changedFiles: 3,
  base: { ref: 'main' },
  head: { ref: 'feature-x' },
};

const mockReview = {
  summary: 'Good PR overall',
  score: 8,
  issues: [],
  suggestions: [],
};

// ========================================
// TESTS
// ========================================

describe('GET /api/code-lab/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: { from: vi.fn() },
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await GET(createGetRequest({ owner: 'test', repo: 'repo', pr: '1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required params', async () => {
    const res = await GET(createGetRequest({ owner: 'test' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Missing');
  });

  it('returns 400 when GitHub not connected', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: null },
      error: null,
    });

    const res = await GET(createGetRequest({ owner: 'test', repo: 'repo', pr: '1' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('GitHub not connected');
  });

  it('returns 400 when token decryption fails', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue(null);

    const res = await GET(createGetRequest({ owner: 'test', repo: 'repo', pr: '1' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Invalid GitHub token');
  });

  it('returns 404 when PR not found', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(null);

    const res = await GET(createGetRequest({ owner: 'test', repo: 'repo', pr: '42' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('returns PR info successfully', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(mockPRInfo);

    const res = await GET(createGetRequest({ owner: 'test', repo: 'repo', pr: '42' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.pr).toMatchObject({
      number: 42,
      title: 'Add feature X',
      author: 'testuser',
    });
    expect(mockFetchPRInfo).toHaveBeenCalledWith('test', 'repo', 42, 'ghp_decrypted_token');
  });
});

describe('POST /api/code-lab/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: { from: vi.fn() },
    });
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 42 }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 42 }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when missing required fields', async () => {
    const res = await POST(createPostRequest({ owner: 'test' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Missing');
  });

  it('returns 400 when GitHub not connected', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: null },
      error: null,
    });

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 42 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('GitHub not connected');
  });

  it('reviews PR successfully', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(mockPRInfo);
    mockFetchPRDiff.mockResolvedValue([{ filename: 'src/index.ts', patch: '+const x = 1;' }]);
    mockReviewPR.mockResolvedValue(mockReview);
    mockFormatReviewAsMarkdown.mockReturnValue('# Review\nGood PR overall');

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 42 }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.review).toMatchObject({
      summary: 'Good PR overall',
      score: 8,
    });
    expect(data.markdown).toBe('# Review\nGood PR overall');
    expect(data.pr).toMatchObject({ number: 42 });
    expect(data.postedToGitHub).toBe(false);

    expect(mockFetchPRInfo).toHaveBeenCalledWith('test', 'repo', 42, 'ghp_decrypted_token');
    expect(mockFetchPRDiff).toHaveBeenCalledWith('test', 'repo', 42, 'ghp_decrypted_token');
    expect(mockReviewPR).toHaveBeenCalledWith(mockPRInfo, expect.any(Array), {});
  });

  it('posts review to GitHub when requested', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(mockPRInfo);
    mockFetchPRDiff.mockResolvedValue([{ filename: 'src/index.ts', patch: '+const x = 1;' }]);
    mockReviewPR.mockResolvedValue(mockReview);
    mockFormatReviewAsMarkdown.mockReturnValue('# Review');
    mockPostReviewToGitHub.mockResolvedValue(true);

    const res = await POST(
      createPostRequest({
        owner: 'test',
        repo: 'repo',
        prNumber: 42,
        postToGitHub: true,
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.postedToGitHub).toBe(true);
    expect(mockPostReviewToGitHub).toHaveBeenCalledWith(
      'test',
      'repo',
      42,
      mockReview,
      'ghp_decrypted_token'
    );
  });

  it('returns 404 when PR not found', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(null);

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 999 }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when no changes found in PR', async () => {
    mockAdminSupabaseSingle.mockResolvedValue({
      data: { github_token: 'encrypted-token' },
      error: null,
    });
    mockSafeDecrypt.mockReturnValue('ghp_decrypted_token');
    mockFetchPRInfo.mockResolvedValue(mockPRInfo);
    mockFetchPRDiff.mockResolvedValue([]);

    const res = await POST(createPostRequest({ owner: 'test', repo: 'repo', prNumber: 42 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('No changes found');
  });
});
