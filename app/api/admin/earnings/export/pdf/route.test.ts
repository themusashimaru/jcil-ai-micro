/**
 * ADMIN EARNINGS PDF EXPORT API TESTS
 *
 * Tests for /api/admin/earnings/export/pdf endpoint:
 * - GET: Export earnings report as PDF HTML (admin only)
 * - Auth, rate limiting, validation
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
  checkPermission: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('@/lib/api/utils', () => ({
  errors: {
    badRequest: vi.fn((msg) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    notFound: vi.fn(
      (msg) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
  },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  adminPdfExportQuerySchema: {},
  validateQuery: vi.fn().mockReturnValue({
    success: true,
    data: { reportId: 'report-1' },
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

describe('Admin Earnings PDF Export API', () => {
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
      new NextRequest('http://localhost/api/admin/earnings/export/pdf?reportId=report-1')
    );
    expect(response.status).toBe(401);
  });

  it('should reject invalid query parameters', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: false,
      error: 'Invalid',
      details: [],
    } as never);

    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/admin/earnings/export/pdf'));
    expect(response.status).toBe(400);
  });

  it('should return 404 for nonexistent report', async () => {
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
      new NextRequest('http://localhost/api/admin/earnings/export/pdf?reportId=nonexistent')
    );
    expect(response.status).toBe(404);
  });

  it('should export report as HTML PDF', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'report-1',
              report_type: 'monthly',
              report_period_start: '2026-02-01',
              report_period_end: '2026-02-28',
              full_report: '# Monthly Report\n\nRevenue: $1000',
              key_metrics: {
                users: { total: 100, byTier: { free: 80, basic: 0, pro: 20, executive: 0 } },
                revenue: { total: 1000, byTier: { free: 0, basic: 0, pro: 1000, executive: 0 } },
                costs: { total: 200, api: 150, news: 50, byModel: {} },
                profit: { total: 800, margin: '80' },
              },
              created_at: '2026-03-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('http://localhost/api/admin/earnings/export/pdf?reportId=report-1')
    );
    expect(response.status).toBe(200);
  });
});
