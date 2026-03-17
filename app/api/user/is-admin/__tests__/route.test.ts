import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSupabaseFrom = vi.fn();
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/user/is-admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns isAdmin: true when user is in admin_users table', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'admin-row-1' },
            error: null,
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.isAdmin).toBe(true);
    expect(json.userId).toBe('user-123');
    expect(json.email).toBe('test@example.com');
  });

  it('returns isAdmin: false when user is not in admin_users table (PGRST116)', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Row not found' },
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.isAdmin).toBe(false);
    expect(json.userId).toBe('user-123');
    expect(json.email).toBe('test@example.com');
  });

  it('handles database errors gracefully and still returns isAdmin: false', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST500', message: 'Database connection error' },
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    // Route still returns 200 with isAdmin: false on non-PGRST116 errors
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.isAdmin).toBe(false);
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ ok: false, error: 'Too many requests' }),
      { status: 429 }
    );
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const response = await GET();
    expect(response.status).toBe(429);
  });

  it('returns 500 when an unexpected exception is thrown', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected error'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
