/**
 * Prompt Caching Utilities
 *
 * Optimizes API costs by leveraging OpenAI's automatic prompt caching:
 * - Cached prompts get 50% discount on input tokens
 * - Cache works on prompts > 1024 tokens with matching prefixes
 * - TTL is ~1 hour of inactivity (automatic)
 *
 * Strategy:
 * 1. Static content (system prompts, instructions) at the BEGINNING
 * 2. Dynamic content (user messages, time) at the END
 * 3. Consistent ordering to maximize prefix matching
 */

// Cache TTLs in seconds (for explicit caching if supported)
export const CACHE_TTLS = {
  system: 172800,      // 48h - system prompts rarely change
  instruction: 86400,  // 24h - instructions may change occasionally
  user: 0,             // never cache user input
} as const;

// Dynamic content patterns that should NOT be cached
const DYNAMIC_TRIGGERS = /(upload|file|image|photo|today|now|current|news|weather|search|email|time|date)/i;

/**
 * Get the appropriate cache TTL for a message type
 */
export function getCacheTTL(message: { role: string; content?: string }): number {
  if (message.role === 'system') return CACHE_TTLS.system;
  if (message.role === 'instruction') return CACHE_TTLS.instruction;
  return CACHE_TTLS.user;
}

/**
 * Determine if a message should be cached
 * Only cache static prompts, not user input or dynamic data
 */
export function shouldCache(message: { role: string; content?: string | unknown }): boolean {
  // Never cache user messages
  if (message.role === 'user') return false;

  // System and instruction messages are cacheable unless they contain dynamic content
  if (message.role === 'system' || message.role === 'instruction') {
    const content = typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content);

    // Don't cache if contains dynamic triggers
    if (DYNAMIC_TRIGGERS.test(content)) {
      return false;
    }

    return true;
  }

  return false;
}

/**
 * Split system prompt into cacheable (static) and non-cacheable (dynamic) parts
 * This maximizes cache hits by keeping static content at the beginning
 */
export function splitPromptForCaching(systemPrompt: string): {
  staticPart: string;
  dynamicPart: string;
} {
  // Dynamic content markers that should be at the end
  const dynamicMarkers = [
    /Today is.*$/m,
    /Other US timezones:.*$/m,
    /UTC:.*$/m,
    /Current time:.*$/m,
    /IMPORTANT: Use these times.*$/m,
  ];

  let staticPart = systemPrompt;
  let dynamicPart = '';

  // Extract dynamic parts and move them to the end
  for (const marker of dynamicMarkers) {
    const match = staticPart.match(marker);
    if (match) {
      dynamicPart += match[0] + '\n';
      staticPart = staticPart.replace(marker, '').trim();
    }
  }

  return {
    staticPart: staticPart.trim(),
    dynamicPart: dynamicPart.trim(),
  };
}

/**
 * Build cache-optimized messages array
 * Ensures static system content comes first for maximum cache hits
 *
 * Order for optimal caching:
 * 1. Static system prompt (cacheable prefix)
 * 2. User context (semi-static, cacheable if unchanged)
 * 3. Conversation history (user + assistant messages)
 * 4. Dynamic time context (always at end, never cached)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCacheOptimizedMessages(options: {
  staticSystemPrompt: string;
  dynamicContext?: string;
  userContext?: { role: string; content: string };
  conversationMessages: Array<{ role: string; content: unknown }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Array<{ role: string; content: any; cache_control?: { type: string } }> {
  const { staticSystemPrompt, dynamicContext, userContext, conversationMessages } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: Array<{ role: string; content: any; cache_control?: { type: string } }> = [];

  // 1. Static system prompt FIRST (cacheable prefix)
  // Mark with cache_control for explicit caching (if API supports it)
  messages.push({
    role: 'system',
    content: staticSystemPrompt,
    cache_control: { type: 'ephemeral' }, // Request caching if supported
  });

  // 2. User context (semi-static, helps with personalization)
  if (userContext) {
    messages.push({
      role: 'system',
      content: userContext.content,
    });
  }

  // 3. Conversation history (user and assistant turns)
  for (const msg of conversationMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // 4. Dynamic context LAST (time, etc. - changes frequently)
  if (dynamicContext) {
    messages.push({
      role: 'system',
      content: dynamicContext,
    });
  }

  return messages;
}

/**
 * Estimate token count for cache efficiency analysis
 * Rule of thumb: ~4 characters per token for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if prompt is long enough to benefit from caching
 * OpenAI caches prompts > 1024 tokens with matching prefixes
 */
export function willBenefitFromCaching(messages: Array<{ content: string | unknown }>): boolean {
  let totalChars = 0;

  for (const msg of messages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    totalChars += content.length;
  }

  // ~4 chars per token, need > 1024 tokens
  return totalChars > 4096;
}

/**
 * Log cache efficiency metrics
 */
export function logCacheMetrics(options: {
  staticPromptLength: number;
  totalPromptLength: number;
  requestId?: string;
}): void {
  const { staticPromptLength, totalPromptLength, requestId } = options;
  const cacheableRatio = staticPromptLength / totalPromptLength;
  const estimatedSavings = cacheableRatio * 0.5; // 50% discount on cached tokens

  console.log('[Prompt Cache]', {
    requestId: requestId?.slice(0, 8),
    staticTokensEst: estimateTokens(String(staticPromptLength)),
    totalTokensEst: estimateTokens(String(totalPromptLength)),
    cacheableRatio: (cacheableRatio * 100).toFixed(1) + '%',
    potentialSavings: (estimatedSavings * 100).toFixed(1) + '%',
  });
}
