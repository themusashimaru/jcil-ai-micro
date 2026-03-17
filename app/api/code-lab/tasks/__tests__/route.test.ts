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

const mockRateLimiters = {
  codeLabEdit: vi.fn().mockResolvedValue({ allowed: true }),
};
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: mockRateLimiters,
}));

vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

const mockGetTaskStatus = vi.fn();
const mockGetUserTasks = vi.fn();
const mockCreateTask = vi.fn();
const mockExecuteTask = vi.fn();
const mockCancelTask = vi.fn();
vi.mock('@/lib/autonomous-task', () => ({
  getTaskStatus: (...args: unknown[]) => mockGetTaskStatus(...args),
  getUserTasks: (...args: unknown[]) => mockGetUserTasks(...args),
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  executeTask: (...args: unknown[]) => mockExecuteTask(...args),
  cancelTask: (...args: unknown[]) => mockCancelTask(...args),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/security/crypto', () => ({
  safeDecrypt: vi.fn().mockReturnValue('decrypted-token'),
}));

// Import after mocks
const { GET, POST, DELETE } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function createGetRequest(queryParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/code-lab/tasks');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, { method: 'GET' });
}

function createPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/code-lab/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(queryParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/code-lab/tasks');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

function mock401() {
  return new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
    status: 401,
  });
}

const mockTask = {
  id: 'task-001',
  title: 'Test Task',
  description: 'A test task',
  status: 'running',
  userId: USER_ID,
  steps: [],
  totalSteps: 3,
  progress: 0,
  estimatedDuration: 60,
};

// ========================================
// TESTS
// ========================================

describe('GET /api/code-lab/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: createMockSupabase(),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await GET(createGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns task by id', async () => {
    mockGetTaskStatus.mockResolvedValue(mockTask);

    const res = await GET(createGetRequest({ id: 'task-001' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.task).toMatchObject({
      id: 'task-001',
      title: 'Test Task',
      status: 'running',
    });
    expect(mockGetTaskStatus).toHaveBeenCalledWith('task-001');
  });

  it('returns 404 when task not found', async () => {
    mockGetTaskStatus.mockResolvedValue(null);

    const res = await GET(createGetRequest({ id: 'nonexistent' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('returns 404 when task belongs to different user', async () => {
    mockGetTaskStatus.mockResolvedValue({ ...mockTask, userId: 'other-user' });

    const res = await GET(createGetRequest({ id: 'task-001' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('returns list of tasks', async () => {
    const tasks = [mockTask, { ...mockTask, id: 'task-002', title: 'Task Two' }];
    mockGetUserTasks.mockResolvedValue(tasks);

    const res = await GET(createGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.tasks).toHaveLength(2);
    expect(mockGetUserTasks).toHaveBeenCalledWith(USER_ID, 10);
  });

  it('respects limit parameter', async () => {
    mockGetUserTasks.mockResolvedValue([]);

    await GET(createGetRequest({ limit: '5' }));

    expect(mockGetUserTasks).toHaveBeenCalledWith(USER_ID, 5);
  });
});

describe('POST /api/code-lab/tasks', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: true });
    mockExecuteTask.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await POST(createPostRequest({ request: 'Do something', sessionId: 'session-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    const res = await POST(createPostRequest({ request: 'Do something' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Missing');
  });

  it('creates task successfully', async () => {
    // Session ownership check succeeds
    mockSupabase._chain.single.mockResolvedValue({
      data: { id: 'session-1' },
      error: null,
    });

    mockCreateTask.mockResolvedValue(mockTask);

    const res = await POST(
      createPostRequest({
        request: 'Build a feature',
        sessionId: 'session-1',
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.task).toMatchObject({
      id: 'task-001',
      title: 'Test Task',
      status: 'running',
    });
    expect(mockCreateTask).toHaveBeenCalledWith('Build a feature', expect.any(Object));
  });

  it('returns 403 when session ownership check fails', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await POST(
      createPostRequest({
        request: 'Build a feature',
        sessionId: 'session-wrong',
      })
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.ok).toBe(false);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const res = await POST(createPostRequest({ request: 'Do something', sessionId: 'session-1' }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });
});

describe('DELETE /api/code-lab/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: createMockSupabase(),
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await DELETE(createDeleteRequest({ id: 'task-001' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing task ID', async () => {
    const res = await DELETE(createDeleteRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Missing task ID');
  });

  it('returns 404 when task not found', async () => {
    mockGetTaskStatus.mockResolvedValue(null);

    const res = await DELETE(createDeleteRequest({ id: 'nonexistent' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('returns 404 when task belongs to different user', async () => {
    mockGetTaskStatus.mockResolvedValue({ ...mockTask, userId: 'other-user' });

    const res = await DELETE(createDeleteRequest({ id: 'task-001' }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
  });

  it('cancels task successfully', async () => {
    mockGetTaskStatus.mockResolvedValue(mockTask);
    mockCancelTask.mockResolvedValue(true);

    const res = await DELETE(createDeleteRequest({ id: 'task-001' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(mockCancelTask).toHaveBeenCalledWith('task-001');
  });
});
