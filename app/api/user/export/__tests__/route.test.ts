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
const mockSupabaseFrom = vi.fn();
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
const { GET } = await import('../route');

// Helper to create chained Supabase query mocks
function createQueryChain(resolvedValue: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(resolvedValue),
        order: vi.fn().mockResolvedValue(resolvedValue),
      }),
      order: vi.fn().mockResolvedValue(resolvedValue),
    }),
  };
}

describe('GET /api/user/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns CSV with correct Content-Type and Content-Disposition headers', async () => {
    // Mock three sequential calls to supabase.from()
    let _callCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      _callCount++;
      if (table === 'users') {
        return createQueryChain({
          data: {
            email: 'test@example.com',
            full_name: 'Test User',
            role: 'student',
            field: 'CS',
            subscription_tier: 'free',
            subscription_status: 'active',
            total_messages: 10,
            total_images: 2,
            created_at: '2025-01-01',
            last_login_at: '2026-03-01',
          },
          error: null,
        });
      }
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      return createQueryChain({ data: null, error: null });
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toContain(
      'attachment; filename="jcil-ai-data-export-'
    );
    expect(response.headers.get('Content-Disposition')).toContain('.csv"');
  });

  it('CSV contains user profile section', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryChain({
          data: {
            email: 'test@example.com',
            full_name: 'Test User',
            role: 'student',
            field: 'Computer Science',
            subscription_tier: 'pro',
            subscription_status: 'active',
            total_messages: 42,
            total_images: 5,
            created_at: '2025-01-01T00:00:00Z',
            last_login_at: '2026-03-15T10:00:00Z',
          },
          error: null,
        });
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const response = await GET();
    const csv = await response.text();

    expect(csv).toContain('JCIL.ai User Data Export');
    expect(csv).toContain('=== ACCOUNT INFORMATION ===');
    expect(csv).toContain('Email,test@example.com');
    expect(csv).toContain('"Test User"');
    expect(csv).toContain('Subscription Tier,pro');
    expect(csv).toContain('Total Messages,42');
  });

  it('CSV contains conversations section', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryChain({
          data: { email: 'test@example.com' },
          error: null,
        });
      }
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conv-1',
                    title: 'Hello World',
                    tool_context: 'general',
                    message_count: 5,
                    created_at: '2026-01-01T00:00:00Z',
                    last_message_at: '2026-01-01T01:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'msg-1',
                    conversation_id: 'conv-1',
                    role: 'user',
                    content: 'Hello!',
                    created_at: '2026-01-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return createQueryChain({ data: null, error: null });
    });

    const response = await GET();
    const csv = await response.text();

    expect(csv).toContain('=== CONVERSATIONS ===');
    expect(csv).toContain('conv-1');
    expect(csv).toContain('"Hello World"');
    expect(csv).toContain('=== MESSAGES ===');
    expect(csv).toContain('msg-1');
    expect(csv).toContain('Total Conversations: 1');
    expect(csv).toContain('Total Messages: 1');
  });

  it('handles user with no conversations', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryChain({
          data: { email: 'test@example.com' },
          error: null,
        });
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const response = await GET();
    const csv = await response.text();

    expect(csv).toContain('No conversations found');
    expect(csv).toContain('No messages found');
    expect(csv).toContain('Total Conversations: 0');
    expect(csv).toContain('Total Messages: 0');
  });

  it('escapes quotes in CSV content', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return createQueryChain({
          data: { email: 'test@example.com', full_name: 'User "Nickname" Test' },
          error: null,
        });
      }
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'conv-1',
                    title: 'Title with "quotes"',
                    tool_context: 'general',
                    message_count: 1,
                    created_at: '2026-01-01T00:00:00Z',
                    last_message_at: '2026-01-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'msg-1',
                    conversation_id: 'conv-1',
                    role: 'user',
                    content: 'He said "hello" to me',
                    created_at: '2026-01-01T00:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return createQueryChain({ data: null, error: null });
    });

    const response = await GET();
    const csv = await response.text();

    // CSV escapes double quotes by doubling them
    expect(csv).toContain('Title with ""quotes""');
    expect(csv).toContain('He said ""hello"" to me');
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ ok: false, error: 'Too many requests' }),
      { status: 429 }
    );
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const response = await GET();
    expect(response.status).toBe(429);
  });
});
