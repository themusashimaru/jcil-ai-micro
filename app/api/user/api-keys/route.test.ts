/**
 * USER API KEYS ROUTE TESTS
 *
 * Tests for /api/user/api-keys endpoint:
 * - Auth guard (requireUser) rejecting unauthenticated requests
 * - GET: Returns configured providers without exposing keys
 * - POST (save): Validates provider, key format, tests key, encrypts and saves
 * - POST (test): Tests an API key without saving
 * - DELETE: Removes an API key for a provider
 * - Validation errors (bad provider, missing key, wrong format)
 * - Error handling (DB failures, encryption failures)
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

const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
vi.mock('@/lib/security/crypto', () => ({
  encrypt: (...args: unknown[]) => mockEncrypt(...args),
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
}));

const mockAuditLog = vi.fn().mockResolvedValue(true);
const mockGetAuditContext = vi.fn().mockReturnValue({ ip: '127.0.0.1', userAgent: 'test' });
vi.mock('@/lib/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getAuditContext: (...args: unknown[]) => mockGetAuditContext(...args),
}));

// Supabase mock chain
const mockSupabaseData = { data: null, error: null };
const mockSupabaseChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockImplementation(function (this: typeof mockSupabaseChain) {
    return {
      ...this,
      single: vi.fn().mockResolvedValue(mockSupabaseData),
      data: mockSupabaseData.data,
      error: mockSupabaseData.error,
    };
  }),
  single: vi.fn().mockResolvedValue(mockSupabaseData),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnThis(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseChain),
}));

// Mock global fetch for testApiKey
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// We need the real successResponse and errors from api/utils
// but to avoid importing the whole chain, we mock them simply
vi.mock('@/lib/api/utils', () => ({
  successResponse: vi.fn((data: unknown) => {
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  errors: {
    badRequest: vi.fn(
      (msg: string) =>
        new Response(JSON.stringify({ ok: false, error: msg, code: 'INVALID_INPUT' }), {
          status: 400,
        })
    ),
    serverError: vi.fn(
      (msg?: string) =>
        new Response(
          JSON.stringify({ ok: false, error: msg || 'Internal error', code: 'INTERNAL_ERROR' }),
          { status: 500 }
        )
    ),
    notFound: vi.fn(
      (resource?: string) =>
        new Response(
          JSON.stringify({
            ok: false,
            error: `${resource || 'Resource'} not found`,
            code: 'NOT_FOUND',
          }),
          { status: 404 }
        )
    ),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

async function parseResponse(response: Response) {
  return response.json();
}

function setAuthSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: mockUser,
  });
}

function setAuthFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'Authentication required', code: 'UNAUTHORIZED' }),
      { status: 401 }
    ),
  });
}

// Build a proper supabase chain for querying provider preferences
function mockSupabaseSelect(providerApiKeys: Record<string, unknown> | null) {
  const singleResult =
    providerApiKeys !== null
      ? { data: { provider_api_keys: providerApiKeys }, error: null }
      : { data: null, error: null };

  const eqFn = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue(singleResult),
  });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  mockSupabaseChain.from.mockReturnValue({
    select: selectFn,
    upsert: mockSupabaseChain.upsert,
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });

  return { eqFn, selectFn };
}

function mockSupabaseSelectThenUpsert(
  providerApiKeys: Record<string, unknown> | null,
  upsertError: unknown = null
) {
  const singleResult =
    providerApiKeys !== null
      ? { data: { provider_api_keys: providerApiKeys }, error: null }
      : { data: null, error: null };

  const eqFn = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue(singleResult),
  });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const upsertFn = vi.fn().mockResolvedValue({ error: upsertError });
  mockSupabaseChain.from.mockReturnValue({
    select: selectFn,
    upsert: upsertFn,
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
  });

  return { eqFn, selectFn, upsertFn };
}

function mockSupabaseSelectThenUpdate(
  providerApiKeys: Record<string, unknown> | null,
  updateError: unknown = null
) {
  const singleResult =
    providerApiKeys !== null
      ? { data: { provider_api_keys: providerApiKeys }, error: null }
      : { data: null, error: null };

  const eqForSelect = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue(singleResult),
  });
  const selectFn = vi.fn().mockReturnValue({ eq: eqForSelect });

  const eqForUpdate = vi.fn().mockResolvedValue({ error: updateError });
  const updateFn = vi.fn().mockReturnValue({ eq: eqForUpdate });

  mockSupabaseChain.from.mockReturnValue({
    select: selectFn,
    upsert: mockSupabaseChain.upsert,
    update: updateFn,
  });

  return { selectFn, updateFn, eqForUpdate };
}

// ============================================================================
// IMPORT ROUTE HANDLERS (after mocks)
// ============================================================================

// Dynamic import to ensure mocks are set up first
let GET: typeof import('./route').GET;
let POST: typeof import('./route').POST;
let DELETE_handler: typeof import('./route').DELETE;

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-import to get fresh references with mocks applied
  const mod = await import('./route');
  GET = mod.GET;
  POST = mod.POST;
  DELETE_handler = mod.DELETE;
});

// ============================================================================
// TESTS
// ============================================================================

describe('/api/user/api-keys', () => {
  // --------------------------------------------------------------------------
  // AUTH GUARD
  // --------------------------------------------------------------------------
  describe('Auth Guard (requireUser)', () => {
    it('GET returns 401 when user is not authenticated', async () => {
      setAuthFailure();

      const response = await GET();
      expect(response.status).toBe(401);

      const body = await parseResponse(response);
      expect(body.error).toBe('Authentication required');
    });

    it('POST returns 401 when user is not authenticated', async () => {
      setAuthFailure();

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-test123',
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('DELETE returns 401 when user is not authenticated', async () => {
      setAuthFailure();

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      const response = await DELETE_handler(request);
      expect(response.status).toBe(401);
    });

    it('POST passes request to requireUser for CSRF validation', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpsert({});
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted');

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-testkey1234567890',
      });
      await POST(request);

      expect(mockRequireUser).toHaveBeenCalledWith(request);
    });

    it('GET calls requireUser without request (no CSRF needed)', async () => {
      setAuthSuccess();
      mockSupabaseSelect({});

      await GET();

      expect(mockRequireUser).toHaveBeenCalledWith();
    });
  });

  // --------------------------------------------------------------------------
  // GET - List configured providers
  // --------------------------------------------------------------------------
  describe('GET - List configured providers', () => {
    it('returns all supported providers with configured status', async () => {
      setAuthSuccess();
      mockSupabaseSelect({});

      const response = await GET();
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.ok).toBe(true);
      expect(body.data.providers).toHaveLength(5);

      const providerIds = body.data.providers.map((p: { provider: string }) => p.provider);
      expect(providerIds).toEqual(['claude', 'openai', 'deepseek', 'xai', 'gemini']);
    });

    it('marks providers as not configured when no keys exist', async () => {
      setAuthSuccess();
      mockSupabaseSelect({});

      const response = await GET();
      const body = await parseResponse(response);

      for (const p of body.data.providers) {
        expect(p.configured).toBe(false);
        expect(p.lastChars).toBeUndefined();
      }
    });

    it('marks providers as configured when keys exist and decrypts last 4 chars', async () => {
      setAuthSuccess();
      mockDecrypt.mockReturnValue('sk-ant-realkey1234');
      mockSupabaseSelect({
        claude: { key: 'v1:encrypted-data' },
      });

      const response = await GET();
      const body = await parseResponse(response);

      const claude = body.data.providers.find((p: { provider: string }) => p.provider === 'claude');
      expect(claude.configured).toBe(true);
      expect(claude.lastChars).toBe('1234');
    });

    it('handles legacy string format for stored keys', async () => {
      setAuthSuccess();
      mockDecrypt.mockReturnValue('sk-legacykey5678');
      mockSupabaseSelect({
        openai: 'legacy-encrypted-string',
      });

      const response = await GET();
      const body = await parseResponse(response);

      const openai = body.data.providers.find((p: { provider: string }) => p.provider === 'openai');
      expect(openai.configured).toBe(true);
      expect(openai.lastChars).toBe('5678');
    });

    it('returns **** when decryption fails', async () => {
      setAuthSuccess();
      mockDecrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      mockSupabaseSelect({
        claude: { key: 'v1:bad-encrypted-data' },
      });

      const response = await GET();
      const body = await parseResponse(response);

      const claude = body.data.providers.find((p: { provider: string }) => p.provider === 'claude');
      expect(claude.configured).toBe(true);
      expect(claude.lastChars).toBe('****');
    });

    it('includes custom model when set in provider config', async () => {
      setAuthSuccess();
      mockDecrypt.mockReturnValue('sk-ant-key1234');
      mockSupabaseSelect({
        claude: { key: 'v1:encrypted', model: 'claude-opus-4-6' },
      });

      const response = await GET();
      const body = await parseResponse(response);

      const claude = body.data.providers.find((p: { provider: string }) => p.provider === 'claude');
      expect(claude.model).toBe('claude-opus-4-6');
    });

    it('includes defaultModel for each provider', async () => {
      setAuthSuccess();
      mockSupabaseSelect({});

      const response = await GET();
      const body = await parseResponse(response);

      const claude = body.data.providers.find((p: { provider: string }) => p.provider === 'claude');
      expect(claude.defaultModel).toBe('claude-sonnet-4-6');

      const openai = body.data.providers.find((p: { provider: string }) => p.provider === 'openai');
      expect(openai.defaultModel).toBe('gpt-4o');
    });

    it('handles null prefs (no record for user)', async () => {
      setAuthSuccess();
      mockSupabaseSelect(null);

      const response = await GET();
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.data.providers).toHaveLength(5);
      for (const p of body.data.providers) {
        expect(p.configured).toBe(false);
      }
    });

    it('returns 500 on unexpected error', async () => {
      setAuthSuccess();
      mockSupabaseChain.from.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const response = await GET();
      expect(response.status).toBe(500);
    });
  });

  // --------------------------------------------------------------------------
  // POST - Save API key
  // --------------------------------------------------------------------------
  describe('POST - Save API key', () => {
    it('saves a valid OpenAI key', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted-openai-key');
      mockSupabaseSelectThenUpsert({});

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-valid-openai-key-1234',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.ok).toBe(true);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain('OpenAI');
      expect(body.data.lastChars).toBe('1234');
    });

    it('saves a valid Claude key with custom model', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted-claude-key');
      mockSupabaseSelectThenUpsert({});

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'claude',
        apiKey: 'sk-ant-my-claude-key-5678',
        model: 'claude-opus-4-6',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.data.model).toBe('claude-opus-4-6');
    });

    it('rejects invalid provider', async () => {
      setAuthSuccess();

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'invalid-provider',
        apiKey: 'sk-key123',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('Invalid provider');
    });

    it('rejects missing API key on save', async () => {
      setAuthSuccess();

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('API key required');
    });

    it('rejects key with wrong prefix', async () => {
      setAuthSuccess();

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'claude',
        apiKey: 'sk-wrong-prefix-key',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('sk-ant-');
    });

    it('rejects key that fails validation test', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-invalid-key-for-openai',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('Invalid API key');
    });

    it('returns 500 when upsert fails', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted');
      mockSupabaseSelectThenUpsert({}, { message: 'DB write error' });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-valid-key-test1234',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('encrypts the API key before saving', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted-result');
      mockSupabaseSelectThenUpsert({});

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-my-secret-key-9999',
      });

      await POST(request);

      expect(mockEncrypt).toHaveBeenCalledWith('sk-my-secret-key-9999');
    });

    it('merges with existing keys when saving', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:encrypted-deepseek');
      const { upsertFn } = mockSupabaseSelectThenUpsert({
        openai: { key: 'v1:existing-openai-key' },
      });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'deepseek',
        apiKey: 'sk-deepseek-key-abcd',
      });

      await POST(request);

      expect(upsertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          provider_api_keys: expect.objectContaining({
            openai: { key: 'v1:existing-openai-key' },
            deepseek: { key: 'v1:encrypted-deepseek' },
          }),
        }),
        { onConflict: 'user_id' }
      );
    });

    it('creates audit log entry on successful save', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:enc');
      mockSupabaseSelectThenUpsert({});

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-audit-test-key-0000',
      });

      await POST(request);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'api.key_created',
          resourceType: 'api_key',
          resourceId: 'openai',
        })
      );
    });

    it('trims model name and omits if empty', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });
      mockEncrypt.mockReturnValue('v1:enc');
      const { upsertFn } = mockSupabaseSelectThenUpsert({});

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-key-with-empty-model',
        model: '   ',
      });

      await POST(request);

      // Model should not be present when it's just whitespace
      const upsertCall = upsertFn.mock.calls[0][0];
      const savedConfig = upsertCall.provider_api_keys.openai;
      expect(savedConfig.model).toBeUndefined();
    });

    it('returns 500 on unexpected error (e.g., JSON parse failure)', async () => {
      setAuthSuccess();

      // Create a request with invalid JSON
      const request = new NextRequest(new URL('/api/user/api-keys', 'http://localhost:3000'), {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  // --------------------------------------------------------------------------
  // POST - Test API key (action: 'test')
  // --------------------------------------------------------------------------
  describe('POST - Test API key', () => {
    it('tests a valid OpenAI key (Bearer token)', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-test-key-here',
        action: 'test',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.data.valid).toBe(true);
    });

    it('tests a valid Claude key (POST to messages)', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'claude',
        apiKey: 'sk-ant-test-claude-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(true);

      // Verify Claude uses x-api-key header and POST method
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'x-api-key': 'sk-ant-test-claude-key' }),
        })
      );
    });

    it('Claude key test: treats 429 (rate limited) as valid', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: false, status: 429 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'claude',
        apiKey: 'sk-ant-rate-limited-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(true);
    });

    it('tests a Gemini key (query param)', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'gemini',
        apiKey: 'AIzaSyTestGeminiKey',
        action: 'test',
      });

      await POST(request);

      // Gemini passes key as query param
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=AIzaSyTestGeminiKey'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns invalid for 401 response', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-bad-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(false);
      expect(body.data.error).toBe('Invalid API key');
    });

    it('returns invalid for 403 response', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: false, status: 403 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'deepseek',
        apiKey: 'sk-forbidden-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(false);
      expect(body.data.error).toBe('Invalid API key');
    });

    it('returns error message for other HTTP errors', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-server-error-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(false);
      expect(body.data.error).toContain('500');
    });

    it('handles network errors gracefully', async () => {
      setAuthSuccess();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-network-fail-key',
        action: 'test',
      });

      const response = await POST(request);
      const body = await parseResponse(response);
      expect(body.data.valid).toBe(false);
      expect(body.data.error).toBe('Failed to connect to API');
    });

    it('rejects test action without API key', async () => {
      setAuthSuccess();

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        action: 'test',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('API key required');
    });

    it('does not encrypt or save when action is test', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'openai',
        apiKey: 'sk-test-only-key',
        action: 'test',
      });

      await POST(request);

      expect(mockEncrypt).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // DELETE - Remove API key
  // --------------------------------------------------------------------------
  describe('DELETE - Remove API key', () => {
    it('deletes an existing API key', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpdate({
        openai: { key: 'v1:encrypted-openai' },
        claude: { key: 'v1:encrypted-claude' },
      });

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(200);

      const body = await parseResponse(response);
      expect(body.data.success).toBe(true);
      expect(body.data.message).toContain('OpenAI');
    });

    it('rejects missing provider parameter', async () => {
      setAuthSuccess();

      const request = makeRequest('DELETE', '/api/user/api-keys');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(400);

      const body = await parseResponse(response);
      expect(body.error).toContain('Invalid provider');
    });

    it('rejects invalid provider parameter', async () => {
      setAuthSuccess();

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=fakeai');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(400);
    });

    it('returns 404 when no existing preferences found', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpdate(null);

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(404);
    });

    it('returns 500 when database update fails', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpdate({ openai: { key: 'v1:enc' } }, { message: 'DB error' });

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(500);
    });

    it('creates audit log entry on successful delete', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpdate({
        openai: { key: 'v1:enc' },
      });

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      await DELETE_handler(request);

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'api.key_revoked',
          resourceType: 'api_key',
          resourceId: 'openai',
        })
      );
    });

    it('passes request to requireUser for CSRF validation', async () => {
      setAuthSuccess();
      mockSupabaseSelectThenUpdate({ openai: { key: 'v1:enc' } });

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=openai');
      await DELETE_handler(request);

      expect(mockRequireUser).toHaveBeenCalledWith(request);
    });

    it('returns 500 on unexpected error', async () => {
      setAuthSuccess();
      mockSupabaseChain.from.mockImplementation(() => {
        throw new Error('Unexpected DB crash');
      });

      const request = makeRequest('DELETE', '/api/user/api-keys?provider=claude');
      const response = await DELETE_handler(request);

      expect(response.status).toBe(500);
    });
  });

  // --------------------------------------------------------------------------
  // Provider-specific test behaviors
  // --------------------------------------------------------------------------
  describe('Provider-specific key testing', () => {
    it('xAI uses Bearer token auth', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'xai',
        apiKey: 'xai-test-key',
        action: 'test',
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.x.ai/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer xai-test-key',
          }),
        })
      );
    });

    it('DeepSeek uses Bearer token auth', async () => {
      setAuthSuccess();
      mockFetch.mockResolvedValue({ ok: true, status: 200 });

      const request = makeRequest('POST', '/api/user/api-keys', {
        provider: 'deepseek',
        apiKey: 'sk-deepseek-test',
        action: 'test',
      });

      await POST(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-deepseek-test',
          }),
        })
      );
    });
  });
});
