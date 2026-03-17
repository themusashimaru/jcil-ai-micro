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

// Mock Sentry (imported transitively via utils)
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock auth
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

// Import after mocks
const { PATCH } = await import('../route');

// ========================================
// HELPERS
// ========================================

const VALID_CONV_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_FOLDER_ID = '660e8400-e29b-41d4-a716-446655440001';
const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function createPatchRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost/api/conversations/${VALID_CONV_ID}/folder`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

// ========================================
// TESTS
// ========================================

describe('PATCH /api/conversations/[id]/folder', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    const mockResponse = new Response(
      JSON.stringify({ ok: false, error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const res = await PATCH(
      createPatchRequest({ folder_id: VALID_FOLDER_ID }),
      makeParams(VALID_CONV_ID)
    );
    expect(res.status).toBe(401);
  });

  it('passes request to requireUser for CSRF validation', async () => {
    // Set up folder lookup to succeed
    const folderChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: VALID_FOLDER_ID }, error: null }),
    };

    // Set up conversation update to succeed
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_CONV_ID, folder_id: VALID_FOLDER_ID },
        error: null,
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return folderChain;
      return updateChain;
    });

    const req = createPatchRequest({ folder_id: VALID_FOLDER_ID });
    await PATCH(req, makeParams(VALID_CONV_ID));

    expect(mockRequireUser).toHaveBeenCalledWith(req);
  });

  it('returns 429 when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const res = await PATCH(
      createPatchRequest({ folder_id: VALID_FOLDER_ID }),
      makeParams(VALID_CONV_ID)
    );
    expect(res.status).toBe(429);
  });

  it('returns 404 when folder not found', async () => {
    // Folder lookup fails
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await PATCH(
      createPatchRequest({ folder_id: VALID_FOLDER_ID }),
      makeParams(VALID_CONV_ID)
    );
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Folder');
  });

  it('returns 404 when conversation not found', async () => {
    // No folder_id provided, so folder lookup is skipped
    // Conversation update returns PGRST116
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await PATCH(createPatchRequest({ folder_id: null }), makeParams(VALID_CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Conversation');
  });

  it('successfully moves conversation to folder', async () => {
    // Folder lookup succeeds
    const folderChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: VALID_FOLDER_ID }, error: null }),
    };

    // Conversation update succeeds
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_CONV_ID, folder_id: VALID_FOLDER_ID },
        error: null,
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return folderChain;
      return updateChain;
    });

    const res = await PATCH(
      createPatchRequest({ folder_id: VALID_FOLDER_ID }),
      makeParams(VALID_CONV_ID)
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.conversation.folder_id).toBe(VALID_FOLDER_ID);
  });

  it('successfully removes conversation from folder (null folder_id)', async () => {
    // No folder lookup needed when folder_id is null/falsy
    // Conversation update succeeds
    mockSupabase._chain.single.mockResolvedValue({
      data: { id: VALID_CONV_ID, folder_id: null },
      error: null,
    });

    const res = await PATCH(createPatchRequest({ folder_id: null }), makeParams(VALID_CONV_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.conversation.folder_id).toBeNull();
  });

  it('verifies folder ownership before moving', async () => {
    // Folder lookup succeeds
    const folderChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: VALID_FOLDER_ID }, error: null }),
    };

    // Conversation update succeeds
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: VALID_CONV_ID, folder_id: VALID_FOLDER_ID },
        error: null,
      }),
    };

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) return folderChain;
      return updateChain;
    });

    await PATCH(createPatchRequest({ folder_id: VALID_FOLDER_ID }), makeParams(VALID_CONV_ID));

    // Verify it queried chat_folders with user_id
    expect(mockSupabase.from).toHaveBeenCalledWith('chat_folders');
    expect(folderChain.eq).toHaveBeenCalledWith('id', VALID_FOLDER_ID);
    expect(folderChain.eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('returns 500 on unexpected update error', async () => {
    // Conversation update fails with non-PGRST116 error
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'UNKNOWN', message: 'Database error' },
    });

    const res = await PATCH(createPatchRequest({ folder_id: null }), makeParams(VALID_CONV_ID));

    expect(res.status).toBe(500);
  });
});
