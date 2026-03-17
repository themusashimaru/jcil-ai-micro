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
const { GET, POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function createMockSupabase() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue(chainable),
    _chain: chainable,
  };
}

async function mockAuth(authorized: boolean, supabase?: ReturnType<typeof createMockSupabase>) {
  if (authorized) {
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID },
      supabase: supabase || createMockSupabase(),
    });
  } else {
    const { NextResponse } = await import('next/server');
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 }),
    });
  }
}

function createPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/folders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

// ========================================
// TESTS: GET /api/folders
// ========================================

describe('GET /api/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    await mockAuth(false);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('returns empty folders list', async () => {
    const supabase = createMockSupabase();
    supabase._chain.order.mockReturnValue({
      ...supabase._chain,
      data: [],
      error: null,
    });
    // Override the select -> eq -> order chain to resolve with data
    supabase._chain.order.mockResolvedValue({ data: [], error: null });

    await mockAuth(true, supabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.folders).toEqual([]);
    expect(json.maxFolders).toBe(20);
    expect(json.availableColors).toBeDefined();
    expect(Array.isArray(json.availableColors)).toBe(true);
  });

  it('returns folders with maxFolders and availableColors', async () => {
    const mockFolders = [
      { id: '1', name: 'Work', position: 0, color: '#ef4444' },
      { id: '2', name: 'Personal', position: 1, color: '#3b82f6' },
    ];

    const supabase = createMockSupabase();
    supabase._chain.order.mockResolvedValue({ data: mockFolders, error: null });

    await mockAuth(true, supabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.folders).toEqual(mockFolders);
    expect(json.maxFolders).toBe(20);
    expect(json.availableColors).toHaveLength(9);
  });

  it('returns 500 on database error', async () => {
    const supabase = createMockSupabase();
    supabase._chain.order.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    await mockAuth(true, supabase);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});

// ========================================
// TESTS: POST /api/folders
// ========================================

describe('POST /api/folders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    await mockAuth(false);

    const request = createPostRequest({ name: 'Test' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('returns 400 for missing name', async () => {
    const supabase = createMockSupabase();
    await mockAuth(true, supabase);

    const request = createPostRequest({});
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Folder name is required');
  });

  it('returns 400 for empty name', async () => {
    const supabase = createMockSupabase();
    await mockAuth(true, supabase);

    const request = createPostRequest({ name: '   ' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Folder name is required');
  });

  it('returns 400 for name exceeding 50 characters', async () => {
    const supabase = createMockSupabase();
    await mockAuth(true, supabase);

    const request = createPostRequest({ name: 'A'.repeat(51) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('50 characters or less');
  });

  it('returns 400 when at folder limit', async () => {
    const supabase = createMockSupabase();
    // The select call with count returns { count: 20 }
    supabase._chain.eq.mockResolvedValue({ count: 20, error: null });

    await mockAuth(true, supabase);

    const request = createPostRequest({ name: 'New Folder' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Maximum 20 folders allowed');
  });

  it('returns 400 for duplicate folder name', async () => {
    const supabase = createMockSupabase();

    // First from() call: count check
    // Second from() call: get last position
    // Third from() call: insert
    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Count check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }
      if (callCount === 2) {
        // Get last position
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { position: 4 }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      // Insert
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value' },
            }),
          }),
        }),
      };
    });

    await mockAuth(true, supabase);

    const request = createPostRequest({ name: 'Existing Folder' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('already exists');
  });

  it('creates folder successfully', async () => {
    const mockFolder = { id: 'folder-1', name: 'New Folder', position: 0, color: null };
    const supabase = createMockSupabase();

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockFolder, error: null }),
          }),
        }),
      };
    });

    await mockAuth(true, supabase);

    const request = createPostRequest({ name: 'New Folder' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.folder).toEqual(mockFolder);
  });

  it('sets correct position for new folder when folders exist', async () => {
    const supabase = createMockSupabase();

    let callCount = 0;
    let insertedData: Record<string, unknown> | null = null;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        };
      }
      if (callCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { position: 5 }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          insertedData = data;
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'folder-new', ...data },
                error: null,
              }),
            }),
          };
        }),
      };
    });

    await mockAuth(true, supabase);

    const request = createPostRequest({ name: 'Next Folder' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(insertedData).not.toBeNull();
    expect((insertedData as unknown as Record<string, unknown>).position).toBe(6);
    expect(json.ok).toBe(true);
  });
});
