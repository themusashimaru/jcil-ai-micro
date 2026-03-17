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

const mockCookieStore = {
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

const mockGetUser = vi.fn();
const mockSignInWithOAuth = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  }),
}));

// Set required env vars
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Import after mocks
const { GET } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('GET /api/auth/link-github', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('redirects with rate limit error when rate limited', async () => {
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('error=rate_limited');
  });

  it('redirects with already_linked when GitHub is already connected', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          identities: [{ provider: 'github' }],
        },
      },
    });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('github=already_linked');
  });

  it('initiates OAuth flow for user without GitHub', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          identities: [{ provider: 'google' }],
        },
      },
    });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize?client_id=abc' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe(
      'https://github.com/login/oauth/authorize?client_id=abc'
    );
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        options: expect.objectContaining({
          scopes: 'repo read:user user:email',
        }),
      })
    );
  });

  it('initiates OAuth flow for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('https://github.com/login/oauth/authorize');
  });

  it('redirects with error when OAuth initiation fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: new Error('OAuth config error'),
    });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('error=oauth_failed');
  });

  it('redirects with error when no OAuth URL returned', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/auth/link-github');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('error=no_oauth_url');
  });

  it('uses custom redirect parameter', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://github.com/login/oauth/authorize' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/auth/link-github?redirect=/settings');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining(encodeURIComponent('/settings')),
        }),
      })
    );
  });
});
