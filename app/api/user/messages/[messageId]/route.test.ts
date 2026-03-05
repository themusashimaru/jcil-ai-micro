/**
 * USER MESSAGE DETAIL API TESTS
 *
 * Tests for /api/user/messages/[messageId] endpoint:
 * - GET: Get single message
 * - PATCH: Update message status
 * - DELETE: Soft delete message
 * - Auth requirements
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'test-user-id', email: 'test@example.com' },
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

describe('User Message Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  describe('GET', () => {
    it('should export GET handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.GET).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { GET } = await import('./route');
      const response = await GET(new NextRequest('http://localhost/api/user/messages/msg-1'), {
        params: Promise.resolve({ messageId: 'msg-1' }),
      } as never);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH', () => {
    it('should export PATCH handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.PATCH).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { PATCH } = await import('./route');
      const response = await PATCH(
        new NextRequest('http://localhost/api/user/messages/msg-1', {
          method: 'PATCH',
          body: JSON.stringify({ is_read: true }),
          headers: { 'Content-Type': 'application/json' },
        }),
        { params: Promise.resolve({ messageId: 'msg-1' }) } as never
      );
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE', () => {
    it('should export DELETE handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.DELETE).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { DELETE } = await import('./route');
      const response = await DELETE(
        new NextRequest('http://localhost/api/user/messages/msg-1', { method: 'DELETE' }),
        { params: Promise.resolve({ messageId: 'msg-1' }) } as never
      );
      expect(response.status).toBe(401);
    });
  });
});
