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
const mockGetAvailableTools = vi.fn();
const mockIsComposioConfigured = vi.fn();
const mockGetComposioClient = vi.fn();
vi.mock('@/lib/composio', () => ({
  getConnectedAccounts: (...args: unknown[]) => mockGetConnectedAccounts(...args),
  getAvailableTools: (...args: unknown[]) => mockGetAvailableTools(...args),
  isComposioConfigured: (...args: unknown[]) => mockIsComposioConfigured(...args),
  getComposioClient: (...args: unknown[]) => mockGetComposioClient(...args),
}));

const mockGetComposioToolsForUser = vi.fn();
vi.mock('@/lib/composio/chat-tools', () => ({
  getComposioToolsForUser: (...args: unknown[]) => mockGetComposioToolsForUser(...args),
}));

// Mock global fetch for direct API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocks
const { GET } = await import('../route');

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

function createRequest() {
  return new NextRequest('http://localhost/api/composio/debug', {
    method: 'GET',
  });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/composio/debug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COMPOSIO_API_KEY = 'test-api-key';
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns failure when Composio is not configured', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(false);

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.summary).toContain('COMPOSIO_API_KEY is not set');
  });

  it('returns failure when no connected accounts found', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioClient.mockReturnValue({
      connectedAccounts: {
        list: vi.fn().mockResolvedValue({ items: [] }),
      },
    });
    mockGetConnectedAccounts.mockResolvedValue([]);

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.summary).toContain('No connected apps found');
  });

  it('runs full diagnostic pipeline when accounts are connected', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioClient.mockReturnValue({
      connectedAccounts: {
        list: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'acc-1',
              status: 'ACTIVE',
              toolkit: { slug: 'github', name: 'GitHub', id: 'tk-1' },
              integrationId: 'int-1',
              appName: 'github',
              appUniqueId: 'github-1',
            },
          ],
        }),
      },
    });
    mockGetConnectedAccounts.mockResolvedValue([
      { id: 'acc-1', toolkit: 'GITHUB', status: 'connected' },
    ]);
    mockFetch.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({
        items: [{ name: 'github_create_issue', slug: 'github_create_issue' }],
      }),
    });
    mockGetAvailableTools.mockResolvedValue([
      {
        name: 'github_create_issue',
        description: 'Create issue',
        parameters: { properties: { title: {} }, required: ['title'] },
      },
    ]);
    mockGetComposioToolsForUser.mockResolvedValue({
      connectedApps: ['GITHUB'],
      tools: [{ name: 'github_create_issue' }],
      hasGitHub: true,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
      systemPromptAddition: 'GitHub tools available',
    });

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.steps).toBeDefined();
    expect(body.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('returns 500 on unexpected top-level error', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected'));

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it('handles individual step failures gracefully', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioClient.mockReturnValue({
      connectedAccounts: {
        list: vi.fn().mockRejectedValue(new Error('API timeout')),
      },
    });
    mockGetConnectedAccounts.mockResolvedValue([
      { id: 'acc-1', toolkit: 'GITHUB', status: 'connected' },
    ]);
    mockFetch.mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ items: [] }),
    });
    mockGetAvailableTools.mockResolvedValue([]);
    mockGetComposioToolsForUser.mockResolvedValue({
      connectedApps: ['GITHUB'],
      tools: [],
      hasGitHub: true,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
      systemPromptAddition: '',
    });

    const request = createRequest();
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    // Should still return results even with step failures
    expect(body.steps).toBeDefined();
    const failedStep = body.steps.find(
      (s: { step: string; status: string }) => s.step === '2a_raw_composio_accounts'
    );
    expect(failedStep?.status).toBe('fail');
  });
});
