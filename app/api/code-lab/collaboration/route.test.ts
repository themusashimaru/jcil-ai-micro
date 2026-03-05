/**
 * CODE-LAB COLLABORATION API TESTS
 *
 * Tests for /api/code-lab/collaboration endpoint:
 * - POST: Collaboration actions (create, join, leave, operation, cursor, sync)
 * - GET: Get session info
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
    codeLabEdit: vi.fn().mockResolvedValue({ allowed: true }),
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
  successResponse: vi.fn(
    (data) => new Response(JSON.stringify({ success: true, ...data }), { status: 200 })
  ),
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
    notFound: vi.fn(
      (msg) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
  },
}));

const mockSession = {
  id: 'session-1',
  documentId: 'doc-1',
  ownerId: 'test-user-id',
  createdAt: new Date('2026-03-01'),
  users: new Map(),
  isActive: true,
};

const mockManager = {
  createSession: vi.fn().mockReturnValue(mockSession),
  joinSession: vi.fn().mockReturnValue({ success: true, session: mockSession }),
  leaveSession: vi.fn(),
  applyOperation: vi.fn().mockReturnValue({ success: true }),
  updateCursor: vi.fn(),
  getSession: vi.fn().mockReturnValue(mockSession),
  getSessions: vi.fn().mockReturnValue([]),
};

vi.mock('@/lib/collaboration/collaboration-manager', () => ({
  getCollaborationManager: vi.fn(() => mockManager),
  CollaborationSession: vi.fn(),
}));

vi.mock('@/lib/collaboration/crdt-document', () => ({
  CRDTOperation: vi.fn(),
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

// ============================================================================
// TESTS
// ============================================================================

describe('Code-Lab Collaboration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/code-lab/collaboration', () => {
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
        createPostRequest('http://localhost/api/code-lab/collaboration', {
          action: 'create',
          documentId: 'doc-1',
        })
      );
      expect(response.status).toBe(401);
    });

    it('should reject rate-limited requests', async () => {
      const { rateLimiters } = await import('@/lib/security/rate-limit');
      vi.mocked(rateLimiters.codeLabEdit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 30,
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/collaboration', {
          action: 'create',
          documentId: 'doc-1',
        })
      );
      expect(response.status).toBe(429);
    });

    it('should create a collaboration session', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/collaboration', {
          action: 'create',
          documentId: 'doc-1',
          initialContent: 'hello world',
        })
      );
      expect(response.status).toBe(200);
      expect(mockManager.createSession).toHaveBeenCalled();
    });

    it('should require documentId for create', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/collaboration', {
          action: 'create',
        })
      );
      expect(response.status).toBe(400);
    });

    it('should reject unknown actions', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/code-lab/collaboration', {
          action: 'unknownAction',
        })
      );
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/code-lab/collaboration', () => {
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
      const response = await GET(new NextRequest('http://localhost/api/code-lab/collaboration'));
      expect(response.status).toBe(401);
    });
  });
});
