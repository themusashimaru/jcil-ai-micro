/**
 * ADMIN EARNINGS GENERATE-REPORT API TESTS
 *
 * Tests for /api/admin/earnings/generate-report endpoint:
 * - POST: Generate earnings report (admin only)
 * - Auth, validation, error handling
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
  },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  adminReportGenerateSchema: {},
  validateBody: vi.fn().mockReturnValue({
    success: true,
    data: { reportType: 'monthly', startDate: '2026-02-01', endDate: '2026-02-28' },
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
// HELPERS
// ============================================================================

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

describe('Admin Earnings Generate-Report API', () => {
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
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as never);

    const { POST } = await import('./route');
    const response = await POST(
      createPostRequest('http://localhost/api/admin/earnings/generate-report', {
        reportType: 'monthly',
      })
    );
    expect(response.status).toBe(401);
  });

  it('should reject invalid body', async () => {
    const { validateBody } = await import('@/lib/validation/schemas');
    vi.mocked(validateBody).mockReturnValueOnce({
      success: false,
      error: 'Invalid',
      details: [],
    } as never);

    const { POST } = await import('./route');
    const response = await POST(
      createPostRequest('http://localhost/api/admin/earnings/generate-report', { bad: 'data' })
    );
    expect(response.status).toBe(400);
  });
});
