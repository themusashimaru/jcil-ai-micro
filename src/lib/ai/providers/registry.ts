/**
 * AI PROVIDER REGISTRY
 *
 * Central registry of all supported AI providers with their configurations.
 * This is the single source of truth for provider capabilities and settings.
 */

import type { ProviderId, ProviderConfig, ModelConfig, ProviderCapabilities } from './types';

// ============================================================================
// PROVIDER CONFIGURATIONS
// ============================================================================

/**
 * Claude (Anthropic) Provider Configuration
 */
const CLAUDE_CONFIG: ProviderConfig = {
  id: 'claude',
  name: 'Claude',
  family: 'anthropic',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  icon: 'anthropic',
  description: 'Advanced reasoning and coding from Anthropic',
  capabilities: {
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: false,
    toolCalling: true,
  },
  models: [
    {
      id: 'claude-opus-4-6-20260205',
      name: 'Claude Opus 4.6',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 5,
      outputPricePer1M: 25,
      tier: 'premium',
    },
    {
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
      tier: 'standard',
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.8,
      outputPricePer1M: 4,
      tier: 'budget',
      isDefault: true,
    },
  ],
};

/**
 * OpenAI Provider Configuration
 */
const OPENAI_CONFIG: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  family: 'openai-compatible',
  apiKeyEnv: 'OPENAI_API_KEY',
  icon: 'openai',
  description: 'GPT-5 series models from OpenAI',
  capabilities: {
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
  },
  models: [
    {
      id: 'gpt-5.2',
      name: 'GPT-5.2',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 5,
      outputPricePer1M: 15,
      tier: 'premium',
      isDefault: true,
    },
  ],
};

/**
 * xAI (Grok) Provider Configuration
 *
 * Pricing (per 1M tokens):
 * - grok-4-1-fast-reasoning: Input $0.20 / Output $0.50 (2M context)
 * - grok-code-fast-1: Input $0.20 / Output $1.50 (256K context) - Agentic coding
 */
const XAI_CONFIG: ProviderConfig = {
  id: 'xai',
  name: 'xAI (Grok)',
  family: 'openai-compatible',
  baseURL: 'https://api.x.ai/v1',
  apiKeyEnv: 'XAI_API_KEY',
  icon: 'xai',
  description: 'Grok 4 models with real-time knowledge from xAI',
  capabilities: {
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
  },
  models: [
    {
      id: 'grok-4-1-fast-reasoning',
      name: 'Grok 4.1 Fast (Reasoning)',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
      isDefault: true,
    },
    {
      id: 'grok-code-fast-1',
      name: 'Grok Code Fast',
      contextWindow: 256000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 1.5,
      tier: 'standard',
    },
  ],
};

/**
 * DeepSeek Provider Configuration
 *
 * Pricing (per 1M tokens):
 * - deepseek-reasoner: Input $0.55 (cache miss) / $0.14 (cache hit) / Output $2.19
 */
const DEEPSEEK_CONFIG: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  family: 'openai-compatible',
  baseURL: 'https://api.deepseek.com',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  icon: 'deepseek',
  description: 'Cost-effective models from DeepSeek for reasoning and coding',
  capabilities: {
    vision: false, // DeepSeek doesn't support vision yet
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
  },
  models: [
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner (R1)',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.55,
      outputPricePer1M: 2.19,
      tier: 'standard',
      isDefault: true,
    },
  ],
};

/**
 * Google (Gemini) Provider Configuration
 *
 * Pricing (per 1M tokens):
 * - gemini-3-pro-preview: Input $2.00 / Output $12.00 (~1M context)
 * - gemini-3-flash-preview: Input $0.50 / Output $3.00 (~1M context)
 */
const GOOGLE_CONFIG: ProviderConfig = {
  id: 'google',
  name: 'Google (Gemini)',
  family: 'google',
  apiKeyEnv: 'GEMINI_API_KEY',
  icon: 'google',
  description: 'Gemini models with massive context windows from Google',
  capabilities: {
    vision: true,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
  },
  models: [
    {
      id: 'gemini-3-pro-preview',
      name: 'Gemini 3 Pro (Preview)',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPricePer1M: 2.0,
      outputPricePer1M: 12.0,
      tier: 'premium',
    },
    {
      id: 'gemini-3-flash-preview',
      name: 'Gemini 3 Flash (Preview)',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.5,
      outputPricePer1M: 3.0,
      tier: 'standard',
      isDefault: true,
    },
  ],
};

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

/**
 * Complete registry of all supported providers
 */
export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  claude: CLAUDE_CONFIG,
  openai: OPENAI_CONFIG,
  xai: XAI_CONFIG,
  deepseek: DEEPSEEK_CONFIG,
  google: GOOGLE_CONFIG,
};

// ============================================================================
// REGISTRY FUNCTIONS
// ============================================================================

/**
 * Get a provider configuration by ID
 * @throws Error if provider not found
 */
export function getProvider(id: ProviderId): ProviderConfig {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return provider;
}

/**
 * Get a provider configuration by ID, returns undefined if not found
 */
export function getProviderSafe(id: string): ProviderConfig | undefined {
  return PROVIDERS[id as ProviderId];
}

/**
 * Check if a provider ID is valid
 */
export function isValidProviderId(id: string): id is ProviderId {
  return id in PROVIDERS;
}

/**
 * Get all provider configurations
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS);
}

/**
 * Check if an API key is configured for a provider
 * Supports both single key (e.g., DEEPSEEK_API_KEY) and numbered keys (e.g., DEEPSEEK_API_KEY_1)
 */
function hasApiKeyConfigured(apiKeyEnv: string): boolean {
  // Check for single key
  const singleKey = process.env[apiKeyEnv];
  if (singleKey !== undefined && singleKey !== '') {
    return true;
  }

  // Check for numbered keys (e.g., DEEPSEEK_API_KEY_1)
  const numberedKey = process.env[`${apiKeyEnv}_1`];
  if (numberedKey !== undefined && numberedKey !== '') {
    return true;
  }

  return false;
}

/**
 * Get providers that have API keys configured
 */
export function getAvailableProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS).filter((provider) => {
    return hasApiKeyConfigured(provider.apiKeyEnv);
  });
}

/**
 * Get provider IDs that have API keys configured
 */
export function getAvailableProviderIds(): ProviderId[] {
  return getAvailableProviders().map((p) => p.id);
}

/**
 * Check if a specific provider is available (has API key)
 */
export function isProviderAvailable(id: ProviderId): boolean {
  const provider = PROVIDERS[id];
  if (!provider) return false;
  return hasApiKeyConfigured(provider.apiKeyEnv);
}

// ============================================================================
// MODEL FUNCTIONS
// ============================================================================

/**
 * Get a specific model configuration
 */
export function getModel(providerId: ProviderId, modelId: string): ModelConfig | undefined {
  const provider = PROVIDERS[providerId];
  if (!provider) return undefined;
  return provider.models.find((m) => m.id === modelId);
}

/**
 * Get provider ID for a given model ID
 * Searches all providers to find which one contains the model
 * @returns The provider ID or undefined if not found
 */
export function getProviderForModel(modelId: string): ProviderId | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.models.some((m) => m.id === modelId)) {
      return provider.id;
    }
  }
  return undefined;
}

/**
 * Get provider and model configuration for a given model ID
 * @returns Object with provider and model, or undefined if not found
 */
export function getProviderAndModel(
  modelId: string
): { provider: ProviderConfig; model: ModelConfig } | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) {
      return { provider, model };
    }
  }
  return undefined;
}

/**
 * Get the default model for a provider
 */
export function getDefaultModel(providerId: ProviderId): ModelConfig | undefined {
  const provider = PROVIDERS[providerId];
  if (!provider) return undefined;
  return provider.models.find((m) => m.isDefault) ?? provider.models[0];
}

/**
 * Get all models for a provider
 */
export function getModelsForProvider(providerId: ProviderId): ModelConfig[] {
  const provider = PROVIDERS[providerId];
  if (!provider) return [];
  return provider.models;
}

/**
 * Get model capabilities (merges provider and model-specific)
 */
export function getModelCapabilities(
  providerId: ProviderId,
  modelId: string
): ProviderCapabilities {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const model = provider.models.find((m) => m.id === modelId);
  if (!model) {
    return provider.capabilities;
  }

  // Merge provider capabilities with model-specific overrides
  return {
    ...provider.capabilities,
    ...model.capabilities,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get providers grouped by pricing tier
 */
export function getProvidersByTier(): Record<string, ProviderConfig[]> {
  const result: Record<string, ProviderConfig[]> = {
    premium: [],
    standard: [],
    budget: [],
  };

  for (const provider of Object.values(PROVIDERS)) {
    const defaultModel = getDefaultModel(provider.id);
    if (defaultModel) {
      result[defaultModel.tier].push(provider);
    }
  }

  return result;
}

/**
 * Get providers that support a specific capability
 */
export function getProvidersWithCapability(
  capability: keyof ProviderCapabilities
): ProviderConfig[] {
  return Object.values(PROVIDERS).filter((p) => p.capabilities[capability]);
}

/**
 * Get the cheapest provider for a given capability requirement
 */
export function getCheapestProvider(requireVision: boolean = false): ProviderConfig | undefined {
  const available = getAvailableProviders();
  const filtered = requireVision ? available.filter((p) => p.capabilities.vision) : available;

  if (filtered.length === 0) return undefined;

  return filtered.reduce((cheapest, current) => {
    const cheapestModel = getDefaultModel(cheapest.id);
    const currentModel = getDefaultModel(current.id);

    if (!cheapestModel) return current;
    if (!currentModel) return cheapest;

    const cheapestCost = cheapestModel.inputPricePer1M + cheapestModel.outputPricePer1M;
    const currentCost = currentModel.inputPricePer1M + currentModel.outputPricePer1M;

    return currentCost < cheapestCost ? current : cheapest;
  });
}

/**
 * Estimate cost for a conversation
 */
export function estimateCost(
  providerId: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModel(providerId, modelId);
  if (!model) return 0;

  const inputCost = (inputTokens / 1_000_000) * model.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePer1M;

  return inputCost + outputCost;
}
