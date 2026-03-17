/**
 * AGENTS HEALTH CHECK ROUTE TESTS
 *
 * Tests for GET /api/agents/health endpoint:
 * - Admin auth guard rejection
 * - Happy path with all systems healthy
 * - Degraded state (partial failures)
 * - Unhealthy state (critical infrastructure down)
 * - Code Agent health check (success and error)
 * - Database connectivity check (up, degraded, down, unconfigured)
 * - Redis connectivity check (up, degraded, down)
 * - Web search availability reporting
 * - Overall health calculation logic
 *
 * NOTE: Strategy Agent and Brave Search tests removed — agent system deprecated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    serviceUnavailable: vi.fn((msg) => {
      return new Response(JSON.stringify({ ok: false, error: msg, code: 'SERVICE_UNAVAILABLE' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
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

const mockIsRedisAvailable = vi.fn();
const mockRedis = {
  ping: vi.fn(),
};
vi.mock('@/lib/redis/client', () => ({
  redis: mockRedis,
  isRedisAvailable: (...args: unknown[]) => mockIsRedisAvailable(...args),
}));

const mockIsCodeAgentEnabled = vi.fn();
const mockShouldUseCodeAgent = vi.fn();
const mockIsCodeReviewRequest = vi.fn();
vi.mock('@/agents/code', () => ({
  isCodeAgentEnabled: (...args: unknown[]) => mockIsCodeAgentEnabled(...args),
  shouldUseCodeAgent: (...args: unknown[]) => mockShouldUseCodeAgent(...args),
  isCodeReviewRequest: (...args: unknown[]) => mockIsCodeReviewRequest(...args),
}));

const mockIsWebSearchAvailable = vi.fn();
vi.mock('@/lib/ai/tools/web-search', () => ({
  isWebSearchAvailable: (...args: unknown[]) => mockIsWebSearchAvailable(...args),
}));

const mockCreateClient = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// ============================================================================
// HELPERS
// ============================================================================

function setupAdminAuth() {
  mockRequireAdmin.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-user-id', email: 'admin@test.com' },
    adminUser: { id: 'admin-id', permissions: {} },
  });
}

function setupAdminRejection(status = 401) {
  mockRequireAdmin.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status }),
  });
}

function setupHealthyInfrastructure() {
  // Redis healthy
  mockIsRedisAvailable.mockReturnValue(true);
  mockRedis.ping.mockResolvedValue('PONG');

  // Database healthy
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  mockCreateClient.mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ error: null, data: [{ id: '1' }] }),
      }),
    }),
  });
}

function setupHealthyAgents() {
  // Code agent
  mockIsCodeAgentEnabled.mockReturnValue(true);
  mockShouldUseCodeAgent.mockImplementation((query: string) => {
    return query.toLowerCase().includes('build') || query.toLowerCase().includes('react');
  });
  mockIsCodeReviewRequest.mockImplementation((query: string) => {
    return query.toLowerCase().includes('review');
  });

  // Web search
  mockIsWebSearchAvailable.mockReturnValue(true);
}

async function importAndCallGET() {
  const { GET } = await import('./route');
  return GET();
}

// ============================================================================
// TESTS
// ============================================================================

describe('Agents Health Check API - GET /api/agents/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  // --------------------------------------------------------------------------
  // AUTH GUARD
  // --------------------------------------------------------------------------

  describe('Authentication', () => {
    it('should reject unauthenticated requests with 401', async () => {
      setupAdminRejection(401);

      const response = await importAndCallGET();

      expect(response.status).toBe(401);
      expect(mockRequireAdmin).toHaveBeenCalledOnce();
    });

    it('should reject non-admin users with 403', async () => {
      setupAdminRejection(403);

      const response = await importAndCallGET();

      expect(response.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // HAPPY PATH - ALL HEALTHY
  // --------------------------------------------------------------------------

  describe('Happy path - all systems healthy', () => {
    it('should return 200 with healthy status when everything is up', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();

      const response = await importAndCallGET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.data.overall).toBe('healthy');
      expect(body.data.timestamp).toBeDefined();
    });

    it('should report agent statuses in the agents array', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();

      const response = await importAndCallGET();
      const body = await response.json();

      expect(body.data.agents).toBeInstanceOf(Array);
      expect(body.data.agents.length).toBeGreaterThanOrEqual(1);

      const codeAgent = body.data.agents.find((a: { name: string }) => a.name === 'Code Agent');
      expect(codeAgent).toBeDefined();
      expect(codeAgent.enabled).toBe(true);
      expect(codeAgent.available).toBe(true);
      expect(codeAgent.detectionWorking).toBe(true);
    });

    it('should report infrastructure status', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();

      const response = await importAndCallGET();
      const body = await response.json();

      expect(body.data.infrastructure.database.status).toBe('up');
      expect(body.data.infrastructure.database.latency).toBeDefined();
      expect(body.data.infrastructure.redis.status).toBe('up');
      expect(body.data.infrastructure.webSearchTool).toBe(true);
    });

    it('should include summary with zero issues', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();

      const response = await importAndCallGET();
      const body = await response.json();

      expect(body.data.summary.total).toBeGreaterThanOrEqual(1);
      expect(body.data.summary.enabled).toBeGreaterThanOrEqual(1);
      expect(body.data.summary.available).toBeGreaterThanOrEqual(1);
      expect(body.data.summary.issues).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // DATABASE HEALTH CHECKS
  // --------------------------------------------------------------------------

  describe('Database health checks', () => {
    it('should return 503 when database env vars not configured (db down)', async () => {
      setupAdminAuth();
      // No supabase env vars set => checkDatabase returns status: 'down'
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();

      // DB down => overall unhealthy => 503
      expect(response.status).toBe(503);
    });

    it('should report database as degraded when table not found (42P01)', async () => {
      setupAdminAuth();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              error: { code: '42P01', message: 'relation "users" does not exist' },
            }),
          }),
        }),
      });
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();
      const body = await response.json();

      expect(body.data.infrastructure.database.status).toBe('degraded');
      expect(body.data.infrastructure.database.message).toContain('Table not found');
    });

    it('should return 503 on generic database query error (db down)', async () => {
      setupAdminAuth();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              error: { code: 'PGRST301', message: 'Connection refused' },
            }),
          }),
        }),
      });
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();

      // DB down => overall unhealthy => 503
      expect(response.status).toBe(503);
    });

    it('should return 503 when createClient throws (db down)', async () => {
      setupAdminAuth();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockCreateClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();

      // DB down => overall unhealthy => 503
      expect(response.status).toBe(503);
    });
  });

  // --------------------------------------------------------------------------
  // REDIS HEALTH CHECKS
  // --------------------------------------------------------------------------

  describe('Redis health checks', () => {
    it('should report redis as degraded when not configured', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      mockIsRedisAvailable.mockReturnValue(false);

      const response = await importAndCallGET();
      const body = await response.json();

      expect(body.data.infrastructure.redis.status).toBe('degraded');
      expect(body.data.infrastructure.redis.message).toContain('not configured');
    });

    it('should return 503 when redis ping fails (redis down)', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockRejectedValue(new Error('Connection timeout'));

      const response = await importAndCallGET();

      // Redis down => overall unhealthy => 503
      expect(response.status).toBe(503);
    });
  });

  // --------------------------------------------------------------------------
  // CODE AGENT HEALTH CHECKS
  // --------------------------------------------------------------------------

  describe('Code Agent health check', () => {
    it('should report code agent as disabled when not enabled', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      mockIsCodeAgentEnabled.mockReturnValue(false);

      const response = await importAndCallGET();
      const body = await response.json();

      const codeAgent = body.data.agents.find((a: { name: string }) => a.name === 'Code Agent');
      expect(codeAgent.enabled).toBe(false);
      expect(codeAgent.available).toBe(false);
    });

    it('should report detection as not working when detection functions fail', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      // shouldUseCodeAgent returns false for build requests (incorrect detection)
      mockShouldUseCodeAgent.mockReturnValue(false);

      const response = await importAndCallGET();
      const body = await response.json();

      const codeAgent = body.data.agents.find((a: { name: string }) => a.name === 'Code Agent');
      expect(codeAgent.detectionWorking).toBe(false);
    });

    it('should handle code agent throwing an error', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      mockIsCodeAgentEnabled.mockImplementation(() => {
        throw new Error('Code agent config error');
      });

      const response = await importAndCallGET();
      const body = await response.json();

      const codeAgent = body.data.agents.find((a: { name: string }) => a.name === 'Code Agent');
      expect(codeAgent.enabled).toBe(false);
      expect(codeAgent.available).toBe(false);
      expect(codeAgent.error).toBe('Code agent config error');
    });
  });

  // --------------------------------------------------------------------------
  // OVERALL HEALTH CALCULATION
  // --------------------------------------------------------------------------

  describe('Overall health calculation', () => {
    it('should return unhealthy (503) when database is down', async () => {
      setupAdminAuth();
      // No supabase env vars = db down
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should return unhealthy (503) when redis is down', async () => {
      setupAdminAuth();
      setupHealthyInfrastructure();
      setupHealthyAgents();
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockRejectedValue(new Error('Redis down'));

      const response = await importAndCallGET();

      expect(response.status).toBe(503);
    });

    it('should return degraded when database is degraded (not down)', async () => {
      setupAdminAuth();
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      mockCreateClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              error: { code: '42P01', message: 'relation does not exist' },
            }),
          }),
        }),
      });
      mockIsRedisAvailable.mockReturnValue(true);
      mockRedis.ping.mockResolvedValue('PONG');
      setupHealthyAgents();

      const response = await importAndCallGET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.overall).toBe('degraded');
    });
  });

  // --------------------------------------------------------------------------
  // EXPORTS
  // --------------------------------------------------------------------------

  describe('Module exports', () => {
    it('should export GET handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.GET).toBeDefined();
      expect(typeof routeModule.GET).toBe('function');
    });

    it('should export maxDuration of 30', async () => {
      const routeModule = await import('./route');
      expect(routeModule.maxDuration).toBe(30);
    });
  });
});
