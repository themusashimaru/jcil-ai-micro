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

// Mock admin auth
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock redis
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();
vi.mock('@/lib/redis/client', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
}));

// Mock rate limiting and validation
const mockCheckRequestRateLimit = vi.fn();
const mockValidateBody = vi.fn();
const mockGetClientIP = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
    validateBody: (...args: unknown[]) => mockValidateBody(...args),
    getClientIP: (...args: unknown[]) => mockGetClientIP(...args),
  };
});

// Mock validation schema
vi.mock('@/lib/validation/schemas', () => ({
  designSettingsSchema: { parse: vi.fn() },
}));

// Mock supabase client with a from handler that tracks calls
const mockFromHandler = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockFromHandler(...args),
  }),
}));

// Set env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { GET, POST } = await import('../route');

describe('GET /api/design-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const request = new Request('http://localhost/api/design-settings');
    const response = await GET(request as never);
    expect(response.status).toBe(429);
  });

  it('returns cached settings with X-Cache HIT header', async () => {
    const cachedSettings = {
      main_logo: '/images/logo.png',
      site_name: 'JCIL.ai',
      subtitle: 'AI Assistant',
    };
    mockCacheGet.mockResolvedValue(cachedSettings);

    const request = new Request('http://localhost/api/design-settings');
    const response = await GET(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.site_name).toBe('JCIL.ai');
    expect(response.headers.get('X-Cache')).toBe('HIT');
  });

  it('fetches from database on cache miss and returns MISS', async () => {
    const dbSettings = {
      main_logo: '/images/logo.png',
      site_name: 'JCIL.ai',
      subtitle: 'Your AI Assistant',
    };
    mockFromHandler.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: dbSettings, error: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/design-settings');
    const response = await GET(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.site_name).toBe('JCIL.ai');
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('returns default settings on database error', async () => {
    mockFromHandler.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/design-settings');
    const response = await GET(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    // Returns defaults
    expect(body.site_name).toBe('JCIL.ai');
  });
});

describe('POST /api/design-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
    mockCacheDelete.mockResolvedValue(undefined);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const request = new Request('http://localhost/api/design-settings', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(429);
  });

  it('returns 403 when not admin', async () => {
    const unauthorizedResponse = new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
    });
    mockRequireAdmin.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const request = new Request('http://localhost/api/design-settings', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(403);
  });

  it('returns validation error on invalid body', async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: { id: 'admin-1', email: 'admin@test.com' },
    });
    const validationResponse = new Response(JSON.stringify({ error: 'Validation failed' }), {
      status: 400,
    });
    mockValidateBody.mockResolvedValue({ success: false, response: validationResponse });

    const request = new Request('http://localhost/api/design-settings', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('updates existing settings and invalidates cache', async () => {
    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: { id: 'admin-1', email: 'admin@test.com' },
    });
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        mainLogo: '/new-logo.png',
        headerLogo: '',
        loginLogo: '',
        lightModeLogo: '',
        favicon: '',
        siteName: 'New Name',
        subtitle: 'New Sub',
        modelName: '',
      },
    });

    const updatedData = { id: 'settings-1', site_name: 'New Name' };

    // The POST handler calls from('design_settings') twice:
    // 1. select('id').limit(1).single() — check existing
    // 2. update({...}).eq('id', ...).select().single() — update
    let callCount = 0;
    mockFromHandler.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'settings-1' }, error: null }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedData, error: null }),
            }),
          }),
        }),
      };
    });

    const request = new Request('http://localhost/api/design-settings', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.settings).toEqual(updatedData);
    expect(mockCacheDelete).toHaveBeenCalledWith('design_settings');
  });
});
