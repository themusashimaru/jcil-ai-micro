/**
 * Tests for /api/conversations/[id]/messages
 *
 * Covers GET, POST, PATCH, DELETE methods including:
 * - Auth guard rejection
 * - Happy paths
 * - Validation errors
 * - Error handling (DB errors, not found, forbidden)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ========================================
// MOCKS
// ========================================

/**
 * Creates a chainable Supabase-like query builder.
 * All methods return `this` for chaining. Terminal methods (.single(), .order())
 * resolve with configurable values. The builder is also thenable so
 * `await sb.from('x').update({...}).eq('id', val)` resolves correctly when
 * there is no explicit terminal like .single().
 */
function createChainableBuilder() {
  // Queue of resolutions: each awaited terminal pops the next value
  const resolutions: Array<{ data: unknown; error: unknown }> = [];
  let defaultResolution: { data: unknown; error: unknown } = { data: null, error: null };

  function popResolution() {
    return resolutions.length > 0 ? resolutions.shift()! : defaultResolution;
  }

  const builder: Record<string, unknown> & {
    _pushResolution: (r: { data: unknown; error: unknown }) => void;
    _setDefault: (r: { data: unknown; error: unknown }) => void;
  } = {
    _pushResolution(r) {
      resolutions.push(r);
    },
    _setDefault(r) {
      defaultResolution = r;
    },

    from: vi.fn().mockImplementation(() => builder),
    select: vi.fn().mockImplementation(() => builder),
    insert: vi.fn().mockImplementation(() => builder),
    update: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    is: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => Promise.resolve(popResolution())),
    single: vi.fn().mockImplementation(() => Promise.resolve(popResolution())),

    // Make builder itself thenable for chains ending at .eq()
    then: vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        try {
          return resolve(popResolution());
        } catch (e) {
          if (reject) return reject(e);
          throw e;
        }
      }),
  };

  return builder;
}

const mockUser = { id: 'user-123', email: 'test@example.com' };

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/api/utils', async () => {
  const { NextResponse } = await import('next/server');

  return {
    successResponse: vi.fn((data: unknown) =>
      NextResponse.json({ ok: true, data }, { status: 200 })
    ),
    errors: {
      notFound: vi.fn((resource: string) =>
        NextResponse.json(
          { ok: false, error: `${resource} not found`, code: 'NOT_FOUND' },
          { status: 404 }
        )
      ),
      serverError: vi.fn(() =>
        NextResponse.json(
          { ok: false, error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
          { status: 500 }
        )
      ),
      badRequest: vi.fn((msg: string) =>
        NextResponse.json({ ok: false, error: msg, code: 'INVALID_INPUT' }, { status: 400 })
      ),
      forbidden: vi.fn((msg: string) =>
        NextResponse.json({ ok: false, error: msg, code: 'FORBIDDEN' }, { status: 403 })
      ),
      validationError: vi.fn((details: Array<{ field: string; message: string }>) =>
        NextResponse.json(
          { ok: false, error: 'Validation failed', code: 'INVALID_INPUT', details },
          { status: 400 }
        )
      ),
    },
    validateBody: vi.fn(),
    checkRequestRateLimit: vi.fn(),
    rateLimits: {
      standard: { maxRequests: 60, windowMs: 60000 },
      strict: { maxRequests: 10, windowMs: 60000 },
    },
  };
});

vi.mock('@/lib/validation/schemas', () => ({
  createMessageSchema: {
    partial: vi.fn().mockReturnValue({ _type: 'schema' }),
  },
}));

// ========================================
// IMPORTS (after mocks)
// ========================================
import { requireUser } from '@/lib/auth/user-guard';
import { successResponse, errors, validateBody, checkRequestRateLimit } from '@/lib/api/utils';
import { GET, POST, PATCH, DELETE } from './route';

// ========================================
// HELPERS
// ========================================

function makeRequest(
  method: string,
  body?: unknown,
  contentType = 'application/json'
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': contentType },
  };
  if (body && contentType === 'application/json') {
    init.body = JSON.stringify(body);
  }
  return new NextRequest('http://localhost:3000/api/conversations/conv-1/messages', init as never);
}

function makeParams(id = 'conv-1') {
  return { params: Promise.resolve({ id }) };
}

/**
 * Sets up auth mock. When authorized=true, returns a fresh chainable
 * Supabase builder that tests can push resolution values onto.
 */
function setupAuth(authorized = true) {
  if (authorized) {
    const sb = createChainableBuilder();
    const authResult = { authorized: true, user: mockUser, supabase: sb };
    vi.mocked(requireUser).mockResolvedValue(authResult as never);
    return sb;
  } else {
    vi.mocked(requireUser).mockResolvedValue({
      authorized: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 }),
    } as never);
    return null;
  }
}

function setupRateLimit(allowed = true) {
  if (allowed) {
    vi.mocked(checkRequestRateLimit).mockResolvedValue({ allowed: true });
  } else {
    vi.mocked(checkRequestRateLimit).mockResolvedValue({
      allowed: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Rate limited' }), { status: 429 }),
    } as never);
  }
}

// ========================================
// TESTS: GET
// ========================================

describe('GET /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    setupAuth(false);

    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('returns 404 when conversation not found', async () => {
    const sb = setupAuth(true)!;
    // conversation lookup fails (first terminal = .single())
    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Conversation');
  });

  it('returns messages for valid conversation', async () => {
    const sb = setupAuth(true)!;
    const fakeMessages = [
      { id: 'msg-1', content: 'Hello', role: 'user' },
      { id: 'msg-2', content: 'Hi there', role: 'assistant' },
    ];
    // 1st terminal: conversation lookup .single()
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    // 2nd terminal: messages query .order()
    sb._pushResolution({ data: fakeMessages, error: null });

    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(200);
    expect(successResponse).toHaveBeenCalledWith({ messages: fakeMessages });
  });

  it('returns 500 when messages query fails', async () => {
    const sb = setupAuth(true)!;
    // conversation found
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    // messages query error
    sb._pushResolution({ data: null, error: { message: 'db error' } });

    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(500);
    expect(errors.serverError).toHaveBeenCalled();
  });
});

// ========================================
// TESTS: POST
// ========================================

describe('POST /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    setupAuth(false);
    setupRateLimit(true);

    const res = await POST(makeRequest('POST', { role: 'user', content: 'Hello' }), makeParams());
    expect(res.status).toBe(401);
  });

  it('rejects when rate limited', async () => {
    setupAuth(true);
    setupRateLimit(false);

    const res = await POST(makeRequest('POST', { role: 'user', content: 'Hello' }), makeParams());
    expect(res.status).toBe(429);
  });

  it('returns validation error for invalid JSON body', async () => {
    setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: false,
      response: (errors.validationError as ReturnType<typeof vi.fn>)([
        { field: 'role', message: 'Required' },
      ]),
    });

    const res = await POST(makeRequest('POST', { invalid: true }), makeParams());
    expect(res.status).toBe(400);
  });

  it('rejects messages with no content and no attachments', async () => {
    setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: '',
        content_type: 'text',
        type: 'text',
        attachment_urls: [],
      },
    });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('Provide text or at least one file');
  });

  it('returns 404 when conversation not found', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: 'Hello',
        content_type: 'text',
        type: 'text',
        attachment_urls: [],
      },
    });

    // conversation lookup fails
    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Conversation');
  });

  it('saves a message and returns success', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: 'Hello world',
        content_type: 'text',
        type: 'text',
        attachment_urls: [],
      },
    });

    const savedMessage = { id: 'msg-new', content: 'Hello world', role: 'user' };
    // 1: conversation lookup (.single())
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    // 2: insert message (.single())
    sb._pushResolution({ data: savedMessage, error: null });
    // 3: update conversation timestamps (awaited .eq() — thenable)
    sb._pushResolution({ error: null, data: null });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(200);
    expect(successResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        message: savedMessage,
        conversationId: 'conv-1',
        role: 'user',
      })
    );
  });

  it('returns 500 when insert fails', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: 'Hello',
        content_type: 'text',
        type: 'text',
        attachment_urls: [],
      },
    });

    // conversation found
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    // insert fails
    sb._pushResolution({ data: null, error: { message: 'insert failed' } });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(500);
    expect(errors.serverError).toHaveBeenCalled();
  });

  it('handles multipart form-data with attachments_json parse error', async () => {
    setupAuth(true)!;
    setupRateLimit(true);

    const formData = new FormData();
    formData.set('text', 'Hello');
    formData.set('role', 'user');
    formData.set('attachments_json', 'not-valid-json');

    const req = new NextRequest('http://localhost:3000/api/conversations/conv-1/messages', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('attachments_json is not valid JSON');
  });

  it('accepts message with prompt and no content for image type', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: '',
        content_type: 'text',
        type: 'image',
        prompt: 'Generate a cat image',
        image_url: 'https://example.com/img.png',
        attachment_urls: [],
      },
    });

    const savedMessage = { id: 'msg-img', content: 'Generate a cat image', role: 'user' };
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({ data: savedMessage, error: null });
    sb._pushResolution({ error: null, data: null });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(200);
  });

  it('succeeds even when conversation timestamp update fails', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: 'Test message',
        content_type: 'text',
        type: 'text',
        attachment_urls: [],
      },
    });

    const savedMessage = { id: 'msg-ts', content: 'Test message', role: 'user' };
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({ data: savedMessage, error: null });
    // conversation update fails — should NOT fail the request
    sb._pushResolution({ error: { message: 'update failed' }, data: null });

    const res = await POST(makeRequest('POST', {}), makeParams());
    // Still 200 because update error is non-fatal
    expect(res.status).toBe(200);
  });

  it('includes attachment metadata in response', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    vi.mocked(validateBody).mockResolvedValue({
      success: true,
      data: {
        role: 'user',
        content: 'See attached',
        content_type: 'text',
        type: 'text',
        attachment_urls: ['data:image/png;base64,abc123'],
      },
    });

    const savedMessage = { id: 'msg-att', content: 'See attached', role: 'user' };
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({ data: savedMessage, error: null });
    sb._pushResolution({ error: null, data: null });

    const res = await POST(makeRequest('POST', {}), makeParams());
    expect(res.status).toBe(200);
    expect(successResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ index: 0, hasData: true }],
      })
    );
  });
});

// ========================================
// TESTS: PATCH
// ========================================

describe('PATCH /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    setupAuth(false);

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(401);
  });

  it('rejects when rate limited', async () => {
    setupAuth(true);
    setupRateLimit(false);

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid JSON body', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = new NextRequest('http://localhost:3000/api/conversations/conv-1/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json at all{{{',
    });

    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('Invalid JSON body');
  });

  it('returns 400 when messageId is missing', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = makeRequest('PATCH', { content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('messageId is required');
  });

  it('returns 400 when content is empty', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: '' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('content cannot be empty');
  });

  it('returns 400 when content is only whitespace', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: '   ' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('content cannot be empty');
  });

  it('returns 404 when conversation not found', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Conversation');
  });

  it('returns 404 when message not found', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Message');
  });

  it('returns 403 when editing another user message', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', role: 'user', user_id: 'other-user', content: 'Original' },
      error: null,
    });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(403);
    expect(errors.forbidden).toHaveBeenCalledWith('You can only edit your own messages');
  });

  it('returns 403 when editing an assistant message', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', role: 'assistant', user_id: 'user-123', content: 'AI response' },
      error: null,
    });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(403);
    expect(errors.forbidden).toHaveBeenCalledWith('Only user messages can be edited');
  });

  it('successfully edits a user message', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', role: 'user', user_id: 'user-123', content: 'Original content' },
      error: null,
    });
    const updatedMsg = {
      id: 'msg-1',
      content: 'Updated content',
      edited_at: '2026-03-05T00:00:00Z',
    };
    sb._pushResolution({ data: updatedMsg, error: null });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated content' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(200);
    expect(successResponse).toHaveBeenCalledWith({
      message: updatedMsg,
      edited: true,
      previousContent: 'Original content',
    });
  });

  it('returns 500 when update fails', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', role: 'user', user_id: 'user-123', content: 'Original' },
      error: null,
    });
    sb._pushResolution({ data: null, error: { message: 'update failed' } });

    const req = makeRequest('PATCH', { messageId: 'msg-1', content: 'Updated' });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(500);
    expect(errors.serverError).toHaveBeenCalled();
  });
});

// ========================================
// TESTS: DELETE
// ========================================

describe('DELETE /api/conversations/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    setupAuth(false);

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(401);
  });

  it('rejects when rate limited', async () => {
    setupAuth(true);
    setupRateLimit(false);

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid JSON body', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = new NextRequest('http://localhost:3000/api/conversations/conv-1/messages', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });

    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('Invalid JSON body');
  });

  it('returns 400 when messageId is missing', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = makeRequest('DELETE', {});
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('messageId is required');
  });

  it('returns 400 when messageId is not a string', async () => {
    setupAuth(true);
    setupRateLimit(true);

    const req = makeRequest('DELETE', { messageId: 123 });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(400);
    expect(errors.badRequest).toHaveBeenCalledWith('messageId is required');
  });

  it('returns 404 when conversation not found', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Conversation');
  });

  it('returns 404 when message not found', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({ data: null, error: { message: 'not found' } });

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(404);
    expect(errors.notFound).toHaveBeenCalledWith('Message');
  });

  it('returns 403 when deleting another user message', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', user_id: 'other-user' },
      error: null,
    });

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(403);
    expect(errors.forbidden).toHaveBeenCalledWith('You can only delete your own messages');
  });

  it('successfully soft deletes a message', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    // conversation lookup
    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    // message lookup
    sb._pushResolution({
      data: { id: 'msg-1', user_id: 'user-123' },
      error: null,
    });
    // soft delete update (awaited via .then on builder)
    sb._pushResolution({ error: null, data: null });

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(200);
    expect(successResponse).toHaveBeenCalledWith({
      deleted: true,
      messageId: 'msg-1',
    });
  });

  it('returns 500 when soft delete fails', async () => {
    const sb = setupAuth(true)!;
    setupRateLimit(true);

    sb._pushResolution({ data: { id: 'conv-1' }, error: null });
    sb._pushResolution({
      data: { id: 'msg-1', user_id: 'user-123' },
      error: null,
    });
    sb._pushResolution({ error: { message: 'delete failed' }, data: null });

    const req = makeRequest('DELETE', { messageId: 'msg-1' });
    const res = await DELETE(req, makeParams());
    expect(res.status).toBe(500);
    expect(errors.serverError).toHaveBeenCalled();
  });
});
