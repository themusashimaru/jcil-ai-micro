/**
 * ADMIN MESSAGES API TESTS
 *
 * Tests for /api/admin/messages endpoint:
 * - GET: List sent messages (admin auth required)
 * - POST: Send new message (admin + permission required)
 * - Pagination
 * - Individual vs broadcast messages
 * - Validation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'admin-user-id', email: 'admin@test.com' },
    adminUser: { id: 'admin-id', role: 'super_admin', permissions: { can_edit_users: true } },
  }),
  checkPermission: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data) => {
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    badRequest: vi.fn((msg) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    notFound: vi.fn(
      (entity) => new Response(JSON.stringify({ error: `${entity} not found` }), { status: 404 })
    ),
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { admin: { limit: 100, window: 60 }, strict: { limit: 10, window: 60 } },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  adminMessageSchema: {},
  paginationSchema: {},
  validateBody: vi.fn().mockReturnValue({
    success: true,
    data: {
      recipient_type: 'individual',
      recipient_user_id: 'target-user-id',
      subject: 'Test Subject',
      message: 'Test message body',
      message_type: 'info',
      priority: 'normal',
    },
  }),
  validateQuery: vi.fn().mockReturnValue({
    success: true,
    data: { page: 1, limit: 20 },
  }),
  validationErrorResponse: vi.fn((error, details) => ({
    message: 'Validation failed',
    error,
    details,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockInsert = vi.fn();
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(url, options);
}

function createPostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('Admin Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  describe('GET /api/admin/messages', () => {
    it('should export GET handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.GET).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireAdmin } = await import('@/lib/auth/admin-guard');
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { GET } = await import('./route');
      const response = await GET(createRequest('http://localhost/api/admin/messages'));
      expect(response.status).toBe(401);
    });

    it('should reject rate-limited requests', async () => {
      const { checkRequestRateLimit } = await import('@/lib/api/utils');
      vi.mocked(checkRequestRateLimit).mockResolvedValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
      } as never);

      const { GET } = await import('./route');
      const response = await GET(createRequest('http://localhost/api/admin/messages'));
      expect(response.status).toBe(429);
    });

    it('should return paginated messages', async () => {
      const messagesData = [
        {
          id: 'msg-1',
          recipient_user_id: null,
          recipient_tier: 'all',
          sender_admin_email: 'admin@test.com',
          subject: 'Announcement',
          message: 'Hello everyone',
          message_type: 'info',
          priority: 'normal',
          is_broadcast: true,
          broadcast_sent_count: 50,
          created_at: '2026-03-01T00:00:00Z',
          expires_at: null,
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: messagesData,
              error: null,
              count: 1,
            }),
          }),
        }),
      });

      const { GET } = await import('./route');
      const response = await GET(createRequest('http://localhost/api/admin/messages'));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.messages).toBeDefined();
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
              count: null,
            }),
          }),
        }),
      });

      const { GET } = await import('./route');
      const response = await GET(createRequest('http://localhost/api/admin/messages'));
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/admin/messages', () => {
    it('should export POST handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.POST).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireAdmin } = await import('@/lib/auth/admin-guard');
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/admin/messages', {
          subject: 'Test',
          message: 'Hello',
        })
      );
      expect(response.status).toBe(401);
    });

    it('should reject without permission', async () => {
      const { checkPermission } = await import('@/lib/auth/admin-guard');
      vi.mocked(checkPermission).mockReturnValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/admin/messages', {
          subject: 'Test',
          message: 'Hello',
        })
      );
      expect(response.status).toBe(403);
    });

    it('should send individual message successfully', async () => {
      // Mock admin_users query
      const fromCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'admin-id', email: 'admin@test.com' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'target-user-id' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'new-msg-id', created_at: '2026-03-01T00:00:00Z' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/admin/messages', {
          recipient_type: 'individual',
          recipient_user_id: 'target-user-id',
          subject: 'Test',
          message: 'Hello',
          message_type: 'info',
          priority: 'normal',
        })
      );
      expect(response.status).toBe(200);
    });

    it('should reject invalid body', async () => {
      const { validateBody } = await import('@/lib/validation/schemas');
      vi.mocked(validateBody).mockReturnValueOnce({
        success: false,
        error: 'Invalid body',
        details: [],
      } as never);

      // Mock admin_users query
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'admin_users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'admin-id', email: 'admin@test.com' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/admin/messages', { bad: 'data' })
      );
      expect(response.status).toBe(400);
    });
  });
});
