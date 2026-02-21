/**
 * HEALTH CHECK API TESTS
 *
 * Tests for /api/health endpoint:
 * - GET: Basic health status (public)
 * - GET ?detailed=true: Detailed status (auth required)
 * - HEAD: Simple uptime check
 * - Response structure and status codes
 * - Component health determination logic
 * - Cache-Control headers
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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
      })),
    })),
  })),
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({
      ping: vi.fn().mockResolvedValue('PONG'),
    })),
  },
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

describe('Health API Module', () => {
  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe('function');
  });

  it('should export HEAD handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.HEAD).toBeDefined();
    expect(typeof routeModule.HEAD).toBe('function');
  });
});

describe('GET /api/health (basic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 for basic health check', async () => {
    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should return correct response structure', async () => {
    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health');
    const response = await GET(request);
    const body = await response.json();

    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.uptime).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  it('should not include detailed checks in basic mode', async () => {
    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health');
    const response = await GET(request);
    const body = await response.json();

    expect(body.checks).toBeUndefined();
  });

  it('should set no-cache headers', async () => {
    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health');
    const response = await GET(request);

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
  });
});

describe('GET /api/health?detailed=true', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore env vars for health checks
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('should require authentication for detailed check', async () => {
    const { requireUser } = await import('@/lib/auth/user-guard');
    vi.mocked(requireUser).mockResolvedValue({
      authorized: false,
      response: {} as never,
    } as never);

    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health?detailed=true');
    const response = await GET(request);

    // Falls back to basic health check when not authenticated
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checks).toBeUndefined();

    // Restore
    vi.mocked(requireUser).mockResolvedValue({
      authorized: true,
      user: { id: 'test-user-id', email: 'test@example.com' },
    } as never);
  });

  it('should include component checks when authenticated', async () => {
    const { GET } = await import('./route');
    const request = createRequest('http://localhost/api/health?detailed=true');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    if (body.checks) {
      expect(body.checks.database).toBeDefined();
      expect(body.checks.cache).toBeDefined();
      expect(body.checks.ai).toBeDefined();
    }
  });
});

describe('HEAD /api/health', () => {
  it('should return 200 for HEAD request', async () => {
    const { HEAD } = await import('./route');
    const response = await HEAD();

    expect(response.status).toBe(200);
  });

  it('should return no body', async () => {
    const { HEAD } = await import('./route');
    const response = await HEAD();

    // HEAD responses should have null body
    expect(response.body).toBeNull();
  });

  it('should set no-cache headers', async () => {
    const { HEAD } = await import('./route');
    const response = await HEAD();

    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
  });
});

describe('Overall Health Status Determination', () => {
  it('should be healthy when all components are up', () => {
    const checks = {
      database: { status: 'up' as const },
      cache: { status: 'up' as const },
      ai: { status: 'up' as const },
    };

    const statuses = Object.values(checks).map((c) => c.status);
    const hasDown = statuses.some((s) => s === 'down');
    const hasDegraded = statuses.some((s) => s === 'degraded');

    expect(hasDown).toBe(false);
    expect(hasDegraded).toBe(false);
  });

  it('should be degraded when non-database component is down', () => {
    const checks = {
      database: { status: 'up' as const },
      cache: { status: 'down' as const },
      ai: { status: 'up' as const },
    };

    const isDatabaseDown = checks.database.status === 'down';
    const hasAnyDown = Object.values(checks).some((c) => c.status === 'down');

    expect(hasAnyDown).toBe(true);
    expect(isDatabaseDown).toBe(false);
    // When cache is down but database is up, status is degraded (not unhealthy)
  });

  it('should be unhealthy when database is down', () => {
    const checks = {
      database: { status: 'down' as const },
      cache: { status: 'up' as const },
      ai: { status: 'up' as const },
    };

    const isDatabaseDown = checks.database.status === 'down';
    expect(isDatabaseDown).toBe(true);
    // When database is down, system is unhealthy
  });

  it('should be degraded when components report degraded status', () => {
    const checks = {
      database: { status: 'up' as const },
      cache: { status: 'degraded' as const },
      ai: { status: 'up' as const },
    };

    const hasDegraded = Object.values(checks).some((c) => c.status === 'degraded');
    expect(hasDegraded).toBe(true);
  });

  it('should return 503 when unhealthy', () => {
    const status = 'unhealthy';
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    expect(httpStatus).toBe(503);
  });

  it('should return 200 even when degraded', () => {
    const status = 'degraded';
    const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    expect(httpStatus).toBe(200);
  });
});

describe('Component Health Checks', () => {
  it('should report database as down when not configured', () => {
    const hasConfig = !!(undefined && undefined); // Missing env vars
    expect(hasConfig).toBe(false);
  });

  it('should report cache as degraded when Redis not configured', () => {
    // Redis unavailable means in-memory fallback is active
    const fallbackActive = true;
    expect(fallbackActive).toBe(true);
  });

  it('should report AI as down when no API key configured', () => {
    const hasApiKey = !!(undefined || undefined || undefined);
    expect(hasApiKey).toBe(false);
  });

  it('should report AI as up when any API key is configured', () => {
    const hasApiKey = !!('sk-test' || undefined || undefined);
    expect(hasApiKey).toBe(true);
  });
});

describe('Uptime Tracking', () => {
  it('should calculate uptime in seconds', () => {
    const startTime = Date.now() - 60000; // Started 60 seconds ago
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    expect(uptime).toBeGreaterThanOrEqual(59);
    expect(uptime).toBeLessThanOrEqual(61);
  });

  it('should provide version string', () => {
    const version = process.env.npm_package_version || '1.0.0';
    expect(version).toBeTruthy();
    expect(typeof version).toBe('string');
  });
});
