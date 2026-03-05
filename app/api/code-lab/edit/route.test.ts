// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock CSRF
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock auth
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock rate limiters
const mockCodeLabEdit = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimiters: {
    codeLabEdit: (...args: unknown[]) => mockCodeLabEdit(...args),
  },
}));

// Mock surgical edit
const mockSurgicalEdit = vi.fn();
const mockFormatDiffForDisplay = vi.fn();
const mockGenerateUnifiedDiff = vi.fn();
vi.mock('@/lib/workspace/surgical-edit', () => ({
  surgicalEdit: (...args: unknown[]) => mockSurgicalEdit(...args),
  formatDiffForDisplay: (...args: unknown[]) => mockFormatDiffForDisplay(...args),
  generateUnifiedDiff: (...args: unknown[]) => mockGenerateUnifiedDiff(...args),
}));

// Mock backup service
const mockGetBackup = vi.fn();
const mockListBackups = vi.fn();
const mockRestoreFromBackup = vi.fn();
vi.mock('@/lib/workspace/backup-service', () => ({
  getBackup: (...args: unknown[]) => mockGetBackup(...args),
  listBackups: (...args: unknown[]) => mockListBackups(...args),
  restoreFromBackup: (...args: unknown[]) => mockRestoreFromBackup(...args),
}));

// Mock container manager
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock('@/lib/workspace/container', () => ({
  getContainerManager: () => ({
    readFile: (...args: unknown[]) => mockReadFile(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  }),
}));

// Mock sanitize
vi.mock('@/lib/workspace/security', () => ({
  sanitizeFilePath: (p: string) => p,
}));

// Mock supabase
const mockSupabaseSingle = vi.fn();
const mockSupabaseFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: (...args: unknown[]) => mockSupabaseSingle(...args),
});
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  })),
}));

// Import after mocks
const { POST, GET, PUT } = await import('./route');

// ========================================
// HELPERS
// ========================================

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/code-lab/edit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/code-lab/edit');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url, { method: 'GET' });
}

function createPutRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/code-lab/edit', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ========================================
// DEFAULTS
// ========================================

const defaultAuth = {
  authorized: true,
  user: { id: 'user-1', email: 'test@test.com' },
};

const unauthorizedAuth = {
  authorized: false,
  response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 }),
};

// ========================================
// TESTS
// ========================================

describe('POST /api/code-lab/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockRequireUser.mockResolvedValue(defaultAuth);
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
    mockSupabaseSingle.mockResolvedValue({ data: { id: 'session-1' }, error: null });
    mockSurgicalEdit.mockResolvedValue({
      success: true,
      linesAdded: 1,
      linesRemoved: 0,
      linesModified: 1,
      diffs: [],
      originalContent: 'old',
      newContent: 'new',
    });
  });

  it('applies surgical edits successfully (default JSON format)', async () => {
    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'const x = 1;' }],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.success).toBe(true);
  });

  it('returns diff format when requested', async () => {
    mockFormatDiffForDisplay.mockReturnValue('formatted diff');

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
      format: 'diff',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.diff).toBe('formatted diff');
    expect(body.data.stats).toBeDefined();
  });

  it('returns unified diff format when requested', async () => {
    mockGenerateUnifiedDiff.mockReturnValue('--- a/src/index.ts\n+++ b/src/index.ts');

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
      format: 'unified',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.unifiedDiff).toContain('---');
    expect(body.data.stats).toBeDefined();
  });

  it('skips CSRF and rate limiting for dry-run requests', async () => {
    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
      dryRun: true,
    });

    await POST(req);

    expect(mockValidateCSRF).not.toHaveBeenCalled();
    expect(mockCodeLabEdit).not.toHaveBeenCalled();
    expect(mockSurgicalEdit).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireUser.mockResolvedValue(unauthorizedAuth);

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'CSRF failed' }), { status: 403 }),
    });

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    mockCodeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 400 when sessionId is missing', async () => {
    const req = createPostRequest({
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('sessionId');
  });

  it('returns 400 when filePath is missing', async () => {
    const req = createPostRequest({
      sessionId: 'session-1',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('filePath');
  });

  it('returns 400 when edits array is empty', async () => {
    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [],
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when edits is not provided', async () => {
    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when user does not own the session', async () => {
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 500 on unexpected error', async () => {
    mockSurgicalEdit.mockRejectedValue(new Error('Container crashed'));

    const req = createPostRequest({
      sessionId: 'session-1',
      filePath: 'src/index.ts',
      edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/code-lab/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue(defaultAuth);
    mockSupabaseSingle.mockResolvedValue({ data: { id: 'session-1' }, error: null });
  });

  it('returns API info when no action is specified', async () => {
    const req = createGetRequest();
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('active');
    expect(body.data.capabilities).toBeDefined();
    expect(body.data.capabilities.lineBasedEditing).toBe(true);
  });

  it('lists backups for a session', async () => {
    mockListBackups.mockResolvedValue([
      { id: 'backup-1', filePath: 'src/index.ts', createdAt: '2025-01-01' },
    ]);

    const req = createGetRequest({ action: 'listBackups', sessionId: 'session-1' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.backups).toHaveLength(1);
  });

  it('lists backups filtered by filePath', async () => {
    mockListBackups.mockResolvedValue([]);

    const req = createGetRequest({
      action: 'listBackups',
      sessionId: 'session-1',
      filePath: 'src/main.ts',
    });
    await GET(req);

    expect(mockListBackups).toHaveBeenCalledWith('session-1', 'src/main.ts', 20);
  });

  it('returns 401 for listBackups when not authenticated', async () => {
    mockRequireUser.mockResolvedValue(unauthorizedAuth);

    const req = createGetRequest({ action: 'listBackups', sessionId: 'session-1' });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 for listBackups when session not owned', async () => {
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = createGetRequest({ action: 'listBackups', sessionId: 'session-1' });
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('gets a specific backup', async () => {
    mockGetBackup.mockResolvedValue({
      id: 'backup-1',
      workspaceId: 'session-1',
      filePath: 'src/index.ts',
      content: 'old content',
    });

    const req = createGetRequest({ action: 'getBackup', backupId: 'backup-1' });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.backup.id).toBe('backup-1');
  });

  it('returns 404 when backup not found', async () => {
    mockGetBackup.mockResolvedValue(null);

    const req = createGetRequest({ action: 'getBackup', backupId: 'missing' });
    const res = await GET(req);

    expect(res.status).toBe(404);
  });

  it('returns 403 when user cannot access backup workspace', async () => {
    mockGetBackup.mockResolvedValue({
      id: 'backup-1',
      workspaceId: 'other-session',
      filePath: 'src/index.ts',
    });
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = createGetRequest({ action: 'getBackup', backupId: 'backup-1' });
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/code-lab/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockRequireUser.mockResolvedValue(defaultAuth);
    mockCodeLabEdit.mockResolvedValue({ allowed: true });
    mockSupabaseSingle.mockResolvedValue({ data: { id: 'session-1' }, error: null });
  });

  it('restores a file from backup successfully', async () => {
    mockGetBackup.mockResolvedValue({
      id: 'backup-1',
      workspaceId: 'session-1',
      filePath: 'src/index.ts',
      createdAt: '2025-01-01',
    });
    mockRestoreFromBackup.mockResolvedValue({ success: true });

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.success).toBe(true);
    expect(body.data.message).toContain('restored from backup');
  });

  it('returns 403 when CSRF validation fails', async () => {
    mockRequireUser.mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'CSRF failed' }), { status: 403 }),
    });

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireUser.mockResolvedValue(unauthorizedAuth);

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockCodeLabEdit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(429);
  });

  it('returns 400 when backupId is missing', async () => {
    const req = createPutRequest({});
    const res = await PUT(req);

    expect(res.status).toBe(400);
  });

  it('returns 404 when backup not found', async () => {
    mockGetBackup.mockResolvedValue(null);

    const req = createPutRequest({ backupId: 'missing' });
    const res = await PUT(req);

    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own backup workspace', async () => {
    mockGetBackup.mockResolvedValue({
      id: 'backup-1',
      workspaceId: 'other-session',
      filePath: 'src/index.ts',
    });
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(403);
  });

  it('returns 500 when restore fails', async () => {
    mockGetBackup.mockResolvedValue({
      id: 'backup-1',
      workspaceId: 'session-1',
      filePath: 'src/index.ts',
      createdAt: '2025-01-01',
    });
    mockRestoreFromBackup.mockResolvedValue({ success: false, error: 'Restore failed' });

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(500);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetBackup.mockRejectedValue(new Error('DB connection lost'));

    const req = createPutRequest({ backupId: 'backup-1' });
    const res = await PUT(req);

    expect(res.status).toBe(500);
  });
});
