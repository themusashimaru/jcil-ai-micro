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
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      contextWindow: 200000,
      maxOutputTokens: 32000,
      inputPricePer1M: 15,
      outputPricePer1M: 75,
      tier: 'premium',
      isDefault: true,
    },
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      contextWindow: 200000,
      maxOutputTokens: 64000,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
      tier: 'standard',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
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
  description: 'GPT-4 and o1 models from OpenAI',
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
      id: 'gpt-4o',
      name: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPricePer1M: 2.5,
      outputPricePer1M: 10,
      tier: 'premium',
      isDefault: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputPricePer1M: 0.15,
      outputPricePer1M: 0.6,
      tier: 'budget',
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputPricePer1M: 10,
      outputPricePer1M: 30,
      tier: 'premium',
    },
    {
      id: 'o1',
      name: 'o1 (Reasoning)',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      inputPricePer1M: 15,
      outputPricePer1M: 60,
      tier: 'premium',
      capabilities: {
        vision: false,
        parallelToolCalls: false,
        streaming: true,
        systemMessages: false, // o1 doesn't support system messages
        jsonMode: false,
        toolCalling: false, // o1 has limited tool support
      },
    },
    {
      id: 'o1-mini',
      name: 'o1 Mini (Reasoning)',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      inputPricePer1M: 3,
      outputPricePer1M: 12,
      tier: 'standard',
      capabilities: {
        vision: false,
        parallelToolCalls: false,
        streaming: true,
        systemMessages: false,
        jsonMode: false,
        toolCalling: false,
      },
    },
  ],
};

/**
 * xAI (Grok) Provider Configuration
 */
const XAI_CONFIG: ProviderConfig = {
  id: 'xai',
  name: 'xAI (Grok)',
  family: 'openai-compatible',
  baseURL: 'https://api.x.ai/v1',
  apiKeyEnv: 'XAI_API_KEY',
  icon: 'xai',
  description: 'Grok models with real-time knowledge from xAI',
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
      id: 'grok-2',
      name: 'Grok 2',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      inputPricePer1M: 2,
      outputPricePer1M: 10,
      tier: 'standard',
      isDefault: true,
    },
    {
      id: 'grok-2-vision',
      name: 'Grok 2 Vision',
      contextWindow: 32768,
      maxOutputTokens: 8192,
      inputPricePer1M: 2,
      outputPricePer1M: 10,
      tier: 'standard',
    },
    {
      id: 'grok-3',
      name: 'Grok 3',
      contextWindow: 131072,
      maxOutputTokens: 32768,
      inputPricePer1M: 3,
      outputPricePer1M: 15,
      tier: 'premium',
    },
  ],
};

/**
 * DeepSeek Provider Configuration
 */
const DEEPSEEK_CONFIG: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  family: 'openai-compatible',
  baseURL: 'https://api.deepseek.com/v1',
  apiKeyEnv: 'DEEPSEEK_API_KEY',
  icon: 'deepseek',
  description: 'Cost-effective coding models from DeepSeek',
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
      name: 'DeepSeek V3',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.14,
      outputPricePer1M: 0.28,
      tier: 'budget',
      isDefault: true,
    },
    {
      id: 'deepseek-coder',
      name: 'DeepSeek Coder',
      contextWindow: 64000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.14,
      outputPricePer1M: 0.28,
      tier: 'budget',
    },
  ],
};

/**
 * Groq Provider Configuration
 */
const GROQ_CONFIG: ProviderConfig = {
  id: 'groq',
  name: 'Groq',
  family: 'openai-compatible',
  baseURL: 'https://api.groq.com/openai/v1',
  apiKeyEnv: 'GROQ_API_KEY',
  icon: 'groq',
  description: 'Ultra-fast inference with open models',
  capabilities: {
    vision: false,
    parallelToolCalls: true,
    streaming: true,
    systemMessages: true,
    jsonMode: true,
    toolCalling: true,
  },
  models: [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      contextWindow: 128000,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.59,
      outputPricePer1M: 0.79,
      tier: 'budget',
      isDefault: true,
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      inputPricePer1M: 0.05,
      outputPricePer1M: 0.08,
      tier: 'budget',
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B',
      contextWindow: 32768,
      maxOutputTokens: 32768,
      inputPricePer1M: 0.24,
      outputPricePer1M: 0.24,
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
  groq: GROQ_CONFIG,
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
