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

const mockGetChatJob = vi.fn();
vi.mock('@/lib/queue/bull-queue', () => ({
  getChatJob: (...args: unknown[]) => mockGetChatJob(...args),
}));

// Import after mocks
const { GET, DELETE } = await import('../route');

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

function createRequest(method = 'GET') {
  return new NextRequest(`http://localhost/api/queue/job/${JOB_ID}`, {
    method,
    headers: { Origin: 'http://localhost' },
  });
}

// ========================================
// TESTS: GET /api/queue/job/[jobId]
// ========================================

describe('GET /api/queue/job/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(401);
  });

  it('returns 404 when job not found', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue(null);
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Job not found');
  });

  it('returns job status for active job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('active'),
      progress: 50,
      timestamp: 1000,
      processedOn: 2000,
      finishedOn: null,
      returnvalue: null,
      failedReason: null,
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.jobId).toBe(JOB_ID);
    expect(body.state).toBe('active');
    expect(body.progress).toBe(50);
    expect(body.createdAt).toBe(1000);
    expect(body.processedAt).toBe(2000);
  });

  it('includes result for completed job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('completed'),
      progress: 100,
      timestamp: 1000,
      processedOn: 2000,
      finishedOn: 3000,
      returnvalue: { text: 'done' },
      failedReason: null,
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    const body = await response.json();
    expect(body.state).toBe('completed');
    expect(body.result).toEqual({ text: 'done' });
    expect(body.finishedAt).toBe(3000);
  });

  it('includes error for failed job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('failed'),
      progress: 0,
      timestamp: 1000,
      processedOn: 2000,
      finishedOn: 3000,
      returnvalue: null,
      failedReason: 'Out of memory',
    });
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    const body = await response.json();
    expect(body.state).toBe('failed');
    expect(body.error).toBe('Out of memory');
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockRejectedValue(new Error('Redis connection failed'));
    const request = createRequest();
    const response = await GET(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(500);
  });
});

// ========================================
// TESTS: DELETE /api/queue/job/[jobId]
// ========================================

describe('DELETE /api/queue/job/[jobId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(401);
  });

  it('returns 404 when job not found', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue(null);
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(404);
  });

  it('cancels a waiting job successfully', async () => {
    mockAuthSuccess();
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('waiting'),
      remove: mockRemove,
    });
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockRemove).toHaveBeenCalled();
  });

  it('cancels a delayed job successfully', async () => {
    mockAuthSuccess();
    const mockRemove = vi.fn().mockResolvedValue(undefined);
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('delayed'),
      remove: mockRemove,
    });
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 when trying to cancel an active job', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockResolvedValue({
      id: JOB_ID,
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn(),
    });
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Cannot cancel job in current state');
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockGetChatJob.mockRejectedValue(new Error('Redis down'));
    const request = createRequest('DELETE');
    const response = await DELETE(request, createRouteParams(JOB_ID));
    expect(response.status).toBe(500);
  });
});
