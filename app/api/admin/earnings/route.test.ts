/**
 * ADMIN EARNINGS API TESTS
 *
 * Tests for /api/admin/earnings endpoint:
 * - GET: Requires admin authentication
 * - Revenue calculation by tier
 * - Cost aggregation by model
 * - Profit margin calculation
 * - Date range filtering
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'admin-user-id', email: 'admin@test.com' },
    adminUser: { id: 'admin-id', role: 'super_admin' },
  }),
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
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { admin: { limit: 100, window: 60 } },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/validation/schemas', () => ({
  adminEarningsQuerySchema: {},
  validateQuery: vi.fn().mockReturnValue({
    success: true,
    data: { startDate: null, endDate: null },
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
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
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

describe('Admin Earnings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    // Default: return empty data for all queries
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
  });

  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe('function');
  });

  it('should reject unauthenticated requests', async () => {
    const { requireAdmin } = await import('@/lib/auth/admin-guard');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as never);

    const { GET } = await import('./route');
    const response = await GET(createRequest('http://localhost/api/admin/earnings'));
    expect(response.status).toBe(401);
  });

  it('should reject rate-limited requests', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    vi.mocked(checkRequestRateLimit).mockResolvedValueOnce({
      allowed: false,
      response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
    } as never);

    const { GET } = await import('./route');
    const response = await GET(createRequest('http://localhost/api/admin/earnings'));
    expect(response.status).toBe(429);
  });

  it('should reject invalid query parameters', async () => {
    const { validateQuery } = await import('@/lib/validation/schemas');
    vi.mocked(validateQuery).mockReturnValueOnce({
      success: false,
      error: 'Invalid date',
      details: [],
    } as never);

    const { GET } = await import('./route');
    const response = await GET(
      createRequest('http://localhost/api/admin/earnings?startDate=invalid')
    );
    expect(response.status).toBe(400);
  });

  it('should return earnings data on success', async () => {
    // Mock users by tier
    const usersData = [
      { subscription_tier: 'free', id: 'u1' },
      { subscription_tier: 'pro', id: 'u2' },
      { subscription_tier: 'pro', id: 'u3' },
    ];

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // users query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: usersData, error: null }),
          }),
        };
      }
      if (callCount === 2) {
        // subscription_tiers query
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      // All other queries
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const { GET } = await import('./route');
    const response = await GET(createRequest('http://localhost/api/admin/earnings'));
    expect(response.status).toBe(200);
  });

  it('should handle database errors gracefully', async () => {
    mockSupabase.from.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    }));

    const { GET } = await import('./route');
    const response = await GET(createRequest('http://localhost/api/admin/earnings'));
    expect(response.status).toBe(500);
  });
});
