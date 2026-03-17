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

// Mock secure service role
const mockGetUserData = vi.fn();
const mockUpdateUserData = vi.fn();
vi.mock('@/lib/supabase/secure-service-role', () => ({
  createSecureServiceClient: () => ({
    getUserData: (...args: unknown[]) => mockGetUserData(...args),
    updateUserData: (...args: unknown[]) => mockUpdateUserData(...args),
  }),
  extractRequestContext: vi
    .fn()
    .mockReturnValue({ ip: '127.0.0.1', path: '/api/user/github-token' }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks
const { GET, POST, DELETE } = await import('../route');

describe('GET /api/user/github-token', () => {
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

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    expect(response.status).toBe(429);
  });

  it('returns connected: false when no token stored', async () => {
    mockGetUserData.mockResolvedValue(null);

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.connected).toBe(false);
  });

  it('returns connected: true with user info when token is valid', async () => {
    mockGetUserData.mockResolvedValue({
      github_token: 'encrypted-token',
      github_username: 'octocat',
    });
    mockDecrypt.mockReturnValue('ghp_real_token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'octocat', avatar_url: 'https://avatar.url' }),
    });

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.connected).toBe(true);
    expect(body.data.username).toBe('octocat');
    expect(body.data.avatarUrl).toBe('https://avatar.url');
  });

  it('clears token and returns connected: false when GitHub API rejects token', async () => {
    mockGetUserData.mockResolvedValue({
      github_token: 'encrypted-token',
      github_username: 'octocat',
    });
    mockDecrypt.mockReturnValue('ghp_expired_token');
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    const body = await response.json();
    expect(body.data.connected).toBe(false);
    expect(body.data.error).toBe('Token expired or invalid');
    expect(mockUpdateUserData).toHaveBeenCalledWith('user-123', {
      github_token: null,
      github_username: null,
    });
  });

  it('clears token when decryption fails', async () => {
    mockGetUserData.mockResolvedValue({
      github_token: 'bad-encrypted-data',
      github_username: 'octocat',
    });
    mockDecrypt.mockImplementation(() => {
      throw new Error('Decryption failed');
    });

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    const body = await response.json();
    expect(body.data.connected).toBe(false);
    expect(body.data.error).toContain('Token encryption changed');
    expect(mockUpdateUserData).toHaveBeenCalledWith('user-123', {
      github_token: null,
      github_username: null,
    });
  });

  it('returns connected: false with error when fetch throws', async () => {
    mockGetUserData.mockResolvedValue({
      github_token: 'encrypted-token',
      github_username: 'octocat',
    });
    mockDecrypt.mockReturnValue('ghp_real_token');
    mockFetch.mockRejectedValue(new Error('Network error'));

    const request = new Request('http://localhost/api/user/github-token');
    const response = await GET(request as never);
    const body = await response.json();
    expect(body.data.connected).toBe(false);
    expect(body.data.error).toBe('Failed to verify token');
  });
});

describe('POST /api/user/github-token', () => {
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

    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'ghp_test' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('returns 400 when token is missing', async () => {
    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 when GitHub API rejects the token', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });

    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'ghp_invalid' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('returns 400 when token lacks repo scope', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'octocat', avatar_url: 'https://avatar.url' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'ghp_norepo' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('repo');
  });

  it('encrypts and stores valid token successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: 'octocat', avatar_url: 'https://avatar.url' }),
      })
      .mockResolvedValueOnce({ ok: true });
    mockEncrypt.mockReturnValue('encrypted-ghp');
    mockUpdateUserData.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'ghp_valid' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.username).toBe('octocat');
    expect(mockEncrypt).toHaveBeenCalledWith('ghp_valid');
    expect(mockUpdateUserData).toHaveBeenCalledWith('user-123', {
      github_token: 'encrypted-ghp',
      github_username: 'octocat',
    });
  });

  it('returns 500 when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const request = new Request('http://localhost/api/user/github-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'ghp_test' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/user/github-token', () => {
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

    const request = new Request('http://localhost/api/user/github-token', { method: 'DELETE' });
    const response = await DELETE(request as never);
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const request = new Request('http://localhost/api/user/github-token', { method: 'DELETE' });
    const response = await DELETE(request as never);
    expect(response.status).toBe(429);
  });

  it('clears token and returns success', async () => {
    mockUpdateUserData.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/user/github-token', { method: 'DELETE' });
    const response = await DELETE(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(mockUpdateUserData).toHaveBeenCalledWith('user-123', {
      github_token: null,
      github_username: null,
    });
  });
});
