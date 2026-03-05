/**
 * ADMIN SINGLE TICKET API TESTS
 *
 * Tests for /api/admin/support/tickets/[ticketId] endpoint:
 * - GET: Get ticket with replies
 * - PATCH: Update ticket status
 * - POST: Add reply
 * - Auth and rate limiting
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
  successResponse: vi.fn(
    (data) => new Response(JSON.stringify({ success: true, ...data }), { status: 200 })
  ),
  errors: {
    badRequest: vi.fn((msg) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    notFound: vi.fn(
      (msg) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { admin: { limit: 100, window: 60 }, strict: { limit: 10, window: 60 } },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  uuidSchema: { safeParse: vi.fn().mockReturnValue({ success: true }) },
  adminTicketPatchSchema: {},
  adminTicketReplySchema: {},
  validateBody: vi.fn().mockReturnValue({
    success: true,
    data: { status: 'in_progress' },
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

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Admin Ticket API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  describe('GET /api/admin/support/tickets/[ticketId]', () => {
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
        new NextRequest('http://localhost/api/admin/support/tickets/ticket-1'),
        { params: { ticketId: 'ticket-1' } } as never
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
        new NextRequest('http://localhost/api/admin/support/tickets/ticket-1'),
        { params: { ticketId: 'ticket-1' } } as never
      );
      expect(response.status).toBe(429);
    });
  });

  describe('PATCH /api/admin/support/tickets/[ticketId]', () => {
    it('should export PATCH handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.PATCH).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireAdmin } = await import('@/lib/auth/admin-guard');
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { PATCH } = await import('./route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/support/tickets/ticket-1', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'resolved' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: { ticketId: 'ticket-1' } } as never
      );
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/support/tickets/[ticketId]', () => {
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
        new NextRequest('http://localhost/api/admin/support/tickets/ticket-1', {
          method: 'POST',
          body: JSON.stringify({ message: 'Reply text' }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: { ticketId: 'ticket-1' } } as never
      );
      expect(response.status).toBe(401);
    });
  });
});
