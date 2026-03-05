/**
 * ADMIN USERS API TESTS
 *
 * Tests for /api/admin/users endpoint:
 * - GET: Requires admin authentication and can_view_users permission
 * - Pagination (page, limit params)
 * - Stats calculation and caching
 * - Error handling (auth failure, DB errors, rate limiting)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

// Supabase query chain mock
const mockRange = vi.fn();
const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockSelectChain = {
  order: mockOrder,
  eq: mockEq,
  gte: mockGte,
  then: vi.fn(),
};
const mockSelect = vi.fn().mockReturnValue(mockSelectChain);
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

const mockRequireAdmin = vi.fn();
const mockCheckPermission = vi.fn();

vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    serverError: vi.fn(
      () =>
        new Response(JSON.stringify({ ok: false, error: 'Internal server error' }), { status: 500 })
    ),
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { admin: { limit: 60, windowMs: 60_000 } },
  captureAPIError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/redis/client', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url = 'http://localhost/api/admin/users'): NextRequest {
  return new NextRequest(url);
}

const defaultAdminAuth = {
  authorized: true,
  user: { id: 'admin-user-id', email: 'admin@test.com' },
  adminUser: {
    id: 'admin-id',
    permissions: {
      can_view_users: true,
      can_edit_users: true,
      can_view_conversations: true,
      can_export_data: true,
      can_manage_subscriptions: true,
      can_ban_users: true,
    },
  },
};

const sampleUsers = [
  {
    id: 'user-1',
    email: 'user1@test.com',
    full_name: 'User One',
    subscription_tier: 'pro',
    subscription_status: 'active',
    messages_used_today: 5,
    images_generated_today: 2,
    total_messages: 100,
    total_images: 20,
    last_message_date: '2026-03-05',
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: 'sub_1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
  },
  {
    id: 'user-2',
    email: 'user2@test.com',
    full_name: 'User Two',
    subscription_tier: 'free',
    subscription_status: 'active',
    messages_used_today: 0,
    images_generated_today: 0,
    total_messages: 10,
    total_images: 0,
    last_message_date: '2026-02-20',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-20T00:00:00Z',
  },
];

function setupSuccessfulSupabase(users = sampleUsers, totalCount = 2) {
  // Reset the from mock for each test
  mockFrom.mockReturnValue({ select: mockSelect });

  // Track select calls to differentiate: count query, users query, stats queries
  let selectCallCount = 0;

  mockSelect.mockImplementation((_fields: string, options?: { count?: string; head?: boolean }) => {
    selectCallCount++;

    // First select: count query (head: true)
    if (options?.head && selectCallCount === 1) {
      return Promise.resolve({ count: totalCount });
    }

    // Second select: users query (returns order chain)
    if (selectCallCount === 2) {
      mockRange.mockResolvedValue({ data: users, error: null });
      return { order: mockOrder };
    }

    // Stats queries: tier counts
    if (selectCallCount === 3) {
      return {
        then: (cb: (result: { data: { subscription_tier: string }[] | null }) => unknown) =>
          Promise.resolve(
            cb({
              data: users.map((u) => ({ subscription_tier: u.subscription_tier })),
            })
          ),
      };
    }

    // Stats queries: status counts
    if (selectCallCount === 4) {
      return {
        then: (cb: (result: { data: { subscription_status: string }[] | null }) => unknown) =>
          Promise.resolve(
            cb({
              data: users.map((u) => ({ subscription_status: u.subscription_status })),
            })
          ),
      };
    }

    // Stats queries: usage stats
    if (selectCallCount === 5) {
      return {
        then: (
          cb: (result: {
            data:
              | {
                  messages_used_today: number;
                  total_messages: number;
                  images_generated_today: number;
                  total_images: number;
                }[]
              | null;
          }) => unknown
        ) =>
          Promise.resolve(
            cb({
              data: users.map((u) => ({
                messages_used_today: u.messages_used_today,
                total_messages: u.total_messages,
                images_generated_today: u.images_generated_today,
                total_images: u.total_images,
              })),
            })
          ),
      };
    }

    // Active users queries (today, 7 days, 30 days)
    if (selectCallCount >= 6) {
      const eqOrGte = {
        eq: vi.fn().mockResolvedValue({ count: 1 }),
        gte: vi.fn().mockResolvedValue({ count: 2 }),
      };
      return eqOrGte;
    }

    return Promise.resolve({ data: [], count: 0 });
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    mockRequireAdmin.mockResolvedValue(defaultAdminAuth);
    mockCheckPermission.mockReturnValue({ allowed: true });
  });

  // --------------------------------------------------------------------------
  // AUTH TESTS
  // --------------------------------------------------------------------------

  describe('Authentication & Authorization', () => {
    it('should return 401 when admin auth fails (not authenticated)', async () => {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Authentication required', code: 'UNAUTHORIZED' }),
        { status: 401 }
      );
      mockRequireAdmin.mockResolvedValue({
        authorized: false,
        response: errorResponse,
      });

      const { GET } = await import('./route');
      const response = await GET(createRequest());

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    it('should return 403 when admin lacks can_view_users permission', async () => {
      const forbiddenResponse = new Response(
        JSON.stringify({ error: 'Insufficient permissions', code: 'FORBIDDEN' }),
        { status: 403 }
      );
      mockCheckPermission.mockReturnValue({
        allowed: false,
        response: forbiddenResponse,
      });

      const { GET } = await import('./route');
      const response = await GET(createRequest());

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Insufficient permissions');
    });

    it('should call checkPermission with can_view_users', async () => {
      setupSuccessfulSupabase();

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(mockCheckPermission).toHaveBeenCalledWith(defaultAdminAuth, 'can_view_users');
    });
  });

  // --------------------------------------------------------------------------
  // RATE LIMITING
  // --------------------------------------------------------------------------

  describe('Rate Limiting', () => {
    it('should return rate limit response when limit exceeded', async () => {
      const { checkRequestRateLimit } = await import('@/lib/api/utils');
      const mockCheckRate = vi.mocked(checkRequestRateLimit);
      const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
      });
      mockCheckRate.mockResolvedValueOnce({
        allowed: false,
        response: rateLimitResponse as never,
      });

      const { GET } = await import('./route');
      const response = await GET(createRequest());

      expect(response.status).toBe(429);
    });

    it('should use admin user id in rate limit key', async () => {
      setupSuccessfulSupabase();
      const { checkRequestRateLimit } = await import('@/lib/api/utils');
      const mockCheckRate = vi.mocked(checkRequestRateLimit);

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(mockCheckRate).toHaveBeenCalledWith(
        'admin:users:get:admin-user-id',
        expect.objectContaining({ limit: 60 })
      );
    });
  });

  // --------------------------------------------------------------------------
  // HAPPY PATH
  // --------------------------------------------------------------------------

  describe('Successful Response', () => {
    it('should return users with pagination and stats', async () => {
      setupSuccessfulSupabase();
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      const response = await GET(createRequest());

      expect(response.status).toBe(200);
      expect(mockSuccess).toHaveBeenCalled();

      const callArgs = mockSuccess.mock.calls[0][0] as {
        users: typeof sampleUsers;
        stats: unknown;
        pagination: { page: number; limit: number; totalCount: number };
      };
      expect(callArgs.users).toEqual(sampleUsers);
      expect(callArgs.pagination.page).toBe(1);
      expect(callArgs.pagination.limit).toBe(50);
      expect(callArgs.pagination.totalCount).toBe(2);
    });

    it('should return empty array when no users exist', async () => {
      setupSuccessfulSupabase([], 0);
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest());

      const callArgs = mockSuccess.mock.calls[0][0] as {
        users: unknown[];
        pagination: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
      expect(callArgs.users).toEqual([]);
      expect(callArgs.pagination.hasNextPage).toBe(false);
      expect(callArgs.pagination.hasPreviousPage).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // PAGINATION
  // --------------------------------------------------------------------------

  describe('Pagination', () => {
    it('should parse page and limit from query params', async () => {
      setupSuccessfulSupabase();
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users?page=2&limit=10'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { page: number; limit: number };
      };
      expect(callArgs.pagination.page).toBe(2);
      expect(callArgs.pagination.limit).toBe(10);
    });

    it('should default page to 1 and limit to 50', async () => {
      setupSuccessfulSupabase();
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { page: number; limit: number };
      };
      expect(callArgs.pagination.page).toBe(1);
      expect(callArgs.pagination.limit).toBe(50);
    });

    it('should cap limit at 100', async () => {
      setupSuccessfulSupabase();
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users?limit=999'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { limit: number };
      };
      expect(callArgs.pagination.limit).toBe(100);
    });

    it('should enforce minimum page of 1', async () => {
      setupSuccessfulSupabase();
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users?page=-5'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { page: number };
      };
      expect(callArgs.pagination.page).toBe(1);
    });

    it('should calculate hasNextPage correctly', async () => {
      setupSuccessfulSupabase(sampleUsers, 100);
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users?page=1&limit=10'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { hasNextPage: boolean; totalPages: number };
      };
      expect(callArgs.pagination.hasNextPage).toBe(true);
      expect(callArgs.pagination.totalPages).toBe(10);
    });

    it('should set hasPreviousPage to true when page > 1', async () => {
      setupSuccessfulSupabase(sampleUsers, 100);
      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest('http://localhost/api/admin/users?page=3&limit=10'));

      const callArgs = mockSuccess.mock.calls[0][0] as {
        pagination: { hasPreviousPage: boolean };
      };
      expect(callArgs.pagination.hasPreviousPage).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // CACHING
  // --------------------------------------------------------------------------

  describe('Stats Caching', () => {
    it('should use cached stats when available', async () => {
      const cachedStats = {
        totalUsers: 50,
        usersByTier: { free: 20, basic: 15, pro: 10, executive: 5 },
        usersByStatus: { active: 40, trialing: 5, past_due: 3, canceled: 2 },
        usage: {
          totalMessagesToday: 100,
          totalMessagesAllTime: 5000,
          totalImagesToday: 10,
          totalImagesAllTime: 500,
        },
        activeUsers: { today: 10, last7Days: 25, last30Days: 40 },
      };

      const { cacheGet } = await import('@/lib/redis/client');
      vi.mocked(cacheGet).mockResolvedValueOnce(cachedStats);

      // Only need count + users queries when cache hit
      let selectCallCount = 0;
      mockSelect.mockImplementation(
        (_fields: string, options?: { count?: string; head?: boolean }) => {
          selectCallCount++;
          if (options?.head && selectCallCount === 1) {
            return Promise.resolve({ count: 2 });
          }
          if (selectCallCount === 2) {
            mockRange.mockResolvedValue({ data: sampleUsers, error: null });
            return { order: mockOrder };
          }
          return Promise.resolve({ data: [] });
        }
      );

      const { successResponse } = await import('@/lib/api/utils');
      const mockSuccess = vi.mocked(successResponse);

      const { GET } = await import('./route');
      await GET(createRequest());

      const callArgs = mockSuccess.mock.calls[0][0] as { stats: typeof cachedStats };
      expect(callArgs.stats).toEqual(cachedStats);
    });

    it('should cache computed stats with 5 min TTL', async () => {
      setupSuccessfulSupabase();
      const { cacheSet } = await import('@/lib/redis/client');
      const mockCacheSet = vi.mocked(cacheSet);

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(mockCacheSet).toHaveBeenCalledWith(
        'admin:users:stats',
        expect.objectContaining({
          totalUsers: expect.any(Number),
          usersByTier: expect.any(Object),
        }),
        300
      );
    });
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should return 500 when supabase user fetch fails', async () => {
      let selectCallCount = 0;
      mockSelect.mockImplementation(
        (_fields: string, options?: { count?: string; head?: boolean }) => {
          selectCallCount++;
          if (options?.head && selectCallCount === 1) {
            return Promise.resolve({ count: 5 });
          }
          if (selectCallCount === 2) {
            mockRange.mockResolvedValue({ data: null, error: new Error('DB error') });
            return { order: mockOrder };
          }
          return Promise.resolve({ data: [] });
        }
      );

      const { errors } = await import('@/lib/api/utils');

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(errors.serverError).toHaveBeenCalled();
    });

    it('should return 500 and call captureAPIError on unexpected errors', async () => {
      mockRequireAdmin.mockRejectedValueOnce(new Error('Unexpected'));

      const { captureAPIError, errors } = await import('@/lib/api/utils');

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(captureAPIError).toHaveBeenCalledWith(expect.any(Error), '/api/admin/users');
      expect(errors.serverError).toHaveBeenCalled();
    });

    it('should handle missing supabase env vars gracefully', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      // The createClient is mocked, but getSupabaseAdmin checks env vars
      // Need to reimport to pick up env change - the mock bypasses the check
      // Since createClient is mocked, we test the catch block via thrown error
      mockFrom.mockImplementationOnce(() => {
        throw new Error('Missing Supabase configuration');
      });

      const { errors, captureAPIError } = await import('@/lib/api/utils');

      const { GET } = await import('./route');
      await GET(createRequest());

      expect(errors.serverError).toHaveBeenCalled();
      expect(captureAPIError).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // EXPORTS
  // --------------------------------------------------------------------------

  describe('Route Configuration', () => {
    it('should export dynamic as force-dynamic', async () => {
      const route = await import('./route');
      expect(route.dynamic).toBe('force-dynamic');
    });

    it('should export runtime as nodejs', async () => {
      const route = await import('./route');
      expect(route.runtime).toBe('nodejs');
    });

    it('should export maxDuration as 30', async () => {
      const route = await import('./route');
      expect(route.maxDuration).toBe(30);
    });
  });
});
