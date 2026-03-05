/**
 * TOOLS AUDIT API TESTS
 *
 * Tests for /api/tools/audit endpoint:
 * - GET: Returns audit of all registered chat tools (admin only)
 * - Auth requirements
 * - Tool categorization
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
  errors: {
    serverError: vi.fn(
      (msg) =>
        new Response(JSON.stringify({ error: msg || 'Internal server error' }), { status: 500 })
    ),
  },
}));

vi.mock('@/lib/ai/tools', () => ({
  getAvailableChatTools: vi.fn().mockResolvedValue([
    { name: 'security_scanner', description: 'Scans for vulnerabilities' },
    { name: 'math_calculator', description: 'Performs calculations' },
    { name: 'web_scraper', description: 'Scrapes web pages' },
  ]),
  executeChatTool: vi.fn(),
}));

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

describe('Tools Audit API', () => {
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

  it('should return tool audit data', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('should handle tool loading errors', async () => {
    const { getAvailableChatTools } = await import('@/lib/ai/tools');
    vi.mocked(getAvailableChatTools).mockRejectedValueOnce(new Error('Failed to load tools'));

    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(500);
  });
});
