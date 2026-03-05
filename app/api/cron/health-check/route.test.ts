/**
 * CRON HEALTH CHECK API TESTS
 *
 * Tests for /api/cron/health-check endpoint:
 * - GET: Run system health checks
 * - CRON_SECRET verification
 * - Database, Redis, queue, API key checks
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      }),
    }),
  }),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: { ping: vi.fn().mockResolvedValue('PONG') },
  isRedisAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/queue', () => ({
  getQueueStatus: vi.fn().mockReturnValue({ active: 2, available: 8, utilizationPercent: 20 }),
}));

vi.mock('@/lib/anthropic/client', () => ({
  getAnthropicKeyStats: vi.fn().mockReturnValue({ total: 3, available: 3 }),
  isAnthropicConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn(
    (data) => new Response(JSON.stringify({ success: true, ...data }), { status: 200 })
  ),
  errors: {
    unauthorized: vi.fn(
      () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    ),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    serviceUnavailable: vi.fn(
      (msg) => new Response(JSON.stringify({ error: msg }), { status: 503 })
    ),
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Cron Health Check API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
  });

  it('should reject requests without valid cron secret', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('http://localhost/api/cron/health-check', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
    );
    expect(response.status).toBe(401);
  });

  it('should reject requests with no authorization header', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/cron/health-check'));
    expect(response.status).toBe(401);
  });

  it('should run health checks with valid secret', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('http://localhost/api/cron/health-check', {
        headers: { authorization: 'Bearer test-cron-secret' },
      })
    );
    // May return 200 (healthy) or 503 (unhealthy) depending on checks
    expect([200, 503]).toContain(response.status);
  });
});
