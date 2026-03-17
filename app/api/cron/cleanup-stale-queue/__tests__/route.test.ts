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

const mockCleanupStaleRequests = vi.fn();
const mockGetQueueStatus = vi.fn();

vi.mock('@/lib/queue', () => ({
  cleanupStaleRequests: (...args: unknown[]) => mockCleanupStaleRequests(...args),
  getQueueStatus: (...args: unknown[]) => mockGetQueueStatus(...args),
}));

// Import after mocks
const { GET, POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const CRON_SECRET = 'test-cron-secret-789';

function createRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/cleanup-stale-queue', {
    method: 'GET',
    headers,
  });
}

function createAuthorizedRequest() {
  return createRequest({ authorization: `Bearer ${CRON_SECRET}` });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/cron/cleanup-stale-queue', () => {
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
    const request = createRequest({ authorization: 'Bearer nope' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const request = createRequest({ authorization: 'Bearer something' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('successfully cleans up stale queue entries', async () => {
    mockGetQueueStatus
      .mockResolvedValueOnce({
        activeRequests: 5,
        available: 5,
        maxConcurrent: 10,
      })
      .mockResolvedValueOnce({
        activeRequests: 2,
        available: 8,
        maxConcurrent: 10,
      });

    mockCleanupStaleRequests.mockResolvedValue(3);

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.cleaned).toBe(3);
    expect(json.queue.active).toBe(2);
    expect(json.queue.available).toBe(8);
    expect(json.queue.max).toBe(10);
    expect(json.queue.utilizationPercent).toBe(20);
    expect(json.durationMs).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });

  it('handles zero stale entries', async () => {
    const queueStatus = {
      activeRequests: 0,
      available: 10,
      maxConcurrent: 10,
    };

    mockGetQueueStatus.mockResolvedValue(queueStatus);
    mockCleanupStaleRequests.mockResolvedValue(0);

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.cleaned).toBe(0);
    expect(json.queue.utilizationPercent).toBe(0);
  });

  it('returns 500 on cleanup error', async () => {
    mockGetQueueStatus.mockRejectedValue(new Error('Redis down'));

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});

describe('POST /api/cron/cleanup-stale-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('delegates to GET handler', async () => {
    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
