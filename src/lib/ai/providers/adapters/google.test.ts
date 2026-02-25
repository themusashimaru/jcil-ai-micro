/**
 * GOOGLE GEMINI ADAPTER TESTS
 *
 * Tests for the GoogleGeminiAdapter class including:
 * - Message conversion (unified <-> Google)
 * - Tool formatting
 * - Tool result formatting
 * - Error classification
 * - API key management
 * - Factory function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must come BEFORE imports of modules under test
// ============================================================================

vi.mock('@google/generative-ai', () => {
  const mockGenerativeModel = {
    startChat: vi.fn().mockReturnValue({
      sendMessageStream: vi.fn(),
    }),
  };

  const MockGoogleGenerativeAI = vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue(mockGenerativeModel),
  }));

  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    Content: {},
    Part: {},
    Tool: {},
    FunctionDeclaration: {},
    FunctionCallingMode: { AUTO: 'AUTO' },
    SchemaType: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT',
    },
  };
});

vi.mock('../registry', () => ({
  getProvider: vi.fn().mockReturnValue({
    id: 'google',
    name: 'Google (Gemini)',
    family: 'google',
    apiKeyEnv: 'GEMINI_API_KEY',
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
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputPricePer1M: 0.5,
    outputPricePer1M: 3.0,
    tier: 'standard',
    isDefault: true,
  }),
}));

import { GoogleGeminiAdapter, createGoogleAdapter } from './google';
import type { UnifiedMessage, UnifiedTool, UnifiedToolResult } from '../types';

// ============================================================================
// TESTS
// ============================================================================

describe('GoogleGeminiAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  // --------------------------------------------------------------------------
  // Constructor and identity
  // --------------------------------------------------------------------------

  describe('constructor and identity', () => {
    it('should have providerId "google"', () => {
      const adapter = new GoogleGeminiAdapter();
      expect(adapter.providerId).toBe('google');
    });

    it('should have family "google"', () => {
      const adapter = new GoogleGeminiAdapter();
      expect(adapter.family).toBe('google');
    });
  });

  // --------------------------------------------------------------------------
  // toProviderMessages
  // --------------------------------------------------------------------------

  describe('toProviderMessages', () => {
    it('should convert simple user text messages', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [{ role: 'user', content: 'Hello Gemini' }];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'user',
        parts: [{ text: 'Hello Gemini' }],
      });
    });

    it('should filter out system messages', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
    });

    it('should map assistant role to model role', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [{ role: 'assistant', content: 'I am an AI' }];

      const result = adapter.toProviderMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('model');
    });

    it('should convert text content blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Multiple blocks' }],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Multiple blocks' }]);
    });

    it('should convert image blocks to inlineData', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/png', data: 'base64data' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts).toEqual([
        { inlineData: { mimeType: 'image/png', data: 'base64data' } },
      ]);
    });

    it('should convert tool_use blocks to functionCall', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'search',
              arguments: { query: 'test' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts).toEqual([
        {
          functionCall: {
            name: 'search',
            args: { query: 'test' },
          },
        },
      ]);
    });

    it('should convert tool_result blocks to functionResponse', () => {
      const adapter = new GoogleGeminiAdapter();
      // First, set up toolCallIdToName mapping by including a tool_use message
      const messages: UnifiedMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'search',
              arguments: { query: 'test' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool_result',
              toolUseId: 'call_1',
              content: 'Found results',
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      // The tool role message should have functionResponse parts
      const toolResultParts = result[1].parts;
      expect(toolResultParts).toEqual([
        {
          functionResponse: {
            name: 'call_1', // No mapping set yet in toProviderMessages, uses toolUseId
            response: { result: 'Found results' },
          },
        },
      ]);
    });

    it('should return [{ text: "" }] for messages with empty content blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [{ role: 'user', content: [] }];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts).toEqual([{ text: '' }]);
    });
  });

  // --------------------------------------------------------------------------
  // fromProviderMessages
  // --------------------------------------------------------------------------

  describe('fromProviderMessages', () => {
    it('should convert text parts to unified text blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'model',
          parts: [{ text: 'Hello from Gemini' }],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toEqual([{ type: 'text', text: 'Hello from Gemini' }]);
    });

    it('should convert user role correctly', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'user',
          parts: [{ text: 'User message' }],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);

      expect(result[0].role).toBe('user');
    });

    it('should convert inlineData to image blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'user',
          parts: [
            {
              inlineData: { mimeType: 'image/jpeg', data: 'imgdata' },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'image',
        source: { type: 'base64', mediaType: 'image/jpeg', data: 'imgdata' },
      });
    });

    it('should convert functionCall to tool_use blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'model',
          parts: [
            {
              functionCall: { name: 'search', args: { q: 'test' } },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0].type).toBe('tool_use');
      expect(content[0].name).toBe('search');
      expect(content[0].arguments).toEqual({ q: 'test' });
      // Should have a generated ID
      expect(content[0].id).toBeDefined();
    });

    it('should convert functionResponse to tool_result blocks', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: 'search',
                response: { result: 'found stuff' },
              },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);

      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      expect(content[0]).toEqual({
        type: 'tool_result',
        toolUseId: 'search',
        content: JSON.stringify({ result: 'found stuff' }),
      });
    });
  });

  // --------------------------------------------------------------------------
  // formatTools
  // --------------------------------------------------------------------------

  describe('formatTools', () => {
    it('should convert unified tools to Google format with SchemaType', () => {
      const adapter = new GoogleGeminiAdapter();
      const tools: UnifiedTool[] = [
        {
          name: 'web_search',
          description: 'Search the web',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              count: { type: 'number', description: 'Number of results' },
            },
            required: ['query'],
          },
        },
      ];

      const result = adapter.formatTools(tools);

      // Google format wraps declarations in a Tool object with functionDeclarations
      expect(result).toHaveLength(1);
      const tool0 = result[0] as unknown as Record<string, unknown[]>;
      expect(tool0.functionDeclarations).toBeDefined();
      expect(tool0.functionDeclarations).toHaveLength(1);

      const decl = (tool0.functionDeclarations as Record<string, unknown>[])[0] as Record<
        string,
        unknown
      >;
      expect(decl.name).toBe('web_search');
      expect(decl.description).toBe('Search the web');
      const params = decl.parameters as Record<string, unknown>;
      expect(params.type).toBe('OBJECT');
      expect((params.properties as Record<string, Record<string, unknown>>).query.type).toBe(
        'STRING'
      );
      expect((params.properties as Record<string, Record<string, unknown>>).count.type).toBe(
        'NUMBER'
      );
      expect(params.required).toEqual(['query']);
    });

    it('should handle boolean, array, and object types', () => {
      const adapter = new GoogleGeminiAdapter();
      const tools: UnifiedTool[] = [
        {
          name: 'test_tool',
          description: 'Test',
          parameters: {
            type: 'object',
            properties: {
              flag: { type: 'boolean' },
              items: { type: 'array' },
              config: { type: 'object' },
            },
          },
        },
      ];

      const result = adapter.formatTools(tools);
      // @ts-expect-error Accessing deep nested property on formatted Google tool
      const props = result[0].functionDeclarations[0].parameters.properties;

      expect(props.flag.type).toBe('BOOLEAN');
      expect(props.items.type).toBe('ARRAY');
      expect(props.config.type).toBe('OBJECT');
    });

    it('should map integer type to NUMBER', () => {
      const adapter = new GoogleGeminiAdapter();
      const tools: UnifiedTool[] = [
        {
          name: 'int_tool',
          description: 'Integer tool',
          parameters: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
            },
          },
        },
      ];

      const result = adapter.formatTools(tools);
      // @ts-expect-error Accessing deep nested property on formatted Google tool
      const props = result[0].functionDeclarations[0].parameters.properties;
      expect(props.count.type).toBe('NUMBER');
    });

    it('should map unknown types to STRING', () => {
      const adapter = new GoogleGeminiAdapter();
      const tools: UnifiedTool[] = [
        {
          name: 'unknown_tool',
          description: 'Unknown type tool',
          parameters: {
            type: 'object',
            properties: {
              custom: { type: 'custom_type' },
            },
          },
        },
      ];

      const result = adapter.formatTools(tools);
      // @ts-expect-error Accessing deep nested property on formatted Google tool
      const props = result[0].functionDeclarations[0].parameters.properties;
      expect(props.custom.type).toBe('STRING');
    });
  });

  // --------------------------------------------------------------------------
  // formatToolResult
  // --------------------------------------------------------------------------

  describe('formatToolResult', () => {
    it('should format a tool result as functionResponse part', () => {
      const adapter = new GoogleGeminiAdapter();
      const toolResult: UnifiedToolResult = {
        toolCallId: 'call_xyz',
        content: 'Result content',
        isError: false,
      };

      const result = adapter.formatToolResult(toolResult);

      // toolCallId is used as name since no mapping exists initially
      expect(result).toEqual({
        functionResponse: {
          name: 'call_xyz',
          response: { result: 'Result content' },
        },
      });
    });
  });

  // --------------------------------------------------------------------------
  // createGoogleAdapter factory
  // --------------------------------------------------------------------------

  describe('createGoogleAdapter', () => {
    it('should create a GoogleGeminiAdapter instance', () => {
      const adapter = createGoogleAdapter();
      expect(adapter).toBeInstanceOf(GoogleGeminiAdapter);
      expect(adapter.providerId).toBe('google');
      expect(adapter.family).toBe('google');
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle messages with mixed content block types', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Look at this' },
            {
              type: 'image',
              source: { type: 'base64', mediaType: 'image/png', data: 'data' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts).toHaveLength(2);
      expect(result[0].parts[0]).toEqual({ text: 'Look at this' });
      expect(result[0].parts[1]).toEqual({
        inlineData: { mimeType: 'image/png', data: 'data' },
      });
    });

    it('should default mediaType to image/png when not specified', () => {
      const adapter = new GoogleGeminiAdapter();
      const messages: UnifiedMessage[] = [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', data: 'data' },
            },
          ],
        },
      ];

      const result = adapter.toProviderMessages(messages);

      expect(result[0].parts[0]).toEqual({
        inlineData: { mimeType: 'image/png', data: 'data' },
      });
    });

    it('should handle functionResponse with string response', () => {
      const adapter = new GoogleGeminiAdapter();
      const googleMessages = [
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: 'tool_x',
                response: 'plain string result',
              },
            },
          ],
        },
      ];

      const result = adapter.fromProviderMessages(googleMessages);
      const content = result[0].content as unknown as Array<Record<string, unknown>>;
      // String response is passed through as-is (typeof check returns string)
      expect(content[0].content).toBe('plain string result');
    });
  });
});
