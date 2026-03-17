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
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock supabase admin client
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
    rpc: (...args: unknown[]) => mockAdminRpc(...args),
  }),
}));

// Set env vars so getSupabaseAdmin() returns a client
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { POST } = await import('../route');

describe('POST /api/usage/update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom, rpc: mockSupabaseRpc },
    });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('returns 400 when type is missing', async () => {
    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Invalid type');
  });

  it('returns 400 when type is invalid', async () => {
    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });

  it('increments chat usage via RPC successfully', async () => {
    mockAdminRpc.mockResolvedValue({ data: 5, error: null });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.type).toBe('chat');
    expect(body.data.newCount).toBe(5);
  });

  it('increments image usage via RPC successfully', async () => {
    mockAdminRpc.mockResolvedValue({ data: 3, error: null });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'image' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.type).toBe('image');
    expect(body.data.newCount).toBe(3);
  });

  it('resets chat usage when action is reset', async () => {
    mockAdminFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat', action: 'reset' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.message).toContain('reset');
  });

  it('falls back to manual update when RPC fails', async () => {
    mockAdminRpc.mockResolvedValue({ data: null, error: new Error('RPC not found') });

    // Fallback: select current count, then update
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { messages_used_today: 10 }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat' }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.newCount).toBe(11);
  });

  it('returns 403 when non-admin tries to update another user', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: JSON.stringify({ type: 'chat', userId: 'other-user-456' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(403);
  });

  it('returns 500 on unexpected error', async () => {
    const request = new Request('http://localhost/api/usage/update', {
      method: 'POST',
      body: 'not json',
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});
