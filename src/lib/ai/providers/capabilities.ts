/**
 * PROVIDER CAPABILITIES UTILITIES
 *
 * Helper functions for checking and comparing provider capabilities.
 * Used for:
 * - Determining if a provider can handle a specific task
 * - Graceful degradation when switching providers
 * - Capability-based provider selection
 */

import type { ProviderId, ProviderCapabilities, UnifiedMessage } from './types';
import {
  getProvider,
  getModelCapabilities,
  getAvailableProviders,
  getAllProviders,
} from './registry';

// ============================================================================
// CAPABILITY CHECKING
// ============================================================================

/**
 * Check if a provider supports a specific capability
 */
export function hasCapability(
  providerId: ProviderId,
  capability: keyof ProviderCapabilities,
  modelId?: string
): boolean {
  try {
    if (modelId) {
      const caps = getModelCapabilities(providerId, modelId);
      return caps[capability];
    }
    const provider = getProvider(providerId);
    return provider.capabilities[capability];
  } catch {
    return false;
  }
}

/**
 * Check if a provider supports vision/image input
 */
export function supportsVision(providerId: ProviderId, modelId?: string): boolean {
  return hasCapability(providerId, 'vision', modelId);
}

/**
 * Check if a provider supports parallel tool calls
 */
export function supportsParallelTools(providerId: ProviderId, modelId?: string): boolean {
  return hasCapability(providerId, 'parallelToolCalls', modelId);
}

/**
 * Check if a provider supports tool/function calling
 */
export function supportsToolCalling(providerId: ProviderId, modelId?: string): boolean {
  return hasCapability(providerId, 'toolCalling', modelId);
}

/**
 * Check if a provider supports streaming
 */
export function supportsStreaming(providerId: ProviderId, modelId?: string): boolean {
  return hasCapability(providerId, 'streaming', modelId);
}

/**
 * Check if a provider supports system messages
 */
export function supportsSystemMessages(providerId: ProviderId, modelId?: string): boolean {
  return hasCapability(providerId, 'systemMessages', modelId);
}

// ============================================================================
// CAPABILITY COMPARISON
// ============================================================================

/**
 * Compare capabilities between two providers
 */
export function compareCapabilities(
  fromProviderId: ProviderId,
  toProviderId: ProviderId
): {
  gained: (keyof ProviderCapabilities)[];
  lost: (keyof ProviderCapabilities)[];
  same: (keyof ProviderCapabilities)[];
} {
  const fromProvider = getProvider(fromProviderId);
  const toProvider = getProvider(toProviderId);

  const capabilities: (keyof ProviderCapabilities)[] = [
    'vision',
    'parallelToolCalls',
    'streaming',
    'systemMessages',
    'jsonMode',
    'toolCalling',
  ];

  const gained: (keyof ProviderCapabilities)[] = [];
  const lost: (keyof ProviderCapabilities)[] = [];
  const same: (keyof ProviderCapabilities)[] = [];

  for (const cap of capabilities) {
    const fromHas = fromProvider.capabilities[cap];
    const toHas = toProvider.capabilities[cap];

    if (fromHas && !toHas) {
      lost.push(cap);
    } else if (!fromHas && toHas) {
      gained.push(cap);
    } else {
      same.push(cap);
    }
  }

  return { gained, lost, same };
}

/**
 * Get human-readable warnings for capability loss
 */
export function getCapabilityWarnings(
  fromProviderId: ProviderId,
  toProviderId: ProviderId
): string[] {
  const { lost } = compareCapabilities(fromProviderId, toProviderId);
  const warnings: string[] = [];

  const warningMessages: Record<keyof ProviderCapabilities, string> = {
    vision: 'Image analysis will not be available. Images in the conversation will be ignored.',
    parallelToolCalls:
      'Tools will be called sequentially instead of in parallel. This may slow down complex operations.',
    streaming: 'Responses will not stream. You will see the full response at once.',
    systemMessages:
      'System prompts may not work as expected. Instructions will be converted to user messages.',
    jsonMode: 'JSON output mode is not available. Responses may not be valid JSON.',
    toolCalling:
      'Tool/function calling is not supported. The AI cannot use workspace tools with this provider.',
  };

  for (const cap of lost) {
    warnings.push(warningMessages[cap]);
  }

  return warnings;
}

// ============================================================================
// MESSAGE ANALYSIS
// ============================================================================

/**
 * Check if a message contains images
 */
export function messageContainsImages(message: UnifiedMessage): boolean {
  if (typeof message.content === 'string') return false;
  return message.content.some((block) => block.type === 'image');
}

/**
 * Check if a conversation contains images
 */
export function conversationContainsImages(messages: UnifiedMessage[]): boolean {
  return messages.some(messageContainsImages);
}

/**
 * Check if a message contains tool calls
 */
export function messageContainsToolCalls(message: UnifiedMessage): boolean {
  if (typeof message.content === 'string') return false;
  return message.content.some((block) => block.type === 'tool_use');
}

/**
 * Check if a conversation contains tool calls
 */
export function conversationContainsToolCalls(messages: UnifiedMessage[]): boolean {
  return messages.some(messageContainsToolCalls);
}

// ============================================================================
// PROVIDER SELECTION
// ============================================================================

/**
 * Requirements for provider selection
 */
export interface ProviderRequirements {
  vision?: boolean;
  toolCalling?: boolean;
  parallelTools?: boolean;
  streaming?: boolean;
  systemMessages?: boolean;
  maxContextTokens?: number;
}

/**
 * Find providers that meet specific requirements
 */
export function findProvidersForRequirements(
  requirements: ProviderRequirements,
  onlyAvailable: boolean = true
): ProviderId[] {
  const providers = onlyAvailable ? getAvailableProviders() : getAllProviders();

  return providers
    .filter((provider) => {
      if (requirements.vision && !provider.capabilities.vision) return false;
      if (requirements.toolCalling && !provider.capabilities.toolCalling) return false;
      if (requirements.parallelTools && !provider.capabilities.parallelToolCalls) return false;
      if (requirements.streaming && !provider.capabilities.streaming) return false;
      if (requirements.systemMessages && !provider.capabilities.systemMessages) return false;

      if (requirements.maxContextTokens) {
        const hasModelWithContext = provider.models.some(
          (m) => m.contextWindow >= requirements.maxContextTokens!
        );
        if (!hasModelWithContext) return false;
      }

      return true;
    })
    .map((p) => p.id);
}

/**
 * Get the best provider for a given conversation
 */
export function getBestProviderForConversation(
  messages: UnifiedMessage[],
  preferredProvider?: ProviderId
): ProviderId {
  const requirements: ProviderRequirements = {
    streaming: true,
    toolCalling: true,
  };

  // Check if conversation needs vision
  if (conversationContainsImages(messages)) {
    requirements.vision = true;
  }

  // Check if conversation uses tools
  if (conversationContainsToolCalls(messages)) {
    requirements.toolCalling = true;
  }

  const candidates = findProvidersForRequirements(requirements);

  // If preferred provider meets requirements, use it
  if (preferredProvider && candidates.includes(preferredProvider)) {
    return preferredProvider;
  }

  // Default priority: claude > openai > xai > deepseek > groq
  const priority: ProviderId[] = ['claude', 'openai', 'xai', 'deepseek', 'groq'];

  for (const providerId of priority) {
    if (candidates.includes(providerId)) {
      return providerId;
    }
  }

  // Fallback to claude
  return 'claude';
}

// ============================================================================
// CAPABILITY MATRIX
// ============================================================================

/**
 * Get a capability matrix for all providers (useful for UI display)
 */
export function getCapabilityMatrix(): Record<
  ProviderId,
  Record<keyof ProviderCapabilities, boolean>
> {
  const providers: ProviderId[] = ['claude', 'openai', 'xai', 'deepseek', 'groq'];
  const matrix: Record<ProviderId, Record<keyof ProviderCapabilities, boolean>> = {} as Record<
    ProviderId,
    Record<keyof ProviderCapabilities, boolean>
  >;

  for (const providerId of providers) {
    const provider = getProvider(providerId);
    matrix[providerId] = { ...provider.capabilities };
  }

  return matrix;
}

/**
 * Get providers that support all required capabilities
 */
export function getProvidersWithAllCapabilities(
  capabilities: (keyof ProviderCapabilities)[]
): ProviderId[] {
  const providers: ProviderId[] = ['claude', 'openai', 'xai', 'deepseek', 'groq'];

  return providers.filter((providerId) => {
    return capabilities.every((cap) => hasCapability(providerId, cap));
  });
}
