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

// Mock rate limiting (not used in this route but keep for consistency)
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

// Mock Supabase admin client
const mockAdminFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

// Set env vars before import
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/user/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
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

  it('returns messages with status', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { subscription_tier: 'free' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_messages') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'msg-1',
                      subject: 'Welcome',
                      message: 'Welcome to JCIL!',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: 'admin@jcil.ai',
                      is_broadcast: true,
                      is_pinned: false,
                      created_at: '2026-03-01T00:00:00Z',
                      expires_at: null,
                    },
                    {
                      id: 'msg-2',
                      subject: 'Update',
                      message: 'New features available',
                      message_type: 'info',
                      priority: 'high',
                      sender_admin_email: 'admin@jcil.ai',
                      is_broadcast: false,
                      is_pinned: true,
                      created_at: '2026-03-10T00:00:00Z',
                      expires_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_message_status') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { message_id: 'msg-1', is_read: true, is_deleted: false, is_starred: false },
                  { message_id: 'msg-2', is_read: false, is_deleted: false, is_starred: true },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.messages).toHaveLength(2);
    expect(json.messages[0].id).toBe('msg-1');
    expect(json.messages[0].is_read).toBe(true);
    expect(json.messages[1].id).toBe('msg-2');
    expect(json.messages[1].is_starred).toBe(true);
    expect(json.counts.total).toBe(2);
    expect(json.counts.unread).toBe(1);
    expect(json.counts.starred).toBe(1);
  });

  it('filters out deleted messages', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { subscription_tier: 'free' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_messages') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'msg-1',
                      subject: 'Visible',
                      message: 'This is visible',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: 'admin@jcil.ai',
                      is_broadcast: false,
                      is_pinned: false,
                      created_at: '2026-03-01T00:00:00Z',
                      expires_at: null,
                    },
                    {
                      id: 'msg-deleted',
                      subject: 'Deleted',
                      message: 'This was deleted',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: 'admin@jcil.ai',
                      is_broadcast: false,
                      is_pinned: false,
                      created_at: '2026-03-02T00:00:00Z',
                      expires_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_message_status') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { message_id: 'msg-1', is_read: false, is_deleted: false, is_starred: false },
                  { message_id: 'msg-deleted', is_read: true, is_deleted: true, is_starred: false },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };
    });

    const response = await GET();
    const json = await response.json();

    expect(json.messages).toHaveLength(1);
    expect(json.messages[0].id).toBe('msg-1');
    expect(json.counts.total).toBe(1);
  });

  it('returns correct unread and starred counts', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { subscription_tier: 'pro' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_messages') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'msg-1',
                      subject: 'A',
                      message: 'a',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: null,
                      is_broadcast: false,
                      is_pinned: false,
                      created_at: '2026-03-01',
                      expires_at: null,
                    },
                    {
                      id: 'msg-2',
                      subject: 'B',
                      message: 'b',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: null,
                      is_broadcast: false,
                      is_pinned: false,
                      created_at: '2026-03-02',
                      expires_at: null,
                    },
                    {
                      id: 'msg-3',
                      subject: 'C',
                      message: 'c',
                      message_type: 'info',
                      priority: 'normal',
                      sender_admin_email: null,
                      is_broadcast: false,
                      is_pinned: false,
                      created_at: '2026-03-03',
                      expires_at: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'user_message_status') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { message_id: 'msg-1', is_read: true, is_deleted: false, is_starred: true },
                  { message_id: 'msg-2', is_read: false, is_deleted: false, is_starred: true },
                  // msg-3 has no status entry — defaults to unread, not starred
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };
    });

    const response = await GET();
    const json = await response.json();

    expect(json.counts.total).toBe(3);
    expect(json.counts.unread).toBe(2); // msg-2 and msg-3
    expect(json.counts.starred).toBe(2); // msg-1 and msg-2
  });

  it('handles empty messages', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { subscription_tier: 'free' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_messages') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.messages).toHaveLength(0);
    expect(json.counts.total).toBe(0);
    expect(json.counts.unread).toBe(0);
    expect(json.counts.starred).toBe(0);
  });

  it('returns 500 on messages fetch error', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { subscription_tier: 'free' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_messages') {
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error', code: 'PGRST500' },
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi
          .fn()
          .mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      };
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
