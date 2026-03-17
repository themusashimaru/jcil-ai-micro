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

const mockSupabaseFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  }),
}));

// Set required env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';
const TICKET_ID = 'ticket-456';

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
  return new NextRequest(`http://localhost/api/support/tickets/${TICKET_ID}`, {
    method: 'GET',
  });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/support/tickets/[ticketId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthFailure();
    const request = createRequest();
    const response = await GET(request, { params: { ticketId: TICKET_ID } });
    expect(response.status).toBe(401);
  });

  it('returns ticket with replies successfully', async () => {
    mockAuthSuccess();
    const ticket = {
      id: TICKET_ID,
      user_id: USER_ID,
      subject: 'Help needed',
      status: 'open',
      created_at: '2026-03-01',
    };
    const replies = [
      {
        id: 'reply-1',
        admin_email: 'admin@example.com',
        message: 'We can help!',
        is_internal_note: false,
        created_at: '2026-03-02',
      },
    ];

    // Mock ticket query
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: ticket, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'support_replies') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: replies, error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const request = createRequest();
    const response = await GET(request, { params: { ticketId: TICKET_ID } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ticket.id).toBe(TICKET_ID);
    expect(body.replies).toHaveLength(1);
    expect(body.replies[0].message).toBe('We can help!');
  });

  it('returns 404 when ticket not found', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }),
    });

    const request = createRequest();
    const response = await GET(request, { params: { ticketId: 'nonexistent' } });
    expect(response.status).toBe(404);
  });

  it('returns 404 when ticket belongs to different user', async () => {
    mockAuthSuccess();
    // RLS would prevent finding the ticket, so it returns null
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const request = createRequest();
    const response = await GET(request, { params: { ticketId: TICKET_ID } });
    expect(response.status).toBe(404);
  });

  it('returns empty replies array when ticket has no replies', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: TICKET_ID, user_id: USER_ID },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'support_replies') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const request = createRequest();
    const response = await GET(request, { params: { ticketId: TICKET_ID } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.replies).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthSuccess();
    mockSupabaseFrom.mockImplementation(() => {
      throw new Error('Connection failed');
    });

    const request = createRequest();
    const response = await GET(request, { params: { ticketId: TICKET_ID } });
    expect(response.status).toBe(500);
  });
});
