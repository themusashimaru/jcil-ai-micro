import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
  validationError: vi.fn(),
};

vi.mock('@/lib/api/utils', () => ({
  checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errors: mockErrors,
  rateLimits: {
    strict: { maxRequests: 5, windowMs: 60000 },
    standard: { maxRequests: 30, windowMs: 60000 },
  },
  validateBody: vi.fn(),
}));

// Mock Stripe client
const mockCreateCheckoutSession = vi.fn();
let mockStripePriceIds: Record<string, string> = {};

vi.mock('@/lib/stripe/client', () => ({
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
  get STRIPE_PRICE_IDS() {
    return mockStripePriceIds;
  },
}));

// ========================================
// HELPERS
// ========================================

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

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
    supabaseResult ?? { data: { email: 'user@example.com' }, error: null }
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

// We need to get validateBody from the mock so we can configure it per test
const { validateBody: mockValidateBody } = await import('@/lib/api/utils');

const { POST } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('POST /api/stripe/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: rate limit allows
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Default: price IDs configured
    mockStripePriceIds = {
      plus: 'price_plus_abc',
      pro: 'price_pro_def',
      executive: 'price_exec_ghi',
    };

    // Default: successResponse returns a proper NextResponse
    mockSuccessResponse.mockImplementation(
      (data: unknown) =>
        new Response(JSON.stringify({ ok: true, ...(data as object) }), { status: 200 })
    );

    // Default: errors return proper responses
    mockErrors.unauthorized.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    mockErrors.notFound.mockImplementation(
      (resource: string) =>
        new Response(JSON.stringify({ error: `${resource} not found` }), { status: 404 })
    );
    mockErrors.serverError.mockReturnValue(
      new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    );
    mockErrors.badRequest.mockImplementation(
      (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 })
    );
    mockErrors.validationError.mockImplementation(
      (details: unknown) =>
        new Response(JSON.stringify({ error: 'Validation failed', details }), { status: 400 })
    );
  });

  // ----------------------------------------
  // 1. Returns 401 when not authenticated
  // ----------------------------------------
  it('returns 401 when not authenticated', async () => {
    mockAuthFail();
    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockRequireUser).toHaveBeenCalledWith(req);
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

    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(mockCheckRequestRateLimit).toHaveBeenCalledWith(
      'stripe:checkout:user-123',
      expect.any(Object)
    );
  });

  // ----------------------------------------
  // 3. Returns 400 for invalid tier value
  // ----------------------------------------
  it('returns 400 for invalid tier value', async () => {
    mockAuthSuccess();
    const validationResponse = new Response(JSON.stringify({ error: 'Validation failed' }), {
      status: 400,
    });
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: false,
      response: validationResponse,
    } as never);

    const req = makeRequest({ tier: 'invalid-tier' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  // ----------------------------------------
  // 4. Returns 400 for missing tier
  // ----------------------------------------
  it('returns 400 for missing tier', async () => {
    mockAuthSuccess();
    const validationResponse = new Response(JSON.stringify({ error: 'Validation failed' }), {
      status: 400,
    });
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: false,
      response: validationResponse,
    } as never);

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  // ----------------------------------------
  // 5. Returns 404 when user not found in DB
  // ----------------------------------------
  it('returns 404 when user not found in DB', async () => {
    mockAuthSuccess({ data: null, error: { message: 'Not found' } });
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: true,
      data: { tier: 'pro' },
    } as never);

    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(mockErrors.notFound).toHaveBeenCalledWith('User');
  });

  // ----------------------------------------
  // 6. Returns 500 when price ID not configured
  // ----------------------------------------
  it('returns 500 when price ID not configured', async () => {
    mockAuthSuccess();
    mockStripePriceIds = { plus: '', pro: '', executive: '' };
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: true,
      data: { tier: 'pro' },
    } as never);

    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockErrors.serverError).toHaveBeenCalled();
  });

  // ----------------------------------------
  // 7. Returns 500 on Stripe error
  // ----------------------------------------
  it('returns 500 on Stripe error', async () => {
    mockAuthSuccess();
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: true,
      data: { tier: 'pro' },
    } as never);
    mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe API error'));

    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockErrors.serverError).toHaveBeenCalled();
  });

  // ----------------------------------------
  // 8. Successfully creates checkout session for each tier
  // ----------------------------------------
  it.each(['plus', 'pro', 'executive'] as const)(
    'successfully creates checkout session for tier: %s',
    async (tier) => {
      mockAuthSuccess();
      vi.mocked(mockValidateBody).mockResolvedValue({
        success: true,
        data: { tier },
      } as never);
      mockCreateCheckoutSession.mockResolvedValue({
        id: `cs_${tier}_session_id`,
        url: `https://checkout.stripe.com/pay/${tier}`,
      });

      const req = makeRequest({ tier });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        'user-123',
        mockStripePriceIds[tier],
        tier,
        'user@example.com'
      );
      expect(mockSuccessResponse).toHaveBeenCalledWith({
        sessionId: `cs_${tier}_session_id`,
        url: `https://checkout.stripe.com/pay/${tier}`,
      });
    }
  );

  // ----------------------------------------
  // 9. Returns sessionId and url in response
  // ----------------------------------------
  it('returns sessionId and url in response body', async () => {
    mockAuthSuccess();
    vi.mocked(mockValidateBody).mockResolvedValue({
      success: true,
      data: { tier: 'pro' },
    } as never);
    mockCreateCheckoutSession.mockResolvedValue({
      id: 'cs_test_session_123',
      url: 'https://checkout.stripe.com/pay/cs_test_session_123',
    });

    const req = makeRequest({ tier: 'pro' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_session_123');
    expect(data.url).toBe('https://checkout.stripe.com/pay/cs_test_session_123');
  });
});
