// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCK SETUP
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockGetProvider = vi.fn();
const mockGetModel = vi.fn();

vi.mock('../../registry', () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
  getModel: (...args: unknown[]) => mockGetModel(...args),
}));

const mockConversationContainsImages = vi.fn();
const mockConversationContainsToolCalls = vi.fn();

vi.mock('../../capabilities', () => ({
  conversationContainsImages: (...args: unknown[]) => mockConversationContainsImages(...args),
  conversationContainsToolCalls: (...args: unknown[]) => mockConversationContainsToolCalls(...args),
}));

const mockSummarizeContext = vi.fn();
const mockEstimateTokenCount = vi.fn();

vi.mock('../summarizer', () => ({
  summarizeContext: (...args: unknown[]) => mockSummarizeContext(...args),
  estimateTokenCount: (...args: unknown[]) => mockEstimateTokenCount(...args),
}));

// ============================================================================
// IMPORT UNDER TEST (after mocks)
// ============================================================================

import {
  DEFAULT_HANDOFF_OPTIONS,
  analyzeCapabilityLoss,
  isHandoffSafe,
  prepareMessagesForProvider,
  needsSummarization,
  getMaxContextSize,
  prepareProviderHandoff,
  canHandoff,
  getRecommendedHandoffProvider,
} from '../handoff';

import type { UnifiedMessage, ProviderConfig } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'claude',
    name: 'Claude',
    family: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    models: [
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      },
    ],
    capabilities: {
      vision: true,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: false,
      toolCalling: true,
      extendedThinking: true,
    },
    ...overrides,
  };
}

function makeNoVisionProvider(): ProviderConfig {
  return makeProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    capabilities: {
      vision: false,
      parallelToolCalls: true,
      streaming: true,
      systemMessages: true,
      jsonMode: true,
      toolCalling: true,
      extendedThinking: false,
    },
  });
}

function makeNoToolProvider(): ProviderConfig {
  return makeProvider({
    id: 'deepseek',
    name: 'NoToolProvider',
    capabilities: {
      vision: false,
      parallelToolCalls: false,
      streaming: true,
      systemMessages: false,
      jsonMode: false,
      toolCalling: false,
      extendedThinking: false,
    },
  });
}

function textMsg(role: 'user' | 'assistant', text: string): UnifiedMessage {
  return { role, content: text };
}

function imageMsg(): UnifiedMessage {
  return {
    role: 'user',
    content: [{ type: 'image', source: { type: 'base64', data: 'abc123' } }],
  };
}

function toolUseMsg(): UnifiedMessage {
  return {
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'call_1', name: 'search', arguments: { q: 'hello' } }],
  };
}

function toolResultMsg(): UnifiedMessage {
  return {
    role: 'tool',
    content: [{ type: 'tool_result', toolUseId: 'call_1', content: 'result text' }],
  };
}

function mixedMsg(): UnifiedMessage {
  return {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Here is the answer' },
      { type: 'tool_use', id: 'call_2', name: 'calc', arguments: { expr: '2+2' } },
    ],
  };
}

function imageAndTextMsg(): UnifiedMessage {
  return {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', source: { type: 'url', url: 'https://example.com/img.png' } },
    ],
  };
}

function imageOnlyMsg(): UnifiedMessage {
  return {
    role: 'user',
    content: [{ type: 'image', source: { type: 'base64', data: 'abc123' } }],
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('handoff module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockConversationContainsImages.mockReturnValue(false);
    mockConversationContainsToolCalls.mockReturnValue(false);
    mockEstimateTokenCount.mockReturnValue(1000);
  });

  // --------------------------------------------------------------------------
  // DEFAULT_HANDOFF_OPTIONS
  // --------------------------------------------------------------------------

  describe('DEFAULT_HANDOFF_OPTIONS', () => {
    it('should have summarizeIfExceeds set to 0.8', () => {
      expect(DEFAULT_HANDOFF_OPTIONS.summarizeIfExceeds).toBe(0.8);
    });

    it('should have includeSystemPrompt set to true', () => {
      expect(DEFAULT_HANDOFF_OPTIONS.includeSystemPrompt).toBe(true);
    });

    it('should have preserveToolHistory set to true', () => {
      expect(DEFAULT_HANDOFF_OPTIONS.preserveToolHistory).toBe(true);
    });

    it('should have warnOnCapabilityLoss set to true', () => {
      expect(DEFAULT_HANDOFF_OPTIONS.warnOnCapabilityLoss).toBe(true);
    });

    it('should have exactly four keys', () => {
      expect(Object.keys(DEFAULT_HANDOFF_OPTIONS)).toHaveLength(4);
    });
  });

  // --------------------------------------------------------------------------
  // analyzeCapabilityLoss
  // --------------------------------------------------------------------------

  describe('analyzeCapabilityLoss', () => {
    it('should return empty array when both providers have same capabilities', () => {
      const provider = makeProvider();
      mockGetProvider.mockReturnValue(provider);
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = analyzeCapabilityLoss('claude', 'claude', []);
      expect(result).toEqual([]);
    });

    it('should warn about vision loss when conversation has images', () => {
      const from = makeProvider();
      const to = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsImages.mockReturnValue(true);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [imageMsg()]);
      expect(result).toContainEqual(expect.stringContaining('does not support vision'));
    });

    it('should not warn about vision when conversation has no images', () => {
      const from = makeProvider();
      const to = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsImages.mockReturnValue(false);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [textMsg('user', 'hi')]);
      const visionWarnings = result.filter((w) => w.includes('vision'));
      expect(visionWarnings).toHaveLength(0);
    });

    it('should warn about tool calling loss when conversation has tool calls', () => {
      const from = makeProvider();
      const to = makeNoToolProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsToolCalls.mockReturnValue(true);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [toolUseMsg()]);
      expect(result).toContainEqual(expect.stringContaining('does not support tool calling'));
    });

    it('should not warn about tool calling when conversation has no tool calls', () => {
      const from = makeProvider();
      const to = makeNoToolProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [textMsg('user', 'hi')]);
      const toolWarnings = result.filter((w) => w.includes('tool calling'));
      expect(toolWarnings).toHaveLength(0);
    });

    it('should warn about parallel tool calls loss', () => {
      const from = makeProvider();
      const to = makeProvider({
        id: 'deepseek',
        name: 'Target',
        capabilities: {
          ...from.capabilities,
          parallelToolCalls: false,
        },
      });
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));

      const result = analyzeCapabilityLoss('claude', 'deepseek', []);
      expect(result).toContainEqual(
        expect.stringContaining('does not support parallel tool calls')
      );
    });

    it('should warn about system messages loss', () => {
      const from = makeProvider();
      const to = makeProvider({
        id: 'deepseek',
        name: 'Target',
        capabilities: {
          ...from.capabilities,
          systemMessages: false,
        },
      });
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));

      const result = analyzeCapabilityLoss('claude', 'deepseek', []);
      expect(result).toContainEqual(expect.stringContaining('does not support system messages'));
    });

    it('should return multiple warnings when multiple capabilities are lost', () => {
      const from = makeProvider();
      const to = makeNoToolProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(true);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [imageMsg(), toolUseMsg()]);
      // vision, toolCalling, parallelToolCalls, systemMessages
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('should include target provider name in warnings', () => {
      const from = makeProvider();
      const to = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsImages.mockReturnValue(true);

      const result = analyzeCapabilityLoss('claude', 'deepseek', [imageMsg()]);
      expect(result[0]).toContain('DeepSeek');
    });
  });

  // --------------------------------------------------------------------------
  // isHandoffSafe
  // --------------------------------------------------------------------------

  describe('isHandoffSafe', () => {
    it('should return true when target supports all needed capabilities', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      expect(isHandoffSafe('claude', 'openai', [])).toBe(true);
    });

    it('should return false when images present and target lacks vision', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(false);

      expect(isHandoffSafe('claude', 'deepseek', [imageMsg()])).toBe(false);
    });

    it('should return false when tool calls present and target lacks tool calling', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(true);

      expect(isHandoffSafe('claude', 'deepseek', [toolUseMsg()])).toBe(false);
    });

    it('should return false when both vision and tool issues exist', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(true);

      expect(isHandoffSafe('claude', 'deepseek', [imageMsg(), toolUseMsg()])).toBe(false);
    });

    it('should return true when target has vision and conversation has images', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(false);

      expect(isHandoffSafe('claude', 'openai', [imageMsg()])).toBe(true);
    });

    it('should return true for empty conversation regardless of capabilities', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      expect(isHandoffSafe('claude', 'deepseek', [])).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // prepareMessagesForProvider
  // --------------------------------------------------------------------------

  describe('prepareMessagesForProvider', () => {
    it('should pass through text messages when target supports all capabilities', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      const msgs: UnifiedMessage[] = [textMsg('user', 'hello')];

      const result = prepareMessagesForProvider(msgs, 'claude');
      expect(result[0].content).toBe('hello');
    });

    it('should strip images from messages for non-vision providers', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      const msgs: UnifiedMessage[] = [imageAndTextMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string }[];
      const imageBlocks = content.filter((b) => b.type === 'image');
      expect(imageBlocks).toHaveLength(0);
    });

    it('should replace image-only message with placeholder text', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      const msgs: UnifiedMessage[] = [imageOnlyMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      expect(result[0].content).toBe('[Image content removed - not supported by current provider]');
    });

    it('should keep text blocks when stripping images from mixed content', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      const msgs: UnifiedMessage[] = [imageAndTextMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string; text?: string }[];
      const textBlocks = content.filter((b) => b.type === 'text');
      expect(textBlocks).toHaveLength(1);
      expect(textBlocks[0].text).toBe('What is in this image?');
    });

    it('should convert tool_use blocks to text for non-tool providers', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [toolUseMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string; text?: string }[];
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('[Used tool: search');
    });

    it('should convert tool_result blocks to text for non-tool providers', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [toolResultMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string; text?: string }[];
      expect(content[0].type).toBe('text');
      expect(content[0].text).toContain('[Tool result:');
    });

    it('should preserve tool_use blocks for tool-capable providers', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      const msgs: UnifiedMessage[] = [toolUseMsg()];

      const result = prepareMessagesForProvider(msgs, 'claude');
      const content = result[0].content as { type: string }[];
      expect(content[0].type).toBe('tool_use');
    });

    it('should add convertedTo metadata', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      const msgs: UnifiedMessage[] = [textMsg('user', 'hi')];

      const result = prepareMessagesForProvider(msgs, 'claude');
      expect(result[0].metadata?.convertedTo).toBe('claude');
    });

    it('should preserve existing metadata while adding conversion fields', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      const msg: UnifiedMessage = {
        role: 'user',
        content: 'hello',
        metadata: { provider: 'openai', model: 'gpt-5' },
      };

      const result = prepareMessagesForProvider([msg], 'claude');
      expect(result[0].metadata?.provider).toBe('openai');
      expect(result[0].metadata?.convertedFrom).toBe('openai');
      expect(result[0].metadata?.convertedTo).toBe('claude');
    });

    it('should handle string content without modification for vision strip', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      const msgs: UnifiedMessage[] = [textMsg('user', 'just text')];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      expect(result[0].content).toBe('just text');
    });

    it('should handle string content without modification for tool conversion', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [textMsg('assistant', 'just text')];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      expect(result[0].content).toBe('just text');
    });

    it('should handle mixed tool_use and text blocks for non-tool providers', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [mixedMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string; text?: string }[];
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('text');
      expect(content[0].text).toBe('Here is the answer');
      expect(content[1].type).toBe('text');
      expect(content[1].text).toContain('[Used tool: calc');
    });

    it('should include tool arguments in converted text', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [toolUseMsg()];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      const content = result[0].content as { type: string; text?: string }[];
      expect(content[0].text).toContain('"q":"hello"');
    });

    it('should process multiple messages independently', () => {
      mockGetProvider.mockReturnValue(makeNoVisionProvider());
      const msgs: UnifiedMessage[] = [
        textMsg('user', 'first'),
        imageOnlyMsg(),
        textMsg('assistant', 'response'),
      ];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('first');
      expect(typeof result[1].content).toBe('string'); // placeholder
      expect(result[2].content).toBe('response');
    });
  });

  // --------------------------------------------------------------------------
  // needsSummarization
  // --------------------------------------------------------------------------

  describe('needsSummarization', () => {
    it('should return true when tokens exceed threshold', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(170000); // > 200000 * 0.8

      expect(needsSummarization([], 'claude')).toBe(true);
    });

    it('should return false when tokens are under threshold', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(100000); // < 200000 * 0.8

      expect(needsSummarization([], 'claude')).toBe(false);
    });

    it('should return false when exactly at threshold', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(160000); // = 200000 * 0.8

      expect(needsSummarization([], 'claude')).toBe(false);
    });

    it('should use provided modelId to get model', () => {
      const customModel = {
        id: 'custom-model',
        contextWindow: 50000,
        maxOutputTokens: 4096,
        inputPricePer1M: 1,
        outputPricePer1M: 2,
        tier: 'budget',
      };
      mockGetModel.mockReturnValue(customModel);
      mockGetProvider.mockReturnValue(makeProvider());
      mockEstimateTokenCount.mockReturnValue(45000); // > 50000 * 0.8

      expect(needsSummarization([], 'claude', 'custom-model')).toBe(true);
      expect(mockGetModel).toHaveBeenCalledWith('claude', 'custom-model');
    });

    it('should respect custom threshold parameter', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(110000); // > 200000 * 0.5

      expect(needsSummarization([], 'claude', undefined, 0.5)).toBe(true);
    });

    it('should return false when model is not found via getModel and no models array', () => {
      mockGetModel.mockReturnValue(undefined);
      mockGetProvider.mockReturnValue(makeProvider({ models: [] }));
      mockEstimateTokenCount.mockReturnValue(999999);

      expect(needsSummarization([], 'claude', 'nonexistent')).toBe(false);
    });

    it('should use first model from provider when no modelId given', () => {
      const provider = makeProvider();
      mockGetProvider.mockReturnValue(provider);
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(100);

      needsSummarization([], 'claude');
      // It should use provider.models[0], not call getModel
      expect(mockGetModel).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getMaxContextSize
  // --------------------------------------------------------------------------

  describe('getMaxContextSize', () => {
    it('should return the context window of the default model', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);

      expect(getMaxContextSize('claude')).toBe(200000);
    });

    it('should return model context window when modelId is provided', () => {
      mockGetModel.mockReturnValue({
        id: 'small-model',
        contextWindow: 32000,
      });

      expect(getMaxContextSize('claude', 'small-model')).toBe(32000);
    });

    it('should return 128000 as default when model is not found', () => {
      mockGetModel.mockReturnValue(undefined);
      mockGetProvider.mockReturnValue(makeProvider({ models: [] }));

      expect(getMaxContextSize('claude', 'nonexistent')).toBe(128000);
    });

    it('should return 128000 when provider has no models and no modelId', () => {
      mockGetProvider.mockReturnValue(makeProvider({ models: [] }));
      mockGetModel.mockReturnValue(undefined);

      expect(getMaxContextSize('claude')).toBe(128000);
    });
  });

  // --------------------------------------------------------------------------
  // prepareProviderHandoff
  // --------------------------------------------------------------------------

  describe('prepareProviderHandoff', () => {
    beforeEach(() => {
      // Standard setup: full-capability providers, no summarization needed
      const claudeProvider = makeProvider();
      const openaiProvider = makeProvider({
        id: 'openai',
        name: 'OpenAI',
        capabilities: {
          vision: true,
          parallelToolCalls: true,
          streaming: true,
          systemMessages: true,
          jsonMode: true,
          toolCalling: true,
          extendedThinking: false,
        },
      });

      mockGetProvider.mockImplementation((id: string) => {
        if (id === 'claude') return claudeProvider;
        if (id === 'openai') return openaiProvider;
        return claudeProvider;
      });
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(1000);
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);
    });

    it('should return a HandoffResult with correct fromProvider and toProvider', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(result.fromProvider).toBe('claude');
      expect(result.toProvider).toBe('openai');
    });

    it('should include all original messages when no summarization needed', async () => {
      const msgs = [textMsg('user', 'hi'), textMsg('assistant', 'hello')];
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');
      expect(result.messages).toHaveLength(2);
    });

    it('should include metadata with originalMessageCount', async () => {
      const msgs = [textMsg('user', 'a'), textMsg('user', 'b'), textMsg('user', 'c')];
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');
      expect(result.metadata.originalMessageCount).toBe(3);
    });

    it('should include metadata with preparedMessageCount', async () => {
      const msgs = [textMsg('user', 'a')];
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');
      expect(result.metadata.preparedMessageCount).toBe(1);
    });

    it('should set wasSummarized to false when not summarized', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(result.metadata.wasSummarized).toBe(false);
    });

    it('should include processingTimeMs in metadata', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(typeof result.metadata.processingTimeMs).toBe('number');
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include handoffTime in ISO format', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(result.metadata.handoffTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include system prompt by default', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(result.systemPrompt).toBeDefined();
      expect(result.systemPrompt).toContain('continuing a conversation');
    });

    it('should exclude system prompt when includeSystemPrompt is false', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai', {
        includeSystemPrompt: false,
      });
      expect(result.systemPrompt).toBeUndefined();
    });

    it('should add capability warnings when warnOnCapabilityLoss is true', async () => {
      const noVision = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) =>
        id === 'claude' ? makeProvider() : noVision
      );
      mockConversationContainsImages.mockReturnValue(true);

      const result = await prepareProviderHandoff([imageMsg()], 'claude', 'deepseek');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('vision'));
    });

    it('should skip capability warnings when warnOnCapabilityLoss is false', async () => {
      const noVision = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) =>
        id === 'claude' ? makeProvider() : noVision
      );
      mockConversationContainsImages.mockReturnValue(true);

      const result = await prepareProviderHandoff([imageMsg()], 'claude', 'deepseek', {
        warnOnCapabilityLoss: false,
      });
      // Should have no capability warnings (may still have other warnings)
      const visionWarnings = result.warnings.filter((w) => w.includes('vision'));
      expect(visionWarnings).toHaveLength(0);
    });

    it('should trigger summarization when context exceeds threshold', async () => {
      // getModel must return a valid model so needsSummarization doesn't bail
      mockGetModel.mockReturnValue({
        id: 'claude-sonnet-4-6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      });
      mockEstimateTokenCount.mockReturnValue(180000); // > 200000 * 0.8
      mockSummarizeContext.mockResolvedValue({
        messages: [textMsg('system', 'summary'), textMsg('user', 'hi')],
        originalCount: 10,
        summarizedCount: 2,
        tokensBefore: 180000,
        tokensAfter: 5000,
        summaryText: 'summary',
      });

      const msgs = Array.from({ length: 10 }, (_, i) => textMsg('user', `msg ${i}`));
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');

      expect(result.metadata.wasSummarized).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('summarized'));
    });

    it('should include handoff annotation in system prompt', async () => {
      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');
      expect(result.systemPrompt).toContain('Claude');
      expect(result.systemPrompt).toContain('OpenAI');
    });

    it('should include summarization note in system prompt when summarized', async () => {
      mockGetModel.mockReturnValue({
        id: 'claude-sonnet-4-6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      });
      mockEstimateTokenCount.mockReturnValue(180000);
      mockSummarizeContext.mockResolvedValue({
        messages: [textMsg('system', 'summary')],
        originalCount: 5,
        summarizedCount: 1,
        tokensBefore: 180000,
        tokensAfter: 500,
        summaryText: 'summary',
      });

      const msgs = Array.from({ length: 5 }, (_, i) => textMsg('user', `msg ${i}`));
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');
      expect(result.systemPrompt).toContain('summarized');
    });

    it('should use merged config with defaults', async () => {
      mockGetModel.mockReturnValue({
        id: 'claude-sonnet-4-6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      });
      mockEstimateTokenCount.mockReturnValue(95000); // > 200000 * 0.4 but < 200000 * 0.8
      // With custom threshold of 0.4, should trigger summarization
      mockSummarizeContext.mockResolvedValue({
        messages: [textMsg('system', 'summary')],
        originalCount: 1,
        summarizedCount: 1,
        tokensBefore: 95000,
        tokensAfter: 500,
        summaryText: 'summary',
      });

      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai', {
        summarizeIfExceeds: 0.4,
      });
      expect(result.metadata.wasSummarized).toBe(true);
    });

    it('should call summarizeContext with correct parameters', async () => {
      mockGetModel.mockReturnValue({
        id: 'claude-sonnet-4-6',
        contextWindow: 200000,
        maxOutputTokens: 64000,
        inputPricePer1M: 3,
        outputPricePer1M: 15,
        tier: 'standard',
        isDefault: true,
      });
      mockEstimateTokenCount.mockReturnValue(180000);
      mockSummarizeContext.mockResolvedValue({
        messages: [textMsg('system', 'summary')],
        originalCount: 1,
        summarizedCount: 1,
        tokensBefore: 180000,
        tokensAfter: 500,
        summaryText: 'summary',
      });

      await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'openai');

      expect(mockSummarizeContext).toHaveBeenCalledWith(
        expect.any(Array),
        'openai',
        expect.objectContaining({
          preserveRecentMessages: 5,
          preserveToolHistory: true,
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // canHandoff
  // --------------------------------------------------------------------------

  describe('canHandoff', () => {
    it('should return possible=true and empty warnings for same provider', () => {
      const result = canHandoff('claude', 'claude', []);
      expect(result.possible).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should return possible=true even with warnings for different providers', () => {
      const from = makeProvider();
      const to = makeNoVisionProvider();
      mockGetProvider.mockImplementation((id: string) => (id === 'claude' ? from : to));
      mockConversationContainsImages.mockReturnValue(true);

      const result = canHandoff('claude', 'deepseek', [imageMsg()]);
      expect(result.possible).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should not call analyzeCapabilityLoss for same provider', () => {
      canHandoff('claude', 'claude', []);
      expect(mockGetProvider).not.toHaveBeenCalled();
    });

    it('should call analyzeCapabilityLoss for different providers', () => {
      const provider = makeProvider();
      mockGetProvider.mockReturnValue(provider);

      canHandoff('claude', 'openai', []);
      expect(mockGetProvider).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // getRecommendedHandoffProvider
  // --------------------------------------------------------------------------

  describe('getRecommendedHandoffProvider', () => {
    function setupProviderMock() {
      mockGetProvider.mockImplementation((id: string) => {
        switch (id) {
          case 'claude':
            return makeProvider();
          case 'openai':
            return makeProvider({
              id: 'openai',
              name: 'OpenAI',
              capabilities: {
                vision: true,
                parallelToolCalls: true,
                streaming: true,
                systemMessages: true,
                jsonMode: true,
                toolCalling: true,
                extendedThinking: false,
              },
            });
          case 'xai':
            return makeProvider({
              id: 'xai',
              name: 'xAI',
              capabilities: {
                vision: true,
                parallelToolCalls: true,
                streaming: true,
                systemMessages: true,
                jsonMode: true,
                toolCalling: true,
                extendedThinking: false,
              },
            });
          case 'deepseek':
            return makeNoVisionProvider();
          default:
            return makeProvider();
        }
      });
    }

    it('should exclude current provider from candidates', () => {
      setupProviderMock();
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('claude', []);
      expect(result).not.toBe('claude');
    });

    it('should exclude providers in excludeProviders list', () => {
      setupProviderMock();
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('claude', [], ['openai', 'xai', 'deepseek']);
      expect(result).toBeNull();
    });

    it('should skip providers without vision when conversation has images', () => {
      setupProviderMock();
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('claude', [imageMsg()]);
      expect(result).not.toBe('deepseek');
    });

    it('should skip providers without toolCalling when conversation has tool calls', () => {
      mockGetProvider.mockImplementation((id: string) => {
        if (id === 'openai') {
          return makeProvider({
            id: 'openai',
            name: 'OpenAI',
            capabilities: {
              vision: true,
              parallelToolCalls: true,
              streaming: true,
              systemMessages: true,
              jsonMode: true,
              toolCalling: true,
              extendedThinking: false,
            },
          });
        }
        if (id === 'xai') {
          return makeNoToolProvider();
        }
        if (id === 'deepseek') {
          return makeNoToolProvider();
        }
        return makeProvider();
      });
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(true);

      const result = getRecommendedHandoffProvider('claude', [toolUseMsg()]);
      // xai and deepseek should be skipped due to no toolCalling
      expect(result).toBe('openai');
    });

    it('should return null when all candidates are excluded', () => {
      setupProviderMock();
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('claude', [], ['openai', 'xai', 'deepseek']);
      expect(result).toBeNull();
    });

    it('should return null when no provider meets requirements', () => {
      mockGetProvider.mockImplementation(() => makeNoToolProvider());
      mockConversationContainsImages.mockReturnValue(true);
      mockConversationContainsToolCalls.mockReturnValue(true);

      // All candidates lack vision (and tool calling), so all skipped
      const result = getRecommendedHandoffProvider('claude', [imageMsg(), toolUseMsg()]);
      expect(result).toBeNull();
    });

    it('should prefer provider with highest capability score', () => {
      mockGetProvider.mockImplementation((id: string) => {
        if (id === 'openai') {
          return makeProvider({
            id: 'openai',
            name: 'OpenAI',
            capabilities: {
              vision: true,
              parallelToolCalls: true,
              streaming: true,
              systemMessages: true,
              jsonMode: true,
              toolCalling: true,
              extendedThinking: false,
            },
          });
        }
        if (id === 'xai') {
          return makeProvider({
            id: 'xai',
            name: 'xAI',
            capabilities: {
              vision: false,
              parallelToolCalls: false,
              streaming: true,
              systemMessages: true,
              jsonMode: false,
              toolCalling: true,
              extendedThinking: false,
            },
          });
        }
        if (id === 'deepseek') {
          return makeProvider({
            id: 'deepseek',
            name: 'DeepSeek',
            capabilities: {
              vision: false,
              parallelToolCalls: false,
              streaming: false,
              systemMessages: true,
              jsonMode: false,
              toolCalling: true,
              extendedThinking: false,
            },
          });
        }
        return makeProvider();
      });
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('claude', []);
      // openai has vision(2)+toolCalling(2)+parallelToolCalls(1)+streaming(1)=6
      // xai has streaming(1)+toolCalling(2)=3
      // deepseek has toolCalling(2)=2
      expect(result).toBe('openai');
    });

    it('should work with empty conversation', () => {
      setupProviderMock();
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = getRecommendedHandoffProvider('deepseek', []);
      expect(result).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases and integration-style tests
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty conversation array in analyzeCapabilityLoss', () => {
      const provider = makeProvider();
      mockGetProvider.mockReturnValue(provider);
      mockConversationContainsImages.mockReturnValue(false);
      mockConversationContainsToolCalls.mockReturnValue(false);

      const result = analyzeCapabilityLoss('claude', 'openai', []);
      expect(result).toEqual([]);
    });

    it('should handle messages with undefined metadata in prepareMessagesForProvider', () => {
      mockGetProvider.mockReturnValue(makeProvider());
      const msg: UnifiedMessage = { role: 'user', content: 'test' };

      const result = prepareMessagesForProvider([msg], 'claude');
      expect(result[0].metadata?.convertedFrom).toBeUndefined();
      expect(result[0].metadata?.convertedTo).toBe('claude');
    });

    it('should handle prepareProviderHandoff with empty conversation', async () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(0);

      const result = await prepareProviderHandoff([], 'claude', 'openai');
      expect(result.messages).toHaveLength(0);
      expect(result.metadata.originalMessageCount).toBe(0);
    });

    it('should handle needsSummarization when provider has no models and no modelId', () => {
      mockGetProvider.mockReturnValue(makeProvider({ models: [] }));
      mockEstimateTokenCount.mockReturnValue(999999);

      // model is undefined => returns false
      expect(needsSummarization([], 'claude')).toBe(false);
    });

    it('should handle provider with single model having isDefault in prepareProviderHandoff', async () => {
      const provider = makeProvider();
      mockGetProvider.mockReturnValue(provider);
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(100);

      const result = await prepareProviderHandoff([textMsg('user', 'hi')], 'claude', 'claude');
      expect(result.metadata.wasSummarized).toBe(false);
    });

    it('should handle conversation with only system messages', async () => {
      mockGetProvider.mockReturnValue(makeProvider());
      mockGetModel.mockReturnValue(undefined);
      mockEstimateTokenCount.mockReturnValue(100);

      const msgs: UnifiedMessage[] = [{ role: 'system', content: 'You are a helpful assistant' }];
      const result = await prepareProviderHandoff(msgs, 'claude', 'openai');
      expect(result.messages).toHaveLength(1);
    });

    it('should preserve message roles during conversion', () => {
      mockGetProvider.mockReturnValue(makeNoToolProvider());
      const msgs: UnifiedMessage[] = [
        textMsg('user', 'question'),
        textMsg('assistant', 'answer'),
        { role: 'system', content: 'instruction' },
      ];

      const result = prepareMessagesForProvider(msgs, 'deepseek');
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(result[2].role).toBe('system');
    });
  });
});
