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

const mockOptionalUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  optionalUser: (...args: unknown[]) => mockOptionalUser(...args),
}));

const mockGetConnectedAccounts = vi.fn();
const mockIsComposioConfigured = vi.fn();
const mockGetToolkitsByCategory = vi.fn();

const MOCK_ALL_TOOLKITS = [
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description: 'GitHub integration',
    category: 'development',
    popular: true,
  },
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description: 'Gmail integration',
    category: 'communication',
    popular: true,
  },
  {
    id: 'JIRA',
    displayName: 'Jira',
    description: 'Jira project management',
    category: 'productivity',
    popular: false,
  },
];

const MOCK_POPULAR_TOOLKITS = MOCK_ALL_TOOLKITS.filter((t) => t.popular);

vi.mock('@/lib/composio', () => ({
  ALL_TOOLKITS: MOCK_ALL_TOOLKITS,
  POPULAR_TOOLKITS: MOCK_POPULAR_TOOLKITS,
  getToolkitsByCategory: (...args: unknown[]) => mockGetToolkitsByCategory(...args),
  isComposioConfigured: (...args: unknown[]) => mockIsComposioConfigured(...args),
  getConnectedAccounts: (...args: unknown[]) => mockGetConnectedAccounts(...args),
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// TESTS
// ========================================

describe('GET /api/composio/toolkits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsComposioConfigured.mockReturnValue(true);
    mockOptionalUser.mockResolvedValue({ user: null, supabase: null });
  });

  it('returns all toolkits by default', async () => {
    const request = new NextRequest('http://localhost/api/composio/toolkits');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(3);
    expect(body.toolkits).toHaveLength(3);
    expect(body.configured).toBe(true);
  });

  it('returns only popular toolkits when popular=true', async () => {
    const request = new NextRequest('http://localhost/api/composio/toolkits?popular=true');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(2);
  });

  it('filters toolkits by category', async () => {
    mockGetToolkitsByCategory.mockReturnValue([MOCK_ALL_TOOLKITS[0]]);

    const request = new NextRequest('http://localhost/api/composio/toolkits?category=development');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.toolkits[0].id).toBe('GITHUB');
  });

  it('filters toolkits by search query', async () => {
    const request = new NextRequest('http://localhost/api/composio/toolkits?search=gmail');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.toolkits[0].id).toBe('GMAIL');
  });

  it('returns empty results when search matches nothing', async () => {
    const request = new NextRequest('http://localhost/api/composio/toolkits?search=nonexistent');
    const response = await GET(request);
    const body = await response.json();
    expect(body.total).toBe(0);
  });

  it('enriches toolkits with connection status when requested', async () => {
    mockOptionalUser.mockResolvedValue({
      user: { id: 'user-123' },
      supabase: { from: vi.fn() },
    });
    mockGetConnectedAccounts.mockResolvedValue([
      { id: 'conn-1', toolkit: 'GITHUB', status: 'connected' },
    ]);

    const request = new NextRequest('http://localhost/api/composio/toolkits?connected=true');
    const response = await GET(request);
    const body = await response.json();
    const github = body.toolkits.find((t: { id: string }) => t.id === 'GITHUB');
    expect(github.connected).toBe(true);
    expect(github.connectionId).toBe('conn-1');

    const gmail = body.toolkits.find((t: { id: string }) => t.id === 'GMAIL');
    expect(gmail.connected).toBe(false);
  });

  it('does not enrich when Composio is not configured', async () => {
    mockIsComposioConfigured.mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/composio/toolkits?connected=true');
    const response = await GET(request);
    const body = await response.json();
    // All toolkits should have connected=false
    for (const toolkit of body.toolkits) {
      expect(toolkit.connected).toBe(false);
    }
  });

  it('returns grouped toolkits', async () => {
    const request = new NextRequest('http://localhost/api/composio/toolkits');
    const response = await GET(request);
    const body = await response.json();
    expect(body.grouped).toBeDefined();
    expect(body.grouped.popular).toHaveLength(2);
    expect(body.grouped.development).toHaveLength(1);
    expect(body.grouped.communication).toHaveLength(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockOptionalUser.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/composio/toolkits?connected=true');
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
