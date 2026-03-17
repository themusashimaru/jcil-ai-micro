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
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Import after mocks
const { GET, PUT } = await import('../route');

describe('GET /api/user/mcp-servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
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

  it('returns list of servers on success', async () => {
    const mockServers = [
      { id: 'srv-1', server_id: 'filesystem', name: 'Filesystem', enabled: true },
      { id: 'srv-2', server_id: 'github', name: 'GitHub', enabled: false },
    ];
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockServers, error: null }),
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.servers).toEqual(mockServers);
  });

  it('returns empty array when no servers exist', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(body.data.servers).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe('PUT /api/user/mcp-servers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const request = new Request('http://localhost/api/user/mcp-servers', {
      method: 'PUT',
      body: JSON.stringify({ server_id: 'fs', name: 'FS', command: 'npx' }),
    });
    const response = await PUT(request as never);
    expect(response.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/user/mcp-servers', {
      method: 'PUT',
      body: JSON.stringify({ server_id: 'fs' }),
    });
    const response = await PUT(request as never);
    expect(response.status).toBe(400);
  });

  it('upserts server config and returns data on success', async () => {
    const mockServer = {
      id: 'srv-1',
      server_id: 'filesystem',
      name: 'Filesystem',
      command: 'npx',
      enabled: true,
    };
    mockSupabaseFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockServer, error: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/user/mcp-servers', {
      method: 'PUT',
      body: JSON.stringify({
        server_id: 'filesystem',
        name: 'Filesystem',
        command: 'npx',
        args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
        enabled: true,
      }),
    });
    const response = await PUT(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.server).toEqual(mockServer);
  });

  it('returns 500 when upsert fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Upsert failed' } }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/user/mcp-servers', {
      method: 'PUT',
      body: JSON.stringify({
        server_id: 'filesystem',
        name: 'Filesystem',
        command: 'npx',
      }),
    });
    const response = await PUT(request as never);
    expect(response.status).toBe(500);
  });
});
