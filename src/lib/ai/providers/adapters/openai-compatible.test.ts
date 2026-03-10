/**
 * OPENAI-COMPATIBLE ADAPTER TESTS
 *
 * Tests for the OpenAICompatibleAdapter class including:
 * - Message conversion (unified <-> OpenAI)
 * - Tool formatting
 * - Tool result formatting
 * - Stream chunk parsing
 * - Error handling
 * - Multiple provider support (openai, xai, deepseek)
 * - Factory functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must come BEFORE imports of modules under test
// ============================================================================

vi.mock('openai', () => {
  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));

  // @ts-expect-error Assigning static property to mock constructor
  MockOpenAI.APIError = MockAPIError;

  return { default: MockOpenAI };
});

vi.mock('../registry', () => ({
  getProvider: vi.fn().mockImplementation((id: string) => {
    const providers: Record<string, unknown> = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        family: 'openai-compatible',
        apiKeyEnv: 'OPENAI_API_KEY',
        capabilities: {
          vision: true,
          parallelToolCalls: true,
          streaming: true,
          systemMessages: true,
          jsonMode: true,
          toolCalling: true,
          extendedThinking: false,
        },
        models: [],
      },
      xai: {
        id: 'xai',
        name: 'xAI (Grok)',
        family: 'openai-compatible',
        apiKeyEnv: 'XAI_API_KEY',
        capabilities: {
          vision: true,
          parallelToolCalls: true,
          streaming: true,
          systemMessages: true,
          jsonMode: true,
          toolCalling: true,
          extendedThinking: false,
        },
        models: [],
      },
      deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        family: 'openai-compatible',
        apiKeyEnv: 'DEEPSEEK_API_KEY',
        capabilities: {
          vision: false,
          parallelToolCalls: true,
          streaming: true,
          systemMessages: true,
          jsonMode: true,
          toolCalling: true,
          extendedThinking: false,
        },
        models: [],
      },
    };
    return providers[id] || providers.openai;
  }),
  getModelCapabilities: vi.fn().mockReturnValue({
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
    extendedThinking: false,
  }),
  getDefaultModel: vi.fn().mockReturnValue({
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    contextWindow: 200000,
    maxOutputTokens: 32000,
    inputPricePer1M: 5,
    outputPricePer1M: 15,
    tier: 'premium',
    isDefault: true,
  }),
}));

import {
  OpenAICompatibleAdapter,
  createOpenAIAdapter,
  createXAIAdapter,
  createDeepSeekAdapter,
} from './openai-compatible';
import type { UnifiedMessage, UnifiedTool, UnifiedToolResult } from '../types';

// ============================================================================
// TESTS
// ============================================================================

describe('OpenAICompatibleAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.XAI_API_KEY = 'test-xai-key';
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  });

  // --------------------------------------------------------------------------
  // Constructor and identity
  // --------------------------------------------------------------------------

  describe('constructor and identity', () => {
    it('should accept "openai" as provider ID', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      expect(adapter.providerId).toBe('openai');
      expect(adapter.family).toBe('openai-compatible');
    });

    it('should accept "xai" as provider ID', () => {
      const adapter = new OpenAICompatibleAdapter('xai');
      expect(adapter.providerId).toBe('xai');
    });

    it('should accept "deepseek" as provider ID', () => {
      const adapter = new OpenAICompatibleAdapter('deepseek');
      expect(adapter.providerId).toBe('deepseek');
    });
  });

  // --------------------------------------------------------------------------
  // toProviderMessages
  // --------------------------------------------------------------------------

  describe('toProviderMessages', () => {
    it('should convert a simple user string message', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello GPT' }];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello GPT' });
    });

    it('should convert system messages', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [{ role: 'system', content: 'You are helpful' }];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
    });

    it('should convert tool result messages', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'call_123',
              content: 'Result data',
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'Result data',
      });
    });

    it('should handle tool messages with multiple tool results', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'tool',
          content: [
            { type: 'tool_result', toolUseId: 'call_1', content: 'Result 1' },
            { type: 'tool_result', toolUseId: 'call_2', content: 'Result 2' },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      // Should expand into individual tool messages
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'Result 1',
      });
      expect(result[1]).toEqual({
        role: 'tool',
        tool_call_id: 'call_2',
        content: 'Result 2',
      });
    });

    it('should convert user messages with image content blocks (base64)', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/png', data: 'abc123' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'What is in this image?' });
      expect(content[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      });
    });

    it('should convert user messages with image content blocks (URL)', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: 'https://example.com/image.jpg' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image_url',
        image_url: { url: 'https://example.com/image.jpg' },
      });
    });

    it('should convert assistant messages with tool calls', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me search that.' },
            {
              type: 'tool_use',
              id: 'call_abc',
              name: 'search',
              arguments: { query: 'test' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('Let me search that.');
      expect((result[0] as unknown as Record<string, unknown>).tool_calls).toEqual([
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'search',
            arguments: '{"query":"test"}',
          },
        },
      ]);
    });

    it('should filter out empty string messages', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        { role: 'user', content: '   ' },
        { role: 'user', content: 'Valid' },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Valid' });
    });

    it('should filter out tool messages with string content', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [{ role: 'tool', content: 'invalid string content' }];

      const result = adapter.toProviderMessages(messages);
      expect(result).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // fromProviderMessages
  // --------------------------------------------------------------------------

  describe('fromProviderMessages', () => {
    it('should convert system messages', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [{ role: 'system', content: 'You are helpful' }];

      const result = adapter.fromProviderMessages(openaiMessages);

      expect(result[0]).toEqual({ role: 'system', content: 'You are helpful' });
    });

    it('should convert user string messages', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [{ role: 'user', content: 'Hello' }];

      const result = adapter.fromProviderMessages(openaiMessages);

      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert tool messages to tool_result blocks', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [{ role: 'tool', tool_call_id: 'call_1', content: 'Result' }];

      const result = adapter.fromProviderMessages(openaiMessages);

      expect(result[0]).toEqual({
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'call_1',
            content: 'Result',
          },
        ],
      });
    });

    it('should convert user messages with image_url parts', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc123' },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image',
        source: { type: 'base64', mediaType: 'image/png', data: 'abc123' },
      });
    });

    it('should convert user messages with non-data URL images', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/img.jpg' },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image',
        source: { type: 'url', url: 'https://example.com/img.jpg' },
      });
    });

    it('should convert assistant messages with tool_calls', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'assistant',
          content: 'Let me search.',
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'search',
                arguments: '{"query":"test"}',
              },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Let me search.' });
      expect(content[1]).toEqual({
        type: 'tool_use',
        id: 'call_1',
        name: 'search',
        arguments: { query: 'test' },
      });
    });

    it('should handle assistant messages with no content and no tool_calls', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [{ role: 'assistant', content: null }];

      const result = adapter.fromProviderMessages(openaiMessages);

      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('');
    });

    it('should handle malformed JSON in tool call arguments gracefully', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'search',
                arguments: '{not valid json',
              },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      // safeParseJSON should return empty object for invalid JSON
      expect(content[0].arguments).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // formatTools
  // --------------------------------------------------------------------------

  describe('formatTools', () => {
    it('should convert unified tools to OpenAI function format', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const tools: UnifiedTool[] = [
        {
          name: 'google_search',
          description: 'Search the web',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      ];

      const result = adapter.formatTools(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'function',
        function: {
          name: 'google_search',
          description: 'Search the web',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      });
    });

    it('should handle multiple tools', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const tools: UnifiedTool[] = [
        {
          name: 'tool_a',
          description: 'A',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'tool_b',
          description: 'B',
          parameters: { type: 'object', properties: {} },
        },
      ];

      const result = adapter.formatTools(tools);

      expect(result).toHaveLength(2);
      expect((result[0] as unknown as Record<string, Record<string, unknown>>).function.name).toBe(
        'tool_a'
      );
      expect((result[1] as unknown as Record<string, Record<string, unknown>>).function.name).toBe(
        'tool_b'
      );
    });
  });

  // --------------------------------------------------------------------------
  // formatToolResult
  // --------------------------------------------------------------------------

  describe('formatToolResult', () => {
    it('should format a tool result for OpenAI', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const result: UnifiedToolResult = {
        toolCallId: 'call_abc',
        content: 'Result data',
        isError: false,
      };

      const formatted = adapter.formatToolResult(result);

      expect(formatted).toEqual({
        role: 'tool',
        tool_call_id: 'call_abc',
        content: 'Result data',
      });
    });

    it('should include content even for error results', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const result: UnifiedToolResult = {
        toolCallId: 'call_err',
        content: 'Error occurred',
        isError: true,
      };

      const formatted = adapter.formatToolResult(result);

      expect(formatted).toEqual({
        role: 'tool',
        tool_call_id: 'call_err',
        content: 'Error occurred',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Factory functions
  // --------------------------------------------------------------------------

  describe('factory functions', () => {
    it('createOpenAIAdapter should create an adapter with openai providerId', () => {
      const adapter = createOpenAIAdapter();
      expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
      expect(adapter.providerId).toBe('openai');
    });

    it('createXAIAdapter should create an adapter with xai providerId', () => {
      const adapter = createXAIAdapter();
      expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
      expect(adapter.providerId).toBe('xai');
    });

    it('createDeepSeekAdapter should create an adapter with deepseek providerId', () => {
      const adapter = createDeepSeekAdapter();
      expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
      expect(adapter.providerId).toBe('deepseek');
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle assistant content as array of text parts', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Part 1' });
      expect(content[1]).toEqual({ type: 'text', text: 'Part 2' });
    });

    it('should handle user content with text parts', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const openaiMessages = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ];

      const result = adapter.fromProviderMessages(openaiMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({ type: 'text', text: 'Hello' });
    });

    it('should handle assistant messages with only tool_calls (no text)', () => {
      const adapter = new OpenAICompatibleAdapter('openai');
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'search',
              arguments: { q: 'test' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      // When there are no text blocks, content is null (empty string is falsy -> null)
      expect(result[0].content).toBeNull();
      expect((result[0] as unknown as Record<string, unknown>).tool_calls).toBeDefined();
    });
  });
});
