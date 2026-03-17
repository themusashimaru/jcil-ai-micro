import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock requireAdmin
const mockAdminUser = { id: 'admin-123', email: 'admin@example.com' };
const mockAdminRecord = {
  id: 'admin-row-1',
  permissions: {
    can_view_users: true,
    can_edit_users: true,
    can_view_conversations: true,
    can_export_data: true,
    can_manage_subscriptions: true,
    can_ban_users: true,
  },
};
const mockRequireAdmin = vi.fn();
vi.mock('@/lib/auth/admin-guard', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Mock postgrest sanitizer
vi.mock('@/lib/security/postgrest', () => ({
  sanitizePostgrestInput: (input: string) => input,
}));

// Mock Supabase createClient
const mockFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/admin/support/tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRequireAdmin.mockResolvedValue({
      authorized: true,
      user: mockAdminUser,
      adminUser: mockAdminRecord,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Set env vars for getSupabaseAdmin
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns 401 when not admin', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireAdmin.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const request = new NextRequest('http://localhost/api/admin/support/tickets');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('returns paginated tickets with counts', async () => {
    const mockTickets = [
      {
        id: 'ticket-1',
        subject: 'Help with login',
        sender_email: 'user1@example.com',
        sender_name: 'User One',
        category: 'technical',
        status: 'open',
        source: 'internal',
        is_read: false,
        is_starred: false,
        is_archived: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'ticket-2',
        subject: 'Billing question',
        sender_email: 'user2@example.com',
        sender_name: 'User Two',
        category: 'billing',
        status: 'resolved',
        source: 'external',
        is_read: true,
        is_starred: true,
        is_archived: false,
        created_at: '2026-01-02T00:00:00Z',
      },
    ];

    // Mock the main tickets query (chained methods)
    const mockRange = vi.fn().mockResolvedValue({
      data: mockTickets,
      error: null,
      count: 2,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqArchived = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqArchived });

    // Mock the counts query (second call to from)
    const mockCountSelect = vi.fn().mockResolvedValue({
      data: mockTickets,
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      // Second call is for counts
      return { select: mockCountSelect };
    });

    const request = new NextRequest('http://localhost/api/admin/support/tickets');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tickets).toHaveLength(2);
    expect(json.pagination).toBeDefined();
    expect(json.pagination.page).toBe(1);
    expect(json.pagination.totalCount).toBe(2);
    expect(json.counts).toBeDefined();
    expect(json.timestamp).toBeDefined();
  });

  it('handles search parameter', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: [{ id: 'ticket-1', subject: 'Login issue', is_archived: false }],
      error: null,
      count: 1,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqArchived = vi.fn().mockReturnValue({ or: mockOr });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqArchived });

    const mockCountSelect = vi.fn().mockResolvedValue({
      data: [
        {
          category: 'technical',
          status: 'open',
          source: 'internal',
          is_read: false,
          is_starred: false,
          is_archived: false,
        },
      ],
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      return { select: mockCountSelect };
    });

    const request = new NextRequest('http://localhost/api/admin/support/tickets?search=Login');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tickets).toHaveLength(1);
  });

  it('handles filter parameters', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqArchived = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqStatus = vi.fn().mockReturnValue({ eq: mockEqArchived });
    const mockEqCategory = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockEqSource = vi.fn().mockReturnValue({ eq: mockEqCategory });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSource });

    const mockCountSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      return { select: mockCountSelect };
    });

    const request = new NextRequest(
      'http://localhost/api/admin/support/tickets?source=internal&category=technical&status=open'
    );
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.tickets).toHaveLength(0);
    expect(json.pagination.totalCount).toBe(0);
  });

  it('returns correct pagination metadata', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: [{ id: 'ticket-1' }],
      error: null,
      count: 50,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqArchived = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqArchived });

    const mockCountSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockSelect };
      }
      return { select: mockCountSelect };
    });

    const request = new NextRequest('http://localhost/api/admin/support/tickets?page=2&limit=10');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.pagination.page).toBe(2);
    expect(json.pagination.limit).toBe(10);
    expect(json.pagination.totalCount).toBe(50);
    expect(json.pagination.totalPages).toBe(5);
    expect(json.pagination.hasNextPage).toBe(true);
    expect(json.pagination.hasPreviousPage).toBe(true);
  });

  it('returns 500 when ticket query fails', async () => {
    const mockRange = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST500', message: 'Database error' },
      count: null,
    });
    const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
    const mockEqArchived = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqArchived });

    mockFrom.mockImplementation(() => {
      return { select: mockSelect };
    });

    const request = new NextRequest('http://localhost/api/admin/support/tickets');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.ok).toBe(false);
  });
});
