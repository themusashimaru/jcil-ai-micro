import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com' };
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

// Mock supabase service role
const mockFrom = vi.fn();
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}));

// Mock chat router
const mockCompleteChat = vi.fn();
vi.mock('@/lib/ai/chat-router', () => ({
  completeChat: (...args: unknown[]) => mockCompleteChat(...args),
}));

// Mock system prompt
vi.mock('@/lib/prompts/main-chat', () => ({
  getMainChatSystemPrompt: () => 'Test system prompt',
}));

// Import after mocks
const { POST } = await import('../route');

describe('POST /api/conversations/[id]/process-pending', () => {
  const conversationId = 'conv-456';

  function createRequest() {
    return new Request('http://localhost/api/conversations/conv-456/process-pending', {
      method: 'POST',
    });
  }

  function createParams() {
    return { params: Promise.resolve({ id: conversationId }) };
  }

  // Helper to build chained supabase mocks
  function mockSupabaseChain(returnValue: unknown) {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue(returnValue),
                }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const response = await POST(createRequest() as never, createParams());
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const response = await POST(createRequest() as never, createParams());
    expect(response.status).toBe(429);
  });

  it('returns no_pending_request when no pending request exists', async () => {
    const chain = mockSupabaseChain({ data: null, error: { code: 'PGRST116' } });
    mockFrom.mockReturnValue(chain);

    const response = await POST(createRequest() as never, createParams());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('no_pending_request');
  });

  it('processes pending request and returns completed status', async () => {
    const pendingRequest = {
      id: 'req-1',
      conversation_id: conversationId,
      user_id: 'user-123',
      status: 'pending',
      messages: [{ role: 'user', content: 'Hello' }],
      created_at: new Date().toISOString(),
    };

    // pending_requests.select chain
    const pendingChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: pendingRequest, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    // messages chain
    const messagesChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'pending_requests') return pendingChain;
      if (table === 'messages') return messagesChain;
      return {};
    });

    mockCompleteChat.mockResolvedValue({
      text: 'Hello! How can I help?',
      providerId: 'claude',
      model: 'claude-sonnet-4-20250514',
      usedFallback: false,
    });

    const response = await POST(createRequest() as never, createParams());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('completed');
    expect(body.data.content).toBe('Hello! How can I help?');
  });

  it('returns failed status when AI returns empty response', async () => {
    const pendingRequest = {
      id: 'req-1',
      conversation_id: conversationId,
      user_id: 'user-123',
      status: 'pending',
      messages: [{ role: 'user', content: 'Hello' }],
      created_at: new Date().toISOString(),
    };

    const pendingChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: pendingRequest, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    mockFrom.mockReturnValue(pendingChain);

    mockCompleteChat.mockResolvedValue({
      text: '',
      providerId: 'claude',
      model: 'claude-sonnet-4-20250514',
      usedFallback: false,
    });

    const response = await POST(createRequest() as never, createParams());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.status).toBe('failed');
  });

  it('returns 500 when processing throws an error', async () => {
    const pendingChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockRejectedValue(new Error('DB down')),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    mockFrom.mockReturnValue(pendingChain);

    const response = await POST(createRequest() as never, createParams());
    expect(response.status).toBe(500);
  });
});
