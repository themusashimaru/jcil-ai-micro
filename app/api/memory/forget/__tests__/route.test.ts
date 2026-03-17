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

// Mock rate limiting and validation
const mockCheckRequestRateLimit = vi.fn();
const mockValidateBody = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
    validateBody: (...args: unknown[]) => mockValidateBody(...args),
  };
});

// Mock memory module
const mockForgetFromMemory = vi.fn();
vi.mock('@/lib/memory', () => ({
  forgetFromMemory: (...args: unknown[]) => mockForgetFromMemory(...args),
}));

// Import after mocks
const { POST } = await import('../route');

describe('POST /api/memory/forget', () => {
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

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['javascript'] }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('returns rate limit response when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['javascript'] }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(429);
  });

  it('returns validation error when body is invalid', async () => {
    const validationResponse = new Response(JSON.stringify({ error: 'Validation failed' }), {
      status: 400,
    });
    mockValidateBody.mockResolvedValue({ success: false, response: validationResponse });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('forgets topics successfully and returns removed items', async () => {
    mockValidateBody.mockResolvedValue({
      success: true,
      data: {
        topics: ['javascript', 'python'],
        preference_keys: undefined,
        clear_summary: undefined,
      },
    });
    mockForgetFromMemory.mockResolvedValue({
      success: true,
      removed: ['topic:javascript', 'topic:python'],
    });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['javascript', 'python'] }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.removed).toEqual(['topic:javascript', 'topic:python']);
    expect(body.data.message).toContain('Successfully removed');
  });

  it('forgets preference keys successfully', async () => {
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { topics: undefined, preference_keys: ['name'], clear_summary: undefined },
    });
    mockForgetFromMemory.mockResolvedValue({
      success: true,
      removed: ['preference:name'],
    });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ preference_keys: ['name'] }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(body.data.success).toBe(true);
    expect(mockForgetFromMemory).toHaveBeenCalledWith('user-123', {
      topics: undefined,
      preferenceKeys: ['name'],
      clearSummary: undefined,
    });
  });

  it('returns message when no matching items found', async () => {
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { topics: ['nonexistent'], preference_keys: undefined, clear_summary: undefined },
    });
    mockForgetFromMemory.mockResolvedValue({
      success: true,
      removed: [],
    });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['nonexistent'] }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(body.data.message).toContain('No matching items');
  });

  it('returns 500 when forgetFromMemory fails', async () => {
    mockValidateBody.mockResolvedValue({
      success: true,
      data: { topics: ['test'], preference_keys: undefined, clear_summary: undefined },
    });
    mockForgetFromMemory.mockResolvedValue({
      success: false,
      error: 'Database error',
      removed: [],
    });

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['test'] }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockValidateBody.mockRejectedValue(new Error('Unexpected'));

    const request = new Request('http://localhost/api/memory/forget', {
      method: 'POST',
      body: JSON.stringify({ topics: ['test'] }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});
