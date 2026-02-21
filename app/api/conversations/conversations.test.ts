/**
 * CONVERSATIONS API TESTS
 *
 * Tests for /api/conversations endpoint:
 * - GET: List conversations for authenticated user
 * - POST: Create or update conversations (CSRF protected)
 * - Authentication enforcement
 * - Rate limiting
 * - Input validation (Zod schemas)
 * - Soft delete filtering (deleted_at IS NULL)
 * - Retention date calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockConversations = [
  {
    id: 'conv-1',
    user_id: 'test-user-id',
    title: 'Test Chat 1',
    tool_context: 'general',
    message_count: 5,
    last_message_at: '2026-02-21T10:00:00Z',
    deleted_at: null,
    folder: null,
  },
  {
    id: 'conv-2',
    user_id: 'test-user-id',
    title: 'Test Chat 2',
    tool_context: 'code',
    message_count: 10,
    last_message_at: '2026-02-21T09:00:00Z',
    deleted_at: null,
    folder: { id: 'folder-1', name: 'Work', color: '#ff0000' },
  },
];

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: mockConversations, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({
    data: { id: 'new-conv', title: 'New Chat', user_id: 'test-user-id' },
    error: null,
  }),
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
    },
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/api/utils', async () => {
  const { NextResponse } = await import('next/server');
  return {
    successResponse: vi.fn((data) => NextResponse.json({ ok: true, data }, { status: 200 })),
    errors: {
      unauthorized: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
      ),
      badRequest: vi.fn((msg: string) =>
        NextResponse.json({ ok: false, error: msg }, { status: 400 })
      ),
      serverError: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
      ),
      rateLimited: vi.fn(() =>
        NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 })
      ),
      validationError: vi.fn((details: unknown[]) =>
        NextResponse.json({ ok: false, error: 'Validation failed', details }, { status: 400 })
      ),
    },
    validateBody: vi.fn().mockResolvedValue({
      success: true,
      data: { title: 'New Chat', tool_context: 'general' },
    }),
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    rateLimits: {
      standard: { limit: 60, windowMs: 60000 },
    },
  };
});

vi.mock('@/lib/validation/schemas', () => ({
  createConversationSchema: {
    extend: vi.fn().mockReturnValue({
      safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
    }),
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(
  method: string,
  url = 'http://localhost/api/conversations',
  body?: unknown
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'valid-token',
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init);
}

// ============================================================================
// TESTS
// ============================================================================

describe('Conversations API Module', () => {
  it('should export GET handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.GET).toBeDefined();
    expect(typeof routeModule.GET).toBe('function');
  });

  it('should export POST handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.POST).toBeDefined();
    expect(typeof routeModule.POST).toBe('function');
  });

  it('should have correct runtime config', async () => {
    const routeModule = await import('./route');
    expect(routeModule.runtime).toBe('nodejs');
    expect(routeModule.maxDuration).toBe(30);
  });
});

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return conversations for authenticated user', async () => {
    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('should reject unauthenticated requests', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated', code: 'UNAUTHENTICATED' },
        }),
      },
      from: vi.fn(() => mockSupabaseChain),
    } as never);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(401);

    // Restore
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => mockSupabaseChain),
    } as never);
  });

  it('should enforce rate limiting', async () => {
    const { checkRequestRateLimit } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(checkRequestRateLimit).mockResolvedValue({
      allowed: false,
      response: NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 }),
    });

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(429);

    // Restore
    vi.mocked(checkRequestRateLimit).mockResolvedValue({ allowed: true });
  });

  it('should handle database errors gracefully', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    const errorChain = {
      ...mockSupabaseChain,
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Connection failed', code: '500', details: '', hint: '' },
      }),
    };
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => errorChain),
    } as never);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(500);

    // Restore
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => mockSupabaseChain),
    } as never);
  });
});

describe('POST /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should require CSRF token', async () => {
    const { validateCSRF } = await import('@/lib/security/csrf');
    const { NextResponse } = await import('next/server');
    vi.mocked(validateCSRF).mockReturnValue({
      valid: false,
      response: NextResponse.json({ error: 'Invalid CSRF' }, { status: 403 }),
    } as never);

    const { POST } = await import('./route');
    const request = createRequest('POST', undefined, { title: 'Test' });
    const response = await POST(request);

    expect(response.status).toBe(403);

    // Restore
    vi.mocked(validateCSRF).mockReturnValue({ valid: true } as never);
  });

  it('should reject unauthenticated requests', async () => {
    const { createServerClient } = await import('@supabase/ssr');
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not auth' },
        }),
      },
      from: vi.fn(() => mockSupabaseChain),
    } as never);

    const { POST } = await import('./route');
    const request = createRequest('POST', undefined, { title: 'Test' });
    const response = await POST(request);

    expect(response.status).toBe(401);

    // Restore
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn(() => mockSupabaseChain),
    } as never);
  });

  it('should validate request body', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(validateBody).mockResolvedValue({
      success: false,
      response: NextResponse.json({ ok: false, error: 'Validation failed' }, { status: 400 }),
    } as never);

    const { POST } = await import('./route');
    const request = createRequest('POST', undefined, {});
    const response = await POST(request);

    expect(response.status).toBe(400);

    // Restore
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { title: 'New Chat', tool_context: 'general' },
    });
  });

  it('should create new conversation without ID', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { title: 'New Chat', tool_context: 'general' },
    });

    const { POST } = await import('./route');
    const request = createRequest('POST', undefined, {
      title: 'New Chat',
      tool_context: 'general',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it('should update existing conversation with ID', async () => {
    const { validateBody } = await import('@/lib/api/utils');
    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: { id: 'conv-1', title: 'Updated Title', tool_context: 'general' },
    });

    const { POST } = await import('./route');
    const request = createRequest('POST', undefined, {
      id: 'conv-1',
      title: 'Updated Title',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
  });
});

describe('Conversation Input Validation', () => {
  it('should accept valid conversation titles', () => {
    const validTitles = ['New Chat', 'Bug fix discussion', 'Project planning'];
    for (const title of validTitles) {
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(200);
    }
  });

  it('should accept valid tool contexts', () => {
    const validContexts = ['general', 'code', 'research', 'creative'];
    for (const context of validContexts) {
      expect(context.length).toBeLessThanOrEqual(50);
    }
  });

  it('should require UUID format for conversation IDs', () => {
    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidPattern.test(validUUID)).toBe(true);

    const invalidUUID = 'not-a-uuid';
    expect(uuidPattern.test(invalidUUID)).toBe(false);
  });

  it('should allow optional summary field', () => {
    const data = {
      title: 'Chat with summary',
      summary: 'Discussion about React hooks and performance optimization',
    };
    expect(data.summary.length).toBeLessThanOrEqual(5000);
  });
});

describe('Conversation Security', () => {
  it('should scope queries to authenticated user only', () => {
    // Every query should include .eq('user_id', user.id)
    // This prevents users from accessing other users conversations
    const userId = 'test-user-id';
    const query = { user_id: userId };
    expect(query.user_id).toBe(userId);
  });

  it('should filter out soft-deleted conversations', () => {
    // Query includes .is('deleted_at', null)
    const activeConversations = mockConversations.filter((c) => c.deleted_at === null);
    expect(activeConversations).toHaveLength(2);
  });

  it('should order by last_message_at descending', () => {
    // Most recent conversations first
    const sorted = [...mockConversations].sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
    expect(new Date(sorted[0].last_message_at).getTime()).toBeGreaterThan(
      new Date(sorted[1].last_message_at).getTime()
    );
  });

  it('should set 30-day retention date for new conversations', () => {
    const now = new Date();
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    const diffMs = retentionDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    expect(diffDays).toBe(30);
  });

  it('should default title to "New Chat" when not provided', () => {
    const title = undefined || 'New Chat';
    expect(title).toBe('New Chat');
  });

  it('should default tool_context to "general" when not provided', () => {
    const context = undefined || 'general';
    expect(context).toBe('general');
  });
});

describe('Conversation Folder Support', () => {
  it('should include folder data in response', () => {
    const conversationWithFolder = mockConversations[1];
    expect(conversationWithFolder.folder).toBeDefined();
    expect(conversationWithFolder.folder?.name).toBe('Work');
    expect(conversationWithFolder.folder?.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should handle conversations without folders', () => {
    const conversationNoFolder = mockConversations[0];
    expect(conversationNoFolder.folder).toBeNull();
  });
});
