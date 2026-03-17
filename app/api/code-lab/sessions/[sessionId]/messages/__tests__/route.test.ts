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
  codeLabRead: vi.fn().mockResolvedValue({ allowed: true }),
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
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const SESSION_ID = 'session-001';
const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function createGetRequest() {
  return new NextRequest(`http://localhost/api/code-lab/sessions/${SESSION_ID}/messages`, {
    method: 'GET',
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

describe('GET /api/code-lab/sessions/[sessionId]/messages', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockRateLimiters.codeLabRead.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiters.codeLabRead.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });

  it('returns 404 when session not found', async () => {
    // Session ownership check returns null
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: null,
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Session not found');
  });

  it('returns transformed messages', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        session_id: SESSION_ID,
        role: 'user',
        content: 'Hello',
        created_at: '2026-03-17T00:00:00Z',
        type: 'text',
        code_output: null,
        search_output: null,
        summary_output: null,
      },
      {
        id: 'msg-2',
        session_id: SESSION_ID,
        role: 'assistant',
        content: 'Hi there!',
        created_at: '2026-03-17T00:01:00Z',
        type: 'text',
        code_output: '{"result": "ok"}',
        search_output: null,
        summary_output: null,
      },
    ];

    // Session check succeeds, then messages query
    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // Session ownership check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SESSION_ID }, error: null }),
              }),
            }),
          }),
        };
      } else {
        // Messages query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
            }),
          }),
        };
      }
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.messages).toHaveLength(2);
    expect(data.messages[0]).toMatchObject({
      id: 'msg-1',
      sessionId: SESSION_ID,
      role: 'user',
      content: 'Hello',
      createdAt: '2026-03-17T00:00:00Z',
      type: 'text',
    });
    expect(data.messages[1]).toMatchObject({
      id: 'msg-2',
      role: 'assistant',
      codeOutput: '{"result": "ok"}',
    });
  });

  it('returns empty array when no messages', async () => {
    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SESSION_ID }, error: null }),
              }),
            }),
          }),
        };
      } else {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.messages).toEqual([]);
  });
});
