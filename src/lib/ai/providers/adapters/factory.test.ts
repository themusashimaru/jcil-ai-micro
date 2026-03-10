/**
 * ADAPTER FACTORY TESTS
 *
 * Tests for the adapter factory module including:
 * - Creating adapters for each provider
 * - Caching behavior
 * - Cache clearing
 * - Provider type detection utilities
 * - Error handling for unsupported providers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must come BEFORE imports of modules under test
// ============================================================================

// Mock the Anthropic SDK (needed by anthropic adapter import)
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: { stream: vi.fn() },
  }));
  return { default: MockAnthropic };
});

// Mock the web-search sentinel (needed by anthropic adapter)
vi.mock('@/lib/ai/tools/web-search', () => ({
  NATIVE_WEB_SEARCH_SENTINEL: '__native_web_search__',
}));

// Mock the OpenAI SDK (needed by openai-compatible adapter import)
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

// Mock the Google SDK (needed by google adapter import)
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

// Mock the registry (needed by all adapter constructors)
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

import {
  createAdapter,
  getAdapter,
  clearAdapterCache,
  hasAdapterCached,
  isOpenAICompatible,
  isAnthropicProvider,
  isGoogleProvider,
} from './factory';

// ============================================================================
// TESTS
// ============================================================================

describe('Adapter Factory', () => {
  beforeEach(() => {
    // Set env vars needed by constructors
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.XAI_API_KEY = 'test-key';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.GEMINI_API_KEY = 'test-key';

    // Clear cache between tests
    clearAdapterCache();
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // createAdapter
  // --------------------------------------------------------------------------

  describe('createAdapter', () => {
    it('should create an adapter for "claude" provider', () => {
      const adapter = createAdapter('claude');
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe('claude');
      expect(adapter.family).toBe('anthropic');
    });

    it('should create an adapter for "openai" provider', () => {
      const adapter = createAdapter('openai');
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe('openai');
      expect(adapter.family).toBe('openai-compatible');
    });

    it('should create an adapter for "xai" provider', () => {
      const adapter = createAdapter('xai');
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe('xai');
    });

    it('should create an adapter for "deepseek" provider', () => {
      const adapter = createAdapter('deepseek');
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe('deepseek');
    });

    it('should create an adapter for "google" provider', () => {
      const adapter = createAdapter('google');
      expect(adapter).toBeDefined();
      expect(adapter.providerId).toBe('google');
      expect(adapter.family).toBe('google');
    });

    it('should throw for unsupported provider', () => {
      expect(() => createAdapter('unknown_provider' as never)).toThrow(
        'Unsupported provider: unknown_provider'
      );
    });

    it('should cache adapters by default', () => {
      const adapter1 = createAdapter('claude');
      const adapter2 = createAdapter('claude');
      expect(adapter1).toBe(adapter2);
    });

    it('should bypass cache when forceNew is true', () => {
      const adapter1 = createAdapter('claude');
      const adapter2 = createAdapter('claude', true);
      expect(adapter1).not.toBe(adapter2);
    });

    it('should cache the newest adapter when forceNew creates a new one', () => {
      createAdapter('claude');
      const adapter2 = createAdapter('claude', true);
      const adapter3 = createAdapter('claude');
      // adapter3 should be the cached adapter2
      expect(adapter3).toBe(adapter2);
    });
  });

  // --------------------------------------------------------------------------
  // getAdapter
  // --------------------------------------------------------------------------

  describe('getAdapter', () => {
    it('should be an alias for createAdapter with caching', () => {
      const adapter1 = getAdapter('claude');
      const adapter2 = getAdapter('claude');
      expect(adapter1).toBe(adapter2);
      expect(adapter1.providerId).toBe('claude');
    });
  });

  // --------------------------------------------------------------------------
  // clearAdapterCache
  // --------------------------------------------------------------------------

  describe('clearAdapterCache', () => {
    it('should clear all cached adapters', () => {
      createAdapter('claude');
      createAdapter('openai');

      expect(hasAdapterCached('claude')).toBe(true);
      expect(hasAdapterCached('openai')).toBe(true);

      clearAdapterCache();

      expect(hasAdapterCached('claude')).toBe(false);
      expect(hasAdapterCached('openai')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // hasAdapterCached
  // --------------------------------------------------------------------------

  describe('hasAdapterCached', () => {
    it('should return false for uncached providers', () => {
      expect(hasAdapterCached('claude')).toBe(false);
    });

    it('should return true after adapter is created', () => {
      createAdapter('claude');
      expect(hasAdapterCached('claude')).toBe(true);
    });

    it('should return false after cache is cleared', () => {
      createAdapter('claude');
      clearAdapterCache();
      expect(hasAdapterCached('claude')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isOpenAICompatible
  // --------------------------------------------------------------------------

  describe('isOpenAICompatible', () => {
    it('should return true for "openai"', () => {
      expect(isOpenAICompatible('openai')).toBe(true);
    });

    it('should return true for "xai"', () => {
      expect(isOpenAICompatible('xai')).toBe(true);
    });

    it('should return true for "deepseek"', () => {
      expect(isOpenAICompatible('deepseek')).toBe(true);
    });

    it('should return false for "claude"', () => {
      expect(isOpenAICompatible('claude')).toBe(false);
    });

    it('should return false for "google"', () => {
      expect(isOpenAICompatible('google')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isAnthropicProvider
  // --------------------------------------------------------------------------

  describe('isAnthropicProvider', () => {
    it('should return true for "claude"', () => {
      expect(isAnthropicProvider('claude')).toBe(true);
    });

    it('should return false for "openai"', () => {
      expect(isAnthropicProvider('openai')).toBe(false);
    });

    it('should return false for "google"', () => {
      expect(isAnthropicProvider('google')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // isGoogleProvider
  // --------------------------------------------------------------------------

  describe('isGoogleProvider', () => {
    it('should return true for "google"', () => {
      expect(isGoogleProvider('google')).toBe(true);
    });

    it('should return false for "claude"', () => {
      expect(isGoogleProvider('claude')).toBe(false);
    });

    it('should return false for "openai"', () => {
      expect(isGoogleProvider('openai')).toBe(false);
    });
  });
});
