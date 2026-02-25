/**
 * BASE AI ADAPTER TESTS
 *
 * Tests for the abstract BaseAIAdapter class.
 * Since BaseAIAdapter is abstract, we create a concrete test subclass
 * to verify shared (non-abstract) methods.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock the registry module before importing anything that depends on it
vi.mock('../registry', () => ({
  getProvider: vi.fn(),
  getModelCapabilities: vi.fn(),
  getDefaultModel: vi.fn(),
}));

import { BaseAIAdapter } from './base';
import { getProvider, getModelCapabilities, getDefaultModel } from '../registry';
import type {
  ProviderId,
  ProviderFamily,
  ProviderCapabilities,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolResult,
  UnifiedStreamChunk,
  ChatOptions,
} from '../types';

// ============================================================================
// TEST SUBCLASS (concrete implementation of abstract class)
// ============================================================================

class TestAdapter extends BaseAIAdapter {
  readonly providerId: ProviderId = 'claude';
  readonly family: ProviderFamily = 'anthropic';

  async *chat(
    _messages: UnifiedMessage[],
    _options?: ChatOptions
  ): AsyncIterable<UnifiedStreamChunk> {
    yield { type: 'message_end' };
  }

  formatTools(_tools: UnifiedTool[]): unknown {
    return [];
  }

  toProviderMessages(_messages: UnifiedMessage[]): unknown[] {
    return [];
  }

  fromProviderMessages(_messages: unknown[]): UnifiedMessage[] {
    return [];
  }

  formatToolResult(_result: UnifiedToolResult): unknown {
    return {};
  }

  // Expose protected methods for testing
  public testExtractTextContent(message: UnifiedMessage): string {
    return this.extractTextContent(message);
  }

  public testExtractToolCalls(message: UnifiedMessage) {
    return this.extractToolCalls(message);
  }

  public testHasImages(message: UnifiedMessage): boolean {
    return this.hasImages(message);
  }

  public testConversationHasImages(messages: UnifiedMessage[]): boolean {
    return this.conversationHasImages(messages);
  }

  public testGenerateToolCallId(): string {
    return this.generateToolCallId();
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('BaseAIAdapter', () => {
  // --------------------------------------------------------------------------
  // getCapabilities
  // --------------------------------------------------------------------------

  describe('getCapabilities', () => {
    it('should return capabilities from the registry', () => {
      const mockCapabilities: ProviderCapabilities = {
        vision: true,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: false,
        toolCalling: true,
        extendedThinking: true,
      };

      vi.mocked(getProvider).mockReturnValue({
        id: 'claude',
        name: 'Claude',
        family: 'anthropic',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        capabilities: mockCapabilities,
        models: [],
      });

      const adapter = new TestAdapter();
      const capabilities = adapter.getCapabilities();

      expect(capabilities).toEqual(mockCapabilities);
      expect(getProvider).toHaveBeenCalledWith('claude');
    });
  });

  // --------------------------------------------------------------------------
  // hasCapability
  // --------------------------------------------------------------------------

  describe('hasCapability', () => {
    it('should return true when the provider has the capability', () => {
      vi.mocked(getProvider).mockReturnValue({
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
      });

      const adapter = new TestAdapter();
      expect(adapter.hasCapability('vision')).toBe(true);
      expect(adapter.hasCapability('streaming')).toBe(true);
    });

    it('should return false when the provider lacks the capability', () => {
      vi.mocked(getProvider).mockReturnValue({
        id: 'claude',
        name: 'Claude',
        family: 'anthropic',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        capabilities: {
          vision: false,
          parallelToolCalls: false,
          streaming: true,
          systemMessages: true,
          jsonMode: false,
          toolCalling: true,
          extendedThinking: false,
        },
        models: [],
      });

      const adapter = new TestAdapter();
      expect(adapter.hasCapability('vision')).toBe(false);
      expect(adapter.hasCapability('extendedThinking')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getDefaultModelId
  // --------------------------------------------------------------------------

  describe('getDefaultModelId', () => {
    it('should return the default model ID from the registry', () => {
      vi.mocked(getDefaultModel).mockReturnValue({
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      });

      const adapter = new TestAdapter();
      expect(adapter.getDefaultModelId()).toBe('claude-sonnet-4-6');
      expect(getDefaultModel).toHaveBeenCalledWith('claude');
    });

    it('should throw an error when no default model is found', () => {
      vi.mocked(getDefaultModel).mockReturnValue(undefined);

      const adapter = new TestAdapter();
      expect(() => adapter.getDefaultModelId()).toThrow(
        'No default model found for provider: claude'
      );
    });
  });

  // --------------------------------------------------------------------------
  // getModelCapabilities
  // --------------------------------------------------------------------------

  describe('getModelCapabilities', () => {
    it('should return capabilities for a specific model', () => {
      const mockCapabilities: ProviderCapabilities = {
        vision: true,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: false,
        toolCalling: true,
        extendedThinking: true,
      };

      vi.mocked(getModelCapabilities).mockReturnValue(mockCapabilities);

      const adapter = new TestAdapter();
      const result = adapter.getModelCapabilities('claude-sonnet-4-6');

      expect(result).toEqual(mockCapabilities);
      expect(getModelCapabilities).toHaveBeenCalledWith('claude', 'claude-sonnet-4-6');
    });
  });

  // --------------------------------------------------------------------------
  // validateModelCapabilities
  // --------------------------------------------------------------------------

  describe('validateModelCapabilities', () => {
    it('should return valid when all required capabilities are met', () => {
      vi.mocked(getModelCapabilities).mockReturnValue({
        vision: true,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: false,
        toolCalling: true,
        extendedThinking: true,
      });

      const adapter = new TestAdapter();
      const result = adapter.validateModelCapabilities('claude-sonnet-4-6', {
        vision: true,
        toolCalling: true,
      });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('should return invalid with missing capabilities listed', () => {
      vi.mocked(getModelCapabilities).mockReturnValue({
        vision: false,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: false,
        toolCalling: true,
        extendedThinking: false,
      });

      const adapter = new TestAdapter();
      const result = adapter.validateModelCapabilities('some-model', {
        vision: true,
        extendedThinking: true,
      });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('vision');
      expect(result.missing).toContain('extendedThinking');
    });

    it('should ignore capabilities not required (set to false)', () => {
      vi.mocked(getModelCapabilities).mockReturnValue({
        vision: false,
        parallelToolCalls: true,
        streaming: true,
        systemMessages: true,
        jsonMode: false,
        toolCalling: true,
        extendedThinking: false,
      });

      const adapter = new TestAdapter();
      const result = adapter.validateModelCapabilities('some-model', {
        vision: false,
        toolCalling: true,
      });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // extractTextContent
  // --------------------------------------------------------------------------

  describe('extractTextContent', () => {
    it('should extract text from a string message', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = { role: 'user', content: 'Hello world' };
      expect(adapter.testExtractTextContent(message)).toBe('Hello world');
    });

    it('should extract and join text from content blocks', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'First part.' },
          { type: 'text', text: 'Second part.' },
        ],
      };
      expect(adapter.testExtractTextContent(message)).toBe('First part.\nSecond part.');
    });

    it('should ignore non-text blocks', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Only text' },
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'search',
            arguments: { query: 'test' },
          },
        ],
      };
      expect(adapter.testExtractTextContent(message)).toBe('Only text');
    });

    it('should return empty string when no text blocks exist', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'search',
            arguments: { query: 'test' },
          },
        ],
      };
      expect(adapter.testExtractTextContent(message)).toBe('');
    });
  });

  // --------------------------------------------------------------------------
  // extractToolCalls
  // --------------------------------------------------------------------------

  describe('extractToolCalls', () => {
    it('should return empty array for string content', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = { role: 'user', content: 'Hello' };
      expect(adapter.testExtractToolCalls(message)).toEqual([]);
    });

    it('should extract tool_use blocks from content', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me search.' },
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'google_search',
            arguments: { query: 'vitest' },
          },
          {
            type: 'tool_use',
            id: 'call_2',
            name: 'web_scrape',
            arguments: { url: 'https://example.com' },
          },
        ],
      };

      const toolCalls = adapter.testExtractToolCalls(message);
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0]).toEqual({
        id: 'call_1',
        name: 'google_search',
        arguments: { query: 'vitest' },
      });
      expect(toolCalls[1]).toEqual({
        id: 'call_2',
        name: 'web_scrape',
        arguments: { url: 'https://example.com' },
      });
    });
  });

  // --------------------------------------------------------------------------
  // hasImages
  // --------------------------------------------------------------------------

  describe('hasImages', () => {
    it('should return false for string content', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = { role: 'user', content: 'No images here' };
      expect(adapter.testHasImages(message)).toBe(false);
    });

    it('should return true when message contains image blocks', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image' },
          {
            type: 'image',
            source: { type: 'base64', mediaType: 'image/png', data: 'abc123' },
          },
        ],
      };
      expect(adapter.testHasImages(message)).toBe(true);
    });

    it('should return false when no image blocks exist', () => {
      const adapter = new TestAdapter();
      const message: UnifiedMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: 'Just text' }],
      };
      expect(adapter.testHasImages(message)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // conversationHasImages
  // --------------------------------------------------------------------------

  describe('conversationHasImages', () => {
    it('should return true if any message has images', () => {
      const adapter = new TestAdapter();
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/jpeg', data: 'data' },
            },
          ],
        },
      ];
      expect(adapter.testConversationHasImages(messages)).toBe(true);
    });

    it('should return false if no messages have images', () => {
      const adapter = new TestAdapter();
      const messages: UnifiedMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      expect(adapter.testConversationHasImages(messages)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // generateToolCallId
  // --------------------------------------------------------------------------

  describe('generateToolCallId', () => {
    it('should generate an ID starting with "call_"', () => {
      const adapter = new TestAdapter();
      const id = adapter.testGenerateToolCallId();
      expect(id).toMatch(/^call_/);
    });

    it('should generate unique IDs on successive calls', () => {
      const adapter = new TestAdapter();
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        ids.add(adapter.testGenerateToolCallId());
      }
      // All 20 should be unique
      expect(ids.size).toBe(20);
    });
  });

  // --------------------------------------------------------------------------
  // AdapterFactory type export
  // --------------------------------------------------------------------------

  describe('AdapterFactory type', () => {
    it('should allow a function that creates an adapter from a providerId', () => {
      // This is a compile-time check; we just verify it can be used as expected
      const factory = (_providerId: ProviderId): BaseAIAdapter => {
        return new TestAdapter();
      };
      const adapter = factory('claude');
      expect(adapter).toBeInstanceOf(TestAdapter);
    });
  });
});
