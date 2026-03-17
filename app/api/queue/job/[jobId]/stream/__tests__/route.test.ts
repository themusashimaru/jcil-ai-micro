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

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockGetChatJob = vi.fn();
const mockGetChatQueueEvents = vi.fn();
vi.mock('@/lib/queue/bull-queue', () => ({
  getChatJob: (...args: unknown[]) => mockGetChatJob(...args),
  getChatQueueEvents: (...args: unknown[]) => mockGetChatQueueEvents(...args),
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';
const JOB_ID = 'job-456';

function mockAuthSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: USER_ID, email: 'test@example.com' },
    supabase: { from: vi.fn() },
  });
}

function mockAuthFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
      status: 401,
    }),
  });
}

function createRouteParams(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

function createRequest() {
  const controller = new AbortController();
  return new Request(`http://localhost/api/queue/job/${JOB_ID}/stream`, {
    method: 'GET',
    headers: { Origin: 'http://localhost' },
    signal: controller.signal,
  });
}

// ========================================
// TESTS: GET /api/queue/job/[jobId]/stream
// ========================================

describe('GET /api/queue/job/[jobId]/stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(401);
  });

  it('returns 400 when jobId is empty', async () => {
    mockAuthSuccess();
    const request = createRequest();
    const response = await GET(request, createRouteParams(''));
    expect(response.status).toBe(400);
  });

  it('returns 404 when job not found', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue(null);
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(404);
  });

  it('returns 403 when user does not own the job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      data: { userId: 'other-user' },
      getState: vi.fn().mockResolvedValue('active'),
      progress: 0,
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(403);
  });

  it('returns 503 when queue events not available', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      data: { userId: USER_ID },
      getState: vi.fn().mockResolvedValue('active'),
      progress: 0,
    });
    mockGetChatQueueEvents.mockReturnValue(null);
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(503);
  });

  it('returns SSE stream for completed job with correct headers', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      data: { userId: USER_ID },
      getState: vi.fn().mockResolvedValue('completed'),
      progress: 100,
      returnvalue: { text: 'result' },
    });
    mockGetChatQueueEvents.mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    // Read the stream to verify content
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) text += decoder.decode(result.value);
    }
    // Should contain initial state and completed result
    expect(text).toContain('"type":"state"');
    expect(text).toContain('"type":"completed"');
  });

  it('returns SSE stream for failed job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      data: { userId: USER_ID },
      getState: vi.fn().mockResolvedValue('failed'),
      progress: 0,
      failedReason: 'Something broke',
    });
    mockGetChatQueueEvents.mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) text += decoder.decode(result.value);
    }
    expect(text).toContain('"type":"failed"');
    expect(text).toContain('Something broke');
  });

  it('sets up event listeners for in-progress job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      data: { userId: USER_ID },
      getState: vi.fn().mockResolvedValue('active'),
      progress: 25,
    });
    const mockOn = vi.fn();
    mockGetChatQueueEvents.mockReturnValue({
      on: mockOn,
      off: vi.fn(),
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Allow the stream start to execute
    await new Promise((r) => setTimeout(r, 50));

    // Verify event listeners were registered
    expect(mockOn).toHaveBeenCalledWith('progress', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });
});
