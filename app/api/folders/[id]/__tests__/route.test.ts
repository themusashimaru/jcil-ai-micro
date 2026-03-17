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

// Import after mocks
const { PATCH, DELETE } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';
const FOLDER_ID = 'folder-abc';

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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function mockAuth(authorized: boolean, supabase?: ReturnType<typeof createMockSupabase>) {
  if (authorized) {
    const sb = supabase || createMockSupabase();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID },
      supabase: sb,
    });
  } else {
    const { NextResponse } = await import('next/server');
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 }),
    });
  }
}

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/folders/${FOLDER_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest() {
  return new NextRequest(`http://localhost/api/folders/${FOLDER_ID}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

// ========================================
// TESTS: PATCH /api/folders/[id]
// ========================================

describe('PATCH /api/folders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    await mockAuth(false);

    const request = createPatchRequest({ name: 'Updated' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('returns 400 for empty name', async () => {
    const supabase = createMockSupabase();
    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: '   ' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('cannot be empty');
  });

  it('returns 400 for name exceeding 50 characters', async () => {
    const supabase = createMockSupabase();
    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: 'X'.repeat(51) });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('50 characters or less');
  });

  it('returns 400 for duplicate name (unique constraint)', async () => {
    const supabase = createMockSupabase();
    supabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });

    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: 'Duplicate' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('already exists');
  });

  it('returns 404 when folder not found', async () => {
    const supabase = createMockSupabase();
    supabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });

    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: 'Something' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toContain('not found');
  });

  it('updates folder name successfully', async () => {
    const updatedFolder = { id: FOLDER_ID, name: 'Updated Name', color: '#ef4444', position: 0 };
    const supabase = createMockSupabase();
    supabase._chain.single.mockResolvedValue({ data: updatedFolder, error: null });

    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: 'Updated Name' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.folder).toEqual(updatedFolder);
  });

  it('updates color and position', async () => {
    const updatedFolder = { id: FOLDER_ID, name: 'Test', color: '#3b82f6', position: 3 };
    const supabase = createMockSupabase();
    supabase._chain.single.mockResolvedValue({ data: updatedFolder, error: null });

    await mockAuth(true, supabase);

    const request = createPatchRequest({ color: '#3b82f6', position: 3 });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.folder.color).toBe('#3b82f6');
    expect(json.folder.position).toBe(3);
  });

  it('returns 500 on generic database error', async () => {
    const supabase = createMockSupabase();
    supabase._chain.single.mockResolvedValue({
      data: null,
      error: { code: '42000', message: 'syntax error' },
    });

    await mockAuth(true, supabase);

    const request = createPatchRequest({ name: 'Test' });
    const response = await PATCH(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});

// ========================================
// TESTS: DELETE /api/folders/[id]
// ========================================

describe('DELETE /api/folders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    await mockAuth(false);

    const request = createDeleteRequest();
    const response = await DELETE(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('deletes folder successfully', async () => {
    const supabase = createMockSupabase();
    // The chain is: delete() -> eq() -> eq() which resolves with { error }
    // The second eq() call needs to resolve (not return this)
    const secondEq = vi.fn().mockResolvedValue({ error: null });
    supabase._chain.delete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: secondEq,
      }),
    });

    await mockAuth(true, supabase);

    const request = createDeleteRequest();
    const response = await DELETE(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.success).toBe(true);
  });

  it('returns 500 on database error', async () => {
    const supabase = createMockSupabase();
    supabase._chain.delete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'foreign key violation' },
        }),
      }),
    });

    await mockAuth(true, supabase);

    const request = createDeleteRequest();
    const response = await DELETE(request, makeParams(FOLDER_ID));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});
