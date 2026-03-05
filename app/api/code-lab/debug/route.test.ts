/**
 * CODE-LAB DEBUG API TESTS
 *
 * Tests for /api/code-lab/debug endpoint:
 * - POST: Debug actions (start, stop, setBreakpoints, continue, step*, evaluate)
 * - GET: List/get debug sessions
 * - Auth and rate limiting
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'test-user-id', email: 'test@example.com' },
  }),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabDebug: vi.fn().mockResolvedValue({ allowed: true }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data) => {
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    badRequest: vi.fn((msg) => new Response(JSON.stringify({ error: msg }), { status: 400 })),
    serverError: vi.fn(
      (msg) =>
        new Response(JSON.stringify({ error: msg || 'Internal server error' }), { status: 500 })
    ),
    rateLimited: vi.fn(
      (retryAfter) =>
        new Response(JSON.stringify({ error: 'Rate limited', retryAfter }), { status: 429 })
    ),
    sessionNotFound: vi.fn(
      () => new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
    ),
  },
}));

const mockDebugManager = {
  startSession: vi.fn().mockResolvedValue({ id: 'debug-session-1', status: 'running' }),
  stopSession: vi.fn().mockResolvedValue(undefined),
  setBreakpoints: vi.fn().mockResolvedValue([{ verified: true, line: 10 }]),
  continue: vi.fn().mockResolvedValue(undefined),
  stepOver: vi.fn().mockResolvedValue(undefined),
  stepInto: vi.fn().mockResolvedValue(undefined),
  stepOut: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  getThreads: vi.fn().mockResolvedValue([{ id: 1, name: 'main' }]),
  getStackTrace: vi.fn().mockResolvedValue([{ id: 1, name: 'main', line: 10 }]),
  getScopes: vi.fn().mockResolvedValue([{ name: 'Locals', variablesReference: 1 }]),
  getVariables: vi.fn().mockResolvedValue([{ name: 'x', value: '42', type: 'number' }]),
  evaluate: vi.fn().mockResolvedValue({ result: '42', type: 'number' }),
  getSession: vi.fn().mockReturnValue({ id: 'debug-session-1', status: 'running' }),
  getWorkspaceSessions: vi.fn().mockReturnValue([]),
  getUserSessions: vi.fn().mockReturnValue([]),
};

vi.mock('@/lib/debugger/debug-manager', () => ({
  getDebugManager: vi.fn(() => mockDebugManager),
}));

vi.mock('@/lib/debugger/debug-adapter', () => ({
  DebugConfiguration: {},
  Source: {},
}));

// ============================================================================
// HELPERS
// ============================================================================

function createPostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ============================================================================
// TESTS
// ============================================================================

describe('Code-Lab Debug API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/code-lab/debug', () => {
    it('should export POST handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.POST).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', { action: 'start' })
      );
      expect(response.status).toBe(401);
    });

    it('should reject rate-limited requests', async () => {
      const { rateLimiters } = await import('@/lib/security/rate-limit');
      vi.mocked(rateLimiters.codeLabDebug).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 30,
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', { action: 'start' })
      );
      expect(response.status).toBe(429);
    });

    it('should start a debug session', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'start',
          config: { type: 'node', program: 'test.js' },
        })
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.startSession).toHaveBeenCalled();
    });

    it('should reject start without valid config', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'start',
          config: { type: 'node' }, // missing program
        })
      );
      expect(response.status).toBe(400);
    });

    it('should stop a debug session', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'stop',
          sessionId: 'debug-session-1',
        })
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.stopSession).toHaveBeenCalledWith('debug-session-1');
    });

    it('should reject stop without sessionId', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', { action: 'stop' })
      );
      expect(response.status).toBe(400);
    });

    it('should set breakpoints', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'setBreakpoints',
          sessionId: 'debug-session-1',
          source: { path: '/test.js' },
          breakpoints: [{ line: 10 }],
        })
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.setBreakpoints).toHaveBeenCalled();
    });

    it('should handle continue action', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'continue',
          sessionId: 'debug-session-1',
        })
      );
      expect(response.status).toBe(200);
    });

    it('should handle stepOver action', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'stepOver',
          sessionId: 'debug-session-1',
        })
      );
      expect(response.status).toBe(200);
    });

    it('should handle evaluate action', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'evaluate',
          sessionId: 'debug-session-1',
          expression: '2 + 2',
        })
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.evaluate).toHaveBeenCalled();
    });

    it('should reject evaluate without expression', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'evaluate',
          sessionId: 'debug-session-1',
        })
      );
      expect(response.status).toBe(400);
    });

    it('should reject unknown actions', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/debug', {
          action: 'unknownAction',
        })
      );
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/code-lab/debug', () => {
    it('should export GET handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.GET).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { GET } = await import('./route');
      const response = await GET(createGetRequest('http://localhost/api/code-lab/debug'));
      expect(response.status).toBe(401);
    });

    it('should get specific session by ID', async () => {
      const { GET } = await import('./route');
      const response = await GET(
        createGetRequest('http://localhost/api/code-lab/debug?sessionId=debug-session-1')
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.getSession).toHaveBeenCalledWith('debug-session-1');
    });

    it('should return 404 for nonexistent session', async () => {
      mockDebugManager.getSession.mockReturnValueOnce(null);
      const { GET } = await import('./route');
      const response = await GET(
        createGetRequest('http://localhost/api/code-lab/debug?sessionId=nonexistent')
      );
      expect(response.status).toBe(404);
    });

    it('should get sessions by workspace', async () => {
      const { GET } = await import('./route');
      const response = await GET(
        createGetRequest('http://localhost/api/code-lab/debug?workspaceId=workspace-1')
      );
      expect(response.status).toBe(200);
      expect(mockDebugManager.getWorkspaceSessions).toHaveBeenCalledWith('workspace-1');
    });

    it('should get all user sessions by default', async () => {
      const { GET } = await import('./route');
      const response = await GET(createGetRequest('http://localhost/api/code-lab/debug'));
      expect(response.status).toBe(200);
      expect(mockDebugManager.getUserSessions).toHaveBeenCalledWith('test-user-id');
    });
  });
});
