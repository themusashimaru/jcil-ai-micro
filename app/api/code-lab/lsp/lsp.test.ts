import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock CSRF
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock rate limiter
const mockCodeLabLSP = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabLSP: (...args: unknown[]) => mockCodeLabLSP(...args),
  },
}));

// Mock LSP manager
const mockGetLSPManager = vi.fn();
vi.mock('@/lib/lsp/lsp-client', () => ({
  getLSPManager: () => mockGetLSPManager(),
}));

// Mock workspace security
vi.mock('@/lib/workspace/security', () => ({
  sanitizeFilePath: (p: string) => p,
}));

const { POST } = await import('./route');

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/code-lab/lsp', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

describe('POST /api/code-lab/lsp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ authorized: true, user: { id: 'user-123' } });
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockCodeLabLSP.mockResolvedValue({ allowed: true });
  });

  it('rejects when CSRF check fails', async () => {
    const csrfResponse = new Response('CSRF failed', { status: 403 });
    mockValidateCSRF.mockReturnValue({ valid: false, response: csrfResponse });

    const req = createRequest({ operation: 'hover', sessionId: 's1' });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests', async () => {
    const authResponse = new Response('Unauthorized', { status: 401 });
    mockRequireUser.mockResolvedValue({ authorized: false, response: authResponse });

    const req = createRequest({ operation: 'hover', sessionId: 's1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockCodeLabLSP.mockResolvedValue({
      allowed: false,
      retryAfter: 60,
      remaining: 0,
      resetAt: 1000,
    });

    const req = createRequest({ operation: 'hover', sessionId: 's1' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('rejects requests without operation', async () => {
    const req = createRequest({ sessionId: 's1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('rejects requests without sessionId', async () => {
    const req = createRequest({ operation: 'hover' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('rejects unknown LSP operations', async () => {
    const req = createRequest({ operation: 'unknown_op', sessionId: 's1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
