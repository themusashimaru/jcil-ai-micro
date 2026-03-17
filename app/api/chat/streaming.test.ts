// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockGetDefaultChatModelId = vi.fn().mockReturnValue('claude-opus-4-6');
const mockGetFreeTierModelId = vi.fn().mockReturnValue('claude-opus-4-6');
const mockGetDefaultModel = vi.fn();
const mockIsProviderAvailable = vi.fn();
const mockGetProviderAndModel = vi.fn();
const mockGetAvailableProviderIds = vi.fn().mockReturnValue(['claude', 'openai']);

vi.mock('@/lib/ai/providers/registry', () => ({
  getDefaultModel: (...args: unknown[]) => mockGetDefaultModel(...args),
  getDefaultChatModelId: () => mockGetDefaultChatModelId(),
  getFreeTierModelId: () => mockGetFreeTierModelId(),
  isProviderAvailable: (...args: unknown[]) => mockIsProviderAvailable(...args),
  getProviderAndModel: (...args: unknown[]) => mockGetProviderAndModel(...args),
  getAvailableProviderIds: () => mockGetAvailableProviderIds(),
}));

const mockGetAdapter = vi.fn();
vi.mock('@/lib/ai/providers/adapters', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

const mockReleaseSlot = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/queue', () => ({
  releaseSlot: (...args: unknown[]) => mockReleaseSlot(...args),
}));

const mockCreatePendingRequest = vi.fn().mockResolvedValue('pending-123');
const mockCompletePendingRequest = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/pending-requests', () => ({
  createPendingRequest: (...args: unknown[]) => mockCreatePendingRequest(...args),
  completePendingRequest: (...args: unknown[]) => mockCompletePendingRequest(...args),
}));

vi.mock('@/lib/api/utils', () => ({
  chatErrorResponse: (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status }),
}));

vi.mock('@/lib/constants', () => ({
  ERROR_CODES: { INVALID_INPUT: 'INVALID_INPUT' },
  HTTP_STATUS: { BAD_REQUEST: 400 },
  TIMEOUTS: { API_REQUEST: 30000, AI_RESPONSE: 120000 },
}));

const mockTrackTokenUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/usage/track', () => ({
  trackTokenUsage: (...args: unknown[]) => mockTrackTokenUsage(...args),
}));

const mockIncrementTokenUsage = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/limits', () => ({
  incrementTokenUsage: (...args: unknown[]) => mockIncrementTokenUsage(...args),
}));

const mockProcessConversationForMemory = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/memory', () => ({
  processConversationForMemory: (...args: unknown[]) => mockProcessConversationForMemory(...args),
}));

const mockRouteChatWithTools = vi.fn();
vi.mock('@/lib/ai/chat-router', () => ({
  routeChatWithTools: (...args: unknown[]) => mockRouteChatWithTools(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  resolveProvider,
  createStreamPendingRequest,
  handleNonClaudeProvider,
  handleClaudeProvider,
  type StreamConfig,
} from './streaming';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a ReadableStream to completion and return its text content. */
async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
    if (chunk.value) result += decoder.decode(chunk.value, { stream: !done });
  }
  return result;
}

/** Build a minimal StreamConfig for testing. */
function makeStreamConfig(overrides: Partial<StreamConfig> = {}): StreamConfig {
  const controller = new AbortController();
  return {
    messages: [{ role: 'user' as const, content: 'Hello' }],
    systemPrompt: 'You are a helpful assistant.',
    tools: [],
    toolExecutor: vi.fn(),
    selectedModel: 'gpt-4',
    selectedProviderId: 'openai',
    provider: 'openai',
    maxTokens: 4096,
    requestId: 'req-1',
    userId: 'user-1',
    userPlanKey: 'pro',
    isAuthenticated: true,
    requestStartTime: Date.now(),
    request: new Request('https://example.com/api/chat', { signal: controller.signal }),
    ...overrides,
  };
}

/** Create an async iterable from an array of chunks. */
function asyncIterableFrom<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < items.length) {
            return { value: items[index++], done: false as const };
          }
          return { value: undefined as unknown as T, done: true as const };
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // resolveProvider
  // =========================================================================
  describe('resolveProvider', () => {
    it('returns Opus for all users (no planKey)', () => {
      const result = resolveProvider(undefined);
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-opus-4-6');
      expect(result.error).toBeUndefined();
    });

    it('returns Opus for explicit "free" planKey', () => {
      const result = resolveProvider(undefined, 'free');
      expect(result.selectedModel).toBe('claude-opus-4-6');
    });

    it('returns Opus for paid users', () => {
      const result = resolveProvider(undefined, 'pro');
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-opus-4-6');
      expect(result.error).toBeUndefined();
    });

    it('selects an available non-Claude provider', () => {
      mockIsProviderAvailable.mockReturnValue(true);
      mockGetDefaultModel.mockReturnValue({ id: 'gpt-4o' });

      const result = resolveProvider('openai', 'pro');
      expect(result.selectedProviderId).toBe('openai');
      expect(result.selectedModel).toBe('gpt-4o');
      expect(result.error).toBeUndefined();
    });

    it('returns error response for unavailable provider', () => {
      mockIsProviderAvailable.mockReturnValue(false);

      const result = resolveProvider('nonexistent', 'pro');
      expect(result.error).toBeInstanceOf(Response);
      // Falls back to tier-based default for the model/provider fields
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-opus-4-6');
    });

    it('ignores provider when getDefaultModel returns null', () => {
      mockIsProviderAvailable.mockReturnValue(true);
      mockGetDefaultModel.mockReturnValue(null);

      const result = resolveProvider('openai', 'plus');
      // Should stay on default Claude model
      expect(result.selectedModel).toBe('claude-opus-4-6');
    });

    it('handles empty string provider as no provider', () => {
      const result = resolveProvider('', 'pro');
      expect(result.selectedProviderId).toBe('claude');
      expect(result.selectedModel).toBe('claude-opus-4-6');
      expect(result.error).toBeUndefined();
    });
  });

  // =========================================================================
  // createStreamPendingRequest
  // =========================================================================
  describe('createStreamPendingRequest', () => {
    it('returns null when conversationId is absent', async () => {
      const result = await createStreamPendingRequest({
        userId: 'user-1',
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-3',
      });
      expect(result).toBeNull();
      expect(mockCreatePendingRequest).not.toHaveBeenCalled();
    });

    it('creates pending request and returns id', async () => {
      const result = await createStreamPendingRequest({
        userId: 'user-1',
        conversationId: 'conv-1',
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3',
      });
      expect(result).toBe('pending-123');
      expect(mockCreatePendingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          conversationId: 'conv-1',
          model: 'claude-3',
        })
      );
    });

    it('serializes non-string message content to JSON', async () => {
      await createStreamPendingRequest({
        userId: 'user-1',
        conversationId: 'conv-1',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        model: 'claude-3',
      });

      expect(mockCreatePendingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: JSON.stringify([{ type: 'text', text: 'Hello' }]),
            },
          ],
        })
      );
    });

    it('returns null when createPendingRequest resolves to null', async () => {
      mockCreatePendingRequest.mockResolvedValueOnce(null);

      const result = await createStreamPendingRequest({
        userId: 'user-1',
        conversationId: 'conv-1',
        messages: [],
        model: 'claude-3',
      });
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // handleNonClaudeProvider
  // =========================================================================
  describe('handleNonClaudeProvider', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Set required API keys so the env-check inside the stream doesn't throw
      process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test-key' };
      mockGetProviderAndModel.mockReturnValue({
        provider: { id: 'openai' },
        model: { id: 'gpt-4', maxOutputTokens: 4096 },
      });
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('streams text chunks from the adapter', async () => {
      const chatStream = asyncIterableFrom([
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'World' },
      ]);
      mockGetAdapter.mockReturnValue({ chat: vi.fn().mockReturnValue(chatStream) });

      const config = makeStreamConfig();
      const response = handleNonClaudeProvider(config);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(response.headers.get('X-Provider')).toBe('openai');
      expect(response.headers.get('X-Model-Used')).toBe('gpt-4');
      expect(response.headers.get('X-Used-Fallback')).toBe('false');
      expect(response.headers.get('X-Used-Tools')).toBe('false');

      const text = await readStream(response);
      expect(text).toBe('Hello World');
    });

    it('releases slot when stream finishes', async () => {
      const chatStream = asyncIterableFrom([{ type: 'text', text: 'done' }]);
      mockGetAdapter.mockReturnValue({ chat: vi.fn().mockReturnValue(chatStream) });

      const response = handleNonClaudeProvider(makeStreamConfig());
      await readStream(response);

      // Allow microtasks to resolve
      await vi.advanceTimersByTimeAsync(10);
      expect(mockReleaseSlot).toHaveBeenCalledWith('req-1');
    });

    it('releases slot on request abort', async () => {
      const controller = new AbortController();
      // Create a stream that never resolves so we can test abort
      const neverResolve = asyncIterableFrom<{ type: string; text: string }>([]);
      mockGetAdapter.mockReturnValue({ chat: vi.fn().mockReturnValue(neverResolve) });

      const config = makeStreamConfig({
        request: new Request('https://example.com', { signal: controller.signal }),
      });
      handleNonClaudeProvider(config);

      controller.abort();
      await vi.advanceTimersByTimeAsync(10);
      expect(mockReleaseSlot).toHaveBeenCalledWith('req-1');
    });

    it('handles adapter error chunks gracefully', async () => {
      const chatStream = asyncIterableFrom([
        { type: 'text', text: 'partial ' },
        { type: 'error', error: { code: 500, message: 'Internal failure' } },
      ]);
      mockGetAdapter.mockReturnValue({ chat: vi.fn().mockReturnValue(chatStream) });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      // The error causes a throw which results in a generic error message
      expect(text).toContain('partial ');
      expect(text).toContain('Error');
    });

    it('shows API config error when key is not configured', async () => {
      // Remove the env key so the internal check fires
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY_1;
      mockGetAdapter.mockReturnValue({
        chat: vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }])),
      });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      expect(text).toContain('API Configuration Error');
      expect(text).toContain('OPENAI');
    });

    it('shows auth error for invalid API key', async () => {
      const _chatStream = asyncIterableFrom([]);
      mockGetAdapter.mockReturnValue({
        chat: vi.fn().mockImplementation(() => {
          // Throw on iteration start
          return {
            [Symbol.asyncIterator]() {
              return {
                async next() {
                  throw new Error('invalid api key provided');
                },
              };
            },
          };
        }),
      });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      expect(text).toContain('API Authentication Error');
    });

    it('shows rate limit error for 429 responses', async () => {
      mockGetAdapter.mockReturnValue({
        chat: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              async next() {
                throw new Error('429 Too Many Requests');
              },
            };
          },
        }),
      });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      expect(text).toContain('Rate Limit');
    });

    it('shows model error when model not found', async () => {
      mockGetAdapter.mockReturnValue({
        chat: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              async next() {
                throw new Error('model gpt-5 not found');
              },
            };
          },
        }),
      });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      expect(text).toContain('Model Error');
    });

    it('shows generic error for unknown failures', async () => {
      mockGetAdapter.mockReturnValue({
        chat: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]() {
            return {
              async next() {
                throw new Error('something completely unexpected');
              },
            };
          },
        }),
      });

      const response = handleNonClaudeProvider(makeStreamConfig());
      const text = await readStream(response);
      expect(text).toContain('Something went wrong');
    });

    it('converts non-string message content correctly', async () => {
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({
        messages: [{ role: 'user' as const, content: [{ type: 'text', text: 'Hello' }] }],
      });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([{ type: 'text', text: 'Hello' }]),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('converts base64 image content blocks', async () => {
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({
        messages: [
          {
            role: 'user' as const,
            content: [{ type: 'image', image: 'data:image/png;base64,abc123' }],
          },
        ],
      });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'image',
                source: { type: 'base64', data: 'abc123', mediaType: 'image/png' },
              }),
            ]),
          }),
        ]),
        expect.any(Object)
      );
    });

    it('handles null/undefined message content gracefully', async () => {
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user' as const, content: null as any }],
      });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ role: 'user', content: '' })]),
        expect.any(Object)
      );
    });

    it('passes BYOK userApiKey to adapter', async () => {
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({ userApiKey: 'sk-user-key' });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ userApiKey: 'sk-user-key' })
      );
    });

    it('skips API key env check when userApiKey is provided', async () => {
      // Even without env vars, should not throw config error when BYOK is set
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({ userApiKey: 'sk-my-key' });
      const response = handleNonClaudeProvider(config);
      const text = await readStream(response);
      expect(text).toBe('ok');
    });

    it('uses provider maxOutputTokens when available', async () => {
      mockGetProviderAndModel.mockReturnValue({
        provider: { id: 'openai' },
        model: { id: 'gpt-4', maxOutputTokens: 8192 },
      });
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({ maxTokens: 2048 });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ maxTokens: 8192 })
      );
    });

    it('falls back to config maxTokens when provider model info is null', async () => {
      mockGetProviderAndModel.mockReturnValue(null);
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({ maxTokens: 2048 });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      expect(mockChat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ maxTokens: 2048 })
      );
    });

    it('handles empty content array in messages', async () => {
      const mockChat = vi.fn().mockReturnValue(asyncIterableFrom([{ type: 'text', text: 'ok' }]));
      mockGetAdapter.mockReturnValue({ chat: mockChat });

      const config = makeStreamConfig({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [{ role: 'user' as const, content: [] as any }],
      });
      const response = handleNonClaudeProvider(config);
      await readStream(response);

      // Empty blocks => content becomes ''
      expect(mockChat).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ content: '' })]),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // handleClaudeProvider
  // =========================================================================
  describe('handleClaudeProvider', () => {
    function makeClaudeConfig(
      overrides: Partial<StreamConfig & { pendingRequestId: string | null }> = {}
    ) {
      const controller = new AbortController();
      return {
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there' },
        ],
        systemPrompt: 'system',
        tools: [],
        toolExecutor: vi.fn(),
        selectedModel: 'claude-opus-4-6',
        selectedProviderId: 'claude',
        provider: 'claude',
        maxTokens: 4096,
        requestId: 'req-claude-1',
        userId: 'user-1',
        userPlanKey: 'pro',
        isAuthenticated: true,
        requestStartTime: Date.now(),
        request: new Request('https://example.com/api/chat', { signal: controller.signal }),
        pendingRequestId: 'pending-abc' as string | null,
        conversationId: 'conv-1',
        ...overrides,
      };
    }

    function setupRouteResult(text: string, overrides: Record<string, unknown> = {}) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      mockRouteChatWithTools.mockResolvedValue({
        stream,
        providerId: 'claude',
        model: 'claude-opus-4-6',
        usedFallback: false,
        usedTools: false,
        toolsUsed: [],
        ...overrides,
      });
    }

    it('returns a streaming Response with correct headers', async () => {
      setupRouteResult('Hello from Claude');

      const response = await handleClaudeProvider(makeClaudeConfig());
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(response.headers.get('X-Model-Used')).toBe('claude-opus-4-6');
      expect(response.headers.get('X-Provider')).toBe('claude');
      expect(response.headers.get('X-Used-Fallback')).toBe('false');
      expect(response.headers.get('X-Used-Tools')).toBe('false');
      expect(response.headers.get('X-Tools-Used')).toBe('none');
    });

    it('includes fallback and tool headers when applicable', async () => {
      setupRouteResult('response', {
        usedFallback: true,
        usedTools: true,
        toolsUsed: ['search', 'calculator'],
      });

      const response = await handleClaudeProvider(makeClaudeConfig());
      expect(response.headers.get('X-Used-Fallback')).toBe('true');
      expect(response.headers.get('X-Used-Tools')).toBe('true');
      expect(response.headers.get('X-Tools-Used')).toBe('search,calculator');
    });

    it('appends [DONE] marker at end of stream', async () => {
      setupRouteResult('Hello');

      const response = await handleClaudeProvider(makeClaudeConfig());
      const text = await readStream(response);
      expect(text).toContain('Hello');
      expect(text).toContain('[DONE]');
    });

    it('releases slot when stream completes', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig();
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockReleaseSlot).toHaveBeenCalledWith('req-claude-1');
    });

    it('completes pending request on stream finish', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig({ pendingRequestId: 'pending-xyz' });
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockCompletePendingRequest).toHaveBeenCalledWith('pending-xyz');
    });

    it('does not complete pending request when pendingRequestId is null', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig({ pendingRequestId: null });
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockCompletePendingRequest).not.toHaveBeenCalled();
    });

    it('processes memory for authenticated users with 2+ messages', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig({ isAuthenticated: true });
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockProcessConversationForMemory).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Hello' })]),
        'conv-1'
      );
    });

    it('does not process memory for unauthenticated users', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig({ isAuthenticated: false });
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockProcessConversationForMemory).not.toHaveBeenCalled();
    });

    it('does not process memory when fewer than 2 messages', async () => {
      setupRouteResult('done');

      const config = makeClaudeConfig({
        isAuthenticated: true,
        messages: [{ role: 'user' as const, content: 'Hi' }],
      });
      const response = await handleClaudeProvider(config);
      await readStream(response);
      await vi.advanceTimersByTimeAsync(10);

      expect(mockProcessConversationForMemory).not.toHaveBeenCalled();
    });

    it('releases slot on request abort', async () => {
      const controller = new AbortController();
      // Long-running stream
      const stream = new ReadableStream({
        start() {
          // intentionally never closes
        },
      });
      mockRouteChatWithTools.mockResolvedValue({
        stream,
        providerId: 'claude',
        model: 'claude-opus-4-6',
        usedFallback: false,
        usedTools: false,
        toolsUsed: [],
      });

      const config = makeClaudeConfig({
        request: new Request('https://example.com', { signal: controller.signal }),
      });
      await handleClaudeProvider(config);

      controller.abort();
      await vi.advanceTimersByTimeAsync(10);
      expect(mockReleaseSlot).toHaveBeenCalledWith('req-claude-1');
    });

    it('force-releases slot after 30s timeout', async () => {
      // Stream that never closes
      const stream = new ReadableStream({ start() {} });
      mockRouteChatWithTools.mockResolvedValue({
        stream,
        providerId: 'claude',
        model: 'claude-opus-4-6',
        usedFallback: false,
        usedTools: false,
        toolsUsed: [],
      });

      const config = makeClaudeConfig();
      await handleClaudeProvider(config);

      // Not yet released
      expect(mockReleaseSlot).not.toHaveBeenCalled();

      // Advance past 30s timeout
      await vi.advanceTimersByTimeAsync(31_000);
      expect(mockReleaseSlot).toHaveBeenCalledWith('req-claude-1');
    });

    it('only releases slot once even with multiple triggers', async () => {
      const controller = new AbortController();
      setupRouteResult('done');

      const config = makeClaudeConfig({
        request: new Request('https://example.com', { signal: controller.signal }),
      });
      const response = await handleClaudeProvider(config);
      await readStream(response);

      // Abort after stream is already done
      controller.abort();
      await vi.advanceTimersByTimeAsync(31_000);

      // Should be called exactly once despite flush + abort + timeout
      expect(mockReleaseSlot).toHaveBeenCalledTimes(1);
    });

    it('passes userApiKey to routeChatWithTools options', async () => {
      setupRouteResult('ok');

      const config = makeClaudeConfig({ userApiKey: 'sk-byok-key' });
      await handleClaudeProvider(config);

      expect(mockRouteChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ userApiKey: 'sk-byok-key' }),
        expect.any(Function)
      );
    });

    it('calls onUsage to track and increment token usage', async () => {
      setupRouteResult('ok');

      const config = makeClaudeConfig();
      await handleClaudeProvider(config);

      // Extract the onUsage callback from the call
      const routeOptions = mockRouteChatWithTools.mock.calls[0][1];
      expect(routeOptions.onUsage).toBeInstanceOf(Function);

      // Simulate a usage callback
      routeOptions.onUsage({ inputTokens: 100, outputTokens: 50 });

      await vi.advanceTimersByTimeAsync(10);

      expect(mockTrackTokenUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          inputTokens: 100,
          outputTokens: 50,
          source: 'chat',
        })
      );

      expect(mockIncrementTokenUsage).toHaveBeenCalledWith('user-1', 'pro', 150);
    });

    it('calls onProviderSwitch callback when provided', async () => {
      setupRouteResult('ok');

      const config = makeClaudeConfig();
      await handleClaudeProvider(config);

      const routeOptions = mockRouteChatWithTools.mock.calls[0][1];
      expect(routeOptions.onProviderSwitch).toBeInstanceOf(Function);

      // Should not throw
      routeOptions.onProviderSwitch('claude', 'openai', 'rate_limit');
    });

    it('passes thinking config to route options', async () => {
      setupRouteResult('ok');

      const config = makeClaudeConfig({
        thinking: { enabled: true, budgetTokens: 10000 },
      });
      await handleClaudeProvider(config);

      expect(mockRouteChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          thinking: { enabled: true, budgetTokens: 10000 },
        }),
        expect.any(Function)
      );
    });
  });
});
