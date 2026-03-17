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

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

const _mockSupabaseSelect = vi.fn();
const _mockSupabaseDelete = vi.fn();
const mockSupabaseFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  }),
}));

// Set required env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { GET, DELETE } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function mockAuthSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: USER_ID, email: 'test@example.com' },
    supabase: { from: vi.fn() },
  });
}

function mockAuthFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
      status: 401,
    }),
  });
}

// ========================================
// TESTS: GET /api/auth/webauthn/passkeys
// ========================================

describe('GET /api/auth/webauthn/passkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    mockAuthSuccess();
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const response = await GET();
    expect(response.status).toBe(429);
  });

  it('returns list of passkeys', async () => {
    mockAuthSuccess();
    const passkeys = [
      {
        id: 'pk-1',
        device_name: 'MacBook Pro',
        created_at: '2026-01-01',
        last_used_at: '2026-03-01',
      },
    ];
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: passkeys, error: null }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.passkeys).toHaveLength(1);
    expect(body.passkeys[0].device_name).toBe('MacBook Pro');
  });

  it('returns empty array when no passkeys exist', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.passkeys).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

// ========================================
// TESTS: DELETE /api/auth/webauthn/passkeys
// ========================================

describe('DELETE /api/auth/webauthn/passkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = new NextRequest('http://localhost/api/auth/webauthn/passkeys?id=pk-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    mockAuthSuccess();
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limited' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const request = new NextRequest('http://localhost/api/auth/webauthn/passkeys?id=pk-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(429);
  });

  it('returns 400 when passkey ID is missing', async () => {
    mockAuthSuccess();
    const request = new NextRequest('http://localhost/api/auth/webauthn/passkeys', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it('deletes passkey successfully', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const request = new NextRequest('http://localhost/api/auth/webauthn/passkeys?id=pk-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 on database delete error', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: new Error('Foreign key constraint'),
          }),
        }),
      }),
    });

    const request = new NextRequest('http://localhost/api/auth/webauthn/passkeys?id=pk-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });
});
