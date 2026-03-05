/**
 * ADMIN CONVERSATION EXPORT API TESTS
 *
 * Tests for /api/admin/conversations/[conversationId]/export endpoint:
 * - GET: Export conversation as PDF (admin only)
 * - Auth and rate limiting
 * - Conversation not found
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
    adminUser: { id: 'admin-id', role: 'super_admin' },
  }),
}));

vi.mock('@/lib/api/utils', () => ({
  errors: {
    notFound: vi.fn(
      (msg) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { admin: { limit: 100, window: 60 } },
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ============================================================================
// TESTS
// ============================================================================

describe('Admin Conversation Export API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

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
    const response = await GET(
      createRequest('http://localhost/api/admin/conversations/conv-1/export'),
      { params: { conversationId: 'conv-1' } } as never
    );
    expect(response.status).toBe(401);
  });

  it('should reject rate-limited requests', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    vi.mocked(checkRequestRateLimit).mockResolvedValueOnce({
      allowed: false,
      response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
    } as never);

    const { GET } = await import('./route');
    const response = await GET(
      createRequest('http://localhost/api/admin/conversations/conv-1/export'),
      { params: { conversationId: 'conv-1' } } as never
    );
    expect(response.status).toBe(429);
  });

  it('should return 404 for nonexistent conversation', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    const { GET } = await import('./route');
    const response = await GET(
      createRequest('http://localhost/api/admin/conversations/nonexistent/export'),
      { params: { conversationId: 'nonexistent' } } as never
    );
    expect(response.status).toBe(404);
  });

  it('should export conversation successfully', async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // conversations query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'conv-1',
                  title: 'Test Conversation',
                  tool_context: null,
                  created_at: '2026-03-01T00:00:00Z',
                  last_message_at: '2026-03-01T01:00:00Z',
                  message_count: 2,
                  user_id: 'user-1',
                  users: { id: 'user-1', email: 'user@test.com', full_name: 'Test User' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      // messages query - chain: select -> eq -> is -> order
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'msg-1',
                    role: 'user',
                    content: 'Hello',
                    created_at: '2026-03-01T00:00:00Z',
                    moderation_flagged: false,
                  },
                  {
                    id: 'msg-2',
                    role: 'assistant',
                    content: 'Hi there!',
                    created_at: '2026-03-01T00:01:00Z',
                    moderation_flagged: false,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const { GET } = await import('./route');
    const response = await GET(
      createRequest('http://localhost/api/admin/conversations/conv-1/export'),
      { params: { conversationId: 'conv-1' } } as never
    );
    expect(response.status).toBe(200);
  });
});
