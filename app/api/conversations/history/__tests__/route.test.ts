import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock Sentry (imported transitively via utils)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock rate limiting (history route doesn't use checkRequestRateLimit, but mock utils for safety)
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
  };
});

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';
const CONV_ID_1 = '550e8400-e29b-41d4-a716-446655440000';
const CONV_ID_2 = '660e8400-e29b-41d4-a716-446655440001';
const CONV_ID_3 = '770e8400-e29b-41d4-a716-446655440002';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    // The final await on the query builder resolves to data/error
    then: vi.fn(),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function createGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/conversations/history');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: 'GET' });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/conversations/history', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const res = await GET(createGetRequest());
    expect(res.status).toBe(401);
  });

  it('calls requireUser without request (GET = no CSRF)', async () => {
    // Set up conversation query to resolve
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    await GET(createGetRequest());

    // GET handler calls requireUser() with no args
    expect(mockRequireUser).toHaveBeenCalledWith();
  });

  it('returns conversations with messages', async () => {
    const mockConversations = [
      {
        id: CONV_ID_1,
        title: 'First Conversation',
        tool_context: null,
        created_at: '2026-03-17T00:00:00Z',
        last_message_at: '2026-03-17T01:00:00Z',
      },
      {
        id: CONV_ID_2,
        title: 'Second Conversation',
        tool_context: null,
        created_at: '2026-03-16T00:00:00Z',
        last_message_at: '2026-03-16T01:00:00Z',
      },
    ];

    const mockMessages1 = [
      { role: 'user', content: 'Hello', content_type: 'text', created_at: '2026-03-17T00:01:00Z' },
      {
        role: 'assistant',
        content: 'Hi there',
        content_type: 'text',
        created_at: '2026-03-17T00:02:00Z',
      },
    ];

    const mockMessages2 = [
      {
        role: 'user',
        content: 'Help me',
        content_type: 'text',
        created_at: '2026-03-16T00:01:00Z',
      },
    ];

    // Conversation query
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockConversations, error: null }),
    };

    // Message queries for each conversation
    const msgQueryChain1 = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockMessages1, error: null }),
    };

    const msgQueryChain2 = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockMessages2, error: null }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convQueryChain; // conversations query
      if (fromCallCount === 2) return msgQueryChain1; // messages for conv 1
      return msgQueryChain2; // messages for conv 2
    });

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.conversations).toHaveLength(2);
    expect(data.count).toBe(2);
    expect(data.conversations[0].messages).toHaveLength(2);
    expect(data.conversations[1].messages).toHaveLength(1);
  });

  it('respects limit parameter (max 20)', async () => {
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    // Request with limit=50 should be capped to 20
    await GET(createGetRequest({ limit: '50' }));

    expect(convQueryChain.limit).toHaveBeenCalledWith(20);
  });

  it('uses default limit of 10 when not specified', async () => {
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    await GET(createGetRequest());

    expect(convQueryChain.limit).toHaveBeenCalledWith(10);
  });

  it('excludes specified conversation', async () => {
    const queryResult = { data: [], error: null };
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: typeof queryResult) => void) => resolve(queryResult)),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    await GET(createGetRequest({ exclude: CONV_ID_3 }));

    expect(convQueryChain.neq).toHaveBeenCalledWith('id', CONV_ID_3);
  });

  it('does not call neq when no exclude param', async () => {
    const queryResult = { data: [], error: null };
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: typeof queryResult) => void) => resolve(queryResult)),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    await GET(createGetRequest());

    expect(convQueryChain.neq).not.toHaveBeenCalled();
  });

  it('handles empty message list gracefully', async () => {
    const mockConversations = [
      {
        id: CONV_ID_1,
        title: 'Empty Conversation',
        tool_context: null,
        created_at: '2026-03-17T00:00:00Z',
        last_message_at: '2026-03-17T00:00:00Z',
      },
    ];

    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockConversations, error: null }),
    };

    // Messages query returns empty/null
    const msgQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convQueryChain;
      return msgQueryChain;
    });

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.conversations[0].messages).toEqual([]);
  });

  it('handles message fetch error gracefully (returns empty array)', async () => {
    const mockConversations = [
      {
        id: CONV_ID_1,
        title: 'Test',
        tool_context: null,
        created_at: '2026-03-17T00:00:00Z',
        last_message_at: '2026-03-17T00:00:00Z',
      },
    ];

    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockConversations, error: null }),
    };

    // Messages query fails
    const msgQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convQueryChain;
      return msgQueryChain;
    });

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // Should gracefully return empty messages array on error
    expect(data.conversations[0].messages).toEqual([]);
  });

  it('returns 500 when conversation fetch fails', async () => {
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    const res = await GET(createGetRequest());

    expect(res.status).toBe(500);
  });

  it('filters by user_id and excludes deleted conversations', async () => {
    const convQueryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase.from.mockReturnValue(convQueryChain);

    await GET(createGetRequest());

    expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    expect(convQueryChain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(convQueryChain.is).toHaveBeenCalledWith('deleted_at', null);
  });
});
