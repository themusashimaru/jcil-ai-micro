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

const mockExchangeCodeForSession = vi.fn();
const mockCookieStore = {
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    },
  }),
}));

const mockAdminFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('redirects to login when no code is present', async () => {
    const request = new NextRequest('http://localhost/api/auth/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/login');
  });

  it('redirects to login with rate limit error when rate limited', async () => {
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false });

    const request = new NextRequest('http://localhost/api/auth/callback?code=test-code');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('error=Too');
  });

  it('exchanges code for session and redirects to /chat', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: { full_name: 'Test User' },
        },
      },
      error: null,
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
        }),
      }),
    });

    const request = new NextRequest('http://localhost/api/auth/callback?code=valid-code');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/chat');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code');
  });

  it('creates user record on first login', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'new-user',
          email: 'new@example.com',
          user_metadata: { full_name: 'New User', role: 'student' },
        },
      },
      error: null,
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }), // No existing user
        }),
      }),
      insert: mockInsert,
    });

    const request = new NextRequest('http://localhost/api/auth/callback?code=new-code');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(mockAdminFrom).toHaveBeenCalledWith('users');
  });

  it('redirects to custom next path when provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
        }),
      }),
    });

    const request = new NextRequest(
      'http://localhost/api/auth/callback?code=valid-code&next=/settings'
    );
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('/settings');
  });

  it('rejects malicious redirect paths (open redirect prevention)', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.com', user_metadata: {} },
      },
      error: null,
    });
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-1' } }),
        }),
      }),
    });

    // Protocol-relative URL
    const request1 = new NextRequest(
      'http://localhost/api/auth/callback?code=valid-code&next=//evil.com'
    );
    const response1 = await GET(request1);
    expect(response1.headers.get('Location')).toContain('/chat');

    // Absolute URL with protocol
    const request2 = new NextRequest(
      'http://localhost/api/auth/callback?code=valid-code&next=https://evil.com'
    );
    const response2 = await GET(request2);
    expect(response2.headers.get('Location')).toContain('/chat');

    // Backslash trick
    const request3 = new NextRequest(
      'http://localhost/api/auth/callback?code=valid-code&next=/\\evil.com'
    );
    const response3 = await GET(request3);
    expect(response3.headers.get('Location')).toContain('/chat');
  });

  it('redirects with error on session exchange failure', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid code'),
    });

    const request = new NextRequest('http://localhost/api/auth/callback?code=bad-code');
    const response = await GET(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toContain('error=Authentication');
  });
});
