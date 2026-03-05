/**
 * WEBAUTHN REGISTER ROUTE TESTS
 *
 * Tests for /api/auth/webauthn/register endpoint:
 * - Auth guard (requireUser) rejecting unauthenticated requests
 * - Rate limiting rejection for POST and PUT
 * - POST: Generates registration options (happy path)
 * - PUT: Verifies registration and saves passkey (happy path)
 * - PUT: Rejects when challenge is expired/missing
 * - PUT: Rejects when verification fails
 * - PUT: Handles DB insert errors
 * - Error handling (thrown exceptions)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockUser = { id: 'user-123', email: 'test@example.com' };

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockAuditLog = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
}));

// Supabase mock chain
const mockInsertResult = { error: null };
const mockSelectResult = { data: null, error: null };
const mockSupabaseChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(mockSelectResult),
  insert: vi.fn().mockResolvedValue(mockInsertResult),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseChain),
}));

// Redis mock
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn().mockResolvedValue(undefined);
const mockCacheDelete = vi.fn().mockResolvedValue(undefined);
const mockIsRedisAvailable = vi.fn().mockReturnValue(true);
vi.mock('@/lib/redis/client', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
  isRedisAvailable: () => mockIsRedisAvailable(),
}));

// WebAuthn mock
const mockGenerateOptions = vi.fn();
const mockVerifyRegistration = vi.fn();
const mockGetDeviceName = vi.fn().mockReturnValue('Chrome on Mac');
const mockUint8ArrayToBase64URL = vi.fn().mockReturnValue('base64url-public-key');
vi.mock('@/lib/auth/webauthn', () => ({
  generatePasskeyRegistrationOptions: (...args: unknown[]) => mockGenerateOptions(...args),
  verifyPasskeyRegistration: (...args: unknown[]) => mockVerifyRegistration(...args),
  getDeviceNameFromUserAgent: (...args: unknown[]) => mockGetDeviceName(...args),
  uint8ArrayToBase64URL: (...args: unknown[]) => mockUint8ArrayToBase64URL(...args),
}));

// API utils mock
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data: unknown) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    unauthorized: vi.fn(
      () =>
        new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    badRequest: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ ok: false, error: msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    serverError: vi.fn(
      () =>
        new Response(JSON.stringify({ ok: false, error: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
    rateLimited: vi.fn(
      () =>
        new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
    ),
  },
  checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  rateLimits: {
    auth: { limit: 5, windowMs: 60_000 },
    standard: { limit: 60, windowMs: 60_000 },
    strict: { limit: 10, windowMs: 60_000 },
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const url = 'http://localhost:3000/api/auth/webauthn/register';
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as never);
}

function authSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: mockUser,
  });
}

function authFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
    }),
  });
}

function rateLimitAllow() {
  mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
}

function rateLimitDeny() {
  mockCheckRequestRateLimit.mockResolvedValue({
    allowed: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), {
      status: 429,
    }),
  });
}

const mockRegistrationOptions = {
  challenge: 'test-challenge-string',
  rp: { name: 'JCIL AI', id: 'localhost' },
  user: { id: 'user-123', name: 'test@example.com', displayName: 'Test User' },
  pubKeyCredParams: [],
  timeout: 60000,
  attestation: 'none',
  excludeCredentials: [],
};

const mockVerificationResult = {
  verified: true,
  registrationInfo: {
    credential: {
      id: 'credential-id-123',
      publicKey: new Uint8Array([1, 2, 3, 4]),
      counter: 0,
      transports: ['internal'],
    },
    credentialDeviceType: 'multiDevice',
    credentialBackedUp: true,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('WebAuthn Register Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    rateLimitAllow();
    mockIsRedisAvailable.mockReturnValue(true);

    // Default supabase responses
    mockSupabaseChain.from.mockReturnThis();
    mockSupabaseChain.select.mockReturnThis();
    mockSupabaseChain.eq.mockReturnThis();
    mockSupabaseChain.single.mockResolvedValue({ data: { full_name: 'Test User' }, error: null });
    mockSupabaseChain.insert.mockResolvedValue({ error: null });

    // Reset select to return passkeys array (for excludeCredentials)
    // The route calls .select('*').eq('user_id', userId) without .single()
    // so we need eq to resolve with data array
    mockSupabaseChain.eq.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: { full_name: 'Test User' }, error: null }),
      data: [],
      error: null,
      then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
        Promise.resolve(resolve({ data: [], error: null })),
    }));

    mockGenerateOptions.mockResolvedValue(mockRegistrationOptions);
    mockVerifyRegistration.mockResolvedValue(mockVerificationResult);
    mockCacheGet.mockResolvedValue({ challenge: 'test-challenge-string' });

    // Set required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  // --------------------------------------------------------------------------
  // Auth guard tests
  // --------------------------------------------------------------------------

  describe('Auth guard', () => {
    it('POST rejects unauthenticated requests', async () => {
      authFailure();
      const { POST } = await import('./route');
      const request = makeRequest('POST');
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('PUT rejects unauthenticated requests', async () => {
      authFailure();
      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'test' },
      });
      const response = await PUT(request);
      expect(response.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // Rate limiting tests
  // --------------------------------------------------------------------------

  describe('Rate limiting', () => {
    it('POST returns 429 when rate limited', async () => {
      rateLimitDeny();
      const { POST } = await import('./route');
      const request = makeRequest('POST');
      const response = await POST(request);
      expect(response.status).toBe(429);
      expect(mockCheckRequestRateLimit).toHaveBeenCalledWith(
        `webauthn:register:${mockUser.id}`,
        expect.objectContaining({ limit: 5 })
      );
    });

    it('PUT returns 429 when rate limited', async () => {
      rateLimitDeny();
      const { PUT } = await import('./route');
      const request = makeRequest('PUT', { response: { id: 'test' } });
      const response = await PUT(request);
      expect(response.status).toBe(429);
      expect(mockCheckRequestRateLimit).toHaveBeenCalledWith(
        `webauthn:verify:${mockUser.id}`,
        expect.objectContaining({ limit: 5 })
      );
    });
  });

  // --------------------------------------------------------------------------
  // POST - Generate registration options (happy path)
  // --------------------------------------------------------------------------

  describe('POST - Generate registration options', () => {
    it('returns registration options on success', async () => {
      // Set up supabase chain for two calls:
      // 1. users table -> single() -> full_name
      // 2. user_passkeys table -> select/eq -> passkeys list
      mockSupabaseChain.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: 'Test User' },
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
                data: [],
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseChain;
      });

      const { POST } = await import('./route');
      const request = makeRequest('POST');
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.challenge).toBe('test-challenge-string');
      expect(mockGenerateOptions).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'Test User',
        []
      );
      // Challenge should be stored in Redis
      expect(mockCacheSet).toHaveBeenCalledWith(
        'webauthn:register:user-123',
        { challenge: 'test-challenge-string' },
        300 // 5 minutes in seconds
      );
    });

    it('uses email as fallback when full_name is null', async () => {
      mockSupabaseChain.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_passkeys') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return mockSupabaseChain;
      });

      const { POST } = await import('./route');
      const request = makeRequest('POST');
      await POST(request);

      expect(mockGenerateOptions).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'test@example.com', // Falls back to email
        []
      );
    });

    it('excludes existing passkeys', async () => {
      const existingPasskeys = [{ credential_id: 'existing-1', public_key: 'pk1', counter: 5 }];

      mockSupabaseChain.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: 'Test User' },
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
                data: existingPasskeys,
                error: null,
              }),
            }),
          };
        }
        return mockSupabaseChain;
      });

      const { POST } = await import('./route');
      const request = makeRequest('POST');
      await POST(request);

      expect(mockGenerateOptions).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
        'Test User',
        existingPasskeys
      );
    });

    it('returns 500 on unexpected error', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected failure'));

      const { POST } = await import('./route');
      const request = makeRequest('POST');
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  // --------------------------------------------------------------------------
  // PUT - Verify registration and save passkey
  // --------------------------------------------------------------------------

  describe('PUT - Verify and save passkey', () => {
    it('saves passkey on successful verification', async () => {
      mockSupabaseChain.from.mockImplementation((table: string) => {
        if (table === 'user_passkeys') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return mockSupabaseChain;
      });

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
        deviceName: 'My MacBook',
      });

      const response = await PUT(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.success).toBe(true);
      expect(json.data.message).toBe('Passkey registered successfully');
      expect(json.data.deviceType).toBe('multiDevice');
      expect(json.data.backedUp).toBe(true);
    });

    it('uses custom device name when provided', async () => {
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
        deviceName: 'My Work Laptop',
      });

      await PUT(request);

      // The custom device name should be used; getDeviceNameFromUserAgent is fallback
      // Audit log should contain the custom name
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ deviceName: 'My Work Laptop' }),
        })
      );
    });

    it('falls back to user-agent device detection when no custom name', async () => {
      mockGetDeviceName.mockReturnValue('Mac');
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
        // No deviceName provided
      });

      await PUT(request);

      expect(mockGetDeviceName).toHaveBeenCalled();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ deviceName: 'Mac' }),
        })
      );
    });

    it('rejects when challenge is expired or missing', async () => {
      mockCacheGet.mockResolvedValue(null);

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'test' },
      });

      const response = await PUT(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Challenge expired');
    });

    it('rejects when verification fails', async () => {
      mockVerifyRegistration.mockResolvedValue({
        verified: false,
        registrationInfo: null,
      });

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'test', type: 'public-key' },
      });

      const response = await PUT(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Verification failed');
    });

    it('returns 500 when DB insert fails', async () => {
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({
          error: { message: 'Duplicate credential', code: '23505' },
        }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
    });

    it('deletes challenge from Redis after successful save', async () => {
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
      });

      await PUT(request);

      expect(mockCacheDelete).toHaveBeenCalledWith('webauthn:register:user-123');
    });

    it('calls auditLog with correct parameters', async () => {
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
        deviceName: 'Test Device',
      });

      await PUT(request);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'auth.passkey_register',
          resourceType: 'passkey',
          resourceId: 'credential-id-123',
          metadata: expect.objectContaining({
            deviceName: 'Test Device',
            deviceType: 'multiDevice',
            backedUp: true,
          }),
        })
      );
    });

    it('returns 500 on unexpected error', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unexpected failure'));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'test' },
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
    });

    it('does not fail when auditLog throws', async () => {
      mockAuditLog.mockRejectedValue(new Error('Audit failed'));
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
      });

      const response = await PUT(request);

      // Should still succeed even if audit log fails
      expect(response.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Redis availability tests
  // --------------------------------------------------------------------------

  describe('Redis availability', () => {
    it('POST stores challenge in Redis when available', async () => {
      mockSupabaseChain.from.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: 'Test User' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_passkeys') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return mockSupabaseChain;
      });

      const { POST } = await import('./route');
      const request = makeRequest('POST');
      await POST(request);

      expect(mockCacheSet).toHaveBeenCalledWith(
        'webauthn:register:user-123',
        { challenge: 'test-challenge-string' },
        300
      );
    });

    it('PUT retrieves challenge from Redis when available', async () => {
      mockSupabaseChain.from.mockImplementation(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      const { PUT } = await import('./route');
      const request = makeRequest('PUT', {
        response: { id: 'credential-id-123', type: 'public-key' },
      });

      await PUT(request);

      expect(mockCacheGet).toHaveBeenCalledWith('webauthn:register:user-123');
    });
  });

  // --------------------------------------------------------------------------
  // Exports
  // --------------------------------------------------------------------------

  describe('Route exports', () => {
    it('exports dynamic and runtime configuration', async () => {
      const routeModule = await import('./route');
      expect(routeModule.dynamic).toBe('force-dynamic');
      expect(routeModule.runtime).toBe('nodejs');
    });
  });
});
