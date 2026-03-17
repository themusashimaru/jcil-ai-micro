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

const mockOptionalUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  optionalUser: (...args: unknown[]) => mockOptionalUser(...args),
}));

const mockGetQueueStatus = vi.fn();
vi.mock('@/lib/queue', () => ({
  getQueueStatus: (...args: unknown[]) => mockGetQueueStatus(...args),
}));

const mockGetChatQueueStats = vi.fn();
const mockIsBullMQAvailable = vi.fn();
vi.mock('@/lib/queue/bull-queue', () => ({
  getChatQueueStats: (...args: unknown[]) => mockGetChatQueueStats(...args),
  isBullMQAvailable: (...args: unknown[]) => mockIsBullMQAvailable(...args),
}));

const mockGetWorkerStats = vi.fn();
vi.mock('@/lib/queue/workers', () => ({
  getWorkerStats: (...args: unknown[]) => mockGetWorkerStats(...args),
}));

const mockGetAllBreakerStatus = vi.fn();
vi.mock('@/lib/circuit-breaker', () => ({
  getAllBreakerStatus: (...args: unknown[]) => mockGetAllBreakerStatus(...args),
}));

const mockGetAnthropicKeyStats = vi.fn();
vi.mock('@/lib/anthropic/client', () => ({
  getAnthropicKeyStats: (...args: unknown[]) => mockGetAnthropicKeyStats(...args),
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function defaultQueueStatus() {
  return {
    activeRequests: 2,
    available: true,
    maxConcurrent: 10,
  };
}

function createRequest() {
  return new Request('http://localhost/api/queue/status', {
    method: 'GET',
  });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/queue/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: unauthenticated user
    mockOptionalUser.mockResolvedValue({ user: null, supabase: null });
    mockGetQueueStatus.mockResolvedValue(defaultQueueStatus());
    mockIsBullMQAvailable.mockReturnValue(false);
    mockGetAllBreakerStatus.mockReturnValue({});
  });

  it('returns queue status for unauthenticated user', async () => {
    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.simpleQueue).toBeDefined();
    expect(body.simpleQueue.active).toBe(2);
    expect(body.simpleQueue.max).toBe(10);
  });

  it('returns BullMQ stats when available', async () => {
    mockIsBullMQAvailable.mockReturnValue(true);
    mockGetChatQueueStats.mockResolvedValue({ waiting: 5, active: 2 });
    mockGetWorkerStats.mockReturnValue({ running: 1 });

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.bullMQ.enabled).toBe(true);
    expect(body.bullMQ.stats).toEqual({ waiting: 5, active: 2 });
    expect(body.bullMQ.workers).toEqual({ running: 1 });
  });

  it('returns BullMQ disabled when not available', async () => {
    mockIsBullMQAvailable.mockReturnValue(false);

    const request = createRequest();
    const response = await GET(request);
    const body = await response.json();
    expect(body.bullMQ.enabled).toBe(false);
    expect(body.bullMQ.reason).toBe('REDIS_HOST not configured');
  });

  it('includes API key stats for admin users', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'admin-1' } }),
          }),
        }),
      }),
    };
    mockOptionalUser.mockResolvedValue({
      user: { id: USER_ID },
      supabase: mockSupabase,
    });
    mockGetAnthropicKeyStats.mockReturnValue({
      totalKeys: 3,
      totalAvailable: 2,
      primaryAvailable: 1,
      fallbackAvailable: 1,
    });

    const request = createRequest();
    const response = await GET(request);
    const body = await response.json();
    expect(body.apiKeys).toBeDefined();
    expect(body.apiKeys.total).toBe(3);
  });

  it('does not include API key stats for non-admin users', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    };
    mockOptionalUser.mockResolvedValue({
      user: { id: USER_ID },
      supabase: mockSupabase,
    });

    const request = createRequest();
    const response = await GET(request);
    const body = await response.json();
    expect(body.apiKeys).toBeUndefined();
  });

  it('returns 500 when queue status throws', async () => {
    mockGetQueueStatus.mockRejectedValue(new Error('Queue error'));

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it('includes circuit breaker status', async () => {
    mockGetAllBreakerStatus.mockReturnValue({
      anthropic: { state: 'closed', failures: 0 },
    });

    const request = createRequest();
    const response = await GET(request);
    const body = await response.json();
    expect(body.circuitBreakers).toEqual({
      anthropic: { state: 'closed', failures: 0 },
    });
  });

  it('includes utilization percentage', async () => {
    mockGetQueueStatus.mockResolvedValue({
      activeRequests: 5,
      available: true,
      maxConcurrent: 10,
    });

    const request = createRequest();
    const response = await GET(request);
    const body = await response.json();
    expect(body.simpleQueue.utilizationPercent).toBe(50);
  });
});
