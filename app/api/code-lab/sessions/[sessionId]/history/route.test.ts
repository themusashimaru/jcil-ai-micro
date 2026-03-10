// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock CSRF
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock rate limiters
const mockCodeLabRead = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabRead: (...args: unknown[]) => mockCodeLabRead(...args),
  },
}));

// Mock Supabase - we need a chainable mock
const mockGetUser = vi.fn();
const _mockSessionSingle = vi.fn();
const _mockMessagesOrder = vi.fn();
const _mockMessagesIlike = vi.fn();
const _mockMessagesLimit = vi.fn();
const _mockMessagesEqRole = vi.fn();

// Build chainable from() mock
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server-auth', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

// Import after mocks
const { GET, POST } = await import('./route');

// ========================================
// HELPERS
// ========================================

const sessionId = 'test-session-id';

function makeParams() {
  return { params: Promise.resolve({ sessionId }) };
}

function createGetRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL(`http://localhost/api/code-lab/sessions/${sessionId}/history`);
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { method: 'GET' });
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/code-lab/sessions/${sessionId}/history`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// Standard mock data
const mockUser = { id: 'user-1', email: 'test@test.com' };
const mockSession = {
  id: sessionId,
  title: 'Test Session',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T01:00:00Z',
  repo_owner: null,
  repo_name: null,
  repo_branch: null,
};

const mockMessages = [
  {
    id: 'msg-1',
    session_id: sessionId,
    role: 'user',
    content: 'Hello world',
    created_at: '2025-01-01T00:00:00Z',
    type: 'text',
  },
  {
    id: 'msg-2',
    session_id: sessionId,
    role: 'assistant',
    content: 'Hi there!',
    created_at: '2025-01-01T00:01:00Z',
    type: 'text',
  },
];

// ========================================
// TESTS: GET (export session)
// ========================================

describe('GET /api/code-lab/sessions/[sessionId]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockCodeLabRead.mockResolvedValue({ allowed: true });

    // Set up the chainable from() mock
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession }),
              }),
            }),
          }),
        };
      }
      if (table === 'code_lab_messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(Promise.resolve({ data: mockMessages })),
            }),
          }),
        };
      }
      return {};
    });
  });

  it('exports session as markdown by default', async () => {
    const req = createGetRequest();
    const res = await GET(req, makeParams());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/markdown');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const text = await res.text();
    expect(text).toContain('# Test Session');
    expect(text).toContain('Hello world');
    expect(text).toContain('Hi there!');
  });

  it('exports session as JSON when format=json', async () => {
    const req = createGetRequest({ format: 'json' });
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.session.id).toBe(sessionId);
    expect(body.data.session.title).toBe('Test Session');
    expect(body.data.messages).toHaveLength(2);
    expect(body.data.exportedAt).toBeDefined();
  });

  it('includes repo info in JSON export when available', async () => {
    const sessionWithRepo = {
      ...mockSession,
      repo_owner: 'octocat',
      repo_name: 'hello-world',
      repo_branch: 'main',
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: sessionWithRepo }),
              }),
            }),
          }),
        };
      }
      if (table === 'code_lab_messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(Promise.resolve({ data: mockMessages })),
            }),
          }),
        };
      }
      return {};
    });

    const req = createGetRequest({ format: 'json' });
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(body.data.session.repo).toEqual({
      owner: 'octocat',
      name: 'hello-world',
      branch: 'main',
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = createGetRequest();
    const res = await GET(req, makeParams());

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockCodeLabRead.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const req = createGetRequest();
    const res = await GET(req, makeParams());

    expect(res.status).toBe(429);
  });

  it('returns 404 when session not found or not owned', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createGetRequest();
    const res = await GET(req, makeParams());

    expect(res.status).toBe(404);
  });

  it('handles empty messages list', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: mockSession }),
              }),
            }),
          }),
        };
      }
      if (table === 'code_lab_messages') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue(Promise.resolve({ data: null })),
            }),
          }),
        };
      }
      return {};
    });

    const req = createGetRequest({ format: 'json' });
    const res = await GET(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.messages).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('DB connection lost'));

    const req = createGetRequest();
    const res = await GET(req, makeParams());

    expect(res.status).toBe(500);
  });
});

// ========================================
// TESTS: POST (search messages)
// ========================================

describe('POST /api/code-lab/sessions/[sessionId]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockValidateCSRF.mockReturnValue({ valid: true });
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    // chainable from() for POST path
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: { id: sessionId } }),
              }),
            }),
          }),
        };
      }
      if (table === 'code_lab_messages') {
        const resolvedValue = {
          data: [
            {
              id: 'msg-1',
              session_id: sessionId,
              role: 'user',
              content: 'Hello world matching test',
              created_at: '2025-01-01T00:00:00Z',
              type: 'text',
            },
          ],
          error: null,
        };
        // Create a thenable chain: each method returns the chain itself,
        // and awaiting the chain resolves to the data.
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve(resolvedValue).then(resolve);
        return chain;
      }
      return {};
    });
  });

  it('searches messages successfully', async () => {
    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.query).toBe('Hello');
    expect(body.data.results).toHaveLength(1);
    expect(body.data.total).toBe(1);
    expect(body.data.results[0].matchContext).toBeDefined();
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockValidateCSRF.mockReturnValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'CSRF failed' }), { status: 403 }),
    });

    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(401);
  });

  it('returns 400 when query is missing', async () => {
    const req = createPostRequest({});
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 400 when query is not a string', async () => {
    const req = createPostRequest({ query: 123 });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 400 when query is too short', async () => {
    const req = createPostRequest({ query: 'x' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 400 when query is too long', async () => {
    const req = createPostRequest({ query: 'a'.repeat(501) });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(404);
  });

  it('returns 500 when search query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'code_lab_sessions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: () => Promise.resolve({ data: { id: sessionId } }),
              }),
            }),
          }),
        };
      }
      if (table === 'code_lab_messages') {
        const errorValue = {
          data: null,
          error: { message: 'DB error' },
        };
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.ilike = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) => Promise.resolve(errorValue).then(resolve);
        return chain;
      }
      return {};
    });

    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(500);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockRejectedValue(new Error('Unexpected'));

    // CSRF still needs to pass first
    const req = createPostRequest({ query: 'Hello' });
    const res = await POST(req, makeParams());

    expect(res.status).toBe(500);
  });
});
