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

const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

const mockGetConnectedAccounts = vi.fn();
const mockDisconnectAccount = vi.fn();
const mockIsComposioConfigured = vi.fn();
const mockGetToolkitById = vi.fn();
vi.mock('@/lib/composio', () => ({
  getConnectedAccounts: (...args: unknown[]) => mockGetConnectedAccounts(...args),
  disconnectAccount: (...args: unknown[]) => mockDisconnectAccount(...args),
  isComposioConfigured: (...args: unknown[]) => mockIsComposioConfigured(...args),
  getToolkitById: (...args: unknown[]) => mockGetToolkitById(...args),
}));

// Import after mocks
const { GET, DELETE } = await import('../route');

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

// ========================================
// TESTS: GET /api/composio/accounts
// ========================================

describe('GET /api/composio/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns empty accounts when Composio not configured', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(false);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.accounts).toEqual([]);
    expect(body.configured).toBe(false);
  });

  it('returns enriched accounts when Composio is configured', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetConnectedAccounts.mockResolvedValue([
      { id: 'acc-1', toolkit: 'GITHUB', status: 'connected' },
    ]);
    mockGetToolkitById.mockReturnValue({
      displayName: 'GitHub',
      icon: '🐙',
      description: 'GitHub integration',
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].displayName).toBe('GitHub');
    expect(body.accounts[0].icon).toBe('🐙');
  });

  it('uses fallback values when toolkit config not found', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetConnectedAccounts.mockResolvedValue([
      { id: 'acc-1', toolkit: 'UNKNOWN', status: 'connected' },
    ]);
    mockGetToolkitById.mockReturnValue(null);

    const response = await GET();
    const body = await response.json();
    expect(body.accounts[0].displayName).toBe('UNKNOWN');
    expect(body.accounts[0].icon).toBe('🔌');
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetConnectedAccounts.mockRejectedValue(new Error('API error'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

// ========================================
// TESTS: DELETE /api/composio/accounts
// ========================================

describe('DELETE /api/composio/accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = new NextRequest('http://localhost/api/composio/accounts?connectionId=conn-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it('returns 400 when connectionId is missing', async () => {
    mockAuthSuccess();
    const request = new NextRequest('http://localhost/api/composio/accounts', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it('disconnects account successfully', async () => {
    mockAuthSuccess();
    mockDisconnectAccount.mockResolvedValue(true);

    const request = new NextRequest(
      'http://localhost/api/composio/accounts?connectionId=conn-1&toolkit=GITHUB',
      { method: 'DELETE' }
    );
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockDisconnectAccount).toHaveBeenCalledWith('conn-1', USER_ID, 'GITHUB');
  });

  it('returns 500 when disconnect fails', async () => {
    mockAuthSuccess();
    mockDisconnectAccount.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/composio/accounts?connectionId=conn-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockDisconnectAccount.mockRejectedValue(new Error('Network error'));

    const request = new NextRequest('http://localhost/api/composio/accounts?connectionId=conn-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });
});
