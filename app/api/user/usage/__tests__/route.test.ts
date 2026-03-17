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

// Mock limits module
const mockGetTokenUsage = vi.fn();
const mockGetImageUsage = vi.fn();
const mockGetTokenLimit = vi.fn();
const mockGetImageLimit = vi.fn();
const mockFormatTokenCount = vi.fn();
vi.mock('@/lib/limits', () => ({
  getTokenUsage: (...args: unknown[]) => mockGetTokenUsage(...args),
  getImageUsage: (...args: unknown[]) => mockGetImageUsage(...args),
  getTokenLimit: (...args: unknown[]) => mockGetTokenLimit(...args),
  getImageLimit: (...args: unknown[]) => mockGetImageLimit(...args),
  formatTokenCount: (...args: unknown[]) => mockFormatTokenCount(...args),
}));

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/user/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
    mockFormatTokenCount.mockImplementation((n: number) => `${n} tokens`);
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

  it('returns usage stats for free user', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        }),
      }),
    });

    mockGetTokenUsage.mockResolvedValue({
      used: 5000,
      limit: 50000,
      remaining: 45000,
      percentage: 10,
      stop: false,
      warn: false,
    });
    mockGetImageUsage.mockResolvedValue({
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 0,
      stop: false,
      warn: false,
    });
    mockGetTokenLimit.mockReturnValue(50000);
    mockGetImageLimit.mockReturnValue(0);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tier).toBe('free');
    expect(json.tokens.used).toBe(5000);
    expect(json.tokens.limit).toBe(50000);
    expect(json.tokens.remaining).toBe(45000);
    expect(json.features.realtime_voice).toBe(false);
    expect(json.features.image_generation).toBe(false);
    expect(json.hasReachedTokenLimit).toBe(false);
    expect(json.hasReachedImageLimit).toBe(false);
    expect(json.planInfo.nextTier).toBe('basic');
  });

  it('returns usage stats for pro user with different limits', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { subscription_tier: 'pro' },
            error: null,
          }),
        }),
      }),
    });

    mockGetTokenUsage.mockResolvedValue({
      used: 200000,
      limit: 500000,
      remaining: 300000,
      percentage: 40,
      stop: false,
      warn: false,
    });
    mockGetImageUsage.mockResolvedValue({
      used: 10,
      limit: 100,
      remaining: 90,
      percentage: 10,
      stop: false,
      warn: false,
    });
    mockGetTokenLimit.mockImplementation((tier: string) => {
      if (tier === 'pro') return 500000;
      if (tier === 'executive') return 2000000;
      return 50000;
    });
    mockGetImageLimit.mockReturnValue(100);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tier).toBe('pro');
    expect(json.features.realtime_voice).toBe(true);
    expect(json.features.image_generation).toBe(true);
    expect(json.planInfo.nextTier).toBe('executive');
    expect(json.images.used).toBe(10);
    expect(json.images.limit).toBe(100);
  });

  it('returns 500 on database error', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST500', message: 'Database error' },
          }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });

  it('correctly computes hasReachedTokenLimit and hasReachedImageLimit', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { subscription_tier: 'free' },
            error: null,
          }),
        }),
      }),
    });

    mockGetTokenUsage.mockResolvedValue({
      used: 50000,
      limit: 50000,
      remaining: 0,
      percentage: 100,
      stop: true,
      warn: true,
    });
    mockGetImageUsage.mockResolvedValue({
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 100,
      stop: true,
      warn: true,
    });
    mockGetTokenLimit.mockReturnValue(50000);
    mockGetImageLimit.mockReturnValue(0);

    const response = await GET();
    const json = await response.json();

    expect(json.hasReachedTokenLimit).toBe(true);
    expect(json.hasReachedImageLimit).toBe(true);
    expect(json.tokenWarning).toBe(true);
    expect(json.imageWarning).toBe(true);
  });

  it('defaults to free tier when subscription_tier is null', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { subscription_tier: null },
            error: null,
          }),
        }),
      }),
    });

    mockGetTokenUsage.mockResolvedValue({
      used: 0,
      limit: 50000,
      remaining: 50000,
      percentage: 0,
      stop: false,
      warn: false,
    });
    mockGetImageUsage.mockResolvedValue({
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 0,
      stop: false,
      warn: false,
    });
    mockGetTokenLimit.mockReturnValue(50000);
    mockGetImageLimit.mockReturnValue(0);

    const response = await GET();
    const json = await response.json();

    expect(json.tier).toBe('free');
    expect(json.features.realtime_voice).toBe(false);
  });
});
