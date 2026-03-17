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

const CRON_SECRET = 'test-cron-secret-123';

function createRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/cleanup-messages', {
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

describe('GET /api/cron/cleanup-messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('returns 401 when no authorization header', async () => {
    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when cron secret is wrong', async () => {
    const request = createRequest({ authorization: 'Bearer wrong-secret' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const request = createRequest({ authorization: 'Bearer anything' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('successfully cleans up messages, conversations, and uploads', async () => {
    const deletedMessages = [{ id: '1' }, { id: '2' }];
    const deletedConversations = [{ id: '3' }];
    const deletedUploads: unknown[] = [];

    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // messages
        return {
          delete: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: deletedMessages, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // conversations
        return {
          delete: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: deletedConversations, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      // uploads
      return {
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: deletedUploads, error: null }),
              }),
            }),
          }),
        }),
      };
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.stats.messagesDeleted).toBe(2);
    expect(json.stats.conversationsDeleted).toBe(1);
    expect(json.stats.uploadsDeleted).toBe(0);
    expect(json.stats.errors).toHaveLength(0);
    expect(json.durationMs).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });

  it('reports partial failures in stats.errors', async () => {
    let callCount = 0;
    mockSupabaseChain.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          delete: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'messages table error' },
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          delete: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.stats.errors).toHaveLength(1);
    expect(json.stats.errors[0]).toContain('messages table error');
  });

  it('collects errors from all three cleanup phases individually', async () => {
    // When from() throws in each inner try/catch, errors are collected (not 500)
    mockSupabaseChain.from.mockImplementation(() => {
      throw new Error('Connection refused');
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(false);
    expect(json.stats.errors).toHaveLength(3);
    expect(json.stats.errors[0]).toContain('Connection refused');
  });
});

describe('POST /api/cron/cleanup-messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('delegates to GET handler', async () => {
    const request = createRequest();
    const response = await POST(request);

    // Should behave the same as GET (returns 401 without auth)
    expect(response.status).toBe(401);
  });
});
