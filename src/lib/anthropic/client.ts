/**
 * ANTHROPIC CLIENT
 *
 * PURPOSE:
 * - Provide Claude AI chat completion functionality
 * - Support streaming responses
 * - Handle tool calls (web search via Brave)
 *
 * FEATURES:
 * - Streaming text responses
 * - Non-streaming for image analysis
 * - Web search integration via Brave
 * - Multiple API key support with automatic failover
 * - Prompt caching for cost savings
 */

import Anthropic from '@anthropic-ai/sdk';
import { CoreMessage } from 'ai';

// Default model: Claude Sonnet 4.5
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (ANTHROPIC_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (ANTHROPIC_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single ANTHROPIC_API_KEY still works
// NO HARDCODED LIMITS - just add keys in Vercel and they're automatically detected!

interface ApiKeyState {
  key: string;
  client: Anthropic;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
}

// Separate pools for better management
const primaryPool: ApiKeyState[] = [];
const fallbackPool: ApiKeyState[] = [];
let primaryKeyIndex = 0; // Round-robin index for primary pool
let fallbackKeyIndex = 0; // Round-robin index for fallback pool
let initialized = false;

/**
 * Initialize all available Anthropic API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 * Just add ANTHROPIC_API_KEY_N in Vercel and it's automatically picked up
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  // Keeps looking for ANTHROPIC_API_KEY_1, _2, _3, etc. until one is missing
  let i = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    primaryPool.push({
      key,
      client: new Anthropic({ apiKey: key }),
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
    });
    i++;
  }

  // If no numbered keys found, fall back to single ANTHROPIC_API_KEY
  if (primaryPool.length === 0) {
    const singleKey = process.env.ANTHROPIC_API_KEY;
    if (!singleKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Set either ANTHROPIC_API_KEY or ANTHROPIC_API_KEY_1, _2, _3, etc.');
    }
    primaryPool.push({
      key: singleKey,
      client: new Anthropic({ apiKey: singleKey }),
      rateLimitedUntil: 0,
      pool: 'primary',
      index: 0,
    });
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`ANTHROPIC_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    fallbackPool.push({
      key,
      client: new Anthropic({ apiKey: key }),
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = primaryPool.length + fallbackPool.length;
  const estimatedRPM = totalKeys * 60;
  console.log(`[Anthropic] Initialized dual-pool system (dynamic detection):`);
  console.log(`[Anthropic]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
  console.log(`[Anthropic]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  console.log(`[Anthropic]   Estimated capacity: ~${estimatedRPM} RPM (${totalKeys} keys × 60 RPM)`);
}

/**
 * Get an available key from the primary pool (round-robin)
 * Returns null if all primary keys are rate limited
 */
function getPrimaryClient(): Anthropic | null {
  const now = Date.now();

  // Round-robin through primary pool
  for (let i = 0; i < primaryPool.length; i++) {
    const keyIndex = (primaryKeyIndex + i) % primaryPool.length;
    const keyState = primaryPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // Advance round-robin for next request (load distribution)
      primaryKeyIndex = (keyIndex + 1) % primaryPool.length;
      return keyState.client;
    }
  }

  return null; // All primary keys are rate limited
}

/**
 * Get an available key from the fallback pool
 * Returns null if all fallback keys are rate limited
 */
function getFallbackClient(): Anthropic | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < fallbackPool.length; i++) {
    const keyIndex = (fallbackKeyIndex + i) % fallbackPool.length;
    const keyState = fallbackPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      fallbackKeyIndex = (keyIndex + 1) % fallbackPool.length;
      console.log(`[Anthropic] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
      return keyState.client;
    }
  }

  return null; // All fallback keys are also rate limited
}

/**
 * Get the next available Anthropic client
 * Priority: Primary pool (round-robin) → Fallback pool → Wait for soonest available
 */
function getAnthropicClient(): Anthropic {
  initializeApiKeys();

  // Try primary pool first (round-robin for load distribution)
  const primaryClient = getPrimaryClient();
  if (primaryClient) {
    return primaryClient;
  }

  // Primary pool exhausted - try fallback pool
  const fallbackClient = getFallbackClient();
  if (fallbackClient) {
    return fallbackClient;
  }

  // All keys rate limited - find the one available soonest
  const allKeys = [...primaryPool, ...fallbackPool];
  let soonestKey = allKeys[0];

  for (const key of allKeys) {
    if (key.rateLimitedUntil < soonestKey.rateLimitedUntil) {
      soonestKey = key;
    }
  }

  const waitTime = Math.ceil((soonestKey.rateLimitedUntil - Date.now()) / 1000);
  console.log(`[Anthropic] All ${allKeys.length} keys rate limited. Using ${soonestKey.pool} key ${soonestKey.index} (available in ${waitTime}s)`);

  return soonestKey.client;
}

/**
 * Mark a specific API key as rate limited
 */
function markKeyRateLimited(client: Anthropic, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.client === client);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[Anthropic] ${keyState.pool.toUpperCase()} key ${keyState.index} rate limited for ${retryAfterSeconds}s`);

    // Log pool status
    const now = Date.now();
    const availablePrimary = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
    const availableFallback = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;
    console.log(`[Anthropic] Pool status: ${availablePrimary}/${primaryPool.length} primary, ${availableFallback}/${fallbackPool.length} fallback available`);
  }
}

// Track current client for rate limit marking
let lastUsedClient: Anthropic | null = null;

/**
 * Check if an error is a rate limit error and handle it
 */
function handleRateLimitError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) {
    if (lastUsedClient) {
      markKeyRateLimited(lastUsedClient, 60);
    }
    return true;
  }

  if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
    if (lastUsedClient) {
      markKeyRateLimited(lastUsedClient, 60);
    }
    return true;
  }

  return false;
}

/**
 * Get stats about API key usage
 */
export function getApiKeyStats(): {
  primaryKeys: number;
  primaryAvailable: number;
  fallbackKeys: number;
  fallbackAvailable: number;
  totalKeys: number;
  totalAvailable: number;
} {
  initializeApiKeys();
  const now = Date.now();

  const primaryAvailable = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
  const fallbackAvailable = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;

  return {
    primaryKeys: primaryPool.length,
    primaryAvailable,
    fallbackKeys: fallbackPool.length,
    fallbackAvailable,
    totalKeys: primaryPool.length + fallbackPool.length,
    totalAvailable: primaryAvailable + fallbackAvailable,
  };
}

/**
 * Get total number of API keys (for retry logic)
 */
function getTotalKeyCount(): number {
  initializeApiKeys();
  return primaryPool.length + fallbackPool.length;
}

export interface AnthropicChatOptions {
  messages: CoreMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  systemPrompt?: string;
  // Web search function (injected from Brave Search module)
  webSearchFn?: (query: string) => Promise<BraveSearchResult>;
  // For token tracking
  userId?: string;
  planKey?: string;
}

export interface BraveSearchResult {
  results: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
  }>;
  query: string;
}

// Valid image media types for Anthropic API
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

// Anthropic message content types
type AnthropicMessageContent = string | Array<
  { type: 'text'; text: string } |
  { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
>;

/**
 * Convert CoreMessage format to Anthropic message format
 */
function convertMessages(messages: CoreMessage[], systemPrompt?: string): {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: AnthropicMessageContent;
  }>;
} {
  const system = systemPrompt || 'You are a helpful AI assistant.';
  const anthropicMessages: Array<{
    role: 'user' | 'assistant';
    content: AnthropicMessageContent;
  }> = [];

  for (const msg of messages) {
    // Skip system messages - they go in the system parameter
    if (msg.role === 'system') continue;

    if (msg.role === 'user' || msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else if (Array.isArray(msg.content)) {
        // Handle multimodal content (text + images)
        const parts: Array<
          { type: 'text'; text: string } |
          { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
        > = [];

        for (const part of msg.content) {
          // Cast to unknown to handle various image formats that may come from different sources
          const partAny = part as unknown as { type: string; text?: string; image?: string };

          if (partAny.type === 'text' && partAny.text) {
            parts.push({ type: 'text', text: partAny.text });
          } else if ((partAny.type === 'image' || partAny.type === 'image_url') && partAny.image) {
            // Extract base64 data from data URL
            const dataUrl = partAny.image;
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const [, mediaType, data] = matches;
              // Validate and cast media type to allowed values
              const validMediaTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
              const typedMediaType = validMediaTypes.includes(mediaType as ImageMediaType)
                ? (mediaType as ImageMediaType)
                : 'image/png'; // Default to PNG if unknown
              parts.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: typedMediaType,
                  data,
                },
              });
            }
          }
        }

        if (parts.length > 0) {
          anthropicMessages.push({
            role: msg.role,
            content: parts,
          });
        }
      }
    }
  }

  return { system, messages: anthropicMessages };
}

/**
 * Create a chat completion using Claude
 * Uses prompt caching for the system prompt (90% cost savings on cached tokens)
 * Automatically retries with fallback API keys on rate limit errors
 */
export async function createAnthropicCompletion(options: AnthropicChatOptions): Promise<{
  text: string;
  model: string;
  citations?: Array<{ title: string; url: string }>;
  numSourcesUsed?: number;
}> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Retry up to the number of available API keys
  const maxRetries = Math.max(1, getTotalKeyCount());

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();
    lastUsedClient = client; // Track for rate limit marking

    try {
      // Non-streaming mode with prompt caching on system prompt
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        // Use array format with cache_control for prompt caching
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      });

      // Extract text from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        text: textContent,
        model,
      };
    } catch (error) {
      // Check if this is a rate limit error
      if (handleRateLimitError(error) && attempt < maxRetries - 1) {
        console.log(`[Anthropic] Rate limited on attempt ${attempt + 1}, retrying with different key...`);
        continue; // Try again with next available key
      }

      console.error('[Anthropic] Chat completion error:', error);
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error('All API keys exhausted');
}

/**
 * Create a streaming chat completion using Claude
 * Uses prompt caching for the system prompt (90% cost savings on cached tokens)
 * Handles rate limits by rotating to fallback API keys
 */
export async function createAnthropicStreamingCompletion(options: AnthropicChatOptions): Promise<{
  toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => Response;
  model: string;
}> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Create a TransformStream to convert Anthropic stream to text stream
  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  // Start streaming in the background with prompt caching on system prompt
  (async () => {
    const maxRetries = Math.max(1, getTotalKeyCount());

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const client = getAnthropicClient();
      lastUsedClient = client; // Track for rate limit marking

      try {
        const stream = await client.messages.stream({
          model,
          max_tokens: maxTokens,
          temperature,
          // Use array format with cache_control for prompt caching
          system: [
            {
              type: 'text',
              text: system,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta;
            if ('text' in delta) {
              await writer.write(delta.text);
            }
          }
        }

        // Success - exit the retry loop
        return;
      } catch (error) {
        // Check if this is a rate limit error and we can retry
        if (handleRateLimitError(error) && attempt < maxRetries - 1) {
          console.log(`[Anthropic] Streaming rate limited on attempt ${attempt + 1}, retrying with different key...`);
          continue; // Try again with next available key
        }

        console.error('[Anthropic] Streaming error:', error);
        await writer.write('\n\n[Error: Stream interrupted. Please try again.]');
        return;
      }
    }
  })().finally(() => {
    writer.close();
  });

  return {
    toTextStreamResponse: (opts?: { headers?: Record<string, string> }) => {
      return new Response(readable.pipeThrough(new TextEncoderStream()), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          ...opts?.headers,
        },
      });
    },
    model,
  };
}

/**
 * Create a chat completion with PERPLEXITY web search + Claude formatting
 *
 * PERPLEXITY-ONLY SEARCH:
 * 1. Perplexity handles ALL web searches (accurate real-time data)
 * 2. Claude formats and presents the results (conversational style)
 * 3. NO Anthropic native search fallback (it was inaccurate)
 *
 * Perplexity uses the same dual-pool round-robin system as Anthropic:
 * - PERPLEXITY_API_KEY_1, _2, _3, ... (primary pool)
 * - PERPLEXITY_API_KEY_FALLBACK_1, _2, ... (fallback pool)
 * - Or single PERPLEXITY_API_KEY for backward compatibility
 */
export async function createAnthropicCompletionWithSearch(
  options: AnthropicChatOptions
): Promise<{
  text: string;
  model: string;
  citations: Array<{ title: string; url: string }>;
  numSourcesUsed: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { webSearchFn, ...rest } = options;

  const model = rest.model || DEFAULT_MODEL;
  const maxTokens = rest.maxTokens || 4096;

  const { system, messages } = convertMessages(rest.messages, rest.systemPrompt);

  // Get the user's query from the last message
  const lastMessage = messages[messages.length - 1];
  const userQuery = typeof lastMessage.content === 'string'
    ? lastMessage.content
    : Array.isArray(lastMessage.content)
      ? lastMessage.content.map(c => 'text' in c ? c.text : '').join(' ')
      : '';

  // Import Perplexity client
  const { perplexitySearch, isPerplexityConfigured } = await import('@/lib/perplexity/client');

  // Check if Perplexity is configured
  if (!isPerplexityConfigured()) {
    console.error('[Search] Perplexity not configured - web search unavailable');
    // Return a helpful message instead of failing silently
    return {
      text: "I apologize, but web search is currently unavailable. Please configure a Perplexity API key (PERPLEXITY_API_KEY or PERPLEXITY_API_KEY_1, _2, etc.) to enable real-time search capabilities.",
      model,
      citations: [],
      numSourcesUsed: 0,
    };
  }

  // Use Perplexity for the search (with its own round-robin + fallback system)
  console.log('[Perplexity] Executing web search...');
  const perplexityResult = await perplexitySearch({ query: userQuery });
  console.log(`[Perplexity] Search complete. ${perplexityResult.sources.length} sources found.`);

  const citations = perplexityResult.sources.map(s => ({
    title: s.title,
    url: s.url,
  }));

  // Create a prompt for Claude to format the Perplexity results
  // Build clickable markdown links for sources with proper domain names
  const validSources = perplexityResult.sources.filter(s => s.url && s.url.startsWith('http'));

  const sourceLinks = validSources.map(s => {
    let domain = s.title || 'Source';
    if (!s.title || s.title === 'Source') {
      try {
        domain = new URL(s.url).hostname.replace('www.', '');
      } catch {
        domain = 'Source';
      }
    }
    return `- [${domain}](${s.url})`;
  }).join('\n');

  console.log(`[Claude Formatting] Building response with ${validSources.length} source links`);
  if (validSources.length > 0) {
    console.log('[Claude Formatting] Source URLs:', validSources.map(s => s.url).join(', '));
  }

  const formattingPrompt = `Format the search results below into a helpful response.

SEARCH RESULTS:
${perplexityResult.answer}

USER'S QUESTION: ${userQuery}

FORMATTING RULES:
1. Present the information conversationally but concisely
2. Keep ALL data EXACTLY as provided: times, dates, temperatures, timestamps
3. NO em dashes (—). Use commas, periods, or hyphens only
4. NO numbered references like [1] or [2]

IMPORTANT - SOURCES:
At the VERY END of your response, you MUST include this exact section:

**Sources:**
${sourceLinks}

Copy the sources section EXACTLY as shown above - do not change the markdown link format.`;

  const formattedMessages = [
    ...messages.slice(0, -1), // Previous conversation context
    { role: 'user' as const, content: formattingPrompt },
  ];

  const maxRetries = Math.max(1, getTotalKeyCount());

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();
    lastUsedClient = client;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0.3, // Lower temperature for more accurate formatting
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: formattedMessages,
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      console.log('[Perplexity+Claude] Successfully formatted search results');

      return {
        text: textContent,
        model,
        citations,
        numSourcesUsed: citations.length,
      };
    } catch (error) {
      if (handleRateLimitError(error) && attempt < maxRetries - 1) {
        console.log(`[Claude] Rate limited on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      throw error;
    }
  }

  // This should never be reached due to the retry logic above
  throw new Error('All Anthropic API keys exhausted while formatting search results');
}

/**
 * Check if image generation is requested
 * (Anthropic doesn't support image generation, so we return unavailable message)
 */
export function isImageGenerationRequest(content: string): boolean {
  const imagePatterns = [
    /\b(create|generate|make|draw|design|produce)\b.*\b(image|picture|photo|illustration|artwork|graphic)\b/i,
    /\b(image|picture|photo|illustration|artwork|graphic)\b.*\b(of|for|showing|depicting)\b/i,
    /\bdall[-\s]?e\b/i,
    /\bmidjourney\b/i,
    /\bstable diffusion\b/i,
  ];

  return imagePatterns.some(pattern => pattern.test(content));
}

// ========================================
// ANTHROPIC SKILLS API
// Document generation capabilities (xlsx, pptx, docx, pdf)
// ========================================

/**
 * Beta headers required for Skills API
 */
const SKILLS_BETA_HEADERS = [
  'skills-2025-10-02',
  'code-execution-2025-08-25',
];

const FILES_BETA_HEADER = 'files-api-2025-04-14';

/**
 * Available Anthropic document skills
 */
export type DocumentSkillType = 'xlsx' | 'pptx' | 'docx' | 'pdf';

export interface SkillParams {
  skill_id: DocumentSkillType;
  type: 'anthropic';
  version: string;
}

/**
 * Check if the user's message is requesting document generation
 * Returns the type of document if detected, null otherwise
 */
export function detectDocumentRequest(content: string): DocumentSkillType | null {
  const lowerContent = content.toLowerCase();

  // PDF patterns for slides/presentations - check FIRST (most specific)
  // This catches "slides as pdf", "presentation pdf", "powerpoint as pdf"
  const pdfSlidesPatterns = [
    /\b(slides?|presentation|powerpoint|deck)\b.*\b(as|in|to)\s*(a\s*)?(pdf|pdf\s*format)\b/i,
    /\bpdf\b.*\b(slides?|presentation|powerpoint|deck)\b/i,
    /\b(slides?|presentation)\b.*\bpdf\b/i,
    /\bpdf\s*(slides?|presentation|deck)\b/i,
  ];

  // General PDF patterns - expanded
  const pdfCreatePatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\bpdf\b/i,
    /\bpdf\b.*\b(file|document|version|format)\b/i,
    /\b(fillable|form)\b.*\bpdf\b/i,
    /\bpdf\s*(file|document|version)?\b.*\b(create|make|generate|of|for)\b/i,
    /\b(save|export|convert)\b.*\b(as|to)\s*pdf\b/i,
    /\bas\s*a?\s*pdf\b/i, // "as a pdf", "as pdf"
  ];

  // Excel/Spreadsheet patterns - expanded for common phrasings
  const excelPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(excel|spreadsheet|xlsx|xls)\b/i,
    /\b(excel|spreadsheet|xlsx|xls)\b.*\b(file|document|for|with|that)\b/i,
    /\bbudget\b.*\b(spreadsheet|template|excel)\b/i,
    /\bfinancial\b.*\b(model|spreadsheet|excel)\b/i,
    /\bdata\s*(table|sheet)\b/i,
    /\b(chart|graph)\b.*\b(data|excel|spreadsheet)\b/i,
    /\b(excel|spreadsheet)\s*(file)?\b/i, // Simple "excel file" or just "spreadsheet"
    /\btracking\s*(spreadsheet|sheet)\b/i,
  ];

  // PowerPoint patterns - expanded (but PDF slides patterns take priority)
  const pptPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(powerpoint|presentation|pptx|ppt|slides?|deck)\b/i,
    /\b(powerpoint|presentation|pptx|ppt)\b.*\b(file|document|for|about|on|with)\b/i,
    /\bpitch\s*deck\b/i,
    /\bslide\s*(show|deck|presentation)?\b/i,
    /\b\d+\s*slides?\b/i, // "3 slides", "5 slide presentation"
  ];

  // Word document patterns - expanded and more flexible
  const docPatterns = [
    /\b(create|make|generate|build|give me|i need|can you make)\b.*\b(word|docx)\b/i,
    /\b(word|docx)\s*(document|doc|file)?\b/i, // "word document", "word doc", "word file", or just "word"
    /\b(create|make|generate|write)\b.*\b(document|doc)\b.*\b(word|docx|editable)\b/i,
    /\b(create|make|generate|write)\b.*\b(report|letter|memo|manuscript|contract|proposal)\b.*\b(document|word|docx)\b/i,
    /\beditable\s*(document|doc)\b/i, // "editable document" implies Word
  ];

  // Check patterns in order of priority:
  // 1. PDF slides (most specific - "slides as pdf", "presentation as pdf")
  // 2. General PDF ("make a pdf", "pdf document")
  // 3. Excel ("spreadsheet", "excel file")
  // 4. PowerPoint (regular slides without pdf)
  // 5. Word ("word doc", "docx")

  if (pdfSlidesPatterns.some(pattern => pattern.test(lowerContent))) {
    console.log('[Document Detection] Matched: PDF slides/presentation');
    return 'pdf';
  }
  if (pdfCreatePatterns.some(pattern => pattern.test(lowerContent))) {
    console.log('[Document Detection] Matched: PDF');
    return 'pdf';
  }
  if (excelPatterns.some(pattern => pattern.test(lowerContent))) {
    console.log('[Document Detection] Matched: Excel');
    return 'xlsx';
  }
  if (pptPatterns.some(pattern => pattern.test(lowerContent))) {
    console.log('[Document Detection] Matched: PowerPoint');
    return 'pptx';
  }
  if (docPatterns.some(pattern => pattern.test(lowerContent))) {
    console.log('[Document Detection] Matched: Word');
    return 'docx';
  }

  return null;
}

/**
 * Get the appropriate skill configuration for a document type
 */
export function getSkillConfig(docType: DocumentSkillType): SkillParams {
  return {
    skill_id: docType,
    type: 'anthropic',
    version: 'latest',
  };
}

/**
 * File information returned when a document is generated
 */
export interface GeneratedFile {
  file_id: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
}

/**
 * Create a chat completion with Skills enabled for document generation
 * Uses the beta API with code execution and skills
 */
export async function createAnthropicCompletionWithSkills(
  options: AnthropicChatOptions & {
    skills: DocumentSkillType[];
  }
): Promise<{
  text: string;
  model: string;
  files?: GeneratedFile[];
  containerId?: string;
}> {
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 8192; // Higher for document generation
  const temperature = options.temperature ?? 0.7;

  const { system, messages } = convertMessages(options.messages, options.systemPrompt);

  // Build skills configuration
  const skillsConfig = options.skills.map(skill => getSkillConfig(skill));

  const maxRetries = Math.max(1, getTotalKeyCount());

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = getAnthropicClient();
    lastUsedClient = client;

    try {
      // Use the beta messages API with skills
      // Skills require the code_execution tool to be included
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        betas: SKILLS_BETA_HEADERS,
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
        tools: [
          {
            type: 'code_execution_20250825',
            name: 'code_execution',
          },
        ],
        container: {
          skills: skillsConfig,
        },
      });

      // Extract text content and files
      // Skills API returns: server_tool_use, bash_code_execution_tool_result, text_editor_code_execution_tool_result
      // Files copied to $OUTPUT_DIR have file_ids in bash_code_execution_tool_result blocks
      const textParts: string[] = [];
      const files: GeneratedFile[] = [];
      const seenFileIds = new Set<string>();

      // Debug: Log the full response structure
      console.log(`[Anthropic Skills] Response content blocks: ${response.content.length}`);
      console.log(`[Anthropic Skills] Block types: ${response.content.map((b: { type: string }) => b.type).join(', ')}`);

      for (const block of response.content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        }

        // Check bash_code_execution_tool_result blocks - this is where files from Skills are
        if (block.type === 'bash_code_execution_tool_result') {
          const blockData = block as unknown as Record<string, unknown>;
          console.log(`[Anthropic Skills] Found bash_code_execution_tool_result:`, JSON.stringify(blockData).slice(0, 1500));

          // Check content for file information
          const content = blockData.content as Record<string, unknown> | undefined;
          if (content) {
            console.log(`[Anthropic Skills] bash_code_execution content type:`, content.type);

            // Files might be in content.content array
            if ('content' in content && Array.isArray(content.content)) {
              for (const item of content.content) {
                if (item && typeof item === 'object') {
                  const fileItem = item as Record<string, unknown>;
                  if ('file_id' in fileItem && !seenFileIds.has(String(fileItem.file_id))) {
                    seenFileIds.add(String(fileItem.file_id));
                    files.push({
                      file_id: String(fileItem.file_id),
                      filename: fileItem.filename ? String(fileItem.filename) : 'document',
                      mime_type: fileItem.mime_type ? String(fileItem.mime_type) : 'application/octet-stream',
                    });
                    console.log(`[Anthropic Skills] Extracted file from bash result: ${fileItem.file_id}`);
                  }
                }
              }
            }

            // Also check if file_id is directly on content
            if ('file_id' in content && !seenFileIds.has(String(content.file_id))) {
              seenFileIds.add(String(content.file_id));
              files.push({
                file_id: String(content.file_id),
                filename: content.filename ? String(content.filename) : 'document',
                mime_type: content.mime_type ? String(content.mime_type) : 'application/octet-stream',
              });
              console.log(`[Anthropic Skills] Extracted file directly from bash content: ${content.file_id}`);
            }
          }
        }

        // Check text_editor_code_execution_tool_result blocks
        if (block.type === 'text_editor_code_execution_tool_result') {
          const blockData = block as unknown as Record<string, unknown>;
          const content = blockData.content as Record<string, unknown> | undefined;
          if (content && 'file_id' in content && !seenFileIds.has(String(content.file_id))) {
            seenFileIds.add(String(content.file_id));
            files.push({
              file_id: String(content.file_id),
              filename: content.filename ? String(content.filename) : 'document',
              mime_type: content.mime_type ? String(content.mime_type) : 'application/octet-stream',
            });
            console.log(`[Anthropic Skills] Extracted file from text_editor result: ${content.file_id}`);
          }
        }

        // Check for server_tool_use blocks (log for debugging)
        if (block.type === 'server_tool_use') {
          const blockData = block as unknown as Record<string, unknown>;
          console.log(`[Anthropic Skills] Found server_tool_use, name:`, blockData.name);
        }
      }

      // Check container for files
      const containerId = response.container?.id;
      if (response.container && 'files' in response.container) {
        const containerFiles = response.container.files as Array<{
          file_id?: string;
          id?: string;
          filename?: string;
          name?: string;
          mime_type?: string;
        }>;
        if (Array.isArray(containerFiles)) {
          for (const file of containerFiles) {
            const fileId = file.file_id || file.id;
            if (fileId && !seenFileIds.has(String(fileId))) {
              seenFileIds.add(String(fileId));
              files.push({
                file_id: String(fileId),
                filename: file.filename || file.name || 'document',
                mime_type: file.mime_type || 'application/octet-stream',
              });
            }
          }
        }
      }

      console.log(`[Anthropic Skills] Completion successful. Files generated: ${files.length}`, files.map(f => f.filename));

      return {
        text: textParts.join('\n'),
        model,
        files: files.length > 0 ? files : undefined,
        containerId,
      };
    } catch (error) {
      if (handleRateLimitError(error) && attempt < maxRetries - 1) {
        console.log(`[Anthropic Skills] Rate limited on attempt ${attempt + 1}, retrying...`);
        continue;
      }

      console.error('[Anthropic Skills] Completion error:', error);
      throw error;
    }
  }

  throw new Error('All API keys exhausted while generating document');
}

/**
 * Download a file from Anthropic's Files API
 * Returns the file as an ArrayBuffer
 */
export async function downloadAnthropicFile(fileId: string): Promise<{
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
}> {
  initializeApiKeys();
  const client = getAnthropicClient();

  try {
    // First get file metadata
    const metadata = await client.beta.files.retrieveMetadata(fileId, {
      betas: [FILES_BETA_HEADER],
    });

    // Then download the file
    const response = await client.beta.files.download(fileId, {
      betas: [FILES_BETA_HEADER],
    });

    const data = await response.arrayBuffer();

    console.log(`[Anthropic Files] Downloaded file: ${metadata.filename} (${metadata.size_bytes} bytes)`);

    return {
      data,
      filename: metadata.filename,
      mimeType: metadata.mime_type,
    };
  } catch (error) {
    console.error('[Anthropic Files] Download error:', error);
    throw error;
  }
}

/**
 * Check if Skills are available for use
 * Returns true if we have API keys configured
 */
export function isSkillsAvailable(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}
