import { describe, it, expect, vi, beforeEach } from 'vitest';

// ========================================
// MOCKS
// ========================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock requireUser
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock API utils
const mockCheckRequestRateLimit = vi.fn();
const mockSuccessResponse = vi.fn();
const mockErrors = {
  unauthorized: vi.fn(),
  notFound: vi.fn(),
  serverError: vi.fn(),
  badRequest: vi.fn(),
  rateLimited: vi.fn(),
};

vi.mock('@/lib/api/utils', () => ({
  checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errors: mockErrors,
  rateLimits: {
    strict: { limit: 10, windowMs: 60_000 },
    standard: { limit: 60, windowMs: 60_000 },
  },
}));

// ========================================
// HELPERS
// ========================================

function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function mockAuthSuccess(supabaseResult?: { data: unknown; error: unknown }) {
  const supabase = mockSupabaseChain(
    supabaseResult ?? {
      data: {
        subscription_tier: 'pro',
        subscription_status: 'active',
        stripe_customer_id: 'cus_abc123',
        stripe_subscription_id: 'sub_xyz789',
      },
      error: null,
    }
  );
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: 'user-123' },
    supabase,
  });
  return supabase;
}

function mockAuthFail() {
  const response = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  mockRequireUser.mockResolvedValue({ authorized: false, response });
}

// ========================================
// IMPORT ROUTE AFTER MOCKS
// ========================================

const { GET } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('GET /api/user/subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rate limit allows
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Default: successResponse returns a proper Response
    mockSuccessResponse.mockImplementation(
      (data: unknown) =>
        new Response(JSON.stringify({ ok: true, ...(data as object) }), { status: 200 })
    );

    // Default: errors return proper responses
    mockErrors.unauthorized.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    mockErrors.serverError.mockReturnValue(
      new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    );
  });

  // ----------------------------------------
  // 1. Returns 401 when not authenticated
  // ----------------------------------------
  it('returns 401 when not authenticated', async () => {
    mockAuthFail();
    const res = await GET();

    expect(res.status).toBe(401);
    // GET requests call requireUser() without request argument
    expect(mockRequireUser).toHaveBeenCalled();
  });

  // ----------------------------------------
  // 2. Returns 429 when rate limited
  // ----------------------------------------
  it('returns 429 when rate limited', async () => {
    mockAuthSuccess();
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const res = await GET();

    expect(res.status).toBe(429);
    expect(mockCheckRequestRateLimit).toHaveBeenCalledWith(
      'subscription:get:user-123',
      expect.any(Object)
    );
  });

  // ----------------------------------------
  // 3. Returns subscription details for subscribed user
  // ----------------------------------------
  it('returns subscription details for subscribed user', async () => {
    mockAuthSuccess({
      data: {
        subscription_tier: 'pro',
        subscription_status: 'active',
        stripe_customer_id: 'cus_abc123',
        stripe_subscription_id: 'sub_xyz789',
      },
      error: null,
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith({
      tier: 'pro',
      status: 'active',
      hasStripeCustomer: true,
      hasActiveSubscription: true,
    });
    expect(data.tier).toBe('pro');
    expect(data.status).toBe('active');
    expect(data.hasStripeCustomer).toBe(true);
    expect(data.hasActiveSubscription).toBe(true);
  });

  // ----------------------------------------
  // 4. Returns defaults (free/active) when no subscription data
  // ----------------------------------------
  it('returns defaults (free/active) when no subscription data', async () => {
    mockAuthSuccess({
      data: {
        subscription_tier: null,
        subscription_status: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
      },
      error: null,
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mockSuccessResponse).toHaveBeenCalledWith({
      tier: 'free',
      status: 'active',
      hasStripeCustomer: false,
      hasActiveSubscription: false,
    });
    expect(data.tier).toBe('free');
    expect(data.status).toBe('active');
    expect(data.hasStripeCustomer).toBe(false);
    expect(data.hasActiveSubscription).toBe(false);
  });

  // ----------------------------------------
  // 5. Returns 500 on database error
  // ----------------------------------------
  it('returns 500 on database error', async () => {
    mockAuthSuccess({
      data: null,
      error: { message: 'Database connection failed', code: 'PGRST301' },
    });

    const res = await GET();

    expect(res.status).toBe(500);
    expect(mockErrors.serverError).toHaveBeenCalled();
  });

  // ----------------------------------------
  // 6. Correctly computes hasStripeCustomer boolean
  // ----------------------------------------
  it('hasStripeCustomer is true when stripe_customer_id exists', async () => {
    mockAuthSuccess({
      data: {
        subscription_tier: 'plus',
        subscription_status: 'active',
        stripe_customer_id: 'cus_test',
        stripe_subscription_id: null,
      },
      error: null,
    });

    await GET();

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        hasStripeCustomer: true,
        hasActiveSubscription: false,
      })
    );
  });

  // ----------------------------------------
  // 7. Correctly computes hasActiveSubscription boolean
  // ----------------------------------------
  it('hasActiveSubscription is true when stripe_subscription_id exists', async () => {
    mockAuthSuccess({
      data: {
        subscription_tier: 'executive',
        subscription_status: 'active',
        stripe_customer_id: 'cus_test',
        stripe_subscription_id: 'sub_test',
      },
      error: null,
    });

    await GET();

    expect(mockSuccessResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        hasStripeCustomer: true,
        hasActiveSubscription: true,
      })
    );
  });

  // ----------------------------------------
  // 8. Returns 500 when unexpected error is thrown
  // ----------------------------------------
  it('returns 500 when unexpected error is thrown', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected error'));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(mockErrors.serverError).toHaveBeenCalled();
  });
});
