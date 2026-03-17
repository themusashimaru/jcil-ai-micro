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

const mockGetPendingRequests = vi.fn();
const mockMarkRequestProcessing = vi.fn();
const mockSaveBackgroundResponse = vi.fn();
const mockFailPendingRequest = vi.fn();
const mockCleanupOldRequests = vi.fn();

vi.mock('@/lib/pending-requests', () => ({
  getPendingRequestsToProcess: (...args: unknown[]) => mockGetPendingRequests(...args),
  markRequestProcessing: (...args: unknown[]) => mockMarkRequestProcessing(...args),
  saveBackgroundResponse: (...args: unknown[]) => mockSaveBackgroundResponse(...args),
  failPendingRequest: (...args: unknown[]) => mockFailPendingRequest(...args),
  cleanupOldRequests: (...args: unknown[]) => mockCleanupOldRequests(...args),
}));

const mockCompleteChat = vi.fn();
vi.mock('@/lib/ai/chat-router', () => ({
  completeChat: (...args: unknown[]) => mockCompleteChat(...args),
}));

const mockGetMainChatSystemPrompt = vi.fn().mockReturnValue('System prompt');
vi.mock('@/lib/prompts/main-chat', () => ({
  getMainChatSystemPrompt: () => mockGetMainChatSystemPrompt(),
}));

// Import after mocks
const { GET } = await import('../route');

// ========================================
// HELPERS
// ========================================

const CRON_SECRET = 'test-cron-secret-pending';

function createRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/process-pending', {
    method: 'GET',
    headers,
  });
}

function createAuthorizedRequest() {
  return createRequest({ authorization: `Bearer ${CRON_SECRET}` });
}

function createMockPendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    user_id: 'user-123',
    conversation_id: 'conv-456',
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'claude-sonnet-4-6',
    ...overrides,
  };
}

// ========================================
// TESTS
// ========================================

describe('GET /api/cron/process-pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    mockCleanupOldRequests.mockResolvedValue(0);
  });

  it('returns 401 when no authorization header', async () => {
    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.ok).toBe(false);
  });

  it('returns 401 when cron secret is wrong', async () => {
    const request = createRequest({ authorization: 'Bearer incorrect' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const request = createRequest({ authorization: 'Bearer anything' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns success with 0 processed when no pending requests', async () => {
    mockGetPendingRequests.mockResolvedValue([]);

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.processed).toBe(0);
    expect(mockCleanupOldRequests).toHaveBeenCalled();
  });

  it('cleans up old requests before processing', async () => {
    mockCleanupOldRequests.mockResolvedValue(5);
    mockGetPendingRequests.mockResolvedValue([]);

    const request = createAuthorizedRequest();
    await GET(request);

    expect(mockCleanupOldRequests).toHaveBeenCalled();
  });

  it('processes a pending request successfully', async () => {
    const pendingReq = createMockPendingRequest();
    mockGetPendingRequests.mockResolvedValue([pendingReq]);
    mockMarkRequestProcessing.mockResolvedValue(true);
    mockCompleteChat.mockResolvedValue({
      text: 'Hello! How can I help you?',
      providerId: 'anthropic',
      model: 'claude-sonnet-4-6',
      usedFallback: false,
    });
    mockSaveBackgroundResponse.mockResolvedValue(undefined);

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.processed).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.total).toBe(1);
    expect(mockMarkRequestProcessing).toHaveBeenCalledWith('req-1');
    expect(mockSaveBackgroundResponse).toHaveBeenCalledWith(
      'req-1',
      'conv-456',
      'user-123',
      'Hello! How can I help you?',
      'claude-sonnet-4-6'
    );
  });

  it('skips request if already being processed by another worker', async () => {
    const pendingReq = createMockPendingRequest();
    mockGetPendingRequests.mockResolvedValue([pendingReq]);
    mockMarkRequestProcessing.mockResolvedValue(false); // Already claimed

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(json.failed).toBe(0);
    expect(mockCompleteChat).not.toHaveBeenCalled();
  });

  it('fails request when AI returns empty response', async () => {
    const pendingReq = createMockPendingRequest();
    mockGetPendingRequests.mockResolvedValue([pendingReq]);
    mockMarkRequestProcessing.mockResolvedValue(true);
    mockCompleteChat.mockResolvedValue({
      text: '',
      providerId: 'anthropic',
      model: 'claude-sonnet-4-6',
      usedFallback: false,
    });

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(json.failed).toBe(1);
    expect(mockFailPendingRequest).toHaveBeenCalledWith('req-1', 'Empty response from AI');
  });

  it('handles AI completion error gracefully', async () => {
    const pendingReq = createMockPendingRequest();
    mockGetPendingRequests.mockResolvedValue([pendingReq]);
    mockMarkRequestProcessing.mockResolvedValue(true);
    mockCompleteChat.mockRejectedValue(new Error('API rate limit exceeded'));

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(json.failed).toBe(1);
    expect(mockFailPendingRequest).toHaveBeenCalledWith('req-1', 'Processing failed');
  });

  it('processes multiple requests with mixed results', async () => {
    const req1 = createMockPendingRequest({ id: 'req-1' });
    const req2 = createMockPendingRequest({ id: 'req-2' });
    const req3 = createMockPendingRequest({ id: 'req-3' });

    mockGetPendingRequests.mockResolvedValue([req1, req2, req3]);
    mockMarkRequestProcessing.mockResolvedValue(true);
    mockCompleteChat
      .mockResolvedValueOnce({
        text: 'Response 1',
        providerId: 'anthropic',
        model: 'claude-sonnet-4-6',
        usedFallback: false,
      })
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({
        text: 'Response 3',
        providerId: 'anthropic',
        model: 'claude-sonnet-4-6',
        usedFallback: false,
      });

    mockSaveBackgroundResponse.mockResolvedValue(undefined);

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(2);
    expect(json.failed).toBe(1);
    expect(json.total).toBe(3);
  });

  it('returns 500 on unexpected top-level exception', async () => {
    mockCleanupOldRequests.mockRejectedValue(new Error('Database connection failed'));

    const request = createAuthorizedRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});
