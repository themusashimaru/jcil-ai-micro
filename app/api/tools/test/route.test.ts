/**
 * TOOLS TEST API TESTS
 *
 * Tests for /api/tools/test endpoint:
 * - GET: Return test results summary (admin only)
 * - POST: Run tool health checks (admin only)
 * - Auth requirements
 * - File system operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  successResponse: vi.fn((data) => {
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    serverError: vi.fn(
      (msg) =>
        new Response(JSON.stringify({ error: msg || 'Internal server error' }), { status: 500 })
    ),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  readdirSync: vi
    .fn()
    .mockReturnValue(['calculator-tool.ts', 'web-search-tool.ts', 'code-execution-tool.ts']),
}));

vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Tools Test API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tools/test', () => {
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
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('should return tool inventory when no cached results', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { GET } = await import('./route');
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.toolCount).toBeDefined();
    });

    it('should return cached results when available', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          timestamp: '2026-03-01',
          summary: { total: 10, passed: 8, failed: 2 },
          results: [
            { tool: 'calculator', operation: 'add', success: true },
            { tool: 'web-search', operation: 'search', success: false, error: 'not configured' },
          ],
        })
      );

      const { GET } = await import('./route');
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.toolCount).toBeDefined();
    });
  });

  describe('POST /api/tools/test', () => {
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
        new Request('http://localhost/api/tools/test', {
          method: 'POST',
          body: JSON.stringify({ tools: ['calculator'] }),
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(response.status).toBe(401);
    });
  });
});
