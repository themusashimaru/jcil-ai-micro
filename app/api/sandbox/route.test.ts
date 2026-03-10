/**
 * SANDBOX API TESTS
 *
 * Tests for /api/sandbox endpoint:
 * - POST: Execute code in sandbox VMs
 * - Auth and tier-based rate limiting
 * - Sandbox configuration check
 * - Error handling
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
    supabase: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { subscription_tier: 'pro' },
              error: null,
            }),
          }),
        }),
      }),
    },
  }),
}));

vi.mock('@/lib/connectors/vercel-sandbox', () => ({
  executeSandbox: vi.fn().mockResolvedValue({ output: 'Hello World', exitCode: 0 }),
  quickTest: vi.fn().mockResolvedValue({ passed: true }),
  buildAndTest: vi.fn().mockResolvedValue({ success: true }),
  getSandboxConfig: vi.fn().mockReturnValue({ token: 'test-token' }),
  isSandboxConfigured: vi.fn().mockReturnValue(true),
  getMissingSandboxConfig: vi.fn().mockReturnValue([]),
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
    badRequest: vi.fn((msg) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    serverError: vi.fn(
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    serviceUnavailable: vi.fn(
      (msg) => new Response(JSON.stringify({ error: msg }), { status: 503 })
    ),
    rateLimited: vi.fn(
      () => new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 })
    ),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/sandbox', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('Sandbox API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export POST handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.POST).toBeDefined();
  });

  it('should reject when sandbox is not configured', async () => {
    const { isSandboxConfigured } = await import('@/lib/connectors/vercel-sandbox');
    vi.mocked(isSandboxConfigured).mockReturnValueOnce(false);

    const { POST } = await import('./route');
    const response = await POST(createPostRequest({ code: 'console.log("hi")' }));
    expect(response.status).toBe(503);
  });

  it('should reject unauthenticated requests', async () => {
    const { requireUser } = await import('@/lib/auth/user-guard');
    vi.mocked(requireUser).mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as never);

    const { POST } = await import('./route');
    const response = await POST(createPostRequest({ code: 'console.log("hi")' }));
    expect(response.status).toBe(401);
  });
});
