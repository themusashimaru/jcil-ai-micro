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
const { GET, POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const CRON_SECRET = 'test-cron-secret-456';

function createRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/cleanup-rate-limits', {
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

describe('GET /api/cron/cleanup-rate-limits', () => {
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
    const request = createRequest({ authorization: 'Bearer bad-secret' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const request = createRequest({ authorization: 'Bearer anything' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('successfully deletes expired rate limit entries', async () => {
    const deletedEntries = [{ id: '1' }, { id: '2' }, { id: '3' }];

    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Delete expired entries
        return {
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: deletedEntries, error: null }),
            }),
          }),
        };
      }
      // Count remaining
      return {
        select: vi.fn().mockResolvedValue({ count: 10, error: null }),
      };
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.deleted).toBe(3);
    expect(json.remaining).toBe(10);
    expect(json.durationMs).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });

  it('returns 500 on delete error', async () => {
    mockSupabaseChain.from.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'permission denied' },
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

  it('handles zero deleted entries', async () => {
    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          delete: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ count: 0, error: null }),
      };
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.deleted).toBe(0);
    expect(json.remaining).toBe(0);
  });

  it('returns 500 on unexpected exception', async () => {
    mockSupabaseChain.from.mockImplementation(() => {
      throw new Error('Connection lost');
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});

describe('POST /api/cron/cleanup-rate-limits', () => {
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
