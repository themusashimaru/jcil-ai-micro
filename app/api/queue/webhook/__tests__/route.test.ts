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

const mockVerifyWebhookSignature = vi.fn();
vi.mock('@/lib/queue/qstash', () => ({
  verifyWebhookSignature: (...args: unknown[]) => mockVerifyWebhookSignature(...args),
}));

const mockCreateAnthropicCompletion = vi.fn();
const mockCreateAnthropicCompletionWithSearch = vi.fn();
vi.mock('@/lib/anthropic/client', () => ({
  createAnthropicCompletion: (...args: unknown[]) => mockCreateAnthropicCompletion(...args),
  createAnthropicCompletionWithSearch: (...args: unknown[]) =>
    mockCreateAnthropicCompletionWithSearch(...args),
}));

const mockSupabaseInsert = vi.fn();
const mockSupabaseFrom = vi.fn().mockReturnValue({
  insert: (...args: unknown[]) => mockSupabaseInsert(...args),
});
vi.mock('@/lib/supabase/client', () => ({
  createServerClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

// Import after mocks
const { POST } = await import('../route');

// ========================================
// HELPERS
// ========================================

function createWebhookRequest(payload: object, signature = 'test-sig') {
  return new NextRequest('http://localhost/api/queue/webhook', {
    method: 'POST',
    headers: {
      'upstash-signature': signature,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

// ========================================
// TESTS
// ========================================

describe('POST /api/queue/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not production
    process.env.NODE_ENV = 'test';
    mockSupabaseInsert.mockResolvedValue({ error: null });
  });

  it('processes a chat job successfully', async () => {
    mockCreateAnthropicCompletion.mockResolvedValue({
      text: 'Hello from AI',
      model: 'claude-sonnet-4-20250514',
    });

    const request = createWebhookRequest({
      type: 'chat',
      conversationId: 'conv-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'You are helpful',
      webSearchEnabled: false,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.result.textLength).toBe(13);
    expect(mockCreateAnthropicCompletion).toHaveBeenCalled();
  });

  it('processes a chat job with web search', async () => {
    mockCreateAnthropicCompletionWithSearch.mockResolvedValue({
      text: 'Search result',
      model: 'claude-sonnet-4-20250514',
    });

    // Mock the dynamic import of perplexity
    vi.mock('@/lib/perplexity/client', () => ({
      searchWeb: vi.fn().mockResolvedValue({
        sources: [{ title: 'Test', url: 'https://example.com', snippet: 'test' }],
      }),
    }));

    const request = createWebhookRequest({
      type: 'chat',
      conversationId: 'conv-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Search for something' }],
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'You are helpful',
      webSearchEnabled: true,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('processes a codelab job successfully', async () => {
    const request = createWebhookRequest({
      type: 'codelab',
      sessionId: 'session-1',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.result.processed).toBe(true);
  });

  it('returns 400 for unknown job type', async () => {
    const request = createWebhookRequest({
      type: 'unknown',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('verifies signature in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mockVerifyWebhookSignature.mockResolvedValue(false);

    const request = createWebhookRequest({ type: 'chat' }, 'bad-sig');
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockVerifyWebhookSignature).toHaveBeenCalledWith('bad-sig', expect.any(String));

    process.env.NODE_ENV = origEnv;
  });

  it('allows requests with valid signature in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mockVerifyWebhookSignature.mockResolvedValue(true);
    mockCreateAnthropicCompletion.mockResolvedValue({
      text: 'ok',
      model: 'claude-sonnet-4-20250514',
    });

    const request = createWebhookRequest({
      type: 'chat',
      conversationId: 'conv-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'hi' }],
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'test',
      webSearchEnabled: false,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    process.env.NODE_ENV = origEnv;
  });

  it('returns 500 when processing throws an error', async () => {
    mockCreateAnthropicCompletion.mockRejectedValue(new Error('API error'));

    const request = createWebhookRequest({
      type: 'chat',
      conversationId: 'conv-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'test',
      webSearchEnabled: false,
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it('saves message to database after processing chat', async () => {
    mockCreateAnthropicCompletion.mockResolvedValue({
      text: 'AI response',
      model: 'claude-sonnet-4-20250514',
    });

    const request = createWebhookRequest({
      type: 'chat',
      conversationId: 'conv-1',
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'test',
      webSearchEnabled: false,
    });

    await POST(request);

    expect(mockSupabaseFrom).toHaveBeenCalledWith('messages');
    expect(mockSupabaseInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        user_id: 'user-1',
        role: 'assistant',
        content: 'AI response',
      })
    );
  });

  it('returns invalid JSON as 500', async () => {
    const request = new NextRequest('http://localhost/api/queue/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json {{{',
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
