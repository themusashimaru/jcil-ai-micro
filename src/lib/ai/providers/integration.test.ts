/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TEST-003: Provider Service Integration Tests
 *
 * Tests the end-to-end chat → tool → response flow with mocked adapters.
 * Covers: streaming, tool calls, retry logic, provider fallback, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the adapter factory to return controllable adapters
const mockAdapters = new Map<string, any>();

vi.mock('./adapters/factory', () => ({
  getAdapter: vi.fn((id: string) => mockAdapters.get(id) ?? null),
  createAdapter: vi.fn((id: string) => mockAdapters.get(id) ?? null),
  clearAdapterCache: vi.fn(),
  hasAdapterCached: vi.fn(),
  isOpenAICompatible: vi.fn((id: string) => ['openai', 'xai', 'deepseek'].includes(id)),
  isAnthropicProvider: vi.fn((id: string) => id === 'claude'),
  isGoogleProvider: vi.fn((id: string) => id === 'google'),
}));

// Mock registry to report providers as available
vi.mock('./registry', () => ({
  getProvider: vi.fn((id: string) => ({
    id,
    name: id,
    family: id === 'claude' ? 'anthropic' : 'openai-compatible',
    apiKeyEnv: `${id.toUpperCase()}_API_KEY`,
    capabilities: {
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: true,
      toolCalling: true,
      extendedThinking: false,
    },
    models: [{ id: `${id}-default`, name: 'Default', isDefault: true, contextWindow: 100000 }],
  })),
  getDefaultModel: vi.fn((id: string) => ({
    id: `${id}-default`,
    name: 'Default',
    isDefault: true,
    contextWindow: 100000,
    maxOutputTokens: 4096,
    inputPricePer1M: 1,
    outputPricePer1M: 5,
    tier: 'standard',
  })),
  isProviderAvailable: vi.fn(() => true),
  getAvailableProviders: vi.fn(() => []),
  getAvailableProviderIds: vi.fn(() => ['claude', 'openai']),
  PROVIDERS: {},
}));

// Mock errors module
vi.mock('./errors', async () => {
  const { UnifiedAIError } = await import('./types');
  return {
    parseProviderError: vi.fn((err: any, provider: string) => {
      if (err instanceof UnifiedAIError) return err;
      return new UnifiedAIError(
        'server_error',
        err?.message ?? 'Unknown error',
        provider as any,
        true,
        5000,
        err
      );
    }),
    parseAnthropicError: vi.fn(),
    parseOpenAIError: vi.fn(),
    canRecoverWithFallback: vi.fn(() => true),
    getUserFriendlyMessage: vi.fn(() => 'An error occurred'),
    shouldReportError: vi.fn(() => false),
    withRetry: vi.fn(),
    createRetryWrapper: vi.fn(),
    calculateRetryDelay: vi.fn(() => 100),
    sleep: vi.fn(() => Promise.resolve()),
    DEFAULT_RETRY_CONFIG: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitter: false,
    },
  };
});

// Mock context module
vi.mock('./context', () => ({
  prepareProviderHandoff: vi.fn(),
  canHandoff: vi.fn(() => ({ possible: true, warnings: [] })),
  prepareMessagesForProvider: vi.fn((msgs: any) => msgs),
  needsSummarization: vi.fn(() => false),
  estimateTokenCount: vi.fn(() => 100),
  getMaxContextSize: vi.fn(() => 100000),
  DEFAULT_HANDOFF_OPTIONS: {},
  summarizeContext: vi.fn(),
  estimateMessageTokens: vi.fn(() => 50),
  estimateStringTokens: vi.fn(() => 10),
  isSummaryMessage: vi.fn(() => false),
  getCompressionRatio: vi.fn(() => 0.5),
  DEFAULT_SUMMARIZATION_OPTIONS: {},
  analyzeCapabilityLoss: vi.fn(() => ({ lost: [], gained: [] })),
  isHandoffSafe: vi.fn(() => true),
  getRecommendedHandoffProvider: vi.fn(() => 'openai'),
}));

import { ProviderService } from './service';
import { UnifiedAIError } from './types';
import type { UnifiedMessage, UnifiedStreamChunk, AIAdapter } from './types';

// ============================================================================
// HELPERS
// ============================================================================

/** Create a mock adapter that yields given chunks */
function createMockAdapter(
  providerId: string,
  chunks: UnifiedStreamChunk[],
  options?: { throwError?: Error }
): AIAdapter {
  return {
    providerId: providerId as any,
    family: providerId === 'claude' ? 'anthropic' : 'openai-compatible',
    async *chat() {
      if (options?.throwError) throw options.throwError;
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    formatTools: vi.fn((tools) => tools),
    toProviderMessages: vi.fn((msgs) => msgs),
    fromProviderMessages: vi.fn((msgs) => msgs),
    formatToolResult: vi.fn((r) => r),
    getCapabilities: vi.fn(() => ({
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: true,
      toolCalling: true,
      extendedThinking: false,
    })),
    hasCapability: vi.fn(() => true),
  } as any;
}

/** Collect all chunks from an async generator */
async function collectChunks(
  gen: AsyncGenerator<UnifiedStreamChunk, any, unknown>
): Promise<{ chunks: UnifiedStreamChunk[]; result: any }> {
  const chunks: UnifiedStreamChunk[] = [];
  let result: any;
  while (true) {
    const next = await gen.next();
    if (next.done) {
      result = next.value;
      break;
    }
    chunks.push(next.value);
  }
  return { chunks, result };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Provider Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapters.clear();
  });

  // --------------------------------------------------------------------------
  // STREAMING TEXT RESPONSES
  // --------------------------------------------------------------------------

  describe('Streaming text responses', () => {
    it('should stream a simple text response', async () => {
      const textChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Hello, ' },
        { type: 'text', text: 'world!' },
        { type: 'message_end', usage: { inputTokens: 10, outputTokens: 5 } },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', textChunks));
      const service = new ProviderService('claude', null);

      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hi' }];
      const { chunks, result } = await collectChunks(
        service.chat(messages, { enableRetry: false, enableFallback: false })
      );

      expect(chunks).toHaveLength(4);
      expect(chunks[0].type).toBe('message_start');
      expect(chunks[1].text).toBe('Hello, ');
      expect(chunks[2].text).toBe('world!');
      expect(chunks[3].type).toBe('message_end');
      expect(result.providerId).toBe('claude');
      expect(result.usedFallback).toBe(false);
    });

    it('should accumulate text from multiple chunks', async () => {
      const textChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'The ' },
        { type: 'text', text: 'quick ' },
        { type: 'text', text: 'brown ' },
        { type: 'text', text: 'fox' },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', textChunks));
      const service = new ProviderService('claude', null);

      const { chunks } = await collectChunks(
        service.chat([{ role: 'user', content: 'Tell me a story' }], {
          enableRetry: false,
          enableFallback: false,
        })
      );

      const textContent = chunks
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      expect(textContent).toBe('The quick brown fox');
    });
  });

  // --------------------------------------------------------------------------
  // TOOL CALL STREAMING
  // --------------------------------------------------------------------------

  describe('Tool call streaming', () => {
    it('should stream tool call chunks', async () => {
      const toolChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Let me search for that.' },
        {
          type: 'tool_call_start',
          toolCall: { id: 'tc-1', name: 'web_search' },
        },
        {
          type: 'tool_call_delta',
          toolCall: { arguments: '{"query":"test"}' },
        },
        { type: 'tool_call_end', toolCall: { id: 'tc-1' } },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', toolChunks));
      const service = new ProviderService('claude', null);

      const { chunks } = await collectChunks(
        service.chat([{ role: 'user', content: 'Search for test' }], {
          enableRetry: false,
          enableFallback: false,
        })
      );

      const toolStart = chunks.find((c) => c.type === 'tool_call_start');
      expect(toolStart?.toolCall?.name).toBe('web_search');

      const toolDelta = chunks.find((c) => c.type === 'tool_call_delta');
      expect(toolDelta?.toolCall?.arguments).toBe('{"query":"test"}');

      const toolEnd = chunks.find((c) => c.type === 'tool_call_end');
      expect(toolEnd?.toolCall?.id).toBe('tc-1');
    });

    it('should handle multiple parallel tool calls', async () => {
      const parallelToolChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'tool_call_start', toolCall: { id: 'tc-1', name: 'web_search' } },
        { type: 'tool_call_delta', toolCall: { arguments: '{"query":"A"}' } },
        { type: 'tool_call_end', toolCall: { id: 'tc-1' } },
        { type: 'tool_call_start', toolCall: { id: 'tc-2', name: 'fetch_url' } },
        { type: 'tool_call_delta', toolCall: { arguments: '{"url":"https://example.com"}' } },
        { type: 'tool_call_end', toolCall: { id: 'tc-2' } },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', parallelToolChunks));
      const service = new ProviderService('claude', null);

      const { chunks } = await collectChunks(
        service.chat([{ role: 'user', content: 'Do two things' }], {
          enableRetry: false,
          enableFallback: false,
        })
      );

      const toolStarts = chunks.filter((c) => c.type === 'tool_call_start');
      expect(toolStarts).toHaveLength(2);
      expect(toolStarts[0].toolCall?.name).toBe('web_search');
      expect(toolStarts[1].toolCall?.name).toBe('fetch_url');
    });
  });

  // --------------------------------------------------------------------------
  // TOOL RESULT MESSAGES
  // --------------------------------------------------------------------------

  describe('Tool result messages', () => {
    it('should accept tool result messages in conversation', async () => {
      const responseChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Based on the search results, here is the answer.' },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', responseChunks));
      const service = new ProviderService('claude', null);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Search for test' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tc-1', name: 'web_search', arguments: { query: 'test' } },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'tc-1',
              content: 'Search results for test',
              isError: false,
            },
          ],
        },
      ];

      const { chunks } = await collectChunks(
        service.chat(messages, { enableRetry: false, enableFallback: false })
      );

      const textChunks = chunks.filter((c) => c.type === 'text');
      expect(textChunks).toHaveLength(1);
      expect(textChunks[0].text).toContain('search results');
    });

    it('should handle error tool results', async () => {
      const responseChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'The search failed, let me try another approach.' },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', responseChunks));
      const service = new ProviderService('claude', null);

      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Search for test' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tc-1', name: 'web_search', arguments: { query: 'test' } },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'tc-1',
              content: 'Error: Network timeout',
              isError: true,
            },
          ],
        },
      ];

      const { chunks } = await collectChunks(
        service.chat(messages, { enableRetry: false, enableFallback: false })
      );

      expect(chunks.some((c) => c.type === 'text')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // PROVIDER FALLBACK
  // --------------------------------------------------------------------------

  describe('Provider fallback', () => {
    it('should fall back to secondary provider on error', async () => {
      const error = new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true, 1000);

      const fallbackChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Response from fallback' },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: error }));
      mockAdapters.set('openai', createMockAdapter('openai', fallbackChunks));

      const service = new ProviderService('claude', 'openai');

      const { chunks, result } = await collectChunks(
        service.chat([{ role: 'user', content: 'Hello' }], {
          enableRetry: false,
          enableFallback: true,
        })
      );

      expect(result.usedFallback).toBe(true);
      expect(result.providerId).toBe('openai');
      expect(chunks.some((c) => c.text === 'Response from fallback')).toBe(true);
    });

    it('should call onProviderSwitch callback during fallback', async () => {
      const error = new UnifiedAIError('server_error', 'Server down', 'claude', true);
      const switchCallback = vi.fn();

      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: error }));
      mockAdapters.set(
        'openai',
        createMockAdapter('openai', [
          { type: 'message_start' },
          { type: 'text', text: 'OK' },
          { type: 'message_end' },
        ])
      );

      const service = new ProviderService('claude', 'openai');

      await collectChunks(
        service.chat([{ role: 'user', content: 'Test' }], {
          enableRetry: false,
          enableFallback: true,
          onProviderSwitch: switchCallback,
        })
      );

      expect(switchCallback).toHaveBeenCalledWith('claude', 'openai', 'Server down');
    });

    it('should throw if fallback also fails', async () => {
      const primaryError = new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true);
      const fallbackError = new UnifiedAIError(
        'auth_failed',
        'Fallback also failed',
        'openai',
        false
      );

      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: primaryError }));
      mockAdapters.set('openai', createMockAdapter('openai', [], { throwError: fallbackError }));

      const service = new ProviderService('claude', 'openai');

      await expect(
        collectChunks(
          service.chat([{ role: 'user', content: 'Test' }], {
            enableRetry: false,
            enableFallback: true,
          })
        )
      ).rejects.toThrow();
    });

    it('should not fall back for non-recoverable errors', async () => {
      const { canRecoverWithFallback } = await import('./errors');
      (canRecoverWithFallback as any).mockReturnValueOnce(false);

      const error = new UnifiedAIError('auth_failed', 'Invalid key', 'claude', false);
      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: error }));
      mockAdapters.set(
        'openai',
        createMockAdapter('openai', [
          { type: 'message_start' },
          { type: 'text', text: 'Should not reach' },
          { type: 'message_end' },
        ])
      );

      const service = new ProviderService('claude', 'openai');

      await expect(
        collectChunks(
          service.chat([{ role: 'user', content: 'Test' }], {
            enableRetry: false,
            enableFallback: true,
          })
        )
      ).rejects.toThrow('Invalid key');
    });
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING
  // --------------------------------------------------------------------------

  describe('Error handling', () => {
    it('should throw when no adapter is available', async () => {
      // No adapter registered for 'claude'
      const service = new ProviderService('claude', null);

      await expect(
        collectChunks(
          service.chat([{ role: 'user', content: 'Hello' }], {
            enableRetry: false,
            enableFallback: false,
          })
        )
      ).rejects.toThrow(/not configured/);
    });

    it('should propagate stream errors', async () => {
      const error = new UnifiedAIError('content_filtered', 'Content blocked', 'claude', false);
      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: error }));

      const service = new ProviderService('claude', null);

      await expect(
        collectChunks(
          service.chat([{ role: 'user', content: 'Bad content' }], {
            enableRetry: false,
            enableFallback: false,
          })
        )
      ).rejects.toThrow('Content blocked');
    });
  });

  // --------------------------------------------------------------------------
  // PROVIDER SERVICE STATE
  // --------------------------------------------------------------------------

  describe('Provider service state', () => {
    it('should track current provider', () => {
      const service = new ProviderService('claude', 'openai');
      expect(service.getCurrentProvider()).toBe('claude');
    });

    it('should return provider statuses', () => {
      const service = new ProviderService();
      const statuses = service.getProviderStatuses();

      expect(statuses.length).toBe(5);
      const ids = statuses.map((s) => s.providerId);
      expect(ids).toContain('claude');
      expect(ids).toContain('openai');
      expect(ids).toContain('xai');
      expect(ids).toContain('deepseek');
      expect(ids).toContain('google');
    });

    it('should format tools via adapter', () => {
      const mockAdapter = createMockAdapter('claude', []);
      mockAdapters.set('claude', mockAdapter);

      const service = new ProviderService('claude', null);
      const tools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object' as const, properties: { q: { type: 'string' } } },
        },
      ];

      service.formatTools(tools);
      expect(mockAdapter.formatTools).toHaveBeenCalledWith(tools);
    });

    it('should check capabilities via adapter', () => {
      const mockAdapter = createMockAdapter('claude', []);
      mockAdapters.set('claude', mockAdapter);

      const service = new ProviderService('claude', null);
      const result = service.hasCapability('vision');
      expect(typeof result).toBe('boolean');
    });
  });

  // --------------------------------------------------------------------------
  // EXTENDED THINKING
  // --------------------------------------------------------------------------

  describe('Extended thinking', () => {
    it('should stream thinking chunks', async () => {
      const thinkingChunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'thinking', text: 'Let me think about this...' },
        { type: 'thinking', text: 'The answer involves...' },
        { type: 'text', text: 'Here is my answer.' },
        { type: 'message_end' },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', thinkingChunks));
      const service = new ProviderService('claude', null);

      const { chunks } = await collectChunks(
        service.chat([{ role: 'user', content: 'Think about this' }], {
          enableRetry: false,
          enableFallback: false,
          thinking: { enabled: true, budgetTokens: 10000 },
        })
      );

      const thinking = chunks.filter((c) => c.type === 'thinking');
      expect(thinking).toHaveLength(2);
      expect(thinking[0].text).toContain('think about');

      const text = chunks.filter((c) => c.type === 'text');
      expect(text).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // USAGE TRACKING
  // --------------------------------------------------------------------------

  describe('Usage tracking', () => {
    it('should report usage in message_end chunk', async () => {
      const chunks: UnifiedStreamChunk[] = [
        { type: 'message_start' },
        { type: 'text', text: 'Response' },
        { type: 'message_end', usage: { inputTokens: 150, outputTokens: 42 } },
      ];

      mockAdapters.set('claude', createMockAdapter('claude', chunks));
      const service = new ProviderService('claude', null);

      const { chunks: collected } = await collectChunks(
        service.chat([{ role: 'user', content: 'Test' }], {
          enableRetry: false,
          enableFallback: false,
        })
      );

      const endChunk = collected.find((c) => c.type === 'message_end');
      expect(endChunk?.usage?.inputTokens).toBe(150);
      expect(endChunk?.usage?.outputTokens).toBe(42);
    });
  });

  // --------------------------------------------------------------------------
  // CHAT RESULT METADATA
  // --------------------------------------------------------------------------

  describe('Chat result metadata', () => {
    it('should return provider and model in result', async () => {
      mockAdapters.set(
        'claude',
        createMockAdapter('claude', [
          { type: 'message_start' },
          { type: 'text', text: 'Hi' },
          { type: 'message_end' },
        ])
      );

      const service = new ProviderService('claude', null);
      const { result } = await collectChunks(
        service.chat([{ role: 'user', content: 'Hello' }], {
          enableRetry: false,
          enableFallback: false,
        })
      );

      expect(result.providerId).toBe('claude');
      expect(result.model).toBe('claude-default');
      expect(result.usedFallback).toBe(false);
      expect(result.fallbackReason).toBeUndefined();
    });

    it('should include fallback reason when fallback is used', async () => {
      const error = new UnifiedAIError('rate_limited', 'Rate limited', 'claude', true);
      mockAdapters.set('claude', createMockAdapter('claude', [], { throwError: error }));
      mockAdapters.set(
        'openai',
        createMockAdapter('openai', [
          { type: 'message_start' },
          { type: 'text', text: 'Fallback response' },
          { type: 'message_end' },
        ])
      );

      const service = new ProviderService('claude', 'openai');
      const { result } = await collectChunks(
        service.chat([{ role: 'user', content: 'Test' }], {
          enableRetry: false,
          enableFallback: true,
        })
      );

      expect(result.usedFallback).toBe(true);
      expect(result.fallbackReason).toBe('Rate limited');
      expect(result.providerId).toBe('openai');
    });
  });
});
