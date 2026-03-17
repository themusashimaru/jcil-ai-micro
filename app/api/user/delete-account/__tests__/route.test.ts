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

// Mock auth
const mockUser = { id: 'user-123', email: 'test@example.com' };
const mockSignOut = vi.fn().mockResolvedValue({});
const mockSupabaseFrom = vi.fn();
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
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

// Mock audit
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockGetAuditContext = vi.fn().mockReturnValue({
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
});
vi.mock('@/lib/audit', () => ({
  auditLog: (...args: unknown[]) => mockAuditLog(...args),
  getAuditContext: (...args: unknown[]) => mockGetAuditContext(...args),
}));

// Mock Supabase admin client
const mockAdminFrom = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => mockAdminFrom(...args),
  }),
}));

// Set env vars before import
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// Import after mocks
const { DELETE, GET } = await import('../route');

function createDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/user/delete-account', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

describe('DELETE /api/user/delete-account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: {
        from: mockSupabaseFrom,
        auth: { signOut: mockSignOut },
      },
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });

    // Default admin client mock: all operations succeed
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'conv-1' }, { id: 'conv-2' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (
        table === 'user_passkeys' ||
        table === 'user_document_chunks' ||
        table === 'user_documents'
      ) {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'users') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const request = createDeleteRequest();
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(
      JSON.stringify({ ok: false, error: 'Too many requests' }),
      { status: 429 }
    );
    mockCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      response: rateLimitResponse,
    });

    const request = createDeleteRequest();
    const response = await DELETE(request);
    expect(response.status).toBe(429);
  });

  it('soft-deletes user data and returns schedule', async () => {
    const request = createDeleteRequest();
    const response = await DELETE(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
    expect(json.message).toBe('Your account has been scheduled for deletion.');
    expect(json.details.recoveryPeriodDays).toBe(30);
    expect(json.details.softDeletedAt).toBeDefined();
    expect(json.details.permanentDeletionAt).toBeDefined();

    // Verify signOut was called with global scope
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });

    // Verify audit log was created
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.delete_account',
        resourceType: 'user',
        resourceId: 'user-123',
        userId: 'user-123',
        status: 'success',
      })
    );
  });

  it('returns scheduled purge date approximately 30 days out', async () => {
    const beforeRequest = Date.now();
    const request = createDeleteRequest();
    const response = await DELETE(request);
    const json = await response.json();
    const afterRequest = Date.now();

    const purgeDate = new Date(json.details.permanentDeletionAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Purge date should be approximately 30 days from now
    expect(purgeDate).toBeGreaterThanOrEqual(beforeRequest + thirtyDaysMs - 1000);
    expect(purgeDate).toBeLessThanOrEqual(afterRequest + thirtyDaysMs + 1000);
  });

  it('returns 500 when user update fails', async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (
        table === 'user_passkeys' ||
        table === 'user_document_chunks' ||
        table === 'user_documents'
      ) {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'users') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'Database error' },
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const request = createDeleteRequest();
    const response = await DELETE(request);
    expect(response.status).toBe(500);
  });
});

describe('GET /api/user/delete-account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: {
        from: mockSupabaseFrom,
        auth: { signOut: mockSignOut },
      },
    });
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: unauthorizedResponse,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns active status for non-deleted user', async () => {
    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { deleted_at: null, scheduled_purge_at: null },
            error: null,
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe('active');
    expect(json.deletionScheduled).toBe(false);
  });

  it('returns pending_deletion status for deleted user', async () => {
    const deletedAt = '2026-03-01T00:00:00Z';
    const purgeAt = '2026-03-31T00:00:00Z';

    mockAdminFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { deleted_at: deletedAt, scheduled_purge_at: purgeAt },
            error: null,
          }),
        }),
      }),
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe('pending_deletion');
    expect(json.deletedAt).toBe(deletedAt);
    expect(json.permanentDeletionAt).toBe(purgeAt);
    expect(json.canRecover).toBe(true);
  });
});
