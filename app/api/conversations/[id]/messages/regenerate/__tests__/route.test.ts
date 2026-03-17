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
const { POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const CONV_ID = '550e8400-e29b-41d4-a716-446655440000';
const MESSAGE_ID = '660e8400-e29b-41d4-a716-446655440001';
const USER_MSG_ID = '770e8400-e29b-41d4-a716-446655440002';
const LATER_MSG_ID = '880e8400-e29b-41d4-a716-446655440003';
const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
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

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/conversations/${CONV_ID}/messages/regenerate`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

function createInvalidJsonRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/conversations/${CONV_ID}/messages/regenerate`, {
    method: 'POST',
    body: 'not valid json{{{',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

// ========================================
// TESTS
// ========================================

describe('POST /api/conversations/[id]/messages/regenerate', () => {
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
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    expect(res.status).toBe(401);
  });

  it('passes request to requireUser for CSRF validation', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message lookup returns assistant message
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MESSAGE_ID,
          role: 'assistant',
          created_at: '2026-03-17T01:00:00Z',
          content: 'Hello',
        },
        error: null,
      }),
    };

    // All messages query
    const allMsgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: USER_MSG_ID, role: 'user', content: 'Hi', created_at: '2026-03-17T00:59:00Z' },
          {
            id: MESSAGE_ID,
            role: 'assistant',
            content: 'Hello',
            created_at: '2026-03-17T01:00:00Z',
          },
        ],
        error: null,
      }),
    };

    // Delete messages chain
    const deleteChain = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      if (fromCallCount === 2) return msgChain;
      if (fromCallCount === 3) return allMsgChain;
      return deleteChain;
    });

    const req = createPostRequest({ messageId: MESSAGE_ID });
    await POST(req, makeParams(CONV_ID));

    expect(mockRequireUser).toHaveBeenCalledWith(req);
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await POST(createInvalidJsonRequest(), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe('BAD_JSON');
  });

  it('returns 400 for missing messageId', async () => {
    const res = await POST(createPostRequest({}), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe('MISSING_MESSAGE_ID');
  });

  it('returns 400 for non-string messageId', async () => {
    const res = await POST(createPostRequest({ messageId: 12345 }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe('MISSING_MESSAGE_ID');
  });

  it('returns 404 when conversation not found', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Conversation');
  });

  it('returns 404 when message not found', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message lookup fails
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      return msgChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Message');
  });

  it('returns 403 when trying to regenerate non-assistant message', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message is a user message, not assistant
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: MESSAGE_ID, role: 'user', created_at: '2026-03-17T01:00:00Z', content: 'Hi' },
        error: null,
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      return msgChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error.code).toBe('NOT_ASSISTANT');
  });

  it('returns 400 when no previous user message found', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message is assistant
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MESSAGE_ID,
          role: 'assistant',
          created_at: '2026-03-17T01:00:00Z',
          content: 'Hello',
        },
        error: null,
      }),
    };

    // All messages: only system and assistant, no user message before target
    const allMsgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'system-msg',
            role: 'system',
            content: 'You are helpful',
            created_at: '2026-03-17T00:58:00Z',
          },
          {
            id: MESSAGE_ID,
            role: 'assistant',
            content: 'Hello',
            created_at: '2026-03-17T01:00:00Z',
          },
        ],
        error: null,
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      if (fromCallCount === 2) return msgChain;
      return allMsgChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.code).toBe('NO_USER_MESSAGE');
  });

  it('successfully regenerates - deletes messages and returns context', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message is assistant
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MESSAGE_ID,
          role: 'assistant',
          created_at: '2026-03-17T01:00:00Z',
          content: 'Hello there!',
        },
        error: null,
      }),
    };

    // All messages in conversation
    const allMsgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: USER_MSG_ID, role: 'user', content: 'Hi', created_at: '2026-03-17T00:59:00Z' },
          {
            id: MESSAGE_ID,
            role: 'assistant',
            content: 'Hello there!',
            created_at: '2026-03-17T01:00:00Z',
          },
          {
            id: LATER_MSG_ID,
            role: 'user',
            content: 'Follow up',
            created_at: '2026-03-17T01:01:00Z',
          },
        ],
        error: null,
      }),
    };

    // Delete messages chain
    const deleteChain = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      if (fromCallCount === 2) return msgChain;
      if (fromCallCount === 3) return allMsgChain;
      return deleteChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.regenerate).toBe(true);

    // Returns previous user message
    expect(data.previousUserMessage).toEqual({
      id: USER_MSG_ID,
      content: 'Hi',
      role: 'user',
    });

    // History includes only messages before the target
    expect(data.history).toEqual([{ role: 'user', content: 'Hi' }]);

    // Deleted message IDs include target and subsequent messages
    expect(data.deletedMessageIds).toEqual([MESSAGE_ID, LATER_MSG_ID]);

    // Verify soft-delete was called with is_regenerated flag
    expect(deleteChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_regenerated: true })
    );
    expect(deleteChain.in).toHaveBeenCalledWith('id', [MESSAGE_ID, LATER_MSG_ID]);
  });

  it('returns 500 when fetching all messages fails', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message is assistant
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MESSAGE_ID,
          role: 'assistant',
          created_at: '2026-03-17T01:00:00Z',
          content: 'Hello',
        },
        error: null,
      }),
    };

    // All messages query fails
    const allMsgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      if (fromCallCount === 2) return msgChain;
      return allMsgChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    expect(res.status).toBe(500);
  });

  it('returns 500 when soft-delete of messages fails', async () => {
    // Conversation lookup succeeds
    const convChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: CONV_ID }, error: null }),
    };

    // Message is assistant
    const msgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: MESSAGE_ID,
          role: 'assistant',
          created_at: '2026-03-17T01:00:00Z',
          content: 'Hello',
        },
        error: null,
      }),
    };

    // All messages
    const allMsgChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: USER_MSG_ID, role: 'user', content: 'Hi', created_at: '2026-03-17T00:59:00Z' },
          {
            id: MESSAGE_ID,
            role: 'assistant',
            content: 'Hello',
            created_at: '2026-03-17T01:00:00Z',
          },
        ],
        error: null,
      }),
    };

    // Delete fails
    const deleteChain = {
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return convChain;
      if (fromCallCount === 2) return msgChain;
      if (fromCallCount === 3) return allMsgChain;
      return deleteChain;
    });

    const res = await POST(createPostRequest({ messageId: MESSAGE_ID }), makeParams(CONV_ID));
    expect(res.status).toBe(500);
  });
});
