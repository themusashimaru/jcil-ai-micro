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

vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

// Import after mocks
const { GET, PATCH, DELETE } = await import('../route');

// ========================================
// HELPERS
// ========================================

const SESSION_ID = 'session-001';
const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

function createGetRequest() {
  return new NextRequest(`http://localhost/api/code-lab/sessions/${SESSION_ID}`, {
    method: 'GET',
  });
}

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/code-lab/sessions/${SESSION_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest() {
  return new NextRequest(`http://localhost/api/code-lab/sessions/${SESSION_ID}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

const mockSession = {
  id: SESSION_ID,
  title: 'Test Session',
  created_at: '2026-03-17T00:00:00Z',
  updated_at: '2026-03-17T01:00:00Z',
  repo_owner: 'testowner',
  repo_name: 'testrepo',
  repo_branch: 'main',
  message_count: 5,
  has_summary: false,
  lines_added: 10,
  lines_removed: 3,
  files_changed: 2,
};

function mock401() {
  return new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
    status: 401,
  });
}

// ========================================
// TESTS
// ========================================

describe('GET /api/code-lab/sessions/[sessionId]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when session not found', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Session not found');
  });

  it('returns formatted session object', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: mockSession,
      error: null,
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session).toMatchObject({
      id: SESSION_ID,
      title: 'Test Session',
      createdAt: mockSession.created_at,
      updatedAt: mockSession.updated_at,
      repo: {
        owner: 'testowner',
        name: 'testrepo',
        branch: 'main',
        fullName: 'testowner/testrepo',
      },
      isActive: true,
      messageCount: 5,
      hasSummary: false,
      linesAdded: 10,
      linesRemoved: 3,
      filesChanged: 2,
    });
  });

  it('returns null repo when repo_owner is not set', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: { ...mockSession, repo_owner: null, repo_name: null, repo_branch: null },
      error: null,
    });

    const res = await GET(createGetRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.repo).toBeNull();
  });
});

describe('PATCH /api/code-lab/sessions/[sessionId]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await PATCH(createPatchRequest({ title: 'New Title' }), makeParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('updates title successfully', async () => {
    const updatedSession = { ...mockSession, title: 'Updated Title' };
    mockSupabase._chain.single.mockResolvedValue({
      data: updatedSession,
      error: null,
    });

    const res = await PATCH(createPatchRequest({ title: 'Updated Title' }), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.session.title).toBe('Updated Title');

    // Verify supabase was called with update
    expect(mockSupabase.from).toHaveBeenCalledWith('code_lab_sessions');
    expect(mockSupabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title' })
    );
  });

  it('sets repo fields', async () => {
    const updatedSession = {
      ...mockSession,
      repo_owner: 'newowner',
      repo_name: 'newrepo',
      repo_branch: 'develop',
    };
    mockSupabase._chain.single.mockResolvedValue({
      data: updatedSession,
      error: null,
    });

    const res = await PATCH(
      createPatchRequest({
        repo: { owner: 'newowner', name: 'newrepo', branch: 'develop' },
      }),
      makeParams(SESSION_ID)
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.repo).toMatchObject({
      owner: 'newowner',
      name: 'newrepo',
      branch: 'develop',
      fullName: 'newowner/newrepo',
    });

    expect(mockSupabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_owner: 'newowner',
        repo_name: 'newrepo',
        repo_branch: 'develop',
      })
    );
  });

  it('clears repo when null', async () => {
    const updatedSession = {
      ...mockSession,
      repo_owner: null,
      repo_name: null,
      repo_branch: null,
    };
    mockSupabase._chain.single.mockResolvedValue({
      data: updatedSession,
      error: null,
    });

    const res = await PATCH(createPatchRequest({ repo: null }), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.session.repo).toBeNull();

    expect(mockSupabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_owner: null,
        repo_name: null,
        repo_branch: null,
      })
    );
  });

  it('returns 500 when update fails', async () => {
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const res = await PATCH(createPatchRequest({ title: 'New' }), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.ok).toBe(false);
  });
});

describe('DELETE /api/code-lab/sessions/[sessionId]', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await DELETE(createDeleteRequest(), makeParams(SESSION_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when session not found (ownership check fails)', async () => {
    // First call: ownership verification returns no session
    mockSupabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    const res = await DELETE(createDeleteRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain('Session not found');
  });

  it('deletes messages then session successfully', async () => {
    // Track call order to verify messages deleted before session
    const callOrder: string[] = [];

    // Ownership verification succeeds
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: { id: SESSION_ID },
      error: null,
    });

    // Messages delete succeeds
    mockSupabase._chain.delete.mockImplementation(function (this: unknown) {
      return {
        eq: vi.fn().mockImplementation((_col: string, _val: string) => {
          callOrder.push('delete_messages');
          return { error: null };
        }),
      };
    });

    // Override from to track table access while still chaining
    const originalFrom = mockSupabase.from;
    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // First from: ownership check (code_lab_sessions)
        return originalFrom(table);
      } else if (fromCallCount === 2) {
        // Second from: delete messages (code_lab_messages)
        callOrder.push('from_messages');
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      } else {
        // Third from: delete session (code_lab_sessions)
        callOrder.push('from_session_delete');
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
    });

    const res = await DELETE(createDeleteRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.success).toBe(true);

    // Verify messages were deleted before session
    expect(callOrder.indexOf('from_messages')).toBeLessThan(
      callOrder.indexOf('from_session_delete')
    );
  });

  it('returns 500 when message deletion fails', async () => {
    // Ownership verification succeeds
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: { id: SESSION_ID },
      error: null,
    });

    let fromCallCount = 0;
    mockSupabase.from = vi.fn().mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // Ownership check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SESSION_ID }, error: null }),
              }),
            }),
          }),
        };
      } else {
        // Messages delete fails
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
          }),
        };
      }
    });

    const res = await DELETE(createDeleteRequest(), makeParams(SESSION_ID));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.ok).toBe(false);
  });
});
