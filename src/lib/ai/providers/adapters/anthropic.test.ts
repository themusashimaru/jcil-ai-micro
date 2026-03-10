/**
 * ANTHROPIC ADAPTER TESTS
 *
 * Tests for the AnthropicAdapter class including:
 * - Message conversion (unified <-> Anthropic)
 * - Tool formatting
 * - Tool result formatting
 * - Stream event parsing
 * - Error handling
 * - API key management
 * - Factory function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must come BEFORE imports of modules under test
// ============================================================================

vi.mock('@/lib/ai/tools/web-search', () => ({
  NATIVE_WEB_SEARCH_SENTINEL: '__native_web_search__',
}));

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  }

  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      stream: vi.fn(),
    },
  }));

  // @ts-expect-error Assigning static property to mock constructor
  MockAnthropic.APIError = MockAPIError;

  return { default: MockAnthropic };
});

vi.mock('../registry', () => ({
  getProvider: vi.fn().mockReturnValue({
    id: 'claude',
    name: 'Claude',
    family: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    capabilities: {
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: false,
      toolCalling: true,
      extendedThinking: true,
    },
    models: [],
  }),
  getModelCapabilities: vi.fn().mockReturnValue({
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: false,
    toolCalling: true,
    extendedThinking: true,
  }),
  getDefaultModel: vi.fn().mockReturnValue({
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    inputPricePer1M: 3,
    outputPricePer1M: 15,
    tier: 'standard',
    isDefault: true,
  }),
}));

import { AnthropicAdapter, createAnthropicAdapter } from './anthropic';
import type { UnifiedMessage, UnifiedTool, UnifiedToolResult } from '../types';

// ============================================================================
// TESTS
// ============================================================================

describe('AnthropicAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the API key env var so the adapter can construct
    process.env.ANTHROPIC_API_KEY = 'test-key-for-anthropic';
  });

  // --------------------------------------------------------------------------
  // Constructor and identity
  // --------------------------------------------------------------------------

  describe('constructor and identity', () => {
    it('should have providerId "claude"', () => {
      const adapter = new AnthropicAdapter();
      expect(adapter.providerId).toBe('claude');
    });

    it('should have family "anthropic"', () => {
      const adapter = new AnthropicAdapter();
      expect(adapter.family).toBe('anthropic');
    });
  });

  // --------------------------------------------------------------------------
  // toProviderMessages
  // --------------------------------------------------------------------------

  describe('toProviderMessages', () => {
    it('should convert a simple user string message', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello Claude' }];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello Claude' });
    });

    it('should skip system messages', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert text content blocks', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hi there' }],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hi there' }]);
    });

    it('should convert image blocks with base64 data', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/png', data: 'abc123' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'abc123' },
      });
    });

    it('should convert tool_use blocks', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_123',
              name: 'google_search',
              arguments: { query: 'test' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'google_search',
        input: { query: 'test' },
      });
    });

    it('should convert tool result messages to user role with tool_result content', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'call_123',
              content: 'Search results here',
              isError: false,
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_123',
        content: 'Search results here',
        is_error: false,
      });
    });

    it('should filter out messages with empty string content', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        { role: 'user', content: '   ' },
        { role: 'user', content: 'Valid message' },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Valid message' });
    });

    it('should filter out tool role messages with string content (invalid format)', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [{ role: 'tool', content: 'This is not valid' }];

      const result = adapter.toProviderMessages(messages);
      expect(result).toHaveLength(0);
    });

    it('should filter out messages with empty content blocks', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [{ role: 'user', content: [] }];

      const result = adapter.toProviderMessages(messages);
      expect(result).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // fromProviderMessages
  // --------------------------------------------------------------------------

  describe('fromProviderMessages', () => {
    it('should convert a string content Anthropic message to unified format', () => {
      const adapter = new AnthropicAdapter();
      const anthropicMessages = [{ role: 'user', content: 'Hello' }];

      const result = adapter.fromProviderMessages(anthropicMessages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert text blocks from Anthropic to unified format', () => {
      const adapter = new AnthropicAdapter();
      const anthropicMessages = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Response text' }],
        },
      ];

      const result = adapter.fromProviderMessages(anthropicMessages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Response text' }]);
    });

    it('should convert tool_use blocks from Anthropic to unified format', () => {
      const adapter = new AnthropicAdapter();
      const anthropicMessages = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'search',
              input: { query: 'test' },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(anthropicMessages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_use',
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      });
    });

    it('should convert tool_result blocks from Anthropic to unified format', () => {
      const adapter = new AnthropicAdapter();
      const anthropicMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              content: 'result data',
              is_error: false,
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(anthropicMessages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_result',
        toolUseId: 'tool_1',
        content: 'result data',
        isError: false,
      });
    });

    it('should convert image blocks from Anthropic to unified format', () => {
      const adapter = new AnthropicAdapter();
      const anthropicMessages = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: 'imgdata' },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(anthropicMessages);

      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image',
        source: { type: 'base64', mediaType: 'image/jpeg', data: 'imgdata' },
      });
    });
  });

  // --------------------------------------------------------------------------
  // formatTools
  // --------------------------------------------------------------------------

  describe('formatTools', () => {
    it('should convert unified tools to Anthropic format', () => {
      const adapter = new AnthropicAdapter();
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
        name: 'google_search',
        description: 'Search the web',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      });
    });

    it('should handle native web search tools with _nativeConfig', () => {
      const adapter = new AnthropicAdapter();
      const nativeConfig = {
        type: 'server_tool',
        name: 'web_search_20260209',
      };
      const tools: UnifiedTool[] = [
        {
          name: '__native_web_search__',
          description: 'Native web search',
          parameters: { type: 'object', properties: {} },
          _nativeConfig: nativeConfig,
        } as UnifiedTool & { _nativeConfig: unknown },
      ];

      const result = adapter.formatTools(tools);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(nativeConfig);
    });

    it('should handle multiple tools', () => {
      const adapter = new AnthropicAdapter();
      const tools: UnifiedTool[] = [
        {
          name: 'tool_a',
          description: 'Tool A',
          parameters: {
            type: 'object',
            properties: { x: { type: 'string' } },
            required: ['x'],
          },
        },
        {
          name: 'tool_b',
          description: 'Tool B',
          parameters: {
            type: 'object',
            properties: { y: { type: 'number' } },
          },
        },
      ];

      const result = adapter.formatTools(tools);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('tool_a');
      expect(result[1].name).toBe('tool_b');
    });
  });

  // --------------------------------------------------------------------------
  // formatToolResult
  // --------------------------------------------------------------------------

  describe('formatToolResult', () => {
    it('should format a tool result for Anthropic', () => {
      const adapter = new AnthropicAdapter();
      const result: UnifiedToolResult = {
        toolCallId: 'call_abc',
        content: 'Search completed successfully',
        isError: false,
      };

      const formatted = adapter.formatToolResult(result);

      expect(formatted).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_abc',
        content: 'Search completed successfully',
        is_error: false,
      });
    });

    it('should format an error tool result', () => {
      const adapter = new AnthropicAdapter();
      const result: UnifiedToolResult = {
        toolCallId: 'call_err',
        content: 'Tool execution failed',
        isError: true,
      };

      const formatted = adapter.formatToolResult(result);

      expect(formatted).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_err',
        content: 'Tool execution failed',
        is_error: true,
      });
    });
  });

  // --------------------------------------------------------------------------
  // createAnthropicAdapter factory
  // --------------------------------------------------------------------------

  describe('createAnthropicAdapter', () => {
    it('should create an AnthropicAdapter instance', () => {
      const adapter = createAnthropicAdapter();
      expect(adapter).toBeInstanceOf(AnthropicAdapter);
      expect(adapter.providerId).toBe('claude');
      expect(adapter.family).toBe('anthropic');
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle default mediaType for images when not specified', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', data: 'abc' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      const imageBlock = content[0] as { source: { media_type: string } };
      expect(imageBlock.source.media_type).toBe('image/png');
    });

    it('should convert tool_result block in content arrays', () => {
      const adapter = new AnthropicAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'call_x',
              content: 'result data',
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);
      expect(result).toHaveLength(1);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_x',
        content: 'result data',
        is_error: undefined,
      });
    });
  });
});
