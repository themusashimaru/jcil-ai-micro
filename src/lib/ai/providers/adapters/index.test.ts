/**
 * ADAPTERS INDEX (BARREL EXPORT) TESTS
 *
 * Tests that all expected exports are available from the barrel index module.
 * Verifies that each adapter class, factory function, and utility is properly
 * exported for consumers.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// MOCKS — must come BEFORE imports of modules under test
// ============================================================================

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { stream: vi.fn() },
  }));
  // @ts-expect-error Assigning static property to mock constructor
  MockAnthropic.APIError = class extends Error {
    status: number;
    constructor(s: number, m: string) {
      super(m);
      this.status = s;
    }
  };
  return { default: MockAnthropic };
});

vi.mock('@/lib/ai/tools/web-search', () => ({
  NATIVE_WEB_SEARCH_SENTINEL: '__native_web_search__',
}));

vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } },
  }));
  // @ts-expect-error Assigning static property to mock constructor
  MockOpenAI.APIError = class extends Error {
    status: number;
    constructor(s: number, m: string) {
      super(m);
      this.status = s;
    }
  };
  return { default: MockOpenAI };
});

vi.mock('@google/generative-ai', () => {
  const MockGoogleGenerativeAI = vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      startChat: vi.fn().mockReturnValue({ sendMessageStream: vi.fn() }),
    }),
  }));
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
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

// Set env vars before import
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';
process.env.XAI_API_KEY = 'test-key';
process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';

import * as adaptersModule from './index';

// ============================================================================
// TESTS
// ============================================================================

describe('adapters/index barrel exports', () => {
  // --------------------------------------------------------------------------
  // Base adapter class
  // --------------------------------------------------------------------------

  describe('BaseAIAdapter', () => {
    it('should export BaseAIAdapter class', () => {
      expect(adaptersModule.BaseAIAdapter).toBeDefined();
      expect(typeof adaptersModule.BaseAIAdapter).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // Anthropic adapter
  // --------------------------------------------------------------------------

  describe('Anthropic exports', () => {
    it('should export AnthropicAdapter class', () => {
      expect(adaptersModule.AnthropicAdapter).toBeDefined();
      expect(typeof adaptersModule.AnthropicAdapter).toBe('function');
    });

    it('should export createAnthropicAdapter factory', () => {
      expect(adaptersModule.createAnthropicAdapter).toBeDefined();
      expect(typeof adaptersModule.createAnthropicAdapter).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // OpenAI-compatible adapter
  // --------------------------------------------------------------------------

  describe('OpenAI-compatible exports', () => {
    it('should export OpenAICompatibleAdapter class', () => {
      expect(adaptersModule.OpenAICompatibleAdapter).toBeDefined();
      expect(typeof adaptersModule.OpenAICompatibleAdapter).toBe('function');
    });

    it('should export createOpenAIAdapter factory', () => {
      expect(adaptersModule.createOpenAIAdapter).toBeDefined();
      expect(typeof adaptersModule.createOpenAIAdapter).toBe('function');
    });

    it('should export createXAIAdapter factory', () => {
      expect(adaptersModule.createXAIAdapter).toBeDefined();
      expect(typeof adaptersModule.createXAIAdapter).toBe('function');
    });

    it('should export createDeepSeekAdapter factory', () => {
      expect(adaptersModule.createDeepSeekAdapter).toBeDefined();
      expect(typeof adaptersModule.createDeepSeekAdapter).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // Google adapter
  // --------------------------------------------------------------------------

  describe('Google exports', () => {
    it('should export GoogleGeminiAdapter class', () => {
      expect(adaptersModule.GoogleGeminiAdapter).toBeDefined();
      expect(typeof adaptersModule.GoogleGeminiAdapter).toBe('function');
    });

    it('should export createGoogleAdapter factory', () => {
      expect(adaptersModule.createGoogleAdapter).toBeDefined();
      expect(typeof adaptersModule.createGoogleAdapter).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // Factory exports
  // --------------------------------------------------------------------------

  describe('Factory exports', () => {
    it('should export createAdapter', () => {
      expect(adaptersModule.createAdapter).toBeDefined();
      expect(typeof adaptersModule.createAdapter).toBe('function');
    });

    it('should export getAdapter', () => {
      expect(adaptersModule.getAdapter).toBeDefined();
      expect(typeof adaptersModule.getAdapter).toBe('function');
    });

    it('should export clearAdapterCache', () => {
      expect(adaptersModule.clearAdapterCache).toBeDefined();
      expect(typeof adaptersModule.clearAdapterCache).toBe('function');
    });

    it('should export hasAdapterCached', () => {
      expect(adaptersModule.hasAdapterCached).toBeDefined();
      expect(typeof adaptersModule.hasAdapterCached).toBe('function');
    });

    it('should export isOpenAICompatible', () => {
      expect(adaptersModule.isOpenAICompatible).toBeDefined();
      expect(typeof adaptersModule.isOpenAICompatible).toBe('function');
    });

    it('should export isAnthropicProvider', () => {
      expect(adaptersModule.isAnthropicProvider).toBeDefined();
      expect(typeof adaptersModule.isAnthropicProvider).toBe('function');
    });

    it('should export isGoogleProvider', () => {
      expect(adaptersModule.isGoogleProvider).toBeDefined();
      expect(typeof adaptersModule.isGoogleProvider).toBe('function');
    });
  });
});
