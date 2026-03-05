// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS - must be defined before imports
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

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock untypedRpc
const mockUntypedRpc = vi.fn();
vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedRpc: (...args: unknown[]) => mockUntypedRpc(...args),
}));

// Mock collaboration manager
const mockCollabOn = vi.fn();
const mockCollabOff = vi.fn();
vi.mock('@/lib/collaboration/collaboration-manager', () => ({
  getCollaborationManager: () => ({
    on: (...args: unknown[]) => mockCollabOn(...args),
    off: (...args: unknown[]) => mockCollabOff(...args),
  }),
}));

// Mock debug event broadcaster
const mockDebugOn = vi.fn();
const mockDebugOff = vi.fn();
vi.mock('@/lib/debugger/debug-event-broadcaster', () => ({
  getDebugEventBroadcaster: () => ({
    on: (...args: unknown[]) => mockDebugOn(...args),
    off: (...args: unknown[]) => mockDebugOff(...args),
  }),
}));

// Mock rate limiters
const mockCodeLabEdit = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabEdit: (...args: unknown[]) => mockCodeLabEdit(...args),
  },
}));

// ========================================
// IMPORTS (after mocks)
// ========================================

import { GET, POST } from './route';

// ========================================
// HELPERS
// ========================================

const fakeUser = {
  id: 'user-123',
  email: 'test@example.com',
};

const fakeSupabase = { rpc: vi.fn() };

function mockAuthSuccess(_request?: NextRequest) {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: fakeUser,
    supabase: fakeSupabase,
  });
}

function mockAuthFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
}

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/code-lab/realtime');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), { method: 'GET' });
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/code-lab/realtime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Read all SSE data from a ReadableStream until the first data event */
async function readSSEEvents(response: Response, maxEvents = 1): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];

  while (events.length < maxEvents) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    // SSE format: "data: {...}\n\n"
    const lines = text.split('\n').filter((l) => l.startsWith('data: '));
    for (const line of lines) {
      events.push(line.replace('data: ', ''));
    }
  }

  // Cancel the reader to prevent hanging
  try {
    await reader.cancel();
  } catch {
    // ignore
  }

  return events;
}

// ========================================
// TESTS
// ========================================

describe('GET /api/code-lab/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockAuthFailure();

    const request = createGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns SSE stream with connected event on success', async () => {
    mockAuthSuccess();

    const request = createGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    const events = await readSSEEvents(response, 1);
    expect(events.length).toBeGreaterThanOrEqual(1);

    const connectedEvent = JSON.parse(events[0]);
    expect(connectedEvent.type).toBe('connected');
    expect(connectedEvent.payload.userId).toBe('user-123');
    expect(connectedEvent.payload.clientId).toBeDefined();
    expect(connectedEvent.payload.clientId).toMatch(/^sse-/);
  });

  it('includes sessionId in connected event when provided', async () => {
    mockAuthSuccess();

    const request = createGetRequest({ sessionId: 'session-abc' });
    const response = await GET(request);

    expect(response.status).toBe(200);

    const events = await readSSEEvents(response, 1);
    const connectedEvent = JSON.parse(events[0]);
    expect(connectedEvent.payload.sessionId).toBe('session-abc');
  });

  it('sets up collaboration and debug listeners when sessionId provided', async () => {
    mockAuthSuccess();

    const request = createGetRequest({ sessionId: 'session-abc' });
    const response = await GET(request);

    // Read at least the connected event to let the stream start
    await readSSEEvents(response, 1);

    // Collaboration manager should have 'broadcast' listener registered
    expect(mockCollabOn).toHaveBeenCalledWith('broadcast', expect.any(Function));
    // Debug broadcaster should have 'debug:broadcast' listener registered
    expect(mockDebugOn).toHaveBeenCalledWith('debug:broadcast', expect.any(Function));
  });

  it('does not set up collaboration/debug listeners without sessionId', async () => {
    mockAuthSuccess();

    const request = createGetRequest();
    const response = await GET(request);

    await readSSEEvents(response, 1);

    expect(mockCollabOn).not.toHaveBeenCalled();
    expect(mockDebugOn).not.toHaveBeenCalled();
  });

  it('sets correct SSE headers including X-Accel-Buffering', async () => {
    mockAuthSuccess();

    const request = createGetRequest();
    const response = await GET(request);

    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    expect(response.headers.get('Connection')).toBe('keep-alive');

    // Clean up stream
    await readSSEEvents(response, 1);
  });

  it('returns 500 on unexpected errors', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected failure'));

    const request = createGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to establish connection');
  });
});

describe('POST /api/code-lab/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCodeLabEdit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60000,
    });
    mockUntypedRpc.mockResolvedValue({ data: null, error: null });
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockAuthFailure();

    const request = createPostRequest({ type: 'test', sessionId: 'session-1' });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limited', async () => {
    mockAuthSuccess();
    mockCodeLabEdit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30000,
      retryAfter: 30,
    });

    const request = createPostRequest({ type: 'test', sessionId: 'session-1' });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfter).toBeDefined();
  });

  it('returns 400 when type is missing', async () => {
    mockAuthSuccess();

    const request = createPostRequest({ sessionId: 'session-1' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing type or sessionId');
  });

  it('returns 400 when sessionId is missing', async () => {
    mockAuthSuccess();

    const request = createPostRequest({ type: 'test' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing type or sessionId');
  });

  it('returns 400 when both type and sessionId are missing', async () => {
    mockAuthSuccess();

    const request = createPostRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Missing type or sessionId');
  });

  it('broadcasts event and returns success', async () => {
    mockAuthSuccess();

    const request = createPostRequest({
      type: 'collaboration:operation',
      sessionId: 'session-1',
      payload: { data: 'test' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(typeof body.sent).toBe('number');
  });

  it('calls untypedRpc for presence:update events', async () => {
    mockAuthSuccess();

    const presencePayload = {
      userId: 'user-123',
      userName: 'testuser',
      cursorPosition: { line: 10, column: 5 },
      status: 'active',
      isTyping: true,
    };

    const request = createPostRequest({
      type: 'presence:update',
      sessionId: 'session-1',
      payload: presencePayload,
      clientId: 'sse-client-1',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockUntypedRpc).toHaveBeenCalledWith(
      fakeSupabase,
      'upsert_code_lab_presence',
      expect.objectContaining({
        p_session_id: 'session-1',
        p_user_id: 'user-123',
        p_user_name: 'testuser',
        p_user_email: 'test@example.com',
        p_client_id: 'sse-client-1',
        p_cursor_line: 10,
        p_cursor_column: 5,
        p_status: 'active',
        p_is_typing: true,
      })
    );
  });

  it('does not call untypedRpc for non-presence events', async () => {
    mockAuthSuccess();

    const request = createPostRequest({
      type: 'collaboration:operation',
      sessionId: 'session-1',
      payload: { data: 'test' },
    });
    await POST(request);

    expect(mockUntypedRpc).not.toHaveBeenCalled();
  });

  it('succeeds even when presence RPC fails', async () => {
    mockAuthSuccess();
    mockUntypedRpc.mockRejectedValue(new Error('RPC failed - migration not applied'));

    const request = createPostRequest({
      type: 'presence:update',
      sessionId: 'session-1',
      payload: { userName: 'testuser', status: 'active' },
    });
    const response = await POST(request);

    // Should still succeed — RPC failure is logged but non-fatal
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('falls back to email prefix when userName is not provided in presence update', async () => {
    mockAuthSuccess();

    const request = createPostRequest({
      type: 'presence:update',
      sessionId: 'session-1',
      payload: { status: 'active' },
    });
    await POST(request);

    expect(mockUntypedRpc).toHaveBeenCalledWith(
      fakeSupabase,
      'upsert_code_lab_presence',
      expect.objectContaining({
        p_user_name: 'test', // from test@example.com
      })
    );
  });

  it('returns 500 on unexpected errors', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected failure'));

    const request = createPostRequest({ type: 'test', sessionId: 'session-1' });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to send event');
  });

  it('passes request to requireUser for CSRF validation', async () => {
    mockAuthSuccess();

    const request = createPostRequest({
      type: 'test',
      sessionId: 'session-1',
      payload: {},
    });
    await POST(request);

    // POST should pass request for CSRF check
    expect(mockRequireUser).toHaveBeenCalledWith(request);
  });
});

describe('GET /api/code-lab/realtime - max connections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 429 when user exceeds max connections', async () => {
    // We need to create MAX_CONNECTIONS_PER_USER (5) connections first
    mockAuthSuccess();

    // Establish 5 connections — read the first event but do NOT cancel
    // so that the connections remain in the activeConnections map
    const readers: ReadableStreamDefaultReader[] = [];
    for (let i = 0; i < 5; i++) {
      const request = createGetRequest();
      const response = await GET(request);
      const reader = response.body!.getReader();
      // Read one chunk to trigger the stream start callback
      await reader.read();
      readers.push(reader);
    }

    // 6th connection should fail
    const request = createGetRequest();
    const response = await GET(request);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe('Too many connections');
    expect(body.code).toBe('MAX_CONNECTIONS_EXCEEDED');

    // Clean up all readers
    for (const reader of readers) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  });
});
