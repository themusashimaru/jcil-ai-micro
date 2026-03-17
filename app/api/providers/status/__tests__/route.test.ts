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

// Mock providers registry
const mockGetAvailableProviderIds = vi.fn();
vi.mock('@/lib/ai/providers/registry', () => ({
  getAvailableProviderIds: () => mockGetAvailableProviderIds(),
}));

// Mock cookies
const mockCookieStore = {
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

// Mock supabase
const mockGetUser = vi.fn();
const mockAdminSelect = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: (...args: unknown[]) => mockAdminSelect(...args),
    }),
  }),
}));

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/providers/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableProviderIds.mockReturnValue(['claude', 'xai']);
    mockGetUser.mockResolvedValue({ data: { user: null } });
  });

  it('returns platform-configured providers', async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.platformConfigured).toEqual(['claude', 'xai']);
    expect(body.data.configured).toContain('claude');
  });

  it('returns claude as default provider when available', async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.data.default).toBe('claude');
  });

  it('returns first available as default when claude is not configured', async () => {
    mockGetAvailableProviderIds.mockReturnValue(['xai', 'openai']);

    const response = await GET();
    const body = await response.json();
    expect(body.data.default).toBe('xai');
  });

  it('includes user-configured providers (BYOK) when user is logged in', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockAdminSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { provider_api_keys: { openai: 'sk-test', deepseek: 'ds-test' } },
          error: null,
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(body.data.userConfigured).toContain('openai');
    expect(body.data.userConfigured).toContain('deepseek');
    expect(body.data.configured).toContain('openai');
  });

  it('deduplicates providers between platform and user configured', async () => {
    mockGetAvailableProviderIds.mockReturnValue(['claude', 'openai']);
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockAdminSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { provider_api_keys: { openai: 'sk-test' } },
          error: null,
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    // openai should appear only once in configured
    const openaiCount = body.data.configured.filter((p: string) => p === 'openai').length;
    expect(openaiCount).toBe(1);
  });

  it('handles user lookup failure gracefully', async () => {
    mockGetUser.mockRejectedValue(new Error('Cookie error'));

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.userConfigured).toEqual([]);
    expect(body.data.platformConfigured).toEqual(['claude', 'xai']);
  });

  it('returns 500 on unexpected errors', async () => {
    mockGetAvailableProviderIds.mockImplementation(() => {
      throw new Error('Registry error');
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
