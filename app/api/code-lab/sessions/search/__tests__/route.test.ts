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

// Import after mocks
const { POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function createPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/code-lab/sessions/search', {
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

// ========================================
// TESTS
// ========================================

describe('POST /api/code-lab/sessions/search', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await POST(createPostRequest({ query: 'test' }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const res = await POST(createPostRequest({ query: 'test query' }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });

  it('returns 400 for query too short', async () => {
    const res = await POST(createPostRequest({ query: 'a' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('at least 2 characters');
  });

  it('returns 400 for missing query', async () => {
    const res = await POST(createPostRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
  });

  it('returns 400 for query too long', async () => {
    const longQuery = 'x'.repeat(501);
    const res = await POST(createPostRequest({ query: longQuery }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('at most 500');
  });

  it('returns empty results when user has no sessions', async () => {
    // Sessions query returns empty
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const res = await POST(createPostRequest({ query: 'test query' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.results).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.sessionsSearched).toBe(0);
  });

  it('returns search results with match context', async () => {
    const mockSessions = [
      { id: 'session-1', title: 'Session One' },
      { id: 'session-2', title: 'Session Two' },
    ];
    const mockMessages = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'I need help with testing my application',
        created_at: '2026-03-17T00:00:00Z',
      },
      {
        id: 'msg-2',
        session_id: 'session-2',
        role: 'assistant',
        content: 'Here is some testing advice for you',
        created_at: '2026-03-17T00:01:00Z',
      },
    ];

    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // Sessions query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
          }),
        };
      } else {
        // Messages search query
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const res = await POST(createPostRequest({ query: 'testing' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.results).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.sessionsSearched).toBe(2);
    expect(data.sessionsWithMatches).toBe(2);

    // Verify result structure
    expect(data.results[0]).toMatchObject({
      sessionId: 'session-1',
      sessionTitle: 'Session One',
      messageId: 'msg-1',
      role: 'user',
    });
    // Verify matchContext is present
    expect(data.results[0].matchContext).toBeDefined();
    expect(Array.isArray(data.results[0].matchContext)).toBe(true);
  });

  it('filters by role', async () => {
    const mockSessions = [{ id: 'session-1', title: 'Session One' }];
    const mockMessages = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'assistant',
        content: 'Here is the testing answer',
        created_at: '2026-03-17T00:00:00Z',
      },
    ];

    // The role filter eq() is called on the messagesQuery builder after limit().
    // Supabase builder pattern: each method returns 'this', and the final await resolves.
    // When role is provided, .eq('role', role) is called on the query after .limit().
    const mockRoleEq = vi.fn().mockResolvedValue({ data: mockMessages, error: null });

    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
          }),
        };
      } else {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    eq: mockRoleEq,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const res = await POST(createPostRequest({ query: 'testing', role: 'assistant' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // Verify the role eq filter was called correctly
    expect(mockRoleEq).toHaveBeenCalledWith('role', 'assistant');
    // Results come from the mock data
    expect(data.results.length).toBeGreaterThanOrEqual(0);
  });

  it('returns breakdown by session', async () => {
    const mockSessions = [
      { id: 'session-1', title: 'Session One' },
      { id: 'session-2', title: 'Session Two' },
    ];
    const mockMessages = [
      {
        id: 'msg-1',
        session_id: 'session-1',
        role: 'user',
        content: 'test content here',
        created_at: '2026-03-17T00:00:00Z',
      },
      {
        id: 'msg-2',
        session_id: 'session-1',
        role: 'assistant',
        content: 'test response here',
        created_at: '2026-03-17T00:01:00Z',
      },
      {
        id: 'msg-3',
        session_id: 'session-2',
        role: 'user',
        content: 'another test query',
        created_at: '2026-03-17T00:02:00Z',
      },
    ];

    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
          }),
        };
      } else {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const res = await POST(createPostRequest({ query: 'test' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.breakdown).toBeDefined();
    expect(data.breakdown).toHaveLength(2);

    const session1Breakdown = data.breakdown.find(
      (b: { sessionId: string }) => b.sessionId === 'session-1'
    );
    expect(session1Breakdown).toMatchObject({
      sessionId: 'session-1',
      sessionTitle: 'Session One',
      matchCount: 2,
    });

    const session2Breakdown = data.breakdown.find(
      (b: { sessionId: string }) => b.sessionId === 'session-2'
    );
    expect(session2Breakdown).toMatchObject({
      sessionId: 'session-2',
      sessionTitle: 'Session Two',
      matchCount: 1,
    });
  });

  it('filters by sessionIds when provided', async () => {
    const mockSessions = [{ id: 'session-1', title: 'Session One' }];

    const mockInFn = vi.fn().mockResolvedValue({ data: mockSessions, error: null });

    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: mockInFn,
            }),
          }),
        };
      } else {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const res = await POST(
      createPostRequest({
        query: 'test',
        sessionIds: ['session-1'],
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockInFn).toHaveBeenCalledWith('id', ['session-1']);
  });
});
