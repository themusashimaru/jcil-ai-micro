/**
 * CONTEXT HANDOFF MODULE
 *
 * Enables mid-conversation provider switching with seamless context preservation.
 * This is the "jaw-dropping" feature that makes the multi-provider system work.
 *
 * Key features:
 * - Convert message history between provider formats
 * - Detect and warn about capability degradation
 * - Summarize context if it exceeds new provider's limits
 * - Generate handoff system prompt for continuity
 */

import type {
  ProviderId,
  UnifiedMessage,
  UnifiedContentBlock,
  HandoffResult,
  HandoffOptions,
} from '../types';
import { getProvider, getModel } from '../registry';
import { conversationContainsImages, conversationContainsToolCalls } from '../capabilities';
import { summarizeContext, estimateTokenCount } from './summarizer';

// ============================================================================
// HANDOFF CONFIGURATION
// ============================================================================

/**
 * Default handoff configuration
 */
export const DEFAULT_HANDOFF_OPTIONS: Required<HandoffOptions> = {
  summarizeIfExceeds: 0.8, // Summarize if >80% of context window
  includeSystemPrompt: true,
  preserveToolHistory: true,
  warnOnCapabilityLoss: true,
};

/**
 * Handoff system prompt template
 */
const HANDOFF_SYSTEM_PROMPT = `You are continuing a conversation that was started with a different AI model.
The conversation history below has been transferred to you. Please continue naturally from where the previous assistant left off.
Maintain the same tone and context as the previous conversation.`;

// ============================================================================
// CAPABILITY ANALYSIS
// ============================================================================

/**
 * Analyze what capabilities will be lost when switching providers
 */
export function analyzeCapabilityLoss(
  fromProvider: ProviderId,
  toProvider: ProviderId,
  conversation: UnifiedMessage[]
): string[] {
  const warnings: string[] = [];
  const fromCaps = getProvider(fromProvider).capabilities;
  const toCaps = getProvider(toProvider).capabilities;

  // Check vision capability
  if (fromCaps.vision && !toCaps.vision && conversationContainsImages(conversation)) {
    warnings.push(
      `${getProvider(toProvider).name} does not support vision. Images in the conversation will not be processed.`
    );
  }

  // Check tool calling
  if (fromCaps.toolCalling && !toCaps.toolCalling && conversationContainsToolCalls(conversation)) {
    warnings.push(
      `${getProvider(toProvider).name} does not support tool calling. Tool-based interactions may not work.`
    );
  }

  // Check parallel tool calls
  if (fromCaps.parallelToolCalls && !toCaps.parallelToolCalls) {
    warnings.push(
      `${getProvider(toProvider).name} does not support parallel tool calls. Complex tool operations may be slower.`
    );
  }

  // Check system messages
  if (fromCaps.systemMessages && !toCaps.systemMessages) {
    warnings.push(
      `${getProvider(toProvider).name} does not support system messages. Custom instructions may not apply.`
    );
  }

  return warnings;
}

/**
 * Check if handoff is safe (no critical capability loss)
 */
export function isHandoffSafe(
  _fromProvider: ProviderId,
  toProvider: ProviderId,
  conversation: UnifiedMessage[]
): boolean {
  // Consider handoff unsafe if vision is lost with images present
  // or if tool calling is lost with tool calls present
  const toCaps = getProvider(toProvider).capabilities;
  const hasVisionIssue = !toCaps.vision && conversationContainsImages(conversation);
  const hasToolIssue = !toCaps.toolCalling && conversationContainsToolCalls(conversation);

  return !hasVisionIssue && !hasToolIssue;
}

// ============================================================================
// MESSAGE CONVERSION
// ============================================================================

/**
 * Strip images from messages for non-vision providers
 */
function stripImagesFromMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return msg;
    }

    // Filter out image blocks
    const filteredContent = msg.content.filter((block) => block.type !== 'image');

    // If no content left, add placeholder
    if (filteredContent.length === 0) {
      return {
        ...msg,
        content: '[Image content removed - not supported by current provider]',
      };
    }

    return {
      ...msg,
      content: filteredContent,
    };
  });
}

/**
 * Convert tool use blocks to text descriptions for non-tool providers
 */
function convertToolCallsToText(messages: UnifiedMessage[]): UnifiedMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return msg;
    }

    const newContent: UnifiedContentBlock[] = [];

    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        // Convert tool use to text description
        const toolBlock = block as { name: string; arguments: Record<string, unknown> };
        newContent.push({
          type: 'text',
          text: `[Used tool: ${toolBlock.name} with args: ${JSON.stringify(toolBlock.arguments)}]`,
        });
      } else if (block.type === 'tool_result') {
        // Convert tool result to text
        const resultBlock = block as { content: string };
        newContent.push({
          type: 'text',
          text: `[Tool result: ${resultBlock.content}]`,
        });
      } else {
        newContent.push(block);
      }
    }

    return {
      ...msg,
      content: newContent.length > 0 ? newContent : msg.content,
    };
  });
}

/**
 * Prepare messages for the target provider
 */
export function prepareMessagesForProvider(
  messages: UnifiedMessage[],
  toProvider: ProviderId
): UnifiedMessage[] {
  const toCaps = getProvider(toProvider).capabilities;
  let prepared = [...messages];

  // Strip images if no vision support
  if (!toCaps.vision) {
    prepared = stripImagesFromMessages(prepared);
  }

  // Convert tool calls if no tool support
  if (!toCaps.toolCalling) {
    prepared = convertToolCallsToText(prepared);
  }

  // Add metadata to track provider
  return prepared.map((msg) => ({
    ...msg,
    metadata: {
      ...msg.metadata,
      convertedFrom: msg.metadata?.provider,
      convertedTo: toProvider,
    },
  }));
}

// ============================================================================
// CONTEXT SIZING
// ============================================================================

/**
 * Check if context needs to be summarized
 */
export function needsSummarization(
  messages: UnifiedMessage[],
  toProvider: ProviderId,
  modelId?: string,
  threshold: number = 0.8
): boolean {
  const model = modelId ? getModel(toProvider, modelId) : getProvider(toProvider).models[0];
  if (!model) return false;

  const contextWindow = model.contextWindow;
  const estimatedTokens = estimateTokenCount(messages);

  return estimatedTokens > contextWindow * threshold;
}

/**
 * Get the maximum context size for a provider/model
 */
export function getMaxContextSize(toProvider: ProviderId, modelId?: string): number {
  const model = modelId ? getModel(toProvider, modelId) : getProvider(toProvider).models[0];
  return model?.contextWindow ?? 128000;
}

// ============================================================================
// MAIN HANDOFF FUNCTION
// ============================================================================

/**
 * Prepare a conversation for handoff to a new provider
 *
 * This is the main function that orchestrates the entire handoff process:
 * 1. Analyze capability differences
 * 2. Convert message formats
 * 3. Summarize if needed
 * 4. Generate handoff context
 *
 * @param conversation - The current conversation messages
 * @param fromProvider - The current provider
 * @param toProvider - The target provider
 * @param options - Handoff configuration options
 * @returns HandoffResult with prepared messages and metadata
 */
export async function prepareProviderHandoff(
  conversation: UnifiedMessage[],
  fromProvider: ProviderId,
  toProvider: ProviderId,
  options: Partial<HandoffOptions> = {}
): Promise<HandoffResult> {
  const config = { ...DEFAULT_HANDOFF_OPTIONS, ...options };
  const startTime = Date.now();

  // 1. Analyze capability differences
  const warnings: string[] = [];

  if (config.warnOnCapabilityLoss) {
    const capWarnings = analyzeCapabilityLoss(fromProvider, toProvider, conversation);
    warnings.push(...capWarnings);
  }

  // 2. Convert messages for target provider
  let preparedMessages = prepareMessagesForProvider(conversation, toProvider);

  // 3. Check if summarization is needed
  let wasSummarized = false;
  const targetModel =
    getProvider(toProvider).models.find((m) => m.isDefault) || getProvider(toProvider).models[0];

  if (
    needsSummarization(preparedMessages, toProvider, targetModel?.id, config.summarizeIfExceeds)
  ) {
    const summarized = await summarizeContext(preparedMessages, toProvider, {
      targetTokens: Math.floor(getMaxContextSize(toProvider, targetModel?.id) * 0.5),
      preserveRecentMessages: 5,
      preserveToolHistory: config.preserveToolHistory,
    });

    preparedMessages = summarized.messages;
    wasSummarized = true;
    warnings.push(
      `Conversation was summarized to fit within ${getProvider(toProvider).name}'s context window.`
    );
  }

  // 4. Build handoff system prompt if enabled
  let systemPrompt: string | undefined;
  if (config.includeSystemPrompt) {
    systemPrompt = buildHandoffSystemPrompt(fromProvider, toProvider, wasSummarized);
  }

  // 5. Build result
  const result: HandoffResult = {
    messages: preparedMessages,
    fromProvider,
    toProvider,
    warnings,
    systemPrompt,
    metadata: {
      handoffTime: new Date().toISOString(),
      originalMessageCount: conversation.length,
      preparedMessageCount: preparedMessages.length,
      wasSummarized,
      processingTimeMs: Date.now() - startTime,
    },
  };

  return result;
}

/**
 * Build the handoff system prompt
 */
function buildHandoffSystemPrompt(
  fromProvider: ProviderId,
  toProvider: ProviderId,
  wasSummarized: boolean
): string {
  const fromName = getProvider(fromProvider).name;
  const toName = getProvider(toProvider).name;

  let prompt = HANDOFF_SYSTEM_PROMPT;

  if (wasSummarized) {
    prompt += `\n\nNote: The conversation history has been summarized to fit within context limits. Some details may have been condensed.`;
  }

  prompt += `\n\n[Handoff: ${fromName} → ${toName}]`;

  return prompt;
}

// ============================================================================
// QUICK HANDOFF UTILITIES
// ============================================================================

/**
 * Quick check if a handoff is possible
 */
export function canHandoff(
  fromProvider: ProviderId,
  toProvider: ProviderId,
  conversation: UnifiedMessage[]
): { possible: boolean; warnings: string[] } {
  // Same provider is always possible
  if (fromProvider === toProvider) {
    return { possible: true, warnings: [] };
  }

  const warnings = analyzeCapabilityLoss(fromProvider, toProvider, conversation);

  // Always possible, but may have warnings
  return {
    possible: true,
    warnings,
  };
}

/**
 * Get recommended provider for handoff based on conversation content
 */
export function getRecommendedHandoffProvider(
  currentProvider: ProviderId,
  conversation: UnifiedMessage[],
  excludeProviders: ProviderId[] = []
): ProviderId | null {
  const hasImages = conversationContainsImages(conversation);
  const hasTools = conversationContainsToolCalls(conversation);

  // Get all available providers
  const providers: ProviderId[] = ['claude', 'openai', 'xai', 'deepseek'];
  const candidates = providers.filter(
    (p) => p !== currentProvider && !excludeProviders.includes(p)
  );

  // Score each provider
  let bestProvider: ProviderId | null = null;
  let bestScore = -1;

  for (const provider of candidates) {
    const caps = getProvider(provider).capabilities;
    let score = 0;

    // Must have vision if conversation has images
    if (hasImages && !caps.vision) continue;

    // Must have tool calling if conversation has tools
    if (hasTools && !caps.toolCalling) continue;

    // Score based on capabilities
    if (caps.vision) score += 2;
    if (caps.toolCalling) score += 2;
    if (caps.parallelToolCalls) score += 1;
    if (caps.streaming) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }

  return bestProvider;
}
