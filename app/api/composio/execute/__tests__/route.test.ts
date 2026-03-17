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

const mockExecuteTool = vi.fn();
const mockIsComposioConfigured = vi.fn();
vi.mock('@/lib/composio', () => ({
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
  isComposioConfigured: (...args: unknown[]) => mockIsComposioConfigured(...args),
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
  return new NextRequest('http://localhost/api/composio/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ========================================
// TESTS
// ========================================

describe('POST /api/composio/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest({ action: 'github_create_issue', params: {} });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 503 when Composio is not configured', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(false);

    const request = createRequest({ action: 'github_create_issue' });
    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it('returns 400 when action is missing', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);

    const request = createRequest({ params: {} });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('executes tool action successfully', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockExecuteTool.mockResolvedValue({
      success: true,
      data: { issueUrl: 'https://github.com/org/repo/issues/1' },
    });

    const request = createRequest({
      action: 'github_create_issue',
      params: { title: 'Bug report', body: 'Details here' },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    // successResponse spreads + adds data key; the inner data contains our result
    expect(body.data.data).toEqual({ issueUrl: 'https://github.com/org/repo/issues/1' });
    expect(mockExecuteTool).toHaveBeenCalledWith(USER_ID, 'github_create_issue', {
      title: 'Bug report',
      body: 'Details here',
    });
  });

  it('uses empty params when not provided', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockExecuteTool.mockResolvedValue({
      success: true,
      data: { result: 'ok' },
    });

    const request = createRequest({ action: 'github_list_repos' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockExecuteTool).toHaveBeenCalledWith(USER_ID, 'github_list_repos', {});
  });

  it('returns 500 when tool execution fails', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockExecuteTool.mockResolvedValue({
      success: false,
      error: 'Permission denied',
    });

    const request = createRequest({
      action: 'github_create_issue',
      params: { title: 'test' },
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockIsComposioConfigured.mockReturnValue(true);
    mockExecuteTool.mockRejectedValue(new Error('Network timeout'));

    const request = createRequest({
      action: 'github_create_issue',
      params: {},
    });
    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
