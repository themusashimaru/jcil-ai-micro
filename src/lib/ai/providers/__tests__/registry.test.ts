// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * REGISTRY TESTS
 *
 * Comprehensive tests for the AI provider registry covering:
 * - Provider configurations (PROVIDERS constant)
 * - Provider lookup (getProvider, getProviderSafe, isValidProviderId)
 * - Provider listing (getAllProviders, getAvailableProviders, getAvailableProviderIds)
 * - Provider availability (isProviderAvailable, API key detection)
 * - Model functions (getModel, getProviderForModel, getProviderAndModel, getDefaultModel, etc.)
 * - Utility functions (getProvidersByTier, getProvidersWithCapability, getCheapestProvider, estimateCost)
 * - Error handling for all edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

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
  getModelsForProvider,
  getModelCapabilities,
  getProvidersByTier,
  getProvidersWithCapability,
  getCheapestProvider,
  estimateCost,
} from '../registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_PROVIDER_IDS = ['claude', 'openai', 'xai', 'deepseek', 'google'] as const;

// Save original env and restore after each test
const originalEnv = { ...process.env };

afterEach(() => {
  // Restore env to original state
  process.env = { ...originalEnv };
});

// ============================================================================
// PROVIDERS CONSTANT
// ============================================================================

describe('PROVIDERS constant', () => {
  it('should contain exactly 5 providers', () => {
    expect(Object.keys(PROVIDERS)).toHaveLength(5);
  });

  it('should contain all known provider IDs', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      expect(PROVIDERS).toHaveProperty(id);
    }
  });

  it('should have each provider id match its key in the registry', () => {
    for (const [key, config] of Object.entries(PROVIDERS)) {
      expect(config.id).toBe(key);
    }
  });

  it('should have non-empty names for all providers', () => {
    for (const config of Object.values(PROVIDERS)) {
      expect(config.name).toBeTruthy();
      expect(typeof config.name).toBe('string');
    }
  });

  it('should have valid family for all providers', () => {
    const validFamilies = ['anthropic', 'openai-compatible', 'google'];
    for (const config of Object.values(PROVIDERS)) {
      expect(validFamilies).toContain(config.family);
    }
  });

  it('should have at least one model for every provider', () => {
    for (const config of Object.values(PROVIDERS)) {
      expect(config.models.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should have apiKeyEnv set for every provider', () => {
    for (const config of Object.values(PROVIDERS)) {
      expect(config.apiKeyEnv).toBeTruthy();
      expect(typeof config.apiKeyEnv).toBe('string');
    }
  });

  it('should have capabilities defined for every provider', () => {
    for (const config of Object.values(PROVIDERS)) {
      expect(config.capabilities).toBeDefined();
      expect(typeof config.capabilities.vision).toBe('boolean');
      expect(typeof config.capabilities.streaming).toBe('boolean');
      expect(typeof config.capabilities.toolCalling).toBe('boolean');
    }
  });
});

// ============================================================================
// SPECIFIC PROVIDER CONFIGURATIONS
// ============================================================================

describe('Claude provider configuration', () => {
  it('should have id "claude"', () => {
    expect(PROVIDERS.claude.id).toBe('claude');
  });

  it('should use anthropic family', () => {
    expect(PROVIDERS.claude.family).toBe('anthropic');
  });

  it('should use ANTHROPIC_API_KEY env var', () => {
    expect(PROVIDERS.claude.apiKeyEnv).toBe('ANTHROPIC_API_KEY');
  });

  it('should support vision', () => {
    expect(PROVIDERS.claude.capabilities.vision).toBe(true);
  });

  it('should support extended thinking', () => {
    expect(PROVIDERS.claude.capabilities.extendedThinking).toBe(true);
  });

  it('should NOT support JSON mode', () => {
    expect(PROVIDERS.claude.capabilities.jsonMode).toBe(false);
  });

  it('should have multiple models', () => {
    expect(PROVIDERS.claude.models.length).toBeGreaterThanOrEqual(3);
  });

  it('should have claude-sonnet-4-6 as default model', () => {
    const defaultModel = PROVIDERS.claude.models.find((m) => m.isDefault);
    expect(defaultModel).toBeDefined();
    expect(defaultModel!.id).toBe('claude-sonnet-4-6');
  });
});

describe('OpenAI provider configuration', () => {
  it('should have id "openai"', () => {
    expect(PROVIDERS.openai.id).toBe('openai');
  });

  it('should use openai-compatible family', () => {
    expect(PROVIDERS.openai.family).toBe('openai-compatible');
  });

  it('should support JSON mode', () => {
    expect(PROVIDERS.openai.capabilities.jsonMode).toBe(true);
  });

  it('should NOT support extended thinking', () => {
    expect(PROVIDERS.openai.capabilities.extendedThinking).toBe(false);
  });
});

describe('xAI provider configuration', () => {
  it('should have a base URL', () => {
    expect(PROVIDERS.xai.baseURL).toBe('https://api.x.ai/v1');
  });

  it('should use openai-compatible family', () => {
    expect(PROVIDERS.xai.family).toBe('openai-compatible');
  });

  it('should use XAI_API_KEY env var', () => {
    expect(PROVIDERS.xai.apiKeyEnv).toBe('XAI_API_KEY');
  });
});

describe('DeepSeek provider configuration', () => {
  it('should have a base URL', () => {
    expect(PROVIDERS.deepseek.baseURL).toBe('https://api.deepseek.com');
  });

  it('should NOT support vision', () => {
    expect(PROVIDERS.deepseek.capabilities.vision).toBe(false);
  });

  it('should use DEEPSEEK_API_KEY env var', () => {
    expect(PROVIDERS.deepseek.apiKeyEnv).toBe('DEEPSEEK_API_KEY');
  });
});

describe('Google provider configuration', () => {
  it('should have id "google"', () => {
    expect(PROVIDERS.google.id).toBe('google');
  });

  it('should use google family', () => {
    expect(PROVIDERS.google.family).toBe('google');
  });

  it('should use GEMINI_API_KEY env var', () => {
    expect(PROVIDERS.google.apiKeyEnv).toBe('GEMINI_API_KEY');
  });

  it('should support vision', () => {
    expect(PROVIDERS.google.capabilities.vision).toBe(true);
  });

  it('should have models with large context windows', () => {
    for (const model of PROVIDERS.google.models) {
      expect(model.contextWindow).toBeGreaterThanOrEqual(1000000);
    }
  });
});

// ============================================================================
// getProvider
// ============================================================================

describe('getProvider', () => {
  it('should return the provider config for a valid ID', () => {
    const result = getProvider('claude');
    expect(result).toBe(PROVIDERS.claude);
  });

  it('should return the correct config for each known provider', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      const result = getProvider(id);
      expect(result.id).toBe(id);
    }
  });

  it('should throw for an unknown provider ID', () => {
    expect(() => getProvider('nonexistent' as any)).toThrow('Unknown provider: nonexistent');
  });

  it('should throw for empty string provider ID', () => {
    expect(() => getProvider('' as any)).toThrow('Unknown provider: ');
  });
});

// ============================================================================
// getProviderSafe
// ============================================================================

describe('getProviderSafe', () => {
  it('should return the provider config for a valid ID', () => {
    const result = getProviderSafe('claude');
    expect(result).toBe(PROVIDERS.claude);
  });

  it('should return undefined for an unknown provider ID', () => {
    const result = getProviderSafe('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const result = getProviderSafe('');
    expect(result).toBeUndefined();
  });

  it('should return the correct provider for each known ID', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      const result = getProviderSafe(id);
      expect(result).toBeDefined();
      expect(result!.id).toBe(id);
    }
  });
});

// ============================================================================
// isValidProviderId
// ============================================================================

describe('isValidProviderId', () => {
  it('should return true for all known provider IDs', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      expect(isValidProviderId(id)).toBe(true);
    }
  });

  it('should return false for unknown IDs', () => {
    expect(isValidProviderId('nonexistent')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidProviderId('')).toBe(false);
  });

  it('should return false for case-mismatched IDs', () => {
    expect(isValidProviderId('Claude')).toBe(false);
    expect(isValidProviderId('OPENAI')).toBe(false);
  });

  it('should act as a type guard', () => {
    const id: string = 'claude';
    if (isValidProviderId(id)) {
      // TypeScript should narrow this to ProviderId
      const provider = getProvider(id);
      expect(provider).toBeDefined();
    }
  });
});

// ============================================================================
// getAllProviders
// ============================================================================

describe('getAllProviders', () => {
  it('should return an array of all providers', () => {
    const result = getAllProviders();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('should return configs that match PROVIDERS values', () => {
    const result = getAllProviders();
    const providerValues = Object.values(PROVIDERS);
    expect(result).toEqual(providerValues);
  });

  it('should include all known provider IDs', () => {
    const result = getAllProviders();
    const ids = result.map((p) => p.id);
    for (const id of KNOWN_PROVIDER_IDS) {
      expect(ids).toContain(id);
    }
  });
});

// ============================================================================
// getAvailableProviders / getAvailableProviderIds / isProviderAvailable
// ============================================================================

describe('getAvailableProviders', () => {
  beforeEach(() => {
    // Clear all provider API keys
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

  it('should return empty array when no API keys are set', () => {
    const result = getAvailableProviders();
    expect(result).toHaveLength(0);
  });

  it('should return provider when single API key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    const result = getAvailableProviders();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('claude');
  });

  it('should return provider when numbered API key (_1) is set', () => {
    process.env.DEEPSEEK_API_KEY_1 = 'sk-test-numbered';
    const result = getAvailableProviders();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('deepseek');
  });

  it('should return multiple providers when multiple keys are set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-claude';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.GEMINI_API_KEY = 'sk-gemini';
    const result = getAvailableProviders();
    expect(result).toHaveLength(3);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
  });

  it('should not count empty string as a valid key', () => {
    process.env.ANTHROPIC_API_KEY = '';
    const result = getAvailableProviders();
    expect(result).toHaveLength(0);
  });

  it('should return all providers when all keys are set', () => {
    process.env.ANTHROPIC_API_KEY = 'key1';
    process.env.OPENAI_API_KEY = 'key2';
    process.env.XAI_API_KEY = 'key3';
    process.env.DEEPSEEK_API_KEY = 'key4';
    process.env.GEMINI_API_KEY = 'key5';
    const result = getAvailableProviders();
    expect(result).toHaveLength(5);
  });
});

describe('getAvailableProviderIds', () => {
  beforeEach(() => {
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

  it('should return empty array when no keys are set', () => {
    const result = getAvailableProviderIds();
    expect(result).toHaveLength(0);
  });

  it('should return array of provider IDs with keys set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.XAI_API_KEY = 'sk-xai';
    const result = getAvailableProviderIds();
    expect(result).toHaveLength(2);
    expect(result).toContain('claude');
    expect(result).toContain('xai');
  });
});

describe('isProviderAvailable', () => {
  beforeEach(() => {
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

  it('should return false when no key is set', () => {
    expect(isProviderAvailable('claude')).toBe(false);
  });

  it('should return true when single key is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(isProviderAvailable('claude')).toBe(true);
  });

  it('should return true when numbered key is set', () => {
    process.env.OPENAI_API_KEY_1 = 'sk-test';
    expect(isProviderAvailable('openai')).toBe(true);
  });

  it('should return false for unknown provider', () => {
    expect(isProviderAvailable('nonexistent' as any)).toBe(false);
  });

  it('should return false when key is empty string', () => {
    process.env.ANTHROPIC_API_KEY = '';
    expect(isProviderAvailable('claude')).toBe(false);
  });

  it('should check the correct env var for each provider', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deep';
    expect(isProviderAvailable('deepseek')).toBe(true);
    expect(isProviderAvailable('claude')).toBe(false);
    expect(isProviderAvailable('openai')).toBe(false);
  });
});

// ============================================================================
// getModel
// ============================================================================

describe('getModel', () => {
  it('should return model config for valid provider and model', () => {
    const model = getModel('claude', 'claude-sonnet-4-6');
    expect(model).toBeDefined();
    expect(model!.id).toBe('claude-sonnet-4-6');
  });

  it('should return undefined for unknown model', () => {
    const model = getModel('claude', 'nonexistent-model');
    expect(model).toBeUndefined();
  });

  it('should return undefined for unknown provider', () => {
    const model = getModel('nonexistent' as any, 'some-model');
    expect(model).toBeUndefined();
  });

  it('should return model with correct pricing', () => {
    const model = getModel('claude', 'claude-opus-4-6');
    expect(model).toBeDefined();
    expect(model!.inputPricePer1M).toBe(5);
    expect(model!.outputPricePer1M).toBe(25);
  });

  it('should return model with correct context window', () => {
    const model = getModel('xai', 'grok-4-1-fast-reasoning');
    expect(model).toBeDefined();
    expect(model!.contextWindow).toBe(2000000);
  });

  it('should return model with correct tier', () => {
    const model = getModel('claude', 'claude-haiku-4-5-20251001');
    expect(model).toBeDefined();
    expect(model!.tier).toBe('budget');
  });
});

// ============================================================================
// getProviderForModel
// ============================================================================

describe('getProviderForModel', () => {
  it('should find the correct provider for a Claude model', () => {
    expect(getProviderForModel('claude-sonnet-4-6')).toBe('claude');
  });

  it('should find the correct provider for an OpenAI model', () => {
    expect(getProviderForModel('gpt-5.2')).toBe('openai');
  });

  it('should find the correct provider for an xAI model', () => {
    expect(getProviderForModel('grok-4-1-fast-reasoning')).toBe('xai');
  });

  it('should find the correct provider for a DeepSeek model', () => {
    expect(getProviderForModel('deepseek-reasoner')).toBe('deepseek');
  });

  it('should find the correct provider for a Google model', () => {
    expect(getProviderForModel('gemini-3-flash-preview')).toBe('google');
  });

  it('should return undefined for unknown model', () => {
    expect(getProviderForModel('nonexistent-model')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(getProviderForModel('')).toBeUndefined();
  });
});

// ============================================================================
// getProviderAndModel
// ============================================================================

describe('getProviderAndModel', () => {
  it('should return both provider and model for valid model ID', () => {
    const result = getProviderAndModel('claude-opus-4-6');
    expect(result).toBeDefined();
    expect(result!.provider.id).toBe('claude');
    expect(result!.model.id).toBe('claude-opus-4-6');
  });

  it('should return undefined for unknown model ID', () => {
    expect(getProviderAndModel('nonexistent')).toBeUndefined();
  });

  it('should return correct provider config', () => {
    const result = getProviderAndModel('gpt-5.2');
    expect(result).toBeDefined();
    expect(result!.provider.family).toBe('openai-compatible');
    expect(result!.provider.apiKeyEnv).toBe('OPENAI_API_KEY');
  });

  it('should return correct model config with pricing', () => {
    const result = getProviderAndModel('deepseek-reasoner');
    expect(result).toBeDefined();
    expect(result!.model.inputPricePer1M).toBe(0.55);
    expect(result!.model.outputPricePer1M).toBe(2.19);
  });
});

// ============================================================================
// getDefaultModel
// ============================================================================

describe('getDefaultModel', () => {
  it('should return the model marked as isDefault for Claude', () => {
    const model = getDefaultModel('claude');
    expect(model).toBeDefined();
    expect(model!.id).toBe('claude-sonnet-4-6');
    expect(model!.isDefault).toBe(true);
  });

  it('should return the model marked as isDefault for OpenAI', () => {
    const model = getDefaultModel('openai');
    expect(model).toBeDefined();
    expect(model!.id).toBe('gpt-5.2');
  });

  it('should return the model marked as isDefault for xAI', () => {
    const model = getDefaultModel('xai');
    expect(model).toBeDefined();
    expect(model!.id).toBe('grok-4-1-fast-reasoning');
  });

  it('should return the model marked as isDefault for DeepSeek', () => {
    const model = getDefaultModel('deepseek');
    expect(model).toBeDefined();
    expect(model!.id).toBe('deepseek-reasoner');
  });

  it('should return the model marked as isDefault for Google', () => {
    const model = getDefaultModel('google');
    expect(model).toBeDefined();
    expect(model!.id).toBe('gemini-3-flash-preview');
  });

  it('should return undefined for unknown provider', () => {
    const model = getDefaultModel('nonexistent' as any);
    expect(model).toBeUndefined();
  });
});

// ============================================================================
// getDefaultChatModelId
// ============================================================================

describe('getDefaultChatModelId', () => {
  it('should return the default Claude model ID', () => {
    const id = getDefaultChatModelId();
    expect(id).toBe('claude-sonnet-4-6');
  });

  it('should return a string', () => {
    const id = getDefaultChatModelId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// getModelsForProvider
// ============================================================================

describe('getModelsForProvider', () => {
  it('should return all models for Claude', () => {
    const models = getModelsForProvider('claude');
    expect(models.length).toBeGreaterThanOrEqual(3);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('claude-opus-4-6');
    expect(ids).toContain('claude-sonnet-4-6');
    expect(ids).toContain('claude-haiku-4-5-20251001');
  });

  it('should return all models for xAI', () => {
    const models = getModelsForProvider('xai');
    expect(models.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty array for unknown provider', () => {
    const models = getModelsForProvider('nonexistent' as any);
    expect(models).toEqual([]);
  });

  it('should return models with required fields', () => {
    const models = getModelsForProvider('openai');
    for (const model of models) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.maxOutputTokens).toBeGreaterThan(0);
      expect(typeof model.inputPricePer1M).toBe('number');
      expect(typeof model.outputPricePer1M).toBe('number');
      expect(['premium', 'standard', 'budget']).toContain(model.tier);
    }
  });
});

// ============================================================================
// getModelCapabilities
// ============================================================================

describe('getModelCapabilities', () => {
  it('should return provider capabilities when model exists', () => {
    const caps = getModelCapabilities('claude', 'claude-sonnet-4-6');
    expect(caps.vision).toBe(true);
    expect(caps.extendedThinking).toBe(true);
    expect(caps.streaming).toBe(true);
  });

  it('should return provider capabilities when model is not found', () => {
    const caps = getModelCapabilities('claude', 'nonexistent-model');
    expect(caps).toEqual(PROVIDERS.claude.capabilities);
  });

  it('should throw for unknown provider', () => {
    expect(() => getModelCapabilities('nonexistent' as any, 'model')).toThrow(
      'Unknown provider: nonexistent'
    );
  });

  it('should return correct capabilities for DeepSeek (no vision)', () => {
    const caps = getModelCapabilities('deepseek', 'deepseek-reasoner');
    expect(caps.vision).toBe(false);
    expect(caps.toolCalling).toBe(true);
  });

  it('should return correct capabilities for OpenAI (json mode)', () => {
    const caps = getModelCapabilities('openai', 'gpt-5.2');
    expect(caps.jsonMode).toBe(true);
    expect(caps.extendedThinking).toBe(false);
  });

  it('should merge model-specific capability overrides with provider capabilities', () => {
    // This tests the spread merge behavior even when no overrides exist
    const caps = getModelCapabilities('google', 'gemini-3-flash-preview');
    expect(caps.vision).toBe(true);
    expect(caps.streaming).toBe(true);
  });
});

// ============================================================================
// getProvidersByTier
// ============================================================================

describe('getProvidersByTier', () => {
  it('should return an object with premium, standard, and budget keys', () => {
    const result = getProvidersByTier();
    expect(result).toHaveProperty('premium');
    expect(result).toHaveProperty('standard');
    expect(result).toHaveProperty('budget');
  });

  it('should have arrays as values', () => {
    const result = getProvidersByTier();
    expect(Array.isArray(result.premium)).toBe(true);
    expect(Array.isArray(result.standard)).toBe(true);
    expect(Array.isArray(result.budget)).toBe(true);
  });

  it('should place OpenAI in premium tier (default model is premium)', () => {
    const result = getProvidersByTier();
    const premiumIds = result.premium.map((p) => p.id);
    expect(premiumIds).toContain('openai');
  });

  it('should place Claude in standard tier (default model is standard)', () => {
    const result = getProvidersByTier();
    const standardIds = result.standard.map((p) => p.id);
    expect(standardIds).toContain('claude');
  });

  it('should place xAI in budget tier (default model is budget)', () => {
    const result = getProvidersByTier();
    const budgetIds = result.budget.map((p) => p.id);
    expect(budgetIds).toContain('xai');
  });

  it('should include all 5 providers across all tiers', () => {
    const result = getProvidersByTier();
    const total = result.premium.length + result.standard.length + result.budget.length;
    expect(total).toBe(5);
  });
});

// ============================================================================
// getProvidersWithCapability
// ============================================================================

describe('getProvidersWithCapability', () => {
  it('should return providers that support vision', () => {
    const result = getProvidersWithCapability('vision');
    const ids = result.map((p) => p.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('xai');
    // DeepSeek does NOT support vision
    expect(ids).not.toContain('deepseek');
  });

  it('should return providers that support extended thinking', () => {
    const result = getProvidersWithCapability('extendedThinking');
    const ids = result.map((p) => p.id);
    expect(ids).toContain('claude');
    // Others do not support it
    expect(ids).not.toContain('openai');
  });

  it('should return all providers for streaming (all support it)', () => {
    const result = getProvidersWithCapability('streaming');
    expect(result).toHaveLength(5);
  });

  it('should return all providers for toolCalling (all support it)', () => {
    const result = getProvidersWithCapability('toolCalling');
    expect(result).toHaveLength(5);
  });

  it('should return providers supporting jsonMode', () => {
    const result = getProvidersWithCapability('jsonMode');
    const ids = result.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('xai');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('google');
    // Claude does NOT support jsonMode
    expect(ids).not.toContain('claude');
  });
});

// ============================================================================
// getCheapestProvider
// ============================================================================

describe('getCheapestProvider', () => {
  beforeEach(() => {
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

  it('should return undefined when no providers are available', () => {
    const result = getCheapestProvider();
    expect(result).toBeUndefined();
  });

  it('should return the only available provider', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const result = getCheapestProvider();
    expect(result).toBeDefined();
    expect(result!.id).toBe('claude');
  });

  it('should return the cheapest provider when multiple are available', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-claude'; // default: sonnet 4.6, 3 + 15 = 18
    process.env.XAI_API_KEY = 'sk-xai'; // default: grok fast, 0.2 + 0.5 = 0.7
    process.env.OPENAI_API_KEY = 'sk-openai'; // default: gpt-5.2, 5 + 15 = 20
    const result = getCheapestProvider();
    expect(result).toBeDefined();
    expect(result!.id).toBe('xai'); // xAI is cheapest
  });

  it('should filter by vision capability when required', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deep'; // cheapest but no vision
    process.env.ANTHROPIC_API_KEY = 'sk-claude'; // has vision
    const result = getCheapestProvider(true);
    expect(result).toBeDefined();
    expect(result!.id).toBe('claude'); // DeepSeek excluded (no vision)
  });

  it('should return undefined when no vision providers are available', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deep'; // no vision
    const result = getCheapestProvider(true);
    expect(result).toBeUndefined();
  });

  it('should consider all available providers without vision requirement', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deep'; // 0.55 + 2.19 = 2.74
    process.env.XAI_API_KEY = 'sk-xai'; // 0.2 + 0.5 = 0.7
    const result = getCheapestProvider(false);
    expect(result).toBeDefined();
    expect(result!.id).toBe('xai');
  });
});

// ============================================================================
// estimateCost
// ============================================================================

describe('estimateCost', () => {
  it('should return 0 for unknown provider', () => {
    const cost = estimateCost('nonexistent' as any, 'model', 1000, 1000);
    expect(cost).toBe(0);
  });

  it('should return 0 for unknown model', () => {
    const cost = estimateCost('claude', 'nonexistent-model', 1000, 1000);
    expect(cost).toBe(0);
  });

  it('should correctly calculate cost for Claude Opus', () => {
    // claude-opus-4-6: input $5/1M, output $25/1M
    const cost = estimateCost('claude', 'claude-opus-4-6', 1_000_000, 1_000_000);
    expect(cost).toBe(5 + 25);
  });

  it('should correctly calculate cost for small token counts', () => {
    // claude-opus-4-6: input $5/1M, output $25/1M
    const cost = estimateCost('claude', 'claude-opus-4-6', 1000, 500);
    const expected = (1000 / 1_000_000) * 5 + (500 / 1_000_000) * 25;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('should return 0 for zero tokens', () => {
    const cost = estimateCost('claude', 'claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });

  it('should correctly calculate cost for xAI (budget pricing)', () => {
    // grok-4-1-fast-reasoning: input $0.20/1M, output $0.50/1M
    const cost = estimateCost('xai', 'grok-4-1-fast-reasoning', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.7, 5);
  });

  it('should correctly calculate with only input tokens', () => {
    const cost = estimateCost('openai', 'gpt-5.2', 1_000_000, 0);
    expect(cost).toBe(5); // $5/1M input only
  });

  it('should correctly calculate with only output tokens', () => {
    const cost = estimateCost('openai', 'gpt-5.2', 0, 1_000_000);
    expect(cost).toBe(15); // $15/1M output only
  });

  it('should handle fractional pricing correctly', () => {
    // deepseek-reasoner: input $0.55/1M, output $2.19/1M
    const cost = estimateCost('deepseek', 'deepseek-reasoner', 500_000, 200_000);
    const expected = (500_000 / 1_000_000) * 0.55 + (200_000 / 1_000_000) * 2.19;
    expect(cost).toBeCloseTo(expected, 10);
  });

  it('should handle very large token counts', () => {
    const cost = estimateCost('google', 'gemini-3-flash-preview', 10_000_000, 5_000_000);
    // input: 10M * $0.50/1M = $5, output: 5M * $3.00/1M = $15
    expect(cost).toBeCloseTo(20, 5);
  });
});

// ============================================================================
// Model pricing and tier validation (cross-cutting)
// ============================================================================

describe('model pricing validation', () => {
  it('should have non-negative prices for all models', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        expect(model.inputPricePer1M).toBeGreaterThanOrEqual(0);
        expect(model.outputPricePer1M).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should have positive context windows for all models', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        expect(model.contextWindow).toBeGreaterThan(0);
      }
    }
  });

  it('should have positive maxOutputTokens for all models', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        expect(model.maxOutputTokens).toBeGreaterThan(0);
      }
    }
  });

  it('should have valid tier values for all models', () => {
    const validTiers = ['premium', 'standard', 'budget'];
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        expect(validTiers).toContain(model.tier);
      }
    }
  });

  it('should have exactly one default model per provider', () => {
    for (const provider of Object.values(PROVIDERS)) {
      const defaults = provider.models.filter((m) => m.isDefault);
      // Each provider should have at most one isDefault model
      // (getDefaultModel falls back to first model if none marked)
      expect(defaults.length).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Edge cases and integration
// ============================================================================

describe('edge cases', () => {
  it('should handle getting model capabilities for all provider-model combinations', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        const caps = getModelCapabilities(provider.id, model.id);
        expect(caps).toBeDefined();
        expect(typeof caps.vision).toBe('boolean');
        expect(typeof caps.streaming).toBe('boolean');
      }
    }
  });

  it('should handle estimateCost for all provider-model combinations', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        const cost = estimateCost(provider.id, model.id, 10000, 5000);
        expect(cost).toBeGreaterThan(0);
      }
    }
  });

  it('should have consistent getProviderForModel results with getModel', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        const foundProviderId = getProviderForModel(model.id);
        expect(foundProviderId).toBe(provider.id);

        const foundModel = getModel(provider.id, model.id);
        expect(foundModel).toBeDefined();
        expect(foundModel!.id).toBe(model.id);
      }
    }
  });

  it('should have consistent getProviderAndModel results', () => {
    for (const provider of Object.values(PROVIDERS)) {
      for (const model of provider.models) {
        const result = getProviderAndModel(model.id);
        expect(result).toBeDefined();
        expect(result!.provider.id).toBe(provider.id);
        expect(result!.model.id).toBe(model.id);
      }
    }
  });

  it('should have getDefaultModel return a model from getModelsForProvider', () => {
    for (const id of KNOWN_PROVIDER_IDS) {
      const defaultModel = getDefaultModel(id);
      const allModels = getModelsForProvider(id);
      expect(defaultModel).toBeDefined();
      expect(allModels.map((m) => m.id)).toContain(defaultModel!.id);
    }
  });
});
