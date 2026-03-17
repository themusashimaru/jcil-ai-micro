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
};

vi.mock('@/lib/api/utils', () => ({
  checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  successResponse: (...args: unknown[]) => mockSuccessResponse(...args),
  errors: mockErrors,
  rateLimits: {
    strict: { maxRequests: 5, windowMs: 60000 },
    standard: { maxRequests: 30, windowMs: 60000 },
  },
}));

// Mock Stripe client
const mockCreateBillingPortalSession = vi.fn();
vi.mock('@/lib/stripe/client', () => ({
  createBillingPortalSession: (...args: unknown[]) => mockCreateBillingPortalSession(...args),
}));

// Mock validation schemas
vi.mock('@/lib/validation/schemas', async () => {
  const { z } = await import('zod');
  return {
    stripePortalSchema: z.object({
      returnUrl: z.string().url().optional(),
    }),
  };
});

// ========================================
// HELPERS
// ========================================

function makeRequest(body?: unknown): NextRequest {
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest('http://localhost/api/stripe/portal', init);
}

function makeRequestWithEmptyBody(): NextRequest {
  return new NextRequest('http://localhost/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '',
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
    supabaseResult ?? { data: { stripe_customer_id: 'cus_abc123' }, error: null }
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

const { POST } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('POST /api/stripe/portal', () => {
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
    mockErrors.notFound.mockImplementation(
      (resource: string) =>
        new Response(JSON.stringify({ error: `${resource} not found` }), { status: 404 })
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
    const req = makeRequest({});
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

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(mockCheckRequestRateLimit).toHaveBeenCalledWith(
      'stripe:portal:user-123',
      expect.any(Object)
    );
  });

  // ----------------------------------------
  // 3. Returns 404 when user has no stripe_customer_id
  // ----------------------------------------
  it('returns 404 when user has no stripe_customer_id', async () => {
    mockAuthSuccess({ data: { stripe_customer_id: null }, error: null });

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(mockErrors.notFound).toHaveBeenCalledWith('Subscription');
  });

  // ----------------------------------------
  // 4. Returns 404 when user not found
  // ----------------------------------------
  it('returns 404 when user not found in database', async () => {
    mockAuthSuccess({ data: null, error: { message: 'Not found' } });

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(mockErrors.notFound).toHaveBeenCalledWith('Subscription');
  });

  // ----------------------------------------
  // 5. Successfully creates portal session
  // ----------------------------------------
  it('successfully creates portal session', async () => {
    mockAuthSuccess();
    mockCreateBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith('cus_abc123', undefined);
    expect(mockSuccessResponse).toHaveBeenCalledWith({
      url: 'https://billing.stripe.com/session/bps_test',
    });
  });

  // ----------------------------------------
  // 6. Handles optional returnUrl
  // ----------------------------------------
  it('passes returnUrl to createBillingPortalSession when provided', async () => {
    mockAuthSuccess();
    mockCreateBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    const req = makeRequest({ returnUrl: 'https://myapp.com/settings' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith(
      'cus_abc123',
      'https://myapp.com/settings'
    );
  });

  // ----------------------------------------
  // 7. Handles invalid/empty JSON body gracefully
  // ----------------------------------------
  it('handles empty body gracefully (treats as no returnUrl)', async () => {
    mockAuthSuccess();
    mockCreateBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    const req = makeRequestWithEmptyBody();
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith('cus_abc123', undefined);
  });

  it('handles non-JSON body gracefully', async () => {
    mockAuthSuccess();
    mockCreateBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/bps_test',
    });

    const req = new NextRequest('http://localhost/api/stripe/portal', {
      method: 'POST',
      body: 'not json at all',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateBillingPortalSession).toHaveBeenCalledWith('cus_abc123', undefined);
  });

  // ----------------------------------------
  // 8. Returns 500 on Stripe error
  // ----------------------------------------
  it('returns 500 on Stripe error', async () => {
    mockAuthSuccess();
    mockCreateBillingPortalSession.mockRejectedValue(new Error('Stripe API error'));

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockErrors.serverError).toHaveBeenCalled();
  });
});
