import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

const mockCookieStore = {
  get: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockInitiateConnection = vi.fn();
const mockConnectWithApiKey = vi.fn();
const mockIsComposioConfigured = vi.fn();
const mockGetToolkitById = vi.fn();
vi.mock('@/lib/composio', () => ({
  initiateConnection: (...args: unknown[]) => mockInitiateConnection(...args),
  connectWithApiKey: (...args: unknown[]) => mockConnectWithApiKey(...args),
  isComposioConfigured: (...args: unknown[]) => mockIsComposioConfigured(...args),
  getToolkitById: (...args: unknown[]) => mockGetToolkitById(...args),
}));

// Import after mocks
const { POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function mockAuthSuccess() {
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: { id: USER_ID, email: 'test@example.com' },
    supabase: { from: vi.fn() },
  });
}

function mockAuthFailure() {
  mockRequireUser.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
      status: 401,
    }),
  });
}

function createRequest(body: object) {
  return new NextRequest('http://localhost/api/composio/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ========================================
// TESTS
// ========================================

describe('POST /api/composio/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest({ toolkit: 'GITHUB' });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 503 when Composio is not configured', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(false);

    const request = createRequest({ toolkit: 'GITHUB' });
    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it('returns 400 when toolkit is missing', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);

    const request = createRequest({});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('connects with API key successfully', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'OpenAI',
      authType: 'api_key',
    });
    mockConnectWithApiKey.mockResolvedValue({
      success: true,
      connectionId: 'conn-1',
    });

    const request = createRequest({
      toolkit: 'openai',
      apiKey: 'sk-test-key',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authType).toBe('api_key');
    expect(body.connectionId).toBe('conn-1');
  });

  it('returns 400 when sending API key to OAuth toolkit', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'GitHub',
      authType: 'oauth2',
    });

    const request = createRequest({
      toolkit: 'github',
      apiKey: 'some-key',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when trying OAuth for API key toolkit', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'OpenAI',
      authType: 'api_key',
    });

    const request = createRequest({ toolkit: 'openai' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('initiates OAuth connection successfully', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'GitHub',
      authType: 'oauth2',
    });
    mockInitiateConnection.mockResolvedValue({
      id: 'conn-1',
      redirectUrl: 'https://github.com/login/oauth/authorize',
    });

    const request = createRequest({ toolkit: 'github' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.authType).toBe('oauth2');
    expect(body.redirectUrl).toBe('https://github.com/login/oauth/authorize');
    expect(body.connectionId).toBe('conn-1');
    // Should set cookies
    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
  });

  it('rejects cross-origin redirect URL', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'GitHub',
      authType: 'oauth2',
    });

    const request = createRequest({
      toolkit: 'github',
      redirectUrl: 'https://evil.com/steal',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('accepts same-origin redirect URL', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'GitHub',
      authType: 'oauth2',
    });
    mockInitiateConnection.mockResolvedValue({
      id: 'conn-1',
      redirectUrl: 'https://github.com/login/oauth/authorize',
    });

    const request = createRequest({
      toolkit: 'github',
      redirectUrl: 'http://localhost:3000/settings',
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue(null);
    mockInitiateConnection.mockRejectedValue(new Error('Network error'));

    const request = createRequest({ toolkit: 'github' });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 when API key connection fails', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetToolkitById.mockReturnValue({
      displayName: 'OpenAI',
      authType: 'api_key',
    });
    mockConnectWithApiKey.mockResolvedValue({
      success: false,
      error: 'Invalid API key',
    });

    const request = createRequest({
      toolkit: 'openai',
      apiKey: 'bad-key',
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
