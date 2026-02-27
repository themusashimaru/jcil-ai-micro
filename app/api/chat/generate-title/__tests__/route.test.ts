import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
const mockRequireUser = vi.fn();
vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

// Mock CSRF
const mockValidateCSRF = vi.fn();
vi.mock('@/lib/security/csrf', () => ({
  validateCSRF: (...args: unknown[]) => mockValidateCSRF(...args),
}));

// Mock rate limiting
const mockCheckRequestRateLimit = vi.fn();
vi.mock('@/lib/api/utils', () => ({
  checkRequestRateLimit: (...args: unknown[]) => mockCheckRequestRateLimit(...args),
  rateLimits: { standard: { maxRequests: 100, windowMs: 60000 } },
  errors: {
    badRequest: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
    validationError: (errs: unknown[]) =>
      new Response(JSON.stringify({ error: 'Validation error', details: errs }), { status: 422 }),
  },
}));

// Mock validation schema
vi.mock('@/lib/validation/schemas', () => ({
  generateTitleSchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d || !d.userMessage) {
        return {
          success: false,
          error: { errors: [{ path: ['userMessage'], message: 'Required' }] },
        };
      }
      return {
        success: true,
        data: { userMessage: d.userMessage, assistantMessage: d.assistantMessage || '' },
      };
    },
  },
}));

// Mock chat router
const mockCompleteChat = vi.fn();
vi.mock('@/lib/ai/chat-router', () => ({
  completeChat: (...args: unknown[]) => mockCompleteChat(...args),
}));

// Import after mocks
const { POST } = await import('../route');

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/chat/generate-title', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
    },
  });
}

describe('POST /api/chat/generate-title', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ authorized: true, userId: 'user-123' });
    mockValidateCSRF.mockReturnValue({ valid: true });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when user is not authenticated', async () => {
    const mockResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    mockRequireUser.mockResolvedValue({ authorized: false, response: mockResponse });

    const req = createRequest({ userMessage: 'Hello' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('blocks request when CSRF check fails', async () => {
    const csrfResponse = new Response(JSON.stringify({ error: 'CSRF failed' }), { status: 403 });
    mockValidateCSRF.mockReturnValue({ valid: false, response: csrfResponse });

    const req = createRequest({ userMessage: 'Hello' });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('blocks request when rate limited', async () => {
    const rateLimitResponse = new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
    });
    mockCheckRequestRateLimit.mockResolvedValue({ allowed: false, response: rateLimitResponse });

    const req = createRequest({ userMessage: 'Hello' });
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it('returns fallback title for empty user message', async () => {
    const req = createRequest({ userMessage: '   ' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe('New Conversation');
  });

  it('generates title from AI response', async () => {
    mockCompleteChat.mockResolvedValue({
      text: 'Python Code Review',
      providerId: 'claude',
      model: 'claude-3-haiku',
      usedFallback: false,
    });

    const req = createRequest({
      userMessage: 'Can you review my Python code?',
      assistantMessage: 'Sure, I can review your Python code.',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe('Python Code Review');
  });

  it('removes quotes from generated title', async () => {
    mockCompleteChat.mockResolvedValue({
      text: '"Email Writing Help"',
      providerId: 'claude',
    });

    const req = createRequest({ userMessage: 'Help me write an email' });
    const res = await POST(req);
    const data = await res.json();

    expect(data.title).toBe('Email Writing Help');
  });

  it('removes trailing punctuation from title', async () => {
    mockCompleteChat.mockResolvedValue({
      text: 'Bible Study Questions.',
      providerId: 'claude',
    });

    const req = createRequest({ userMessage: 'Bible study question' });
    const res = await POST(req);
    const data = await res.json();

    expect(data.title).toBe('Bible Study Questions');
  });

  it('truncates long titles to 50 characters', async () => {
    mockCompleteChat.mockResolvedValue({
      text: 'This Is An Extremely Long Title That Goes Way Beyond The Character Limit',
      providerId: 'claude',
    });

    const req = createRequest({ userMessage: 'Something long' });
    const res = await POST(req);
    const data = await res.json();

    expect(data.title.length).toBeLessThanOrEqual(50);
    expect(data.title).toContain('...');
  });

  it('falls back to user message when AI fails', async () => {
    mockCompleteChat.mockRejectedValue(new Error('AI provider unavailable'));

    const req = createRequest({
      userMessage: 'Help me with homework',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe('Help me with homework');
  });

  it('falls back when AI returns empty text', async () => {
    mockCompleteChat.mockResolvedValue({ text: '', providerId: 'claude' });

    const req = createRequest({ userMessage: 'Test message' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.title).toBe('Test message');
  });

  it('returns 422 for missing userMessage', async () => {
    const req = createRequest({});
    const res = await POST(req);

    expect(res.status).toBe(422);
  });

  it('returns 500 on unexpected error', async () => {
    // Simulate unexpected error by making requireUser throw
    mockRequireUser.mockRejectedValue(new Error('Unexpected DB error'));

    const req = createRequest({ userMessage: 'Hello' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to generate title');
  });
});
