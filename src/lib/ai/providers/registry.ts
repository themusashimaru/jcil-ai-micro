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
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 15,
      outputPricePer1M: 75,
      tier: 'premium',
      isDefault: true,
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
    {
      id: 'gpt-5.2-pro',
      name: 'GPT-5.2 Pro',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      inputPricePer1M: 10,
      outputPricePer1M: 30,
      tier: 'premium',
    },
    {
      id: 'gpt-5.2-codex',
      name: 'GPT-5.2 Codex',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 5,
      outputPricePer1M: 15,
      tier: 'premium',
    },
    {
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPricePer1M: 0.5,
      outputPricePer1M: 1.5,
      tier: 'budget',
    },
    {
      id: 'gpt-5-nano',
      name: 'GPT-5 Nano',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.1,
      outputPricePer1M: 0.3,
      tier: 'budget',
    },
  ],
};

/**
 * xAI (Grok) Provider Configuration
 *
 * Pricing (per 1M tokens):
 * - grok-4: Input $3.00 / Output $15.00 (256K context)
 * - grok-4-1-fast-reasoning: Input $0.20 / Output $0.50 (2M context)
 * - grok-4-1-fast-non-reasoning: Input $0.20 / Output $0.50 (2M context)
 * - grok-4-fast-reasoning: Input $0.20 / Output $0.50 (2M context)
 * - grok-4-fast-non-reasoning: Input $0.20 / Output $0.50 (2M context)
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
      id: 'grok-4',
      name: 'Grok 4',
      contextWindow: 256000,
      maxOutputTokens: 32768,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
      tier: 'premium',
      isDefault: true,
    },
    {
      id: 'grok-4-1-fast-reasoning',
      name: 'Grok 4.1 Fast (Reasoning)',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
    },
    {
      id: 'grok-4-1-fast-non-reasoning',
      name: 'Grok 4.1 Fast (Non-Reasoning)',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
    },
    {
      id: 'grok-4-fast-reasoning',
      name: 'Grok 4 Fast (Reasoning)',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
    },
    {
      id: 'grok-4-fast-non-reasoning',
      name: 'Grok 4 Fast (Non-Reasoning)',
      contextWindow: 2000000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.2,
      outputPricePer1M: 0.5,
      tier: 'budget',
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
 * - deepseek-chat: Input $0.27 (cache miss) / $0.07 (cache hit) / Output $1.10
 * - deepseek-reasoner: Input $0.55 (cache miss) / $0.14 (cache hit) / Output $2.19
 * - DeepSeek-V3 series: Similar cost band (low dozens of cents per 1M tokens)
 */
const DEEPSEEK_CONFIG: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  family: 'openai-compatible',
  baseURL: 'https://api.deepseek.com/v1',
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
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPricePer1M: 0.27,
      outputPricePer1M: 1.1,
      tier: 'budget',
      isDefault: true,
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPricePer1M: 0.55,
      outputPricePer1M: 2.19,
      tier: 'standard',
    },
  ],
};

/**
 * Google (Gemini) Provider Configuration
 *
 * Pricing (per 1M tokens):
 * - gemini-2.0-flash: Input $0.10 / Output $0.40 (1M context)
 * - gemini-1.5-pro: Input $1.25 / Output $5.00 (2M context)
 * - gemini-1.5-flash: Input $0.075 / Output $0.30 (1M context)
 */
const GOOGLE_CONFIG: ProviderConfig = {
  id: 'google',
  name: 'Google (Gemini)',
  family: 'google',
  apiKeyEnv: 'GOOGLE_API_KEY',
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
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.1,
      outputPricePer1M: 0.4,
      tier: 'budget',
      isDefault: true,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      inputPricePer1M: 1.25,
      outputPricePer1M: 5.0,
      tier: 'standard',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.075,
      outputPricePer1M: 0.3,
      tier: 'budget',
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
 * Get providers that have API keys configured
 */
export function getAvailableProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS).filter((provider) => {
    const apiKey = process.env[provider.apiKeyEnv];
    return apiKey !== undefined && apiKey !== '';
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
  const apiKey = process.env[provider.apiKeyEnv];
  return apiKey !== undefined && apiKey !== '';
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
