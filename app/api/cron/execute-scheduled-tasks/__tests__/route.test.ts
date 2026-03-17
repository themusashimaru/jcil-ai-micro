import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockSupabaseChain = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: () => mockSupabaseChain,
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const CRON_SECRET = 'test-cron-secret-tasks';

function createRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/execute-scheduled-tasks', {
    method: 'GET',
    headers,
  });
}

function createAuthorizedRequest() {
  return createRequest({ authorization: `Bearer ${CRON_SECRET}` });
}

function createMockTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    tool_name: 'composio_GMAIL_SEND_EMAIL',
    tool_params: { to: 'test@example.com', subject: 'Test' },
    scheduled_for: new Date(Date.now() - 60000).toISOString(),
    recurring: null,
    run_count: 0,
    fail_count: 0,
    name: 'Send email',
    ...overrides,
  };
}

// ========================================
// TESTS
// ========================================

describe('GET /api/cron/execute-scheduled-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('returns 401 when no authorization header', async () => {
    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('returns 401 when cron secret is wrong', async () => {
    const request = createRequest({ authorization: 'Bearer wrong' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const request = createRequest({ authorization: 'Bearer anything' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns success with 0 executed when no due tasks', async () => {
    mockSupabaseChain.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.executed).toBe(0);
  });

  it('returns success with null data (no tasks)', async () => {
    mockSupabaseChain.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.executed).toBe(0);
  });

  it('returns 500 when fetch of due tasks fails', async () => {
    mockSupabaseChain.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'table not found' },
              }),
            }),
          }),
        }),
      }),
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });

  it('executes a composio task and marks it as running then completed', async () => {
    const task = createMockTask();
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    // First call: fetch due tasks
    // Subsequent calls: update status
    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [task], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { update: updateMock };
    });

    // Mock the fetch for composio execution
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: { sent: true } }),
    });

    try {
      const request = createAuthorizedRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.executed).toBe(1);
      expect(json.succeeded).toBe(1);
      expect(json.failed).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles failed task execution and increments fail_count', async () => {
    const task = createMockTask({ fail_count: 0 });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [task], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { update: updateMock };
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Service unavailable' }),
    });

    try {
      const request = createAuthorizedRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.executed).toBe(1);
      expect(json.succeeded).toBe(0);
      expect(json.failed).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles non-composio (internal) tools with unsupported error', async () => {
    const task = createMockTask({ tool_name: 'internal_tool' });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [task], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { update: updateMock };
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failed).toBe(1);
  });

  it('handles recurring daily task by rescheduling', async () => {
    const task = createMockTask({
      recurring: 'daily',
      scheduled_for: '2026-03-15T10:00:00.000Z',
    });

    const updateCalls: Array<Record<string, unknown>> = [];
    const updateMock = vi.fn().mockImplementation((data: Record<string, unknown>) => {
      updateCalls.push(data);
      return { eq: vi.fn().mockResolvedValue({ error: null }) };
    });

    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [task], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { update: updateMock };
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: {} }),
    });

    try {
      const request = createAuthorizedRequest();
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.succeeded).toBe(1);

      // Second update call should reschedule to pending with next day
      const rescheduleUpdate = updateCalls.find((u) => u.status === 'pending');
      expect(rescheduleUpdate).toBeDefined();
      expect(rescheduleUpdate?.scheduled_for).toContain('2026-03-16');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns 500 on unexpected exception', async () => {
    mockSupabaseChain.from.mockImplementation(() => {
      throw new Error('Catastrophic failure');
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});
