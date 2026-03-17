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

// Mock Sentry (imported transitively via utils)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Import after mocks
const { GET, DELETE } = await import('../route');

// ========================================
// HELPERS
// ========================================

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INVALID_UUID = 'not-a-uuid';
const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createGetRequest() {
  return new NextRequest(`http://localhost/api/conversations/${VALID_UUID}`, {
    method: 'GET',
  });
}

function createDeleteRequest() {
  return new NextRequest(`http://localhost/api/conversations/${VALID_UUID}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/conversations/[id]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      {
        status: 401,
      }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const res = await GET(createGetRequest(), makeParams(VALID_UUID));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID format', async () => {
    const res = await GET(createGetRequest(), makeParams(INVALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid conversation ID format');
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const res = await GET(createGetRequest(), makeParams(VALID_UUID));
    expect(res.status).toBe(429);
  });

  it('returns 404 when conversation not found', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await GET(createGetRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('returns conversation successfully', async () => {
    const mockConversation = {
      id: VALID_UUID,
      user_id: USER_ID,
      title: 'Test Conversation',
      created_at: '2026-03-17T00:00:00Z',
    };

    mockSupabase._chain.single.mockResolvedValue({
      data: mockConversation,
      error: null,
    });

    const res = await GET(createGetRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.conversation).toEqual(mockConversation);
  });

  it('calls requireUser without request (GET = no CSRF)', async () => {
    mockSupabase._chain.single.mockResolvedValue({ data: { id: VALID_UUID }, error: null });

    await GET(createGetRequest(), makeParams(VALID_UUID));

    // GET handler calls requireUser() with no args
    expect(mockRequireUser).toHaveBeenCalledWith();
  });

  it('filters by user_id and excludes deleted', async () => {
    mockSupabase._chain.single.mockResolvedValue({ data: { id: VALID_UUID }, error: null });

    await GET(createGetRequest(), makeParams(VALID_UUID));

    expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
    expect(mockSupabase._chain.eq).toHaveBeenCalledWith('id', VALID_UUID);
    expect(mockSupabase._chain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null);
  });
});

describe('DELETE /api/conversations/[id]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      {
        status: 401,
      }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    expect(res.status).toBe(401);
  });

  it('passes request to requireUser for CSRF validation', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: { id: VALID_UUID, user_id: USER_ID, deleted_at: null },
      error: null,
    });

    const req = createDeleteRequest();
    await DELETE(req, makeParams(VALID_UUID));

    // DELETE handler calls requireUser(request) for CSRF
    expect(mockRequireUser).toHaveBeenCalledWith(req);
  });

  it('returns 400 for invalid UUID format', async () => {
    const res = await DELETE(createDeleteRequest(), makeParams(INVALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid conversation ID format');
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    expect(res.status).toBe(429);
  });

  it('returns 404 when conversation not found', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('returns 403 when conversation belongs to another user', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: { id: VALID_UUID, user_id: 'other-user-456', deleted_at: null },
      error: null,
    });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('permission');
  });

  it('returns 400 when conversation is already deleted', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: { id: VALID_UUID, user_id: USER_ID, deleted_at: '2026-03-01T00:00:00Z' },
      error: null,
    });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('already deleted');
  });

  it('soft-deletes messages and conversation successfully', async () => {
    // First call: fetch existing conversation
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_UUID, user_id: USER_ID, deleted_at: null },
        error: null,
      }),
    };

    // Message update chain
    const messageUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: null }),
    };

    // Conversation update chain - needs to support .eq().eq() chaining then resolve
    const convUpdateResult = { error: null };
    const convUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: typeof convUpdateResult) => void) => resolve(convUpdateResult)),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation((_table: string) => {
      fromCallCount++;
      if (fromCallCount === 1) return fetchChain; // conversations.select for verify
      if (fromCallCount === 2) return messageUpdateChain; // messages.update
      return convUpdateChain; // conversations.update for soft-delete
    });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deleted).toBe(true);
    expect(data.conversationId).toBe(VALID_UUID);
    expect(data.deletedAt).toBeDefined();
  });

  it('continues deleting conversation even if message deletion fails', async () => {
    // Fetch existing conversation
    const fetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_UUID, user_id: USER_ID, deleted_at: null },
        error: null,
      }),
    };

    // Message update fails
    const messageUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
    };

    // Conversation update succeeds - needs to support .eq().eq() chaining
    const convUpdateResult = { error: null };
    const convUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: typeof convUpdateResult) => void) => resolve(convUpdateResult)),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return fetchChain;
      if (fromCallCount === 2) return messageUpdateChain;
      return convUpdateChain;
    });

    const res = await DELETE(createDeleteRequest(), makeParams(VALID_UUID));
    const data = await res.json();

    // Should still succeed because message deletion failure is non-fatal
    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });
});
