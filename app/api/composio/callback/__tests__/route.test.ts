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

const mockGetUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

const mockWaitForConnection = vi.fn();
vi.mock('@/lib/composio', () => ({
  waitForConnection: (...args: unknown[]) => mockWaitForConnection(...args),
}));

// Set required env var
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Import after mocks
const { GET } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('GET /api/composio/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.get.mockReturnValue(undefined);
    mockCookieStore.getAll.mockReturnValue([]);
  });

  it('redirects with error when Composio returns an error', async () => {
    const request = new NextRequest('http://localhost/api/composio/callback?error=access_denied');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('/settings');
    expect(location).toContain('tab=connectors');
    expect(location).toContain('error=');
  });

  it('redirects with error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const request = new NextRequest('http://localhost/api/composio/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('error=Not+authenticated');
  });

  it('waits for connection when connectionId cookie is present', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'composio_connection_id') return { value: 'conn-1' };
      if (name === 'composio_connection_toolkit') return { value: 'GITHUB' };
      return undefined;
    });
    mockWaitForConnection.mockResolvedValue({
      status: 'connected',
      toolkit: 'GITHUB',
    });

    const request = new NextRequest('http://localhost/api/composio/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('success=');
    expect(mockWaitForConnection).toHaveBeenCalledWith('conn-1', 30000, 'user-123');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('composio_connection_id');
    expect(mockCookieStore.delete).toHaveBeenCalledWith('composio_connection_toolkit');
  });

  it('redirects with pending when connection is not yet active', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'composio_connection_id') return { value: 'conn-1' };
      if (name === 'composio_connection_toolkit') return { value: 'SLACK' };
      return undefined;
    });
    mockWaitForConnection.mockResolvedValue({
      status: 'pending',
      toolkit: 'SLACK',
    });

    const request = new NextRequest('http://localhost/api/composio/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('pending=SLACK');
  });

  it('shows success when no connectionId cookie (OAuth completed externally)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });
    mockCookieStore.get.mockReturnValue(undefined);

    const request = new NextRequest('http://localhost/api/composio/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('success=');
  });

  it('redirects with error on unexpected exception', async () => {
    mockGetUser.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/composio/callback');
    const response = await GET(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('Location')!;
    expect(location).toContain('error=Connection+failed');
  });
});
