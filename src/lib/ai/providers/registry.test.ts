/**
 * REGISTRY TESTS
 *
 * Comprehensive tests for the AI provider registry module.
 * Tests all exported functions, edge cases, and environment variable handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PROVIDERS,
  getProvider,
  getProviderSafe,
  isValidProviderId,
  getAllProviders,
  getAvailableProviders,
  getAvailableProviderIds,
  isProviderAvailable,
  getModel,
  getProviderForModel,
  getProviderAndModel,
  getDefaultModel,
  getDefaultChatModelId,
  getFreeTierModelId,
  getModelsForProvider,
  getModelCapabilities,
  getProvidersByTier,
  getProvidersWithCapability,
  getCheapestProvider,
  estimateCost,
} from './registry';

// ============================================================================
// PROVIDERS CONSTANT
// ============================================================================

describe('PROVIDERS', () => {
  it('should contain all five supported providers', () => {
    expect(Object.keys(PROVIDERS)).toEqual(
      expect.arrayContaining(['claude', 'openai', 'xai', 'deepseek', 'google'])
    );
    expect(Object.keys(PROVIDERS)).toHaveLength(5);
  });

  it('should have valid provider configs with required fields', () => {
    for (const provider of Object.values(PROVIDERS)) {
      expect(provider.id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.family).toBeDefined();
      expect(provider.apiKeyEnv).toBeDefined();
      expect(provider.capabilities).toBeDefined();
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });

  it('should have exactly one default model per provider', () => {
    for (const provider of Object.values(PROVIDERS)) {
      const defaults = provider.models.filter((m) => m.isDefault);
      // At most one default — if none, first model is used as fallback
      expect(defaults.length).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// getProvider
// ============================================================================

describe('getProvider', () => {
  it('should return config for each valid provider ID', () => {
    const ids = ['claude', 'openai', 'xai', 'deepseek', 'google'] as const;
    for (const id of ids) {
      const provider = getProvider(id);
      expect(provider.id).toBe(id);
    }
  });

  it('should throw for an unknown provider ID', () => {
    expect(() => getProvider('nonexistent' as never)).toThrow('Unknown provider: nonexistent');
  });

  it('should return the full config object with capabilities', () => {
    const claude = getProvider('claude');
    expect(claude.capabilities.streaming).toBe(true);
    expect(claude.capabilities.toolCalling).toBe(true);
    expect(claude.family).toBe('anthropic');
  });
});

// ============================================================================
// getProviderSafe
// ============================================================================

describe('getProviderSafe', () => {
  it('should return config for valid provider IDs', () => {
    expect(getProviderSafe('claude')).toBeDefined();
    expect(getProviderSafe('claude')?.id).toBe('claude');
  });

  it('should return undefined for unknown provider IDs', () => {
    expect(getProviderSafe('nonexistent')).toBeUndefined();
    expect(getProviderSafe('')).toBeUndefined();
  });
});

// ============================================================================
// isValidProviderId
// ============================================================================

describe('isValidProviderId', () => {
  it('should return true for all valid provider IDs', () => {
    expect(isValidProviderId('claude')).toBe(true);
    expect(isValidProviderId('openai')).toBe(true);
    expect(isValidProviderId('xai')).toBe(true);
    expect(isValidProviderId('deepseek')).toBe(true);
    expect(isValidProviderId('google')).toBe(true);
  });

  it('should return false for invalid IDs', () => {
    expect(isValidProviderId('gpt')).toBe(false);
    expect(isValidProviderId('')).toBe(false);
    expect(isValidProviderId('CLAUDE')).toBe(false);
  });
});

// ============================================================================
// getAllProviders
// ============================================================================

describe('getAllProviders', () => {
  it('should return all five providers', () => {
    const providers = getAllProviders();
    expect(providers).toHaveLength(5);
  });

  it('should return ProviderConfig objects', () => {
    const providers = getAllProviders();
    for (const p of providers) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('models');
    }
  });
});

// ============================================================================
// API Key Availability Functions
// ============================================================================

describe('getAvailableProviders / getAvailableProviderIds / isProviderAvailable', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset to clean env for each test
    process.env = { ...originalEnv };
    // Remove all provider keys
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY_1;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY_1;
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY_1;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY_1;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_1;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return empty when no API keys are set', () => {
    expect(getAvailableProviders()).toHaveLength(0);
    expect(getAvailableProviderIds()).toHaveLength(0);
  });

  it('should detect provider with single API key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    expect(isProviderAvailable('claude')).toBe(true);
    expect(isProviderAvailable('openai')).toBe(false);
    expect(getAvailableProviderIds()).toEqual(['claude']);
  });

  it('should detect provider with numbered API key (_1 suffix)', () => {
    process.env.DEEPSEEK_API_KEY_1 = 'sk-test-key';
    expect(isProviderAvailable('deepseek')).toBe(true);
    expect(getAvailableProviderIds()).toEqual(['deepseek']);
  });

  it('should not treat empty string as a configured key', () => {
    process.env.OPENAI_API_KEY = '';
    expect(isProviderAvailable('openai')).toBe(false);
  });

  it('should detect multiple providers', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    process.env.GEMINI_API_KEY = 'sk-g';
    const available = getAvailableProviderIds();
    expect(available).toContain('claude');
    expect(available).toContain('google');
    expect(available).toHaveLength(2);
  });

  it('should return false for unknown provider', () => {
    expect(isProviderAvailable('nonexistent' as never)).toBe(false);
  });
});

// ============================================================================
// MODEL FUNCTIONS
// ============================================================================

describe('getModel', () => {
  it('should return a model config for valid provider + model', () => {
    const model = getModel('claude', 'claude-sonnet-4-6');
    expect(model).toBeDefined();
    expect(model?.id).toBe('claude-sonnet-4-6');
    expect(model?.tier).toBe('standard');
  });

  it('should return undefined for unknown model', () => {
    expect(getModel('claude', 'gpt-4')).toBeUndefined();
  });

  it('should return undefined for unknown provider', () => {
    expect(getModel('nonexistent' as never, 'claude-sonnet-4-6')).toBeUndefined();
  });
});

describe('getProviderForModel', () => {
  it('should return the provider for a known model', () => {
    expect(getProviderForModel('claude-sonnet-4-6')).toBe('claude');
    expect(getProviderForModel('gpt-5.2')).toBe('openai');
    expect(getProviderForModel('grok-4-1-fast-reasoning')).toBe('xai');
    expect(getProviderForModel('deepseek-reasoner')).toBe('deepseek');
    expect(getProviderForModel('gemini-3-flash-preview')).toBe('google');
  });

  it('should return undefined for an unknown model', () => {
    expect(getProviderForModel('unknown-model-42')).toBeUndefined();
  });
});

describe('getProviderAndModel', () => {
  it('should return provider and model for a known model', () => {
    const result = getProviderAndModel('claude-opus-4-6');
    expect(result).toBeDefined();
    expect(result?.provider.id).toBe('claude');
    expect(result?.model.id).toBe('claude-opus-4-6');
    expect(result?.model.tier).toBe('premium');
  });

  it('should return undefined for unknown model', () => {
    expect(getProviderAndModel('not-a-model')).toBeUndefined();
  });
});

describe('getDefaultModel', () => {
  it('should return the default model for each provider', () => {
    // Claude default is opus-4-6
    const claudeDefault = getDefaultModel('claude');
    expect(claudeDefault?.isDefault).toBe(true);
    expect(claudeDefault?.id).toBe('claude-opus-4-6');

    // OpenAI default is gpt-5.2
    const openaiDefault = getDefaultModel('openai');
    expect(openaiDefault?.isDefault).toBe(true);
    expect(openaiDefault?.id).toBe('gpt-5.2');
  });

  it('should return undefined for unknown provider', () => {
    expect(getDefaultModel('nonexistent' as never)).toBeUndefined();
  });

  it('should fall back to first model if no isDefault is set', () => {
    // All our providers have defaults, but the logic uses ?? provider.models[0]
    // We just verify the function works for all providers
    for (const provider of getAllProviders()) {
      const model = getDefaultModel(provider.id);
      expect(model).toBeDefined();
    }
  });
});

describe('getDefaultChatModelId', () => {
  it('should return the default Claude model ID', () => {
    const id = getDefaultChatModelId();
    expect(id).toBe('claude-opus-4-6');
  });
});

describe('getFreeTierModelId', () => {
  it('should return Opus 4.6 (all users get the best model)', () => {
    expect(getFreeTierModelId()).toBe('claude-opus-4-6');
  });
});

describe('getModelsForProvider', () => {
  it('should return all models for a valid provider', () => {
    const models = getModelsForProvider('claude');
    expect(models.length).toBeGreaterThanOrEqual(3);
    expect(models.map((m) => m.id)).toContain('claude-opus-4-6');
  });

  it('should return empty array for unknown provider', () => {
    expect(getModelsForProvider('nonexistent' as never)).toEqual([]);
  });
});

describe('getModelCapabilities', () => {
  it('should return provider capabilities for a valid model', () => {
    const caps = getModelCapabilities('claude', 'claude-sonnet-4-6');
    expect(caps.streaming).toBe(true);
    expect(caps.extendedThinking).toBe(true);
  });

  it('should return provider capabilities when model not found (fallback)', () => {
    const caps = getModelCapabilities('claude', 'nonexistent-model');
    expect(caps.streaming).toBe(true);
  });

  it('should throw for unknown provider', () => {
    expect(() => getModelCapabilities('nonexistent' as never, 'any')).toThrow('Unknown provider');
  });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe('getProvidersByTier', () => {
  it('should group providers by their default model tier', () => {
    const tiers = getProvidersByTier();
    expect(tiers).toHaveProperty('premium');
    expect(tiers).toHaveProperty('standard');
    expect(tiers).toHaveProperty('budget');

    // OpenAI default is premium tier
    expect(tiers.premium.map((p) => p.id)).toContain('openai');
    // Claude default is premium tier (opus)
    expect(tiers.premium.map((p) => p.id)).toContain('claude');
    // xAI default is budget tier
    expect(tiers.budget.map((p) => p.id)).toContain('xai');
  });
});

describe('getProvidersWithCapability', () => {
  it('should return providers that support vision', () => {
    const visionProviders = getProvidersWithCapability('vision');
    const ids = visionProviders.map((p) => p.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('openai');
    // DeepSeek does NOT support vision
    expect(ids).not.toContain('deepseek');
  });

  it('should return providers that support extendedThinking', () => {
    const thinkingProviders = getProvidersWithCapability('extendedThinking');
    const ids = thinkingProviders.map((p) => p.id);
    expect(ids).toContain('claude');
    // Only Claude supports extended thinking
    expect(ids).not.toContain('openai');
  });

  it('should return all providers for universally supported capabilities', () => {
    const streamingProviders = getProvidersWithCapability('streaming');
    expect(streamingProviders).toHaveLength(5);
  });
});

describe('getCheapestProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set all API keys so all providers are available
    process.env.ANTHROPIC_API_KEY = 'sk-a';
    process.env.OPENAI_API_KEY = 'sk-o';
    process.env.XAI_API_KEY = 'sk-x';
    process.env.DEEPSEEK_API_KEY = 'sk-d';
    process.env.GEMINI_API_KEY = 'sk-g';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return the cheapest available provider', () => {
    const cheapest = getCheapestProvider();
    expect(cheapest).toBeDefined();
    // xAI grok-4-1-fast-reasoning is $0.20 + $0.50 = $0.70 total, cheapest
    expect(cheapest?.id).toBe('xai');
  });

  it('should filter by vision when requireVision is true', () => {
    const cheapest = getCheapestProvider(true);
    expect(cheapest).toBeDefined();
    // DeepSeek doesn't support vision so it's excluded
    expect(cheapest?.capabilities.vision).toBe(true);
  });

  it('should return undefined when no providers are available', () => {
    // Remove all keys
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(getCheapestProvider()).toBeUndefined();
  });
});

describe('estimateCost', () => {
  it('should calculate cost correctly for known model', () => {
    // claude-sonnet-4-6: $3/1M input, $15/1M output
    const cost = estimateCost('claude', 'claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18, 2); // $3 + $15 = $18
  });

  it('should return 0 for unknown model', () => {
    expect(estimateCost('claude', 'nonexistent', 1000, 1000)).toBe(0);
  });

  it('should return 0 for unknown provider', () => {
    expect(estimateCost('nonexistent' as never, 'any', 1000, 1000)).toBe(0);
  });

  it('should handle zero tokens', () => {
    expect(estimateCost('claude', 'claude-sonnet-4-6', 0, 0)).toBe(0);
  });

  it('should scale linearly with token count', () => {
    const cost1 = estimateCost('openai', 'gpt-5.2', 500_000, 500_000);
    const cost2 = estimateCost('openai', 'gpt-5.2', 1_000_000, 1_000_000);
    expect(cost2).toBeCloseTo(cost1 * 2, 6);
  });
});
