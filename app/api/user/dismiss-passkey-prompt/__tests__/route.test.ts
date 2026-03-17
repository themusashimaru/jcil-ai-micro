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

// Mock supabase client
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      update: (...args: unknown[]) => mockUpdate(...args),
    }),
  }),
}));

// Import after mocks
const { POST } = await import('../route');

describe('POST /api/user/dismiss-passkey-prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const response = await POST();
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const response = await POST();
    expect(response.status).toBe(429);
  });

  it('updates passkey_prompt_dismissed and returns success', async () => {
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ passkey_prompt_dismissed: true });
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockRequireUser.mockRejectedValue(new Error('DB connection failed'));

    const response = await POST();
    expect(response.status).toBe(500);
  });
});
