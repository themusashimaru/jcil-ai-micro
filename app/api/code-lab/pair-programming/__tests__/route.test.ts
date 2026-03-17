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

const mockRateLimiters = {
  codeLabEdit: vi.fn().mockResolvedValue({ allowed: true }),
};
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: mockRateLimiters,
}));

vi.mock('@/lib/api/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/utils')>('@/lib/api/utils');
  return {
    ...actual,
    checkRequestRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

const mockOnEdit = vi.fn();
const mockOnFileOpen = vi.fn();
const mockGetCompletion = vi.fn();
vi.mock('@/lib/pair-programmer', () => ({
  getPairProgrammer: () => ({
    onEdit: mockOnEdit,
    onFileOpen: mockOnFileOpen,
    getCompletion: mockGetCompletion,
  }),
  CodeEdit: {},
  PairProgrammerContext: {},
  PairProgrammerSuggestion: {},
}));

// Import after mocks
const { GET, POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

const USER_ID = 'user-123';

function createPostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/code-lab/pair-programming', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
    body: JSON.stringify(body),
  });
}

function mock401() {
  return new Response(JSON.stringify({ ok: false, error: 'Authentication required' }), {
    status: 401,
  });
}

const mockContext = {
  currentFile: 'src/index.ts',
  code: 'const x = 1;',
  language: 'typescript',
  cursorLine: 1,
  cursorColumn: 0,
};

const mockEdit = {
  startLine: 1,
  endLine: 1,
  newText: 'const y = 2;',
};

const mockSuggestion = {
  type: 'completion',
  content: 'Consider adding a type annotation here',
  reasoning: 'Type annotations improve code clarity and help catch errors at compile time.',
  confidence: 0.85,
  code: 'const x: number = 1;',
  insertAt: { line: 1, column: 0 },
  replaceRange: undefined,
};

// ========================================
// TESTS
// ========================================

describe('GET /api/code-lab/pair-programming', () => {
  it('returns capabilities', async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.status).toBe('active');
    expect(data.capabilities).toEqual(['edit', 'open', 'complete', 'analyze']);
    expect(data.rateLimit).toMatchObject({
      limit: 60,
      window: '1 minute',
    });
  });
});

describe('POST /api/code-lab/pair-programming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: { id: USER_ID, email: 'test@example.com' },
      supabase: { from: vi.fn() },
    });
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue({ authorized: false, response: mock401() });

    const res = await POST(
      createPostRequest({ action: 'edit', edit: mockEdit, context: mockContext })
    );
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockRateLimiters.codeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const res = await POST(
      createPostRequest({ action: 'edit', edit: mockEdit, context: mockContext })
    );
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.ok).toBe(false);
  });

  it('returns 400 when action is missing', async () => {
    const res = await POST(createPostRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Missing action');
  });

  it('returns 400 for unknown action', async () => {
    const res = await POST(createPostRequest({ action: 'unknown' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toContain('Unknown action');
  });

  it('returns suggestions for edit action', async () => {
    mockOnEdit.mockResolvedValue([mockSuggestion]);

    const res = await POST(
      createPostRequest({ action: 'edit', edit: mockEdit, context: mockContext })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(1);
    expect(data.suggestions[0]).toMatchObject({
      type: 'completion',
      title: expect.any(String),
      description: expect.any(String),
      code: 'const x: number = 1;',
      confidence: 0.85,
    });
    expect(data.timestamp).toBeDefined();
    expect(mockOnEdit).toHaveBeenCalledWith(mockEdit, mockContext);
  });

  it('returns 400 for edit action without edit or context', async () => {
    const res = await POST(createPostRequest({ action: 'edit' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Missing edit or context');
  });

  it('returns suggestions for open action', async () => {
    mockOnFileOpen.mockResolvedValue([mockSuggestion]);

    const res = await POST(createPostRequest({ action: 'open', context: mockContext }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.suggestions).toHaveLength(1);
    expect(mockOnFileOpen).toHaveBeenCalledWith(mockContext);
  });

  it('returns 400 for open action without context', async () => {
    const res = await POST(createPostRequest({ action: 'open' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Missing context');
  });

  it('returns completion for complete action', async () => {
    const mockCompletion = { text: 'const y = 2;', confidence: 0.9 };
    mockGetCompletion.mockResolvedValue(mockCompletion);

    const res = await POST(createPostRequest({ action: 'complete', context: mockContext }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.completion).toMatchObject(mockCompletion);
    expect(mockGetCompletion).toHaveBeenCalledWith(mockContext, 'automatic');
  });

  it('returns suggestions for analyze action', async () => {
    mockOnFileOpen.mockResolvedValue([mockSuggestion]);

    const res = await POST(createPostRequest({ action: 'analyze', context: mockContext }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.suggestions).toHaveLength(1);
    expect(mockOnFileOpen).toHaveBeenCalledWith(mockContext);
  });

  it('handles missing code gracefully (empty suggestions)', async () => {
    mockOnEdit.mockResolvedValue([]);

    const res = await POST(
      createPostRequest({
        action: 'edit',
        edit: { startLine: 1, endLine: 1, newText: '' },
        context: { ...mockContext, code: '' },
      })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.suggestions).toEqual([]);
  });

  it('maps suggestion types correctly', async () => {
    const bugSuggestion = {
      ...mockSuggestion,
      type: 'fix',
      confidence: 0.95,
    };
    mockOnEdit.mockResolvedValue([bugSuggestion]);

    const res = await POST(
      createPostRequest({ action: 'edit', edit: mockEdit, context: mockContext })
    );
    const data = await res.json();

    expect(data.suggestions[0].type).toBe('bug');
    expect(data.suggestions[0].priority).toBe('critical');
  });
});
