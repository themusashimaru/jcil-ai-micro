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

describe('GET /api/admin/users/[userId]', () => {
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

    const request = new NextRequest(`http://localhost/api/admin/users/${validUserId}`);
    const response = await GET(request as any, mockParams as any);
    expect(response.status).toBe(401);
  });

  it('returns 403 without can_view_users permission', async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ ok: false, error: 'Insufficient permissions' }),
      { status: 403 }
    );
    mockCheckPermission.mockReturnValue({
      allowed: false,
      response: forbiddenResponse,
    });

    const request = new NextRequest(`http://localhost/api/admin/users/${validUserId}`);
    const response = await GET(request as any, mockParams as any);
    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid UUID', async () => {
    const invalidParams = { params: { userId: 'not-a-uuid' } };

    const request = new NextRequest('http://localhost/api/admin/users/not-a-uuid');
    const response = await GET(request as any, invalidParams as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it('returns 404 when user not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Row not found' },
          }),
        }),
      }),
    });

    const request = new NextRequest(`http://localhost/api/admin/users/${validUserId}`);
    const response = await GET(request as any, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it('returns user with computed counts', async () => {
    const mockUser = {
      id: validUserId,
      email: 'user@example.com',
      full_name: 'Test User',
      subscription_tier: 'pro',
      subscription_status: 'active',
      messages_used_today: 5,
      images_generated_today: 1,
      total_messages: 100,
      total_images: 10,
      last_message_date: '2026-01-15',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_456',
      is_banned: false,
      ban_reason: null,
      created_at: '2025-06-01T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
      last_login_at: '2026-01-15T12:00:00Z',
    };

    let _callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      _callCount++;
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockUser,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'conversations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                count: 12,
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                count: 87,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const request = new NextRequest(`http://localhost/api/admin/users/${validUserId}`);
    const response = await GET(request as any, mockParams as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.user.id).toBe(validUserId);
    expect(json.user.email).toBe('user@example.com');
    expect(json.user.full_name).toBe('Test User');
    expect(json.user.subscription_tier).toBe('pro');
    expect(json.user.conversation_count).toBe(12);
    expect(json.user.actual_message_count).toBe(87);
    expect(json.timestamp).toBeDefined();
  });

  it('handles database error on user fetch', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST500', message: 'Connection error' },
          }),
        }),
      }),
    });

    const request = new NextRequest(`http://localhost/api/admin/users/${validUserId}`);
    const response = await GET(request as any, mockParams as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.ok).toBe(false);
  });
});
