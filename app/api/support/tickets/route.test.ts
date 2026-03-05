import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// MOCKS — must be declared before route import
// =============================================================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock CSRF validation
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock requireUser (auth guard)
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock cookies from next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

// Mock Supabase admin client
const mockSupabaseFrom = vi.fn();
const mockSupabaseAdmin = {
  from: (...args: unknown[]) => mockSupabaseFrom(...args),
};
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseAdmin,
}));

// Mock Supabase SSR client (authenticated client for user check in POST)
const mockAuthGetUser = vi.fn();
const mockSupabaseSSR = {
  auth: {
    getUser: () => mockAuthGetUser(),
  },
};
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => mockSupabaseSSR,
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// We need to partially mock @/lib/api/utils to keep real implementations
// but override checkRequestRateLimit
vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  };
});

// Mock email schema
vi.mock('@/lib/validation/schemas', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { z } = require('zod');
  return {
    emailSchema: z.string().email('Invalid email format').max(255),
  };
});

// =============================================================================
// IMPORT ROUTE HANDLERS (after mocks)
// =============================================================================

import { GET, POST } from './route';

// =============================================================================
// HELPERS
// =============================================================================

function createRequest(
  method: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const url = 'http://localhost:3000/api/support/tickets';
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:3000',
      'user-agent': 'TestAgent/1.0',
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init);
}

function validTicketBody(overrides: Record<string, unknown> = {}) {
  return {
    category: 'general',
    subject: 'Test support ticket subject',
    message: 'This is a test support ticket message that is at least twenty characters long.',
    ...overrides,
  };
}

const fakeUser = {
  id: 'user-123',
  email: 'test@example.com',
};

async function parseResponse(response: Response) {
  return response.json();
}

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Default: CSRF passes
  mockValidateCSRF.mockReturnValue({ valid: true });

  // Default: requireUser returns authorized user
  mockRequireUser.mockResolvedValue({
    authorized: true,
    user: fakeUser,
    supabase: mockSupabaseAdmin,
  });

  // Default: rate limit allows
  mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

  // Default: auth user check (for POST, the SSR client)
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: fakeUser.id, email: fakeUser.email } },
  });

  // Default: Supabase from mock
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ count: 0 }),
        single: vi.fn().mockResolvedValue({ data: { full_name: 'Test User' }, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      count: 'exact',
      head: true,
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'ticket-456', created_at: '2026-03-05T00:00:00Z' },
          error: null,
        }),
      }),
    }),
  });

  // Set env vars
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

// =============================================================================
// TESTS: GET /api/support/tickets
// =============================================================================

describe('GET /api/support/tickets', () => {
  it('returns 401 when user is not authenticated', async () => {
    const errorResponse = Response.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: errorResponse,
    });

    const response = await GET();
    expect(response.status).toBe(401);
    const data = await parseResponse(response);
    expect(data.error).toBe('Authentication required');
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = Response.json(
      { ok: false, error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const response = await GET();
    expect(response.status).toBe(429);
  });

  it('returns tickets for authenticated user (happy path)', async () => {
    const mockTickets = [
      {
        id: 'ticket-1',
        category: 'general',
        subject: 'Test ticket',
        message: 'Test message here with enough characters',
        status: 'open',
        is_read: false,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        resolved_at: null,
      },
    ];

    // Setup supabase mock chain for tickets query
    const mockIn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [{ ticket_id: 'ticket-1' }], error: null }),
    });
    const mockOrderFn = vi.fn().mockResolvedValue({ data: mockTickets, error: null });
    const mockEqTickets = vi.fn().mockReturnValue({ order: mockOrderFn });
    const mockSelectTickets = vi.fn().mockReturnValue({ eq: mockEqTickets });
    const mockSelectReplies = vi.fn().mockReturnValue({
      in: mockIn,
    });

    let _callCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return { select: mockSelectTickets };
      }
      if (table === 'support_replies') {
        return { select: mockSelectReplies };
      }
      // rate_limits or other
      _callCount++;
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({}),
      };
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await parseResponse(response);
    expect(data.ok).toBe(true);
    expect(data.data.tickets).toHaveLength(1);
    expect(data.data.tickets[0].id).toBe('ticket-1');
    expect(data.data.tickets[0].reply_count).toBe(1);
  });

  it('returns empty array when user has no tickets', async () => {
    const mockOrderFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqTickets = vi.fn().mockReturnValue({ order: mockOrderFn });
    const mockSelectTickets = vi.fn().mockReturnValue({ eq: mockEqTickets });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return { select: mockSelectTickets };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ gte: vi.fn().mockResolvedValue({ count: 0 }) }),
        }),
        insert: vi.fn().mockResolvedValue({}),
      };
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await parseResponse(response);
    expect(data.ok).toBe(true);
    expect(data.data.tickets).toEqual([]);
  });

  it('returns 500 when database query fails', async () => {
    const mockOrderFn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });
    const mockEqTickets = vi.fn().mockReturnValue({ order: mockOrderFn });
    const mockSelectTickets = vi.fn().mockReturnValue({ eq: mockEqTickets });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return { select: mockSelectTickets };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ gte: vi.fn().mockResolvedValue({ count: 0 }) }),
        }),
      };
    });

    const response = await GET();
    expect(response.status).toBe(500);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
  });

  it('handles unexpected errors gracefully', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unexpected auth failure'));

    const response = await GET();
    expect(response.status).toBe(500);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
  });
});

// =============================================================================
// TESTS: POST /api/support/tickets
// =============================================================================

describe('POST /api/support/tickets', () => {
  it('returns CSRF error when CSRF validation fails', async () => {
    const csrfResponse = Response.json(
      { ok: false, error: 'CSRF validation failed', code: 'CSRF_VALIDATION_FAILED' },
      { status: 403 }
    );
    mockValidateCSRF.mockReturnValue({ valid: false, response: csrfResponse });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns validation error for missing required fields', async () => {
    const request = createRequest('POST', {});
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
    expect(data.code).toBe('INVALID_INPUT');
  });

  it('returns validation error for subject too short', async () => {
    const request = createRequest('POST', validTicketBody({ subject: 'Hi' }));
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
  });

  it('returns validation error for message too short', async () => {
    const request = createRequest('POST', validTicketBody({ message: 'Short' }));
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns validation error for invalid category', async () => {
    const request = createRequest('POST', validTicketBody({ category: 'invalid_category' }));
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns validation error for subject too long (>200 chars)', async () => {
    const request = createRequest('POST', validTicketBody({ subject: 'A'.repeat(201) }));
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('silently accepts honeypot submissions without creating ticket', async () => {
    const request = createRequest('POST', validTicketBody({ honeypot: 'bot-filled-this' }));
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseResponse(response);
    expect(data.ok).toBe(true);
    expect(data.data.ticketId).toBe('fake');
    // Verify no insert was called on support_tickets
    expect(mockSupabaseFrom).not.toHaveBeenCalledWith('support_tickets');
  });

  it('creates ticket for authenticated user (happy path)', async () => {
    // Setup mock chain for authenticated user flow
    const mockInsertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ticket-789', created_at: '2026-03-05T00:00:00Z' },
        error: null,
      }),
    });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });
    const mockSingleUser = vi.fn().mockResolvedValue({
      data: { full_name: 'Test User' },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleUser });
    const mockSelectUser = vi.fn().mockReturnValue({ eq: mockEqUser });

    const mockGte = vi.fn().mockResolvedValue({ count: 0 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
    const mockInsertRate = vi.fn().mockResolvedValue({});

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: mockSelectUser };
      }
      if (table === 'support_tickets') {
        return { insert: mockInsert };
      }
      if (table === 'rate_limits') {
        return { select: mockSelectRate, insert: mockInsertRate };
      }
      return {};
    });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseResponse(response);
    expect(data.ok).toBe(true);
    expect(data.data.ticketId).toBe('ticket-789');
    expect(data.data.message).toContain('received');
  });

  it('creates ticket for external (unauthenticated) user with email', async () => {
    // No authenticated user
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    const mockInsertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ticket-ext-1', created_at: '2026-03-05T00:00:00Z' },
        error: null,
      }),
    });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });

    const mockGte = vi.fn().mockResolvedValue({ count: 0 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
    const mockInsertRate = vi.fn().mockResolvedValue({});

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'support_tickets') {
        return { insert: mockInsert };
      }
      if (table === 'rate_limits') {
        return { select: mockSelectRate, insert: mockInsertRate };
      }
      return {};
    });

    const request = createRequest(
      'POST',
      validTicketBody({
        senderEmail: 'external@example.com',
        senderName: 'External User',
      })
    );
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseResponse(response);
    expect(data.ok).toBe(true);
    expect(data.data.ticketId).toBe('ticket-ext-1');
  });

  it('returns 400 for external user without email', async () => {
    // No authenticated user
    mockAuthGetUser.mockResolvedValue({ data: { user: null } });

    // Rate limits pass
    const mockGte = vi.fn().mockResolvedValue({ count: 0 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
    const mockInsertRate = vi.fn().mockResolvedValue({});

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'rate_limits') {
        return { select: mockSelectRate, insert: mockInsertRate };
      }
      return {};
    });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Email is required');
  });

  it('returns 429 when request rate limit is exceeded (authenticated)', async () => {
    const rateLimitResponse = Response.json(
      { ok: false, error: 'Too many requests', code: 'RATE_LIMITED' },
      { status: 429 }
    );
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('returns 429 when database rate limit is exceeded', async () => {
    // Redis rate limit passes
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // DB rate limit fails (count >= 3)
    const mockGte = vi.fn().mockResolvedValue({ count: 3 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });

    const mockSingleUser = vi.fn().mockResolvedValue({
      data: { full_name: 'Test User' },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleUser });
    const mockSelectUser = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: mockSelectUser };
      }
      if (table === 'rate_limits') {
        return { select: mockSelectRate };
      }
      return {};
    });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('returns 500 when database insert fails', async () => {
    const mockInsertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database insert error' },
      }),
    });
    const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });
    const mockSingleUser = vi.fn().mockResolvedValue({
      data: { full_name: 'Test User' },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleUser });
    const mockSelectUser = vi.fn().mockReturnValue({ eq: mockEqUser });

    const mockGte = vi.fn().mockResolvedValue({ count: 0 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
    const mockInsertRate = vi.fn().mockResolvedValue({});

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: mockSelectUser };
      }
      if (table === 'support_tickets') {
        return { insert: mockInsert };
      }
      if (table === 'rate_limits') {
        return { select: mockSelectRate, insert: mockInsertRate };
      }
      return {};
    });

    const request = createRequest('POST', validTicketBody());
    const response = await POST(request);
    expect(response.status).toBe(500);
    const data = await parseResponse(response);
    expect(data.ok).toBe(false);
  });

  it('sanitizes HTML tags from subject and message', async () => {
    const mockInsertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'ticket-sanitized', created_at: '2026-03-05T00:00:00Z' },
        error: null,
      }),
    });
    const mockInsertFn = vi.fn().mockReturnValue({ select: mockInsertSelect });
    const mockSingleUser = vi.fn().mockResolvedValue({
      data: { full_name: 'Test User' },
      error: null,
    });
    const mockEqUser = vi.fn().mockReturnValue({ single: mockSingleUser });
    const mockSelectUser = vi.fn().mockReturnValue({ eq: mockEqUser });

    const mockGte = vi.fn().mockResolvedValue({ count: 0 });
    const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
    const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
    const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
    const mockInsertRate = vi.fn().mockResolvedValue({});

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return { select: mockSelectUser };
      }
      if (table === 'support_tickets') {
        return { insert: mockInsertFn };
      }
      if (table === 'rate_limits') {
        return { select: mockSelectRate, insert: mockInsertRate };
      }
      return {};
    });

    const request = createRequest(
      'POST',
      validTicketBody({
        subject: 'Test <script>alert("xss")</script> subject',
        message:
          'This is a <b>bold</b> message with <script>evil()</script> script tags in the text',
      })
    );
    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify the insert was called with sanitized data
    const insertCall = mockInsertFn.mock.calls[0][0];
    expect(insertCall.subject).not.toContain('<script>');
    expect(insertCall.subject).not.toContain('<b>');
    expect(insertCall.message).not.toContain('<script>');
    expect(insertCall.message).not.toContain('<b>');
  });

  it('handles unexpected errors gracefully in POST', async () => {
    // Force an error by making validateBody throw
    mockValidateCSRF.mockReturnValue({ valid: true });

    const request = new NextRequest('http://localhost:3000/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    });

    const response = await POST(request);
    // Should return 400 for invalid JSON
    expect(response.status).toBe(400);
  });

  it('accepts all valid categories', async () => {
    const validCategories = [
      'general',
      'technical_support',
      'bug_report',
      'feature_request',
      'billing',
      'content_moderation',
      'account_issue',
      'partnership',
      'feedback',
      'other',
    ];

    for (const category of validCategories) {
      vi.clearAllMocks();
      mockValidateCSRF.mockReturnValue({ valid: true });
      mockAuthGetUser.mockResolvedValue({ data: { user: null } });
      mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

      const mockInsertSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: `ticket-${category}`, created_at: '2026-03-05T00:00:00Z' },
          error: null,
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect });
      const mockGte = vi.fn().mockResolvedValue({ count: 0 });
      const mockEqRateAction = vi.fn().mockReturnValue({ gte: mockGte });
      const mockEqRateId = vi.fn().mockReturnValue({ eq: mockEqRateAction });
      const mockSelectRate = vi.fn().mockReturnValue({ eq: mockEqRateId });
      const mockInsertRate = vi.fn().mockResolvedValue({});

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'support_tickets') return { insert: mockInsert };
        if (table === 'rate_limits') return { select: mockSelectRate, insert: mockInsertRate };
        return {};
      });

      const request = createRequest(
        'POST',
        validTicketBody({
          category,
          senderEmail: 'test@example.com',
        })
      );
      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });
});
