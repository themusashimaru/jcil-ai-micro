// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const mockGetAdapter = vi.fn();
vi.mock('../../adapters', () => ({
  getAdapter: (...args: unknown[]) => mockGetAdapter(...args),
}));

const mockGetProvider = vi.fn();
const mockGetDefaultModel = vi.fn();
vi.mock('../../registry', () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
  getDefaultModel: (...args: unknown[]) => mockGetDefaultModel(...args),
}));

// ============================================
// IMPORTS
// ============================================

import {
  agentChat,
  agentChatWithTools,
  buildToolResultMessage,
  buildToolCallMessage,
  convertAnthropicTools,
} from '../index';

// ============================================
// HELPERS
// ============================================

function makeChunks(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function setupMocks(options = {}) {
  const chatFn = vi.fn().mockReturnValue(
    makeChunks(
      options.chunks || [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
        { type: 'message_end', usage: { inputTokens: 10, outputTokens: 5 } },
      ]
    )
  );

  mockGetAdapter.mockReturnValue({ chat: chatFn });
  mockGetDefaultModel.mockReturnValue({ id: 'claude-sonnet-4-6' });
  mockGetProvider.mockReturnValue({
    capabilities: { toolCalling: true, vision: true, streaming: true },
  });

  return { chatFn };
}

// ============================================
// TESTS
// ============================================

describe('agentic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // agentChat
  // -----------------------------------------------------------------------

  describe('agentChat', () => {
    it('should return text from streaming response', async () => {
      setupMocks();
      const result = await agentChat([{ role: 'user', content: 'Hello' }]);
      expect(result.text).toBe('Hello world');
    });

    it('should return provider and model', async () => {
      setupMocks();
      const result = await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(result.provider).toBe('claude');
      expect(result.model).toBe('claude-sonnet-4-6');
    });

    it('should return usage stats', async () => {
      setupMocks();
      const result = await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    });

    it('should use specified provider', async () => {
      setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }], { provider: 'openai' });
      expect(mockGetAdapter).toHaveBeenCalledWith('openai');
    });

    it('should use specified model', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }], { model: 'gpt-4' });
      const callArgs = chatFn.mock.calls[0][1];
      expect(callArgs.model).toBe('gpt-4');
    });

    it('should use default maxTokens of 4096', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(chatFn.mock.calls[0][1].maxTokens).toBe(4096);
    });

    it('should use custom maxTokens', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }], { maxTokens: 2000 });
      expect(chatFn.mock.calls[0][1].maxTokens).toBe(2000);
    });

    it('should use default temperature of 0.7', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(chatFn.mock.calls[0][1].temperature).toBe(0.7);
    });

    it('should use custom temperature', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }], { temperature: 0 });
      expect(chatFn.mock.calls[0][1].temperature).toBe(0);
    });

    it('should pass system prompt', async () => {
      const { chatFn } = setupMocks();
      await agentChat([{ role: 'user', content: 'Hi' }], { systemPrompt: 'You are a bot.' });
      expect(chatFn.mock.calls[0][1].systemPrompt).toBe('You are a bot.');
    });

    it('should throw if no default model found', async () => {
      mockGetAdapter.mockReturnValue({ chat: vi.fn() });
      mockGetDefaultModel.mockReturnValue(undefined);

      await expect(agentChat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
        'No default model found'
      );
    });

    it('should throw on streaming error', async () => {
      setupMocks({
        chunks: [
          { type: 'text', text: 'partial' },
          { type: 'error', error: { message: 'Rate limited' } },
        ],
      });

      await expect(agentChat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Rate limited');
    });

    it('should throw with default message on error without message', async () => {
      setupMocks({
        chunks: [{ type: 'error', error: {} }],
      });

      await expect(agentChat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Chat failed');
    });

    it('should handle empty text chunks', async () => {
      setupMocks({
        chunks: [
          { type: 'text', text: '' },
          { type: 'text', text: null },
          { type: 'text', text: 'hello' },
          { type: 'message_end' },
        ],
      });

      const result = await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(result.text).toBe('hello');
    });

    it('should handle no usage in message_end', async () => {
      setupMocks({
        chunks: [{ type: 'text', text: 'hi' }, { type: 'message_end' }],
      });

      const result = await agentChat([{ role: 'user', content: 'Hi' }]);
      expect(result.usage).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // agentChatWithTools
  // -----------------------------------------------------------------------

  describe('agentChatWithTools', () => {
    const sampleTools = [
      {
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    ];

    it('should return text response when no tool calls', async () => {
      setupMocks({
        chunks: [
          { type: 'text', text: 'No tools needed.' },
          { type: 'message_end', usage: { inputTokens: 10, outputTokens: 5 } },
        ],
      });

      const result = await agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools);

      expect(result.text).toBe('No tools needed.');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.done).toBe(true);
    });

    it('should collect tool calls from streaming', async () => {
      setupMocks({
        chunks: [
          { type: 'tool_call_start', toolCall: { id: 'call_1', name: 'read_file' } },
          { type: 'tool_call_delta', toolCall: { arguments: { path: '/test' } } },
          { type: 'tool_call_end' },
          { type: 'message_end' },
        ],
      });

      const result = await agentChatWithTools(
        [{ role: 'user', content: 'Read my file' }],
        sampleTools
      );

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('read_file');
      expect(result.done).toBe(false);
    });

    it('should handle multiple tool calls', async () => {
      setupMocks({
        chunks: [
          { type: 'tool_call_start', toolCall: { id: 'call_1', name: 'read_file' } },
          { type: 'tool_call_end' },
          { type: 'tool_call_start', toolCall: { id: 'call_2', name: 'read_file' } },
          { type: 'tool_call_end' },
          { type: 'message_end' },
        ],
      });

      const result = await agentChatWithTools(
        [{ role: 'user', content: 'Read two files' }],
        sampleTools
      );

      expect(result.toolCalls).toHaveLength(2);
    });

    it('should throw if provider does not support tool calling', async () => {
      setupMocks();
      mockGetProvider.mockReturnValue({
        capabilities: { toolCalling: false },
      });

      await expect(
        agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools)
      ).rejects.toThrow('does not support tool calling');
    });

    it('should throw if no default model found', async () => {
      setupMocks();
      mockGetDefaultModel.mockReturnValue(undefined);

      await expect(
        agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools)
      ).rejects.toThrow('No default model found');
    });

    it('should throw on streaming error', async () => {
      setupMocks({
        chunks: [{ type: 'error', error: { message: 'Overloaded' } }],
      });

      await expect(
        agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools)
      ).rejects.toThrow('Overloaded');
    });

    it('should use default maxTokens of 8192 for tool calls', async () => {
      const { chatFn } = setupMocks();
      await agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools);
      expect(chatFn.mock.calls[0][1].maxTokens).toBe(8192);
    });

    it('should pass tools to adapter', async () => {
      const { chatFn } = setupMocks();
      await agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools);
      expect(chatFn.mock.calls[0][1].tools).toBe(sampleTools);
    });

    it('should include text alongside tool calls', async () => {
      setupMocks({
        chunks: [
          { type: 'text', text: 'Let me check that.' },
          { type: 'tool_call_start', toolCall: { id: 'call_1', name: 'read_file' } },
          { type: 'tool_call_end' },
          { type: 'message_end' },
        ],
      });

      const result = await agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools);

      expect(result.text).toBe('Let me check that.');
      expect(result.toolCalls).toHaveLength(1);
    });

    it('should return usage stats', async () => {
      setupMocks({
        chunks: [
          { type: 'text', text: 'ok' },
          { type: 'message_end', usage: { inputTokens: 100, outputTokens: 50 } },
        ],
      });

      const result = await agentChatWithTools([{ role: 'user', content: 'Hi' }], sampleTools);

      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });
  });

  // -----------------------------------------------------------------------
  // buildToolResultMessage
  // -----------------------------------------------------------------------

  describe('buildToolResultMessage', () => {
    it('should create a message with tool role', () => {
      const msg = buildToolResultMessage([{ toolCallId: 'call_1', content: 'File contents here' }]);
      expect(msg.role).toBe('tool');
    });

    it('should include tool_result content blocks', () => {
      const msg = buildToolResultMessage([{ toolCallId: 'call_1', content: 'Result' }]);
      expect(msg.content).toHaveLength(1);
      expect(msg.content[0].type).toBe('tool_result');
      expect(msg.content[0].toolUseId).toBe('call_1');
      expect(msg.content[0].content).toBe('Result');
    });

    it('should handle multiple results', () => {
      const msg = buildToolResultMessage([
        { toolCallId: 'call_1', content: 'Result 1' },
        { toolCallId: 'call_2', content: 'Result 2' },
      ]);
      expect(msg.content).toHaveLength(2);
    });

    it('should pass isError flag', () => {
      const msg = buildToolResultMessage([
        { toolCallId: 'call_1', content: 'Error occurred', isError: true },
      ]);
      expect(msg.content[0].isError).toBe(true);
    });

    it('should handle empty results array', () => {
      const msg = buildToolResultMessage([]);
      expect(msg.content).toHaveLength(0);
      expect(msg.role).toBe('tool');
    });
  });

  // -----------------------------------------------------------------------
  // buildToolCallMessage
  // -----------------------------------------------------------------------

  describe('buildToolCallMessage', () => {
    it('should create a message with assistant role', () => {
      const msg = buildToolCallMessage([
        { id: 'call_1', name: 'read_file', arguments: { path: '/test' } },
      ]);
      expect(msg.role).toBe('assistant');
    });

    it('should include tool_use content blocks', () => {
      const msg = buildToolCallMessage([
        { id: 'call_1', name: 'read_file', arguments: { path: '/test' } },
      ]);
      expect(msg.content).toHaveLength(1);
      expect(msg.content[0].type).toBe('tool_use');
      expect(msg.content[0].id).toBe('call_1');
      expect(msg.content[0].name).toBe('read_file');
      expect(msg.content[0].arguments).toEqual({ path: '/test' });
    });

    it('should handle multiple tool calls', () => {
      const msg = buildToolCallMessage([
        { id: 'call_1', name: 'read_file', arguments: {} },
        { id: 'call_2', name: 'write_file', arguments: {} },
      ]);
      expect(msg.content).toHaveLength(2);
    });

    it('should handle empty tool calls array', () => {
      const msg = buildToolCallMessage([]);
      expect(msg.content).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // convertAnthropicTools
  // -----------------------------------------------------------------------

  describe('convertAnthropicTools', () => {
    it('should convert tool format', () => {
      const anthropicTools = [
        {
          name: 'search',
          description: 'Search the web',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      ];

      const result = convertAnthropicTools(anthropicTools);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('search');
      expect(result[0].description).toBe('Search the web');
      expect(result[0].parameters.type).toBe('object');
      expect(result[0].parameters.properties.query.type).toBe('string');
      expect(result[0].parameters.required).toEqual(['query']);
    });

    it('should handle missing required array', () => {
      const anthropicTools = [
        {
          name: 'tool1',
          description: 'A tool',
          input_schema: {
            type: 'object',
            properties: {},
          },
        },
      ];

      const result = convertAnthropicTools(anthropicTools);
      expect(result[0].parameters.required).toEqual([]);
    });

    it('should handle multiple tools', () => {
      const anthropicTools = [
        { name: 'a', description: 'A', input_schema: { type: 'object', properties: {} } },
        { name: 'b', description: 'B', input_schema: { type: 'object', properties: {} } },
      ];

      const result = convertAnthropicTools(anthropicTools);
      expect(result).toHaveLength(2);
    });

    it('should handle empty array', () => {
      expect(convertAnthropicTools([])).toEqual([]);
    });

    it('should preserve enum and items in properties', () => {
      const anthropicTools = [
        {
          name: 'tool',
          description: 'D',
          input_schema: {
            type: 'object',
            properties: {
              lang: { type: 'string', enum: ['python', 'javascript'] },
              items: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      ];

      const result = convertAnthropicTools(anthropicTools);
      expect(result[0].parameters.properties.lang.enum).toEqual(['python', 'javascript']);
      expect(result[0].parameters.properties.items.items).toEqual({ type: 'string' });
    });
  });
});
