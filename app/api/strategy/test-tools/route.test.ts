/**
 * STRATEGY TEST-TOOLS API TESTS
 *
 * Tests for /api/strategy/test-tools endpoint:
 * - GET: Test strategy tools (admin only)
 * - Auth requirements
 * - Error handling
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
  successResponse: vi.fn(
    (data) => new Response(JSON.stringify({ success: true, ...data }), { status: 200 })
  ),
}));

vi.mock('@/agents/strategy/tools', () => ({
  executeScoutTool: vi.fn().mockResolvedValue({ result: 'test output' }),
  getClaudeToolDefinitions: vi
    .fn()
    .mockReturnValue([{ name: 'brave_search' }, { name: 'browser_visit' }]),
}));

vi.mock('@/agents/strategy/tools/types', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('Strategy Test-Tools API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('should return test results for admin', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
