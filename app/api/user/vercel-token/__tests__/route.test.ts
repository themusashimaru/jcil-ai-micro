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

// Mock crypto
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
vi.mock('@/lib/security/crypto', () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

// Mock supabase client
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => mockSelect(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    }),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks
const { GET, POST, DELETE } = await import('../route');

describe('GET /api/user/vercel-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Default chain for supabase select
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const response = await GET();
    expect(response.status).toBe(429);
  });

  it('returns connected: false when no token stored', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.connected).toBe(false);
  });

  it('returns connected: true when token is valid', async () => {
    mockSingle.mockResolvedValue({
      data: {
        vercel_token: 'encrypted-token',
        vercel_username: 'vercel-user',
        vercel_team_id: 'team-1',
      },
      error: null,
    });
    mockDecrypt.mockReturnValue('real-vercel-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { username: 'vercel-user', name: 'Vercel User', email: 'v@example.com' },
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.connected).toBe(true);
    expect(body.data.username).toBe('vercel-user');
    expect(body.data.email).toBe('v@example.com');
    expect(body.data.teamId).toBe('team-1');
  });

  it('clears token when Vercel API rejects it', async () => {
    mockSingle.mockResolvedValue({
      data: {
        vercel_token: 'encrypted-token',
        vercel_username: 'vercel-user',
        vercel_team_id: null,
      },
      error: null,
    });
    mockDecrypt.mockReturnValue('expired-token');
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    // Chain for update call
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    const response = await GET();
    const body = await response.json();
    expect(body.data.connected).toBe(false);
    expect(body.data.error).toBe('Token expired or invalid');
  });

  it('returns connected: false with error when fetch throws', async () => {
    mockSingle.mockResolvedValue({
      data: {
        vercel_token: 'encrypted-token',
        vercel_username: 'vercel-user',
        vercel_team_id: null,
      },
      error: null,
    });
    mockDecrypt.mockReturnValue('real-token');
    mockFetch.mockRejectedValue(new Error('Network error'));

    const response = await GET();
    const body = await response.json();
    expect(body.data.connected).toBe(false);
    expect(body.data.error).toBe('Failed to verify token');
  });
});

describe('POST /api/user/vercel-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'test' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('returns 400 when token is missing', async () => {
    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 when Vercel API rejects the token', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid-token' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 when token lacks deployment permissions', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { username: 'vercel-user', email: 'v@example.com' } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'no-deploy-perms' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('deployment permissions');
  });

  it('encrypts and stores valid token successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: { username: 'vercel-user', name: 'V User', email: 'v@example.com' },
        }),
      })
      .mockResolvedValueOnce({ ok: true });
    mockEncrypt.mockReturnValue('encrypted-vercel-token');

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', teamId: 'team-1' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.username).toBe('vercel-user');
    expect(mockEncrypt).toHaveBeenCalledWith('valid-token');
  });

  it('returns 500 on update error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { username: 'vercel-user' } }),
      })
      .mockResolvedValueOnce({ ok: true });
    mockEncrypt.mockReturnValue('encrypted-vercel-token');

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    const request = new Request('http://localhost/api/user/vercel-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/user/vercel-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const request = new Request('http://localhost/api/user/vercel-token', { method: 'DELETE' });
    const response = await DELETE(request as never);
    expect(response.status).toBe(401);
  });

  it('clears token and returns success', async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    const request = new Request('http://localhost/api/user/vercel-token', { method: 'DELETE' });
    const response = await DELETE(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
  });
});
