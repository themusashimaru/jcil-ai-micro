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
const { GET, POST, PATCH, DELETE } = await import('../route');

describe('GET /api/scheduled-tasks', () => {
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

  it('returns list of tasks on success', async () => {
    const mockTasks = [
      { id: 'task-1', name: 'Weekly report', status: 'pending' },
      { id: 'task-2', name: 'Daily sync', status: 'pending' },
    ];
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTasks, error: null }),
          }),
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tasks).toEqual(mockTasks);
  });

  it('returns empty array when no tasks exist', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const response = await GET();
    const body = await response.json();
    expect(body.tasks).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe('POST /api/scheduled-tasks', () => {
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

    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request');
  });

  it('creates task and returns 201 on success', async () => {
    const createdTask = {
      id: 'task-new',
      name: 'Weekly report',
      platform: 'email',
      action: 'send',
      tool_name: 'send_email',
      scheduled_for: '2026-04-01T10:00:00Z',
    };
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdTask, error: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weekly report',
        platform: 'email',
        action: 'send',
        toolName: 'send_email',
        toolParams: {},
        scheduledFor: '2026-04-01T10:00:00Z',
      }),
    });
    const response = await POST(request as never);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.task).toEqual(createdTask);
  });

  it('returns 500 when insert fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Weekly report',
        platform: 'email',
        action: 'send',
        toolName: 'send_email',
        scheduledFor: '2026-04-01T10:00:00Z',
      }),
    });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });
});

describe('PATCH /api/scheduled-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
  });

  it('returns 400 when id is missing', async () => {
    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const response = await PATCH(request as never);
    expect(response.status).toBe(400);
  });

  it('updates task successfully', async () => {
    const updatedTask = { id: 'task-1', name: 'Updated report', status: 'pending' };
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedTask, error: null }),
            }),
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated report',
        status: 'paused',
      }),
    });
    const response = await PATCH(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.task).toEqual(updatedTask);
  });

  it('returns 500 when update fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: null, error: { message: 'Update failed' } }),
            }),
          }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'PATCH',
      body: JSON.stringify({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Updated',
      }),
    });
    const response = await PATCH(request as never);
    expect(response.status).toBe(500);
  });
});

describe('DELETE /api/scheduled-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: mockSupabaseFrom },
    });
  });

  it('returns 400 when task ID is missing', async () => {
    const request = new Request('http://localhost/api/scheduled-tasks', {
      method: 'DELETE',
    });
    const response = await DELETE(request as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing task ID');
  });

  it('cancels task and returns success', async () => {
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks?id=task-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request as never);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 when cancel fails', async () => {
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Cancel failed' } }),
        }),
      }),
    });

    const request = new Request('http://localhost/api/scheduled-tasks?id=task-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request as never);
    expect(response.status).toBe(500);
  });
});
