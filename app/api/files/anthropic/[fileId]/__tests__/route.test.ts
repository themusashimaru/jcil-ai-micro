import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock anthropic client download
const mockDownloadAnthropicFile = vi.fn();
vi.mock('@/lib/anthropic/client', () => ({
  downloadAnthropicFile: (...args: unknown[]) => mockDownloadAnthropicFile(...args),
}));

// Import after mocks
const { GET } = await import('../route');

describe('GET /api/files/anthropic/[fileId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({
      authorized: true,
      user: mockUser,
      supabase: { from: vi.fn() },
    });
  });

  function createRequest(fileId: string) {
    return new Request(`http://localhost/api/files/anthropic/${fileId}`);
  }

  function createParams(fileId: string) {
    return { params: { fileId } };
  }

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401 }
    );
    mockRequireUser.mockResolvedValue({ authorized: false, response: unauthorizedResponse });

    const response = await GET(createRequest('file-123') as never, createParams('file-123'));
    expect(response.status).toBe(401);
  });

  it('returns 400 when fileId is empty', async () => {
    const response = await GET(createRequest('') as never, createParams(''));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('File ID is required');
  });

  it('returns file with correct headers on success', async () => {
    const fileData = new ArrayBuffer(100);
    mockDownloadAnthropicFile.mockResolvedValue({
      data: fileData,
      mimeType: 'application/pdf',
      filename: 'report.pdf',
    });

    const response = await GET(createRequest('file-abc') as never, createParams('file-abc'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="report.pdf"');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
  });

  it('returns 404 when file is not found', async () => {
    mockDownloadAnthropicFile.mockRejectedValue(new Error('File not found'));

    const response = await GET(
      createRequest('file-missing') as never,
      createParams('file-missing')
    );
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain('not found');
  });

  it('returns 429 when rate limited by Anthropic', async () => {
    mockDownloadAnthropicFile.mockRejectedValue(new Error('rate limit exceeded'));

    const response = await GET(createRequest('file-123') as never, createParams('file-123'));
    expect(response.status).toBe(429);
  });

  it('returns 500 on unknown errors', async () => {
    mockDownloadAnthropicFile.mockRejectedValue({ message: 'something weird' });

    const response = await GET(createRequest('file-123') as never, createParams('file-123'));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to download file');
  });
});
