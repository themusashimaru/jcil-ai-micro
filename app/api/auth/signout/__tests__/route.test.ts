import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
    getClientIP: () => '127.0.0.1',
  };
});

const mockSignOut = vi.fn();
const mockCookieStore = {
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([
    { name: 'sb-access-token', value: 'token1' },
    { name: 'sb-refresh-token', value: 'token2' },
    { name: 'other-cookie', value: 'value' },
  ]),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

// Import after mocks
const { POST } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const request = new NextRequest('http://localhost/api/auth/signout', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('signs out user successfully', async () => {
    const request = new NextRequest('http://localhost/api/auth/signout', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('deletes Supabase cookies on signout', async () => {
    const request = new NextRequest('http://localhost/api/auth/signout', {
      method: 'POST',
    });
    await POST(request);

    // Should delete sb-* cookies but not others
    expect(mockCookieStore.delete).toHaveBeenCalledWith('sb-access-token');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('sb-refresh-token');
    expect(mockCookieStore.delete).not.toHaveBeenCalledWith('other-cookie');
  });

  it('returns 500 when Supabase signout fails', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('Session expired') });

    const request = new NextRequest('http://localhost/api/auth/signout', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 on unexpected error', async () => {
    mockSignOut.mockRejectedValue(new Error('Network error'));

    const request = new NextRequest('http://localhost/api/auth/signout', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
