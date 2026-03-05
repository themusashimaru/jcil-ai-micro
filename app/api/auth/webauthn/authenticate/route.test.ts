/**
 * WEBAUTHN AUTHENTICATE API TESTS
 *
 * Tests for /api/auth/webauthn/authenticate endpoint:
 * - POST: Generate authentication options
 * - PUT: Verify passkey and create session
 * - Rate limiting
 * - Challenge storage (Redis + memory fallback)
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/webauthn', () => ({
  generatePasskeyAuthenticationOptions: vi.fn().mockResolvedValue({
    challenge: 'test-challenge-123456789',
    timeout: 60000,
    rpId: 'localhost',
  }),
  verifyPasskeyAuthentication: vi.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 42 },
  }),
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
      () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
    ),
    notFound: vi.fn(
      (msg) => new Response(JSON.stringify({ error: `${msg} not found` }), { status: 404 })
    ),
  },
  checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimits: { auth: { limit: 10, window: 60 } },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/redis/client', () => ({
  isRedisAvailable: vi.fn().mockReturnValue(false),
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDelete: vi.fn().mockResolvedValue(undefined),
}));

const mockSupabase = {
  from: vi.fn(),
  auth: {
    admin: {
      generateLink: vi.fn().mockResolvedValue({
        data: {
          properties: {
            action_link: 'https://test.supabase.co/auth/v1/verify?token=test-token&type=magiclink',
          },
        },
        error: null,
      }),
    },
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
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

function createPutRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('WebAuthn Authenticate API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NODE_ENV = 'test';
  });

  describe('POST - Generate authentication options', () => {
    it('should export POST handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.POST).toBeDefined();
    });

    it('should reject rate-limited requests', async () => {
      const { checkRequestRateLimit } = await import('@/lib/api/utils');
      vi.mocked(checkRequestRateLimit).mockResolvedValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/auth/webauthn/authenticate', {})
      );
      expect(response.status).toBe(429);
    });

    it('should generate auth options without email (discoverable credentials)', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/auth/webauthn/authenticate', {})
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.challenge).toBeDefined();
    });

    it('should generate auth options with email lookup', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'user-1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_passkeys') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ credential_id: 'cred-1', public_key: 'pk-1' }],
                error: null,
              }),
            }),
          };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      });

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/auth/webauthn/authenticate', {
          email: 'user@test.com',
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe('PUT - Verify authentication', () => {
    it('should export PUT handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.PUT).toBeDefined();
    });

    it('should reject rate-limited requests', async () => {
      const { checkRequestRateLimit } = await import('@/lib/api/utils');
      vi.mocked(checkRequestRateLimit).mockResolvedValueOnce({
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 }),
      } as never);

      const { PUT } = await import('./route');
      const response = await PUT(
        createPutRequest('http://localhost/api/auth/webauthn/authenticate', {
          response: { id: 'cred-1' },
          challengeKey: 'test-key',
        })
      );
      expect(response.status).toBe(429);
    });

    it('should reject expired challenges', async () => {
      const { PUT } = await import('./route');
      const response = await PUT(
        createPutRequest('http://localhost/api/auth/webauthn/authenticate', {
          response: { id: 'cred-1' },
          challengeKey: 'expired-key',
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
