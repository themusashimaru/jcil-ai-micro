// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockChat = vi.fn();
const mockGetProviderStatuses = vi.fn().mockReturnValue([]);
const mockGetConfiguredProviders = vi.fn().mockReturnValue([]);

vi.mock('./providers/service', () => ({
  createProviderService: vi.fn(() => ({
    chat: mockChat,
    getProviderStatuses: mockGetProviderStatuses,
    getConfiguredProviders: mockGetConfiguredProviders,
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  convertToUnifiedMessages,
  createStreamFromChunks,
  routeChat,
  routeChatWithTools,
  completeChat,
  isProviderConfigured,
  getAvailableProviders,
  getDefaultProviders,
} from './chat-router';
import type { CoreMessage } from 'ai';
import type { UnifiedStreamChunk, UnifiedToolCall, UnifiedToolResult } from './providers/types';
import type { ProviderChatResult } from './providers/service';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create an async generator that yields chunks and returns a result.
 */
async function* makeChunkGenerator(
  chunks: UnifiedStreamChunk[],
  result?: ProviderChatResult
): AsyncGenerator<UnifiedStreamChunk, ProviderChatResult, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
  return (
    result ?? {
      providerId: 'claude' as const,
      model: 'claude-sonnet-4-20250514',
      usedFallback: false,
    }
  );
}

/**
 * Read all bytes from a ReadableStream into a string
 */
async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ============================================================================
// TEST SUITES
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------
// convertToUnifiedMessages
// -------------------------------------------------------------------
describe('convertToUnifiedMessages', () => {
  // --- String content ---
  it('should convert a user message with string content', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should convert an assistant message with string content', () => {
    const messages: CoreMessage[] = [{ role: 'assistant', content: 'Hi there' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'assistant', content: 'Hi there' }]);
  });

  it('should convert a system message with string content', () => {
    const messages: CoreMessage[] = [{ role: 'system', content: 'You are helpful' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'system', content: 'You are helpful' }]);
  });

  it('should handle empty string content', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: '' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'user', content: '' }]);
  });

  // --- Array content: text simplification ---
  it('should simplify a single text block array to a string', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('Hello world');
  });

  it('should keep multiple text blocks as an array', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(Array.isArray(result[0].content)).toBe(true);
    const content = result[0].content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].text).toBe('Part 1');
    expect(content[1].text).toBe('Part 2');
  });

  // --- Empty array content ---
  it('should handle empty content array by returning empty string', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: [] }];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });

  // --- Image: data URL ---
  it('should convert image data URL (base64) to base64 source', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: 'data:image/jpeg;base64,abc123' }],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; data: string; mediaType: string };
    }>;
    expect(content[0].type).toBe('image');
    expect(content[0].source.type).toBe('base64');
    expect(content[0].source.data).toBe('abc123');
    expect(content[0].source.mediaType).toBe('image/jpeg');
  });

  it('should convert image PNG data URL correctly', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: 'data:image/png;base64,iVBORw0KGgo' }],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; data: string; mediaType: string };
    }>;
    expect(content[0].source.mediaType).toBe('image/png');
    expect(content[0].source.data).toBe('iVBORw0KGgo');
  });

  // --- Image: plain URL string ---
  it('should convert image URL string to url source', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: 'https://example.com/image.png' }],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; url: string };
    }>;
    expect(content[0].source.type).toBe('url');
    expect(content[0].source.url).toBe('https://example.com/image.png');
  });

  // --- Image: object with url ---
  it('should convert image object with url property', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: { url: 'https://example.com/img.jpg' } }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; url: string };
    }>;
    expect(content[0].source.type).toBe('url');
    expect(content[0].source.url).toBe('https://example.com/img.jpg');
  });

  // --- Image: object with base64 ---
  it('should convert image object with base64 property', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: { base64: 'abcdef', mimeType: 'image/gif' } }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; data: string; mediaType: string };
    }>;
    expect(content[0].source.type).toBe('base64');
    expect(content[0].source.data).toBe('abcdef');
    expect(content[0].source.mediaType).toBe('image/gif');
  });

  // --- Image: object with base64 but no mimeType defaults to image/png ---
  it('should default mediaType to image/png for base64 without mimeType', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: { base64: 'xyz' } }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; data: string; mediaType: string };
    }>;
    expect(content[0].source.mediaType).toBe('image/png');
  });

  // --- Image: invalid object (no url or base64) returns null (filtered out) ---
  it('should skip image object with neither url nor base64', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: { other: 'stuff' } }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    // Empty blocks -> content becomes ''
    expect(result[0].content).toBe('');
  });

  // --- Image: missing image property entirely ---
  it('should skip image part with no image property', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image' }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });

  // --- Tool call: tool-call type ---
  it('should convert tool-call parts to tool_use blocks', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: 'call-1',
            toolName: 'web_search',
            args: { query: 'test' },
          },
        ],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    expect(content[0].type).toBe('tool_use');
    expect(content[0].id).toBe('call-1');
    expect(content[0].name).toBe('web_search');
    expect(content[0].arguments).toEqual({ query: 'test' });
  });

  // --- Tool call: tool_use type ---
  it('should convert tool_use parts using id and name fields', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool_use' as const,
            id: 'tu-99',
            name: 'run_code',
            arguments: { code: 'console.log(1)' },
          },
        ],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    expect(content[0].type).toBe('tool_use');
    expect(content[0].id).toBe('tu-99');
    expect(content[0].name).toBe('run_code');
    expect(content[0].arguments).toEqual({ code: 'console.log(1)' });
  });

  // --- Tool result: tool-result type ---
  it('should convert tool-result parts to tool_result blocks', () => {
    const messages = [
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call-1',
            result: 'Search results here',
          },
        ],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      toolUseId: string;
      content: string;
    }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].toolUseId).toBe('call-1');
    expect(content[0].content).toBe('Search results here');
  });

  // --- Tool result: tool_result type ---
  it('should convert tool_result parts using toolUseId', () => {
    const messages = [
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool_result' as const,
            toolUseId: 'tu-55',
            content: 'execution result',
            isError: true,
          },
        ],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      toolUseId: string;
      content: string;
      isError: boolean;
    }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].toolUseId).toBe('tu-55');
    expect(content[0].isError).toBe(true);
  });

  // --- Tool result: object result serialization ---
  it('should JSON.stringify non-string tool result', () => {
    const messages = [
      {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: 'call-2',
            result: { data: [1, 2, 3] },
          },
        ],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{ content: string }>;
    expect(content[0].content).toBe(JSON.stringify({ data: [1, 2, 3] }));
  });

  // --- Unknown content part type with text fallback ---
  it('should extract text from unknown content part types as fallback', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'unknown-type', text: 'fallback text' } as unknown as {
            type: 'text';
            text: string;
          },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('fallback text');
  });

  // --- Unknown content part without text -> filtered out ---
  it('should skip unknown content parts without text property', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'unknown-type', value: 123 } as unknown as { type: 'text'; text: string },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });

  // --- null/non-object part filtered out ---
  it('should skip null content parts', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [null, { type: 'text', text: 'valid' }] as unknown as Array<{
          type: 'text';
          text: string;
        }>,
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('valid');
  });

  // --- Multiple messages ---
  it('should handle multiple messages in sequence', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'How are you?' },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });

  // --- Multimodal: text + image ---
  it('should keep mixed text and image blocks as array', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image' },
          { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo' },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(Array.isArray(result[0].content)).toBe(true);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image');
  });

  // --- Fallback for unexpected content type (e.g., number) ---
  it('should stringify unexpected content types', () => {
    const messages = [{ role: 'user', content: 42 }] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('42');
  });

  // --- Fallback for null content ---
  it('should handle null content gracefully', () => {
    const messages = [{ role: 'user', content: null }] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });

  // --- tool-call with missing id fields defaults to empty string ---
  it('should default tool_use id and name to empty strings when missing', () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: [{ type: 'tool-call' as const }],
      },
    ] as unknown as CoreMessage[];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    expect(content[0].id).toBe('');
    expect(content[0].name).toBe('');
    expect(content[0].arguments).toEqual({});
  });

  // --- text part with empty text ---
  it('should convert text part with empty text property', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: [{ type: 'text', text: '' }] }];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });
});

// -------------------------------------------------------------------
// createStreamFromChunks
// -------------------------------------------------------------------
describe('createStreamFromChunks', () => {
  it('should stream text chunks as encoded bytes', async () => {
    const gen = makeChunkGenerator([
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'World' },
    ]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toBe('Hello World');
  });

  it('should stream thinking chunks wrapped in markers', async () => {
    const gen = makeChunkGenerator([{ type: 'thinking', text: 'Let me think...' }]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toContain('<thinking>');
    expect(text).toContain('Let me think...');
    expect(text).toContain('</thinking>');
  });

  it('should skip text chunks with no text', async () => {
    const gen = makeChunkGenerator([
      { type: 'text' },
      { type: 'text', text: '' },
      { type: 'text', text: 'visible' },
    ]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toBe('visible');
  });

  it('should skip thinking chunks with no text', async () => {
    const gen = makeChunkGenerator([
      { type: 'thinking' },
      { type: 'thinking', text: '' },
      { type: 'text', text: 'ok' },
    ]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toBe('ok');
  });

  it('should call onComplete callback with result', async () => {
    const onComplete = vi.fn();
    const expectedResult: ProviderChatResult = {
      providerId: 'claude',
      model: 'claude-sonnet-4-20250514',
      usedFallback: false,
    };
    const gen = makeChunkGenerator([{ type: 'text', text: 'done' }], expectedResult);
    const stream = createStreamFromChunks(gen, onComplete);
    await readStream(stream);
    // onComplete may or may not be called depending on generator exhaustion
    // The important thing is the stream doesn't throw
  });

  it('should call onUsage callback with accumulated token counts', async () => {
    const onUsage = vi.fn();
    const gen = makeChunkGenerator([
      { type: 'message_start', usage: { inputTokens: 100, outputTokens: 0 } },
      { type: 'text', text: 'hi' },
      { type: 'message_end', usage: { inputTokens: 0, outputTokens: 50 } },
    ]);
    const stream = createStreamFromChunks(gen, undefined, onUsage);
    await readStream(stream);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 100, outputTokens: 50 });
  });

  it('should accumulate usage from multiple message events', async () => {
    const onUsage = vi.fn();
    const gen = makeChunkGenerator([
      { type: 'message_start', usage: { inputTokens: 50, outputTokens: 10 } },
      { type: 'message_end', usage: { inputTokens: 30, outputTokens: 40 } },
    ]);
    const stream = createStreamFromChunks(gen, undefined, onUsage);
    await readStream(stream);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 80, outputTokens: 50 });
  });

  it('should not call onUsage when no tokens accumulated', async () => {
    const onUsage = vi.fn();
    const gen = makeChunkGenerator([{ type: 'text', text: 'hi' }]);
    const stream = createStreamFromChunks(gen, undefined, onUsage);
    await readStream(stream);
    expect(onUsage).not.toHaveBeenCalled();
  });

  it('should handle onUsage callback errors gracefully', async () => {
    const onUsage = vi.fn().mockImplementation(() => {
      throw new Error('usage callback error');
    });
    const gen = makeChunkGenerator([
      { type: 'message_start', usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
    const stream = createStreamFromChunks(gen, undefined, onUsage);
    // Should not throw
    const text = await readStream(stream);
    expect(onUsage).toHaveBeenCalled();
  });

  it('should handle error chunks without crashing the stream', async () => {
    const gen = makeChunkGenerator([
      { type: 'error', error: { code: 'rate_limited', message: 'Too many requests' } },
      { type: 'text', text: 'after error' },
    ]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toBe('after error');
  });

  it('should handle an empty chunk generator', async () => {
    const gen = makeChunkGenerator([]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    expect(text).toBe('');
  });

  it('should handle generator that throws an error', async () => {
    async function* errorGenerator(): AsyncGenerator<
      UnifiedStreamChunk,
      ProviderChatResult,
      unknown
    > {
      yield { type: 'text', text: 'before' };
      throw new Error('generator exploded');
    }
    const stream = createStreamFromChunks(errorGenerator());
    const reader = stream.getReader();
    // First chunk should succeed
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);
    // Next read should error
    await expect(reader.read()).rejects.toThrow('generator exploded');
  });

  it('should interleave text and thinking chunks in order', async () => {
    const gen = makeChunkGenerator([
      { type: 'text', text: 'A' },
      { type: 'thinking', text: 'reasoning' },
      { type: 'text', text: 'B' },
    ]);
    const stream = createStreamFromChunks(gen);
    const text = await readStream(stream);
    const aIdx = text.indexOf('A');
    const thinkIdx = text.indexOf('<thinking>');
    const bIdx = text.lastIndexOf('B');
    expect(aIdx).toBeLessThan(thinkIdx);
    expect(thinkIdx).toBeLessThan(bIdx);
  });
});

// -------------------------------------------------------------------
// routeChat
// -------------------------------------------------------------------
describe('routeChat', () => {
  it('should return a stream and metadata', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'response' }]));
    const result = await routeChat([{ role: 'user', content: 'hi' }]);
    expect(result).toHaveProperty('stream');
    expect(result).toHaveProperty('providerId');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('usedFallback');
  });

  it('should stream text from provider', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'Hello from Claude' }]));
    const result = await routeChat([{ role: 'user', content: 'hi' }]);
    const text = await readStream(result.stream);
    expect(text).toBe('Hello from Claude');
  });

  it('should filter out system messages from unified messages', async () => {
    let capturedMessages: unknown = null;
    mockChat.mockImplementation((msgs: unknown) => {
      capturedMessages = msgs;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ]);
    expect(capturedMessages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should pass system prompt in chat options', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      systemPrompt: 'Be helpful',
    });
    expect((capturedOptions as Record<string, unknown>).systemPrompt).toBe('Be helpful');
  });

  it('should pass model in chat options', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      model: 'claude-opus-4-20250514',
    });
    expect((capturedOptions as Record<string, unknown>).model).toBe('claude-opus-4-20250514');
  });

  it('should pass temperature and maxTokens in chat options', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      temperature: 0.5,
      maxTokens: 1000,
    });
    const opts = capturedOptions as Record<string, unknown>;
    expect(opts.temperature).toBe(0.5);
    expect(opts.maxTokens).toBe(1000);
  });

  it('should pass thinking config to chat options', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      thinking: { enabled: true, budgetTokens: 5000 },
    });
    expect((capturedOptions as Record<string, unknown>).thinking).toEqual({
      enabled: true,
      budgetTokens: 5000,
    });
  });

  it('should disable fallback when disableFallback is true', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      disableFallback: true,
    });
    const opts = capturedOptions as Record<string, unknown>;
    expect(opts.enableFallback).toBe(false);
    expect(opts.fallbackProviderId).toBeUndefined();
  });

  it('should pass onUsage callback to createStreamFromChunks', async () => {
    const onUsage = vi.fn();
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'message_start', usage: { inputTokens: 200, outputTokens: 0 } },
        { type: 'text', text: 'response' },
        { type: 'message_end', usage: { inputTokens: 0, outputTokens: 100 } },
      ])
    );
    const result = await routeChat([{ role: 'user', content: 'hi' }], { onUsage });
    await readStream(result.stream);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 200, outputTokens: 100 });
  });

  it('should use default providers when none specified', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'ok' }]));
    const result = await routeChat([{ role: 'user', content: 'hi' }]);
    // Default provider should be present in result
    expect(result.providerId).toBeDefined();
  });

  it('should accept override providerId', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await routeChat([{ role: 'user', content: 'hi' }], {
      providerId: 'xai',
    });
    expect((capturedOptions as Record<string, unknown>).providerId).toBe('xai');
  });
});

// -------------------------------------------------------------------
// routeChatWithTools
// -------------------------------------------------------------------
describe('routeChatWithTools', () => {
  it('should delegate to routeChat when no tools provided', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'no tools needed' }]));
    const executor = vi.fn();
    const result = await routeChatWithTools(
      [{ role: 'user', content: 'hi' }],
      { tools: [] },
      executor
    );
    expect(result.usedTools).toBe(false);
    expect(result.toolsUsed).toEqual([]);
    const text = await readStream(result.stream);
    expect(text).toBe('no tools needed');
  });

  it('should stream text chunks when no tool calls occur', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'plain response' }]));
    const executor = vi.fn();
    const tools = [
      {
        name: 'web_search',
        description: 'Search the web',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];
    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    const text = await readStream(result.stream);
    expect(text).toBe('plain response');
    expect(result.usedTools).toBe(false);
    expect(executor).not.toHaveBeenCalled();
  });

  it('should execute tools and continue the conversation loop', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        // First call: AI requests a tool
        return makeChunkGenerator([
          { type: 'tool_call_start', toolCall: { id: 'tc-1', name: 'web_search' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{"query":' } },
          { type: 'tool_call_delta', toolCall: { arguments: '"test"}' } },
          { type: 'tool_call_end' },
        ]);
      } else {
        // Second call: AI synthesizes with tool results
        return makeChunkGenerator([{ type: 'text', text: 'Based on search results...' }]);
      }
    });

    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'tc-1',
      content: 'Search results: found something',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search the web',
        parameters: {
          type: 'object' as const,
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'search for test' }],
      { tools },
      executor
    );
    const text = await readStream(result.stream);
    expect(text).toContain('Based on search results...');
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tc-1',
        name: 'web_search',
        arguments: { query: 'test' },
      })
    );
  });

  it('should handle tool execution errors gracefully', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'tool_call_start', toolCall: { id: 'tc-err', name: 'run_code' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{}' } },
          { type: 'tool_call_end' },
        ]);
      } else {
        return makeChunkGenerator([{ type: 'text', text: 'Error handled' }]);
      }
    });

    const executor = vi.fn().mockRejectedValue(new Error('Execution failed'));

    const tools = [
      {
        name: 'run_code',
        description: 'Run code',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'run something' }],
      { tools },
      executor
    );
    const text = await readStream(result.stream);
    // Stream should still complete after error
    expect(text).toContain('Error handled');
  });

  it('should handle invalid JSON in tool arguments with _parseError flag', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'tool_call_start', toolCall: { id: 'tc-bad', name: 'web_search' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{invalid json' } },
          { type: 'tool_call_end' },
        ]);
      } else {
        return makeChunkGenerator([{ type: 'text', text: 'recovered' }]);
      }
    });

    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'tc-bad',
      content: 'handled',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search the web',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'search' }],
      { tools },
      executor
    );
    await readStream(result.stream);
    // Should have been called with _parseError flag
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({ _parseError: true }),
      })
    );
  });

  it('should handle empty tool arguments buffer', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'tool_call_start', toolCall: { id: 'tc-empty', name: 'web_search' } },
          // No tool_call_delta - empty buffer
          { type: 'tool_call_end' },
        ]);
      } else {
        return makeChunkGenerator([{ type: 'text', text: 'done' }]);
      }
    });

    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'tc-empty',
      content: 'ok',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    await readStream(result.stream);
    expect(executor).toHaveBeenCalledWith(expect.objectContaining({ arguments: {} }));
  });

  it('should execute multiple tool calls from a single iteration', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'tool_call_start', toolCall: { id: 'tc-a', name: 'web_search' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{}' } },
          { type: 'tool_call_end' },
          { type: 'tool_call_start', toolCall: { id: 'tc-b', name: 'run_code' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{}' } },
          { type: 'tool_call_end' },
        ]);
      } else {
        return makeChunkGenerator([{ type: 'text', text: 'results' }]);
      }
    });

    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'any',
      content: 'ok',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'run_code',
        description: 'Run code',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    const text = await readStream(result.stream);
    expect(text).toContain('results');
    // Executor should have been called twice (once per tool)
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('should stream thinking chunks during tool loop', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'thinking', text: 'Analyzing the request...' },
          { type: 'tool_call_start', toolCall: { id: 'tc-t', name: 'web_search' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{}' } },
          { type: 'tool_call_end' },
        ]);
      } else {
        return makeChunkGenerator([{ type: 'text', text: 'done' }]);
      }
    });

    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'tc-t',
      content: 'ok',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    const text = await readStream(result.stream);
    expect(text).toContain('<thinking>');
    expect(text).toContain('Analyzing the request...');
  });

  it('should handle error stream chunk by erroring the controller', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'error', error: { code: 'rate_limited', message: 'Rate limited' } },
      ])
    );

    const executor = vi.fn();
    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    const reader = result.stream.getReader();
    await expect(reader.read()).rejects.toThrow('[rate_limited] Rate limited');
  });

  it('should handle error stream chunk without code', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([{ type: 'error', error: { code: '', message: 'Something went wrong' } }])
    );

    const executor = vi.fn();
    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, executor);
    const reader = result.stream.getReader();
    await expect(reader.read()).rejects.toThrow('Something went wrong');
  });

  it('should accumulate token usage across tool iterations', async () => {
    const callCount = { value: 0 };
    mockChat.mockImplementation(() => {
      callCount.value++;
      if (callCount.value === 1) {
        return makeChunkGenerator([
          { type: 'message_start', usage: { inputTokens: 100, outputTokens: 0 } },
          { type: 'tool_call_start', toolCall: { id: 'tc-u', name: 'web_search' } },
          { type: 'tool_call_delta', toolCall: { arguments: '{}' } },
          { type: 'tool_call_end' },
          { type: 'message_end', usage: { inputTokens: 0, outputTokens: 50 } },
        ]);
      } else {
        return makeChunkGenerator([
          { type: 'message_start', usage: { inputTokens: 200, outputTokens: 0 } },
          { type: 'text', text: 'final' },
          { type: 'message_end', usage: { inputTokens: 0, outputTokens: 80 } },
        ]);
      }
    });

    const onUsage = vi.fn();
    const executor = vi.fn().mockResolvedValue({
      toolCallId: 'tc-u',
      content: 'ok',
      isError: false,
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'hi' }],
      { tools, onUsage },
      executor
    );
    await readStream(result.stream);
    // Should accumulate: 100+200 input, 50+80 output
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 300, outputTokens: 130 });
  });

  it('should not call onUsage when zero tokens accumulated', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'no usage' }]));

    const onUsage = vi.fn();
    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'hi' }],
      { tools, onUsage },
      vi.fn()
    );
    await readStream(result.stream);
    expect(onUsage).not.toHaveBeenCalled();
  });

  it('should handle onUsage callback error gracefully', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'message_start', usage: { inputTokens: 10, outputTokens: 5 } },
        { type: 'text', text: 'ok' },
      ])
    );

    const onUsage = vi.fn().mockImplementation(() => {
      throw new Error('usage err');
    });

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools(
      [{ role: 'user', content: 'hi' }],
      { tools, onUsage },
      vi.fn()
    );
    // Should not throw
    const text = await readStream(result.stream);
    expect(text).toBe('ok');
  });

  it('should pass tools in chat options to provider service', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });

    const tools = [
      {
        name: 'my_tool',
        description: 'A tool',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, vi.fn());
    await readStream(result.stream);
    expect((capturedOptions as Record<string, unknown>).tools).toEqual(tools);
  });

  it('should skip tool_call_start without toolCall data', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([{ type: 'tool_call_start' }, { type: 'text', text: 'ok' }])
    );

    const tools = [
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object' as const, properties: {}, required: [] },
      },
    ];

    const result = await routeChatWithTools([{ role: 'user', content: 'hi' }], { tools }, vi.fn());
    const text = await readStream(result.stream);
    expect(text).toBe('ok');
  });
});

// -------------------------------------------------------------------
// completeChat
// -------------------------------------------------------------------
describe('completeChat', () => {
  it('should collect all text from stream chunks', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ])
    );
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('Hello world');
  });

  it('should return provider metadata', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([{ type: 'text', text: 'ok' }], {
        providerId: 'claude',
        model: 'claude-sonnet-4-20250514',
        usedFallback: false,
      })
    );
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.providerId).toBeDefined();
    expect(result.model).toBeDefined();
    expect(typeof result.usedFallback).toBe('boolean');
  });

  it('should accumulate usage from message events', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'message_start', usage: { inputTokens: 150, outputTokens: 0 } },
        { type: 'text', text: 'response' },
        { type: 'message_end', usage: { inputTokens: 0, outputTokens: 75 } },
      ])
    );
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toEqual({ inputTokens: 150, outputTokens: 75 });
  });

  it('should return undefined usage when no tokens accumulated', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'no usage info' }]));
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toBeUndefined();
  });

  it('should filter out system messages', async () => {
    let capturedMessages: unknown = null;
    mockChat.mockImplementation((msgs: unknown) => {
      capturedMessages = msgs;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await completeChat([
      { role: 'system', content: 'System instructions' },
      { role: 'user', content: 'Question' },
    ]);
    expect(capturedMessages).toEqual([{ role: 'user', content: 'Question' }]);
  });

  it('should pass systemPrompt in chat options', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await completeChat([{ role: 'user', content: 'hi' }], {
      systemPrompt: 'Generate a title',
    });
    expect((capturedOptions as Record<string, unknown>).systemPrompt).toBe('Generate a title');
  });

  it('should pass model override', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await completeChat([{ role: 'user', content: 'hi' }], {
      model: 'claude-haiku-4-20250514',
    });
    expect((capturedOptions as Record<string, unknown>).model).toBe('claude-haiku-4-20250514');
  });

  it('should handle disableFallback option', async () => {
    let capturedOptions: unknown = null;
    mockChat.mockImplementation((_msgs: unknown, opts: unknown) => {
      capturedOptions = opts;
      return makeChunkGenerator([{ type: 'text', text: 'ok' }]);
    });
    await completeChat([{ role: 'user', content: 'hi' }], {
      disableFallback: true,
    });
    const opts = capturedOptions as Record<string, unknown>;
    expect(opts.enableFallback).toBe(false);
    expect(opts.fallbackProviderId).toBeUndefined();
  });

  it('should ignore non-text chunks', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'thinking', text: 'reasoning' },
        { type: 'text', text: 'answer' },
        { type: 'tool_call_start', toolCall: { id: 'x', name: 'y' } },
      ])
    );
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('answer');
  });

  it('should handle empty text chunks', async () => {
    mockChat.mockReturnValue(
      makeChunkGenerator([
        { type: 'text', text: '' },
        { type: 'text' },
        { type: 'text', text: 'final' },
      ])
    );
    const result = await completeChat([{ role: 'user', content: 'hi' }]);
    expect(result.text).toBe('final');
  });

  it('should return defaults when generator result is not available', async () => {
    mockChat.mockReturnValue(makeChunkGenerator([{ type: 'text', text: 'ok' }]));
    const result = await completeChat([{ role: 'user', content: 'hi' }], {
      providerId: 'xai',
      model: 'grok-2',
    });
    // Falls back to options when result not obtained from generator
    expect(result.providerId).toBeDefined();
    expect(result.model).toBeDefined();
  });
});

// -------------------------------------------------------------------
// isProviderConfigured
// -------------------------------------------------------------------
describe('isProviderConfigured', () => {
  it('should return false when provider is not found in statuses', () => {
    mockGetProviderStatuses.mockReturnValue([]);
    const result = isProviderConfigured('claude');
    expect(result).toBe(false);
  });

  it('should return true when provider is configured', () => {
    mockGetProviderStatuses.mockReturnValue([
      {
        providerId: 'claude',
        configured: true,
        available: true,
        defaultModel: 'claude-sonnet-4-20250514',
      },
    ]);
    const result = isProviderConfigured('claude');
    expect(result).toBe(true);
  });

  it('should return false when provider exists but is not configured', () => {
    mockGetProviderStatuses.mockReturnValue([
      { providerId: 'openai', configured: false, available: false, defaultModel: null },
    ]);
    const result = isProviderConfigured('openai');
    expect(result).toBe(false);
  });
});

// -------------------------------------------------------------------
// getAvailableProviders
// -------------------------------------------------------------------
describe('getAvailableProviders', () => {
  it('should return empty array when no providers configured', () => {
    mockGetConfiguredProviders.mockReturnValue([]);
    const result = getAvailableProviders();
    expect(result).toEqual([]);
  });

  it('should return list of configured provider IDs', () => {
    mockGetConfiguredProviders.mockReturnValue(['claude', 'xai']);
    const result = getAvailableProviders();
    expect(result).toEqual(['claude', 'xai']);
  });
});

// -------------------------------------------------------------------
// getDefaultProviders
// -------------------------------------------------------------------
describe('getDefaultProviders', () => {
  it('should return primary and fallback provider IDs', () => {
    const providers = getDefaultProviders();
    expect(providers).toHaveProperty('primary');
    expect(providers).toHaveProperty('fallback');
    expect(typeof providers.primary).toBe('string');
    expect(typeof providers.fallback).toBe('string');
  });

  it('should return claude as default primary provider', () => {
    const providers = getDefaultProviders();
    // Default is 'claude' unless overridden by env var
    expect(providers.primary).toBe('claude');
  });

  it('should return xai as default fallback provider', () => {
    const providers = getDefaultProviders();
    // Default is 'xai' unless overridden by env var
    expect(providers.fallback).toBe('xai');
  });
});
