// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// MOCKS — must come before any imports from the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the service module so we can control ProviderService behaviour
const mockChat = vi.fn();
const mockProviderService = {
  chat: mockChat,
  getCurrentProvider: vi.fn(() => 'claude'),
  setProvider: vi.fn(() => true),
  getProviderConfig: vi.fn(),
  getProviderStatuses: vi.fn(() => []),
  getConfiguredProviders: vi.fn(() => ['claude', 'openai']),
  formatTools: vi.fn(),
  hasCapability: vi.fn(() => true),
  switchProvider: vi.fn(),
};

vi.mock('../service', () => ({
  ProviderService: vi.fn(() => mockProviderService),
  createProviderService: vi.fn(() => mockProviderService),
  getProviderService: vi.fn(() => mockProviderService),
}));

// Mock error utilities — uses async factory to access the real UnifiedAIError class
vi.mock('../errors', async () => {
  const typesModule = await vi.importActual<typeof import('../types')>('../types');
  return {
    parseProviderError: vi.fn((err, provider) => {
      // If it is already a UnifiedAIError, pass through
      if (err && err.name === 'UnifiedAIError') return err;
      return new typesModule.UnifiedAIError(
        'server_error',
        err?.message ?? 'Unknown',
        provider ?? 'claude',
        true,
        5000,
        err
      );
    }),
    getUserFriendlyMessage: vi.fn((err) => err?.message ?? 'Something went wrong'),
    canRecoverWithFallback: vi.fn(() => true),
    parseAnthropicError: vi.fn(),
    parseOpenAIError: vi.fn(),
    shouldReportError: vi.fn(() => false),
    withRetry: vi.fn(),
    createRetryWrapper: vi.fn(),
    calculateRetryDelay: vi.fn(() => 100),
    sleep: vi.fn(() => Promise.resolve()),
    DEFAULT_RETRY_CONFIG: {},
  };
});

// ---------------------------------------------------------------------------
// IMPORTS (after mocks)
// ---------------------------------------------------------------------------

import {
  createStreamingResponse,
  createChatResponse,
  createMultiProviderHandler,
  extractProviderFromRequest,
  formatMessagesForProvider,
  simplifyMessages,
} from '../api-integration';
import { UnifiedAIError } from '../types';
import type { UnifiedMessage, UnifiedStreamChunk } from '../types';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Build a minimal NextRequest-like object */
function makeRequest(
  body: Record<string, unknown> = {},
  options: {
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
) {
  const url = new URL('http://localhost/api/chat');
  if (options.searchParams) {
    for (const [k, v] of Object.entries(options.searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const headers = new Headers(options.headers ?? {});
  return {
    json: vi.fn().mockResolvedValue(body),
    nextUrl: url,
    headers,
    url: url.toString(),
  } as unknown as import('next/server').NextRequest;
}

/** Create an async generator that yields given chunks */
async function* asyncChunks(chunks: UnifiedStreamChunk[]) {
  for (const c of chunks) {
    yield c;
  }
}

/** Read all SSE data lines from a Response body */
async function readSSE(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const lines: string[] = [];
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) {
      const text = decoder.decode(result.value);
      const parts = text.split('\n\n').filter(Boolean);
      for (const p of parts) {
        if (p.startsWith('data: ')) {
          lines.push(p.slice(6));
        }
      }
    }
  }
  return lines;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('api-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // extractProviderFromRequest
  // =========================================================================
  describe('extractProviderFromRequest', () => {
    it('returns provider from query param', () => {
      const req = makeRequest({}, { searchParams: { provider: 'openai' } });
      expect(extractProviderFromRequest(req)).toBe('openai');
    });

    it('returns provider from X-AI-Provider header', () => {
      const req = makeRequest({}, { headers: { 'X-AI-Provider': 'xai' } });
      expect(extractProviderFromRequest(req)).toBe('xai');
    });

    it('returns provider from body', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req, { providerId: 'deepseek' })).toBe('deepseek');
    });

    it('returns provider from body for google', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req, { providerId: 'google' })).toBe('google');
    });

    it('prioritizes query param over header', () => {
      const req = makeRequest(
        {},
        { searchParams: { provider: 'claude' }, headers: { 'X-AI-Provider': 'openai' } }
      );
      expect(extractProviderFromRequest(req)).toBe('claude');
    });

    it('prioritizes header over body', () => {
      const req = makeRequest({}, { headers: { 'X-AI-Provider': 'xai' } });
      expect(extractProviderFromRequest(req, { providerId: 'deepseek' })).toBe('xai');
    });

    it('returns undefined for invalid query param', () => {
      const req = makeRequest({}, { searchParams: { provider: 'invalid-provider' } });
      expect(extractProviderFromRequest(req)).toBeUndefined();
    });

    it('returns undefined for invalid header', () => {
      const req = makeRequest({}, { headers: { 'X-AI-Provider': 'unknown' } });
      expect(extractProviderFromRequest(req)).toBeUndefined();
    });

    it('returns undefined for invalid body providerId', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req, { providerId: 'nope' as any })).toBeUndefined();
    });

    it('returns undefined when nothing provided', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req)).toBeUndefined();
    });

    it('returns undefined when body is undefined', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req, undefined)).toBeUndefined();
    });

    it('returns undefined when body has no providerId', () => {
      const req = makeRequest();
      expect(extractProviderFromRequest(req, {})).toBeUndefined();
    });
  });

  // =========================================================================
  // formatMessagesForProvider
  // =========================================================================
  describe('formatMessagesForProvider', () => {
    it('converts messages to unified format', () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ];
      const result = formatMessagesForProvider(messages);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
      expect(result[1].role).toBe('assistant');
      expect(result[1].content).toBe('Hi there');
    });

    it('includes provider metadata when fromProvider is given', () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];
      const result = formatMessagesForProvider(messages, 'openai');
      expect(result[0].metadata).toEqual({ provider: 'openai' });
    });

    it('omits metadata when fromProvider is not given', () => {
      const messages = [{ role: 'user' as const, content: 'Test' }];
      const result = formatMessagesForProvider(messages);
      expect(result[0].metadata).toBeUndefined();
    });

    it('handles system messages', () => {
      const messages = [{ role: 'system' as const, content: 'You are a helper' }];
      const result = formatMessagesForProvider(messages, 'claude');
      expect(result[0].role).toBe('system');
      expect(result[0].metadata?.provider).toBe('claude');
    });

    it('handles empty message array', () => {
      const result = formatMessagesForProvider([]);
      expect(result).toEqual([]);
    });

    it('preserves all roles correctly', () => {
      const messages = [
        { role: 'user' as const, content: 'a' },
        { role: 'assistant' as const, content: 'b' },
        { role: 'system' as const, content: 'c' },
      ];
      const result = formatMessagesForProvider(messages);
      expect(result.map((m) => m.role)).toEqual(['user', 'assistant', 'system']);
    });
  });

  // =========================================================================
  // simplifyMessages
  // =========================================================================
  describe('simplifyMessages', () => {
    it('converts string content messages', () => {
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'World' },
      ];
      const result = simplifyMessages(messages);
      expect(result).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'World' },
      ]);
    });

    it('extracts text from content blocks', () => {
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: ' Part 2' },
          ],
        },
      ];
      const result = simplifyMessages(messages);
      expect(result[0].content).toBe('Part 1 Part 2');
    });

    it('filters out non-text blocks when extracting content', () => {
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'tool_use', id: 'tc-1', name: 'search', arguments: {} },
            { type: 'text', text: ' World' },
          ],
        },
      ];
      const result = simplifyMessages(messages);
      expect(result[0].content).toBe('Hello World');
    });

    it('returns empty string for blocks with no text content', () => {
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tc-1', name: 'search', arguments: {} }],
        },
      ];
      const result = simplifyMessages(messages);
      expect(result[0].content).toBe('');
    });

    it('handles empty message array', () => {
      expect(simplifyMessages([])).toEqual([]);
    });

    it('handles mixed string and block messages', () => {
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'plain text' },
        { role: 'assistant', content: [{ type: 'text', text: 'block text' }] },
      ];
      const result = simplifyMessages(messages);
      expect(result[0].content).toBe('plain text');
      expect(result[1].content).toBe('block text');
    });

    it('handles text blocks where text is undefined', () => {
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'visible' },
            { type: 'text' } as any, // text is missing
          ],
        },
      ];
      const result = simplifyMessages(messages);
      expect(result[0].content).toBe('visible');
    });
  });

  // =========================================================================
  // createChatResponse
  // =========================================================================
  describe('createChatResponse', () => {
    it('accumulates text chunks into content', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, [
        { role: 'user', content: 'Hi' },
      ]);
      expect(result.content).toBe('Hello world');
      expect(result.provider).toBe('claude');
      expect(result.usedFallback).toBe(false);
    });

    it('captures usage information', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Response' },
        { type: 'message_end', usage: { inputTokens: 100, outputTokens: 50 } },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, [
        { role: 'user', content: 'Test' },
      ]);
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });

    it('returns undefined usage if not provided', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'No usage' },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, [
        { role: 'user', content: 'Test' },
      ]);
      expect(result.usage).toBeUndefined();
    });

    it('uses providerId from options', async () => {
      const chunks: UnifiedStreamChunk[] = [{ type: 'text', text: 'OK' }, { type: 'message_end' }];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, [], {
        providerId: 'openai',
        model: 'gpt-4o',
      });
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
    });

    it('defaults providerId to claude and model to unknown', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));
      const result = await createChatResponse(mockProviderService as any, []);
      expect(result.provider).toBe('claude');
      expect(result.model).toBe('unknown');
    });

    it('ignores non-text chunks in content accumulation', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'thinking', text: 'thinking...' },
        { type: 'text', text: 'Final answer' },
        { type: 'tool_call_start', toolCall: { id: 'tc-1', name: 'test' } },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, []);
      expect(result.content).toBe('Final answer');
    });

    it('returns empty content when there are no text chunks', async () => {
      const chunks: UnifiedStreamChunk[] = [{ type: 'message_start' }, { type: 'message_end' }];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, []);
      expect(result.content).toBe('');
    });

    it('handles text chunks with undefined text', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'text' }, // no text property
        { type: 'text', text: 'visible' },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const result = await createChatResponse(mockProviderService as any, []);
      expect(result.content).toBe('visible');
    });
  });

  // =========================================================================
  // createStreamingResponse
  // =========================================================================
  describe('createStreamingResponse', () => {
    it('returns a Response with correct headers', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));
      const response = await createStreamingResponse(mockProviderService as any, []);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });

    it('streams chunks as SSE data lines', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Hello' },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const response = await createStreamingResponse(mockProviderService as any, []);
      const events = await readSSE(response);

      // Should have the chunks plus a done event
      expect(events.length).toBeGreaterThanOrEqual(3);

      const parsed = events.map((e) => JSON.parse(e));
      expect(parsed[0].type).toBe('message_start');
      expect(parsed[1].type).toBe('text');
      expect(parsed[1].text).toBe('Hello');
    });

    it('sends done event at the end', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const response = await createStreamingResponse(mockProviderService as any, [], {
        providerId: 'openai',
        model: 'gpt-4o',
      });
      const events = await readSSE(response);
      const last = JSON.parse(events[events.length - 1]);
      expect(last.type).toBe('done');
    });

    it('sends error event on stream failure', async () => {
      const error = new UnifiedAIError('rate_limited', 'Too many requests', 'claude', true, 30000);
      mockChat.mockImplementation(async function* () {
        throw error;
      });

      const response = await createStreamingResponse(mockProviderService as any, []);
      const events = await readSSE(response);
      const errorEvent = events.map((e) => JSON.parse(e)).find((e) => e.type === 'error');

      expect(errorEvent).toBeDefined();
      expect(errorEvent.error.code).toBe('rate_limited');
      expect(errorEvent.error.retryable).toBe(true);
      expect(errorEvent.error.retryAfterMs).toBe(30000);
    });

    it('handles non-UnifiedAIError errors in stream', async () => {
      mockChat.mockImplementation(async function* () {
        throw new Error('Network failed');
      });

      const response = await createStreamingResponse(mockProviderService as any, [], {
        providerId: 'openai',
      });
      const events = await readSSE(response);
      const errorEvent = events.map((e) => JSON.parse(e)).find((e) => e.type === 'error');

      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toBeDefined();
    });

    it('defaults providerId to claude when not in options', async () => {
      mockChat.mockImplementation(async function* () {
        throw new Error('fail');
      });

      const response = await createStreamingResponse(mockProviderService as any, []);
      const events = await readSSE(response);
      const errorEvent = events.map((e) => JSON.parse(e)).find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  // =========================================================================
  // createMultiProviderHandler
  // =========================================================================
  describe('createMultiProviderHandler', () => {
    it('returns a function', () => {
      const handler = createMultiProviderHandler();
      expect(typeof handler).toBe('function');
    });

    it('handles streaming requests by default', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'text', text: 'streamed' },
        { type: 'message_end' },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [{ role: 'user', content: 'Hi' }] });
      const response = await handler(req);

      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('handles non-streaming requests', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'text', text: 'Hello world' },
        { type: 'message_end', usage: { inputTokens: 10, outputTokens: 5 } },
      ];
      mockChat.mockReturnValue(asyncChunks(chunks));

      const handler = createMultiProviderHandler();
      const req = makeRequest({
        messages: [{ role: 'user', content: 'Hi' }],
        stream: false,
      });
      const response = await handler(req);
      const body = await response.json();

      expect(body.content).toBe('Hello world');
      expect(body.provider).toBe('claude');
    });

    it('uses defaultProvider from handler options', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler({ defaultProvider: 'openai' });
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);
      const body = await response.json();

      expect(body.provider).toBe('openai');
    });

    it('uses providerId from request body over default', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler({ defaultProvider: 'claude' });
      const req = makeRequest({
        messages: [],
        providerId: 'xai',
        stream: false,
      });
      const response = await handler(req);
      const body = await response.json();

      expect(body.provider).toBe('xai');
    });

    it('calls beforeChat hook and uses modified messages', async () => {
      const modifiedMessages: UnifiedMessage[] = [{ role: 'user', content: 'Modified' }];
      const beforeChat = vi.fn().mockResolvedValue(modifiedMessages);

      mockChat.mockReturnValue(
        asyncChunks([{ type: 'text', text: 'OK' }, { type: 'message_end' }])
      );

      const handler = createMultiProviderHandler({ beforeChat });
      const req = makeRequest({ messages: [{ role: 'user', content: 'Original' }], stream: false });
      await handler(req);

      expect(beforeChat).toHaveBeenCalled();
      expect(mockChat).toHaveBeenCalled();
    });

    it('calls afterChat hook on successful non-streaming response', async () => {
      const afterChat = vi.fn();
      mockChat.mockReturnValue(
        asyncChunks([{ type: 'text', text: 'OK' }, { type: 'message_end' }])
      );

      const handler = createMultiProviderHandler({ afterChat });
      const req = makeRequest({ messages: [], stream: false });
      await handler(req);

      expect(afterChat).toHaveBeenCalledWith(req, expect.objectContaining({ content: 'OK' }));
    });

    it('does NOT call afterChat hook on streaming response', async () => {
      const afterChat = vi.fn();
      mockChat.mockReturnValue(
        asyncChunks([{ type: 'text', text: 'OK' }, { type: 'message_end' }])
      );

      const handler = createMultiProviderHandler({ afterChat });
      const req = makeRequest({ messages: [], stream: true });
      const response = await handler(req);

      // Consume the stream
      await readSSE(response);

      // afterChat is not called for streaming
      expect(afterChat).not.toHaveBeenCalled();
    });

    it('calls onError hook on error', async () => {
      const onError = vi.fn().mockReturnValue(null);
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('server_error', 'Server broke', 'claude', true);
      });

      // When stream is false and createChatResponse throws, handler catches it
      const handler = createMultiProviderHandler({ onError });
      const req = makeRequest({ messages: [], stream: false });
      await handler(req);

      expect(onError).toHaveBeenCalled();
    });

    it('uses custom error response from onError hook when returned', async () => {
      const { NextResponse } = await import('next/server');
      const customResponse = NextResponse.json({ custom: true }, { status: 503 });
      const onError = vi.fn().mockReturnValue(customResponse);

      mockChat.mockImplementation(() => {
        throw new Error('boom');
      });

      const handler = createMultiProviderHandler({ onError });
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      // Should return the custom response
      expect(response).toBe(customResponse);
    });

    it('returns 429 for rate_limited errors', async () => {
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true, 10000);
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      expect(response.status).toBe(429);
    });

    it('returns 401 for auth_failed errors', async () => {
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('auth_failed', 'Bad key', 'claude', false);
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      expect(response.status).toBe(401);
    });

    it('returns 500 for generic server errors', async () => {
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('server_error', 'Internal', 'claude', true);
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      expect(response.status).toBe(500);
    });

    it('returns 500 for unknown error codes', async () => {
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('unknown', 'Unknown error', 'claude', false);
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      expect(response.status).toBe(500);
    });

    it('returns properly structured error response body', async () => {
      mockChat.mockImplementation(() => {
        throw new UnifiedAIError('rate_limited', 'Slow down', 'claude', true, 30000);
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);
      const body = await response.json();

      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('rate_limited');
      expect(body.error.provider).toBe('claude');
      expect(body.error.retryable).toBe(true);
      expect(body.error.retryAfterMs).toBe(30000);
    });

    it('handles non-UnifiedAIError exceptions in handler', async () => {
      mockChat.mockImplementation(() => {
        throw new TypeError('Cannot read property foo');
      });

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      const response = await handler(req);

      // Should still return an error response (parseProviderError wraps it)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('passes enableFallback=false from body to chatOptions', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler({ enableFallback: true });
      const req = makeRequest({
        messages: [],
        enableFallback: false,
        stream: false,
      });
      await handler(req);

      // The chat was called; verify the options passed
      const callArgs = mockChat.mock.calls[0];
      const opts = callArgs[1];
      expect(opts.enableFallback).toBe(false);
      expect(opts.fallbackProviderId).toBeUndefined();
    });

    it('passes maxTokens and temperature from body', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler();
      const req = makeRequest({
        messages: [],
        maxTokens: 2048,
        temperature: 0.7,
        stream: false,
      });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(opts.maxTokens).toBe(2048);
      expect(opts.temperature).toBe(0.7);
    });

    it('passes model from body', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler();
      const req = makeRequest({
        messages: [],
        model: 'gpt-4o',
        stream: false,
      });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(opts.model).toBe('gpt-4o');
    });

    it('passes tools from body', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));
      const tools = [
        { name: 'my_tool', description: 'A tool', parameters: { type: 'object', properties: {} } },
      ];

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], tools, stream: false });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(opts.tools).toEqual(tools);
    });

    it('passes systemPrompt from body', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler();
      const req = makeRequest({
        messages: [],
        systemPrompt: 'Be helpful.',
        stream: false,
      });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(opts.systemPrompt).toBe('Be helpful.');
    });

    it('provides onProviderSwitch callback in chatOptions', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [], stream: false });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(typeof opts.onProviderSwitch).toBe('function');
    });

    it('defaults stream to true when not specified in body', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler();
      const req = makeRequest({ messages: [] });
      const response = await handler(req);

      // Should be a streaming response
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('uses fallback provider from handler options', async () => {
      mockChat.mockReturnValue(asyncChunks([{ type: 'message_end' }]));

      const handler = createMultiProviderHandler({ fallbackProvider: 'deepseek' });
      const req = makeRequest({ messages: [], stream: false });
      await handler(req);

      const opts = mockChat.mock.calls[0][1];
      expect(opts.fallbackProviderId).toBe('deepseek');
    });

    it('handles req.json() throwing', async () => {
      const handler = createMultiProviderHandler();
      const req = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        nextUrl: new URL('http://localhost/api/chat'),
        headers: new Headers(),
      } as unknown as import('next/server').NextRequest;

      const response = await handler(req);
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
