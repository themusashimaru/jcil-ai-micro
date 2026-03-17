import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock requireAdmin and checkPermission
const mockAdminUser = { id: 'admin-123', email: 'admin@example.com' };
const mockAdminRecord = {
  id: 'admin-row-1',
  permissions: {
    can_view_users: true,
    can_edit_users: true,
    can_view_conversations: true,
    can_export_data: true,
    can_manage_subscriptions: true,
    can_ban_users: true,
  },
};
const mockRequireAdmin = vi.fn();
const mockCheckPermission = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
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

// Mock Supabase createClient
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Import after mocks
const { GET } = await import('../route');

const validUserId = '550e8400-e29b-41d4-a716-446655440000';
const mockParams = { params: { userId: validUserId } };

describe('GET /api/admin/users/[userId]/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckPermission.mockReturnValue({ allowed: true });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Set env vars for getSupabaseAdmin
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 401 when not admin', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const request = new NextRequest(
      `http://localhost/api/admin/users/${validUserId}/conversations`
    );
    const response = await GET(request, mockParams as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 without can_view_conversations permission', async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ ok: false, error: 'Insufficient permissions' }),
      { status: 403 }
    );
    mockCheckPermission.mockReturnValue({
      allowed: false,
      response: forbiddenResponse,
    });

    const request = new NextRequest(
      `http://localhost/api/admin/users/${validUserId}/conversations`
    );
    const response = await GET(request, mockParams as any);
    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid UUID', async () => {
    const invalidParams = { params: { userId: 'not-a-uuid' } };

    const request = new NextRequest('http://localhost/api/admin/users/not-a-uuid/conversations');
    const response = await GET(request, invalidParams as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it('returns conversations for user', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        title: 'First conversation',
        user_id: validUserId,
        created_at: '2026-01-01T00:00:00Z',
        last_message_at: '2026-01-01T01:00:00Z',
        message_count: 5,
      },
      {
        id: 'conv-2',
        title: 'Second conversation',
        user_id: validUserId,
        created_at: '2026-01-02T00:00:00Z',
        last_message_at: '2026-01-02T02:00:00Z',
        message_count: 3,
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockConversations,
              error: null,
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest(
      `http://localhost/api/admin/users/${validUserId}/conversations`
    );
    const response = await GET(request, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.conversations).toHaveLength(2);
    expect(json.count).toBe(2);
    expect(json.userId).toBe(validUserId);
    expect(json.timestamp).toBeDefined();
  });

  it('handles date range filtering', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        title: 'Filtered conversation',
        user_id: validUserId,
        created_at: '2026-01-15T00:00:00Z',
        last_message_at: '2026-01-15T01:00:00Z',
        message_count: 2,
      },
    ];

    // The code chains: .select('*').eq('user_id', ...).is('deleted_at', null).order(...) then optionally .gte(...).lt(...)
    // With date filters the chain is: .select().eq().is().order().gte().lt() — but actually:
    // query = query.order(...) then query = query.gte(...) then query = query.lt(...)
    // So the chain is: select -> eq -> is -> order -> gte -> lt (each returns the builder)
    const _chainable: Record<string, ReturnType<typeof vi.fn>> = {};
    const mockResult = { data: mockConversations, error: null };

    // Create a proxy-like chainable object where every method returns itself,
    // and also acts as a thenable resolving to mockResult
    const builder: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            // Make it thenable so await resolves to mockResult
            return (resolve: (v: any) => void) => resolve(mockResult);
          }
          // Any method call returns the builder itself
          return vi.fn().mockReturnValue(builder);
        },
      }
    );

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    const request = new NextRequest(
      `http://localhost/api/admin/users/${validUserId}/conversations?startDate=2026-01-01&endDate=2026-01-31`
    );
    const response = await GET(request, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.filters.startDate).toBe('2026-01-01');
    expect(json.filters.endDate).toBe('2026-01-31');
  });

  it('handles database error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST500', message: 'Database error' },
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest(
      `http://localhost/api/admin/users/${validUserId}/conversations`
    );
    const response = await GET(request, mockParams as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.ok).toBe(false);
  });
});
