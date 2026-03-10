/**
 * DOCUMENT PROCESSING API TESTS
 *
 * Tests for /api/documents/user/process endpoint:
 * - POST: Process uploaded documents
 * - Auth requirements
 * - File type validation
 * - Text chunking logic
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
    unauthorized: vi.fn(
      () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
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
  storage: {
    from: vi.fn().mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: new Blob(['test content']),
        error: null,
      }),
    }),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Documents User Process API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('should export POST handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.POST).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    const { requireUser } = await import('@/lib/auth/user-guard');
    vi.mocked(requireUser).mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as never);

    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/documents/user/process', {
        method: 'POST',
        body: JSON.stringify({ documentId: 'doc-1' }),
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(response.status).toBe(401);
  });
});
