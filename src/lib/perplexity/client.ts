/**
 * PERPLEXITY API CLIENT
 *
 * PURPOSE:
 * - Provide accurate real-time web search
 * - Used for time, weather, news, prices, and current events
 * - Primary search provider (no Anthropic native search fallback)
 *
 * FEATURES:
 * - Dual-pool round-robin API key system (same as Anthropic)
 * - Dynamic key detection (PERPLEXITY_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (PERPLEXITY_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 * - Real-time web search with citations
 */

// Perplexity API endpoint
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Models available
// sonar: Fast, good for simple lookups
// sonar-pro: Most accurate, best for complex queries (RECOMMENDED)
const DEFAULT_MODEL = 'sonar-pro';

/**
 * Extract readable domain name from URL
 * e.g., "https://www.bbc.com/news/article" -> "bbc.com"
 */
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Source';
  }
}

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (PERPLEXITY_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (PERPLEXITY_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single PERPLEXITY_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface ApiKeyState {
  key: string;
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
 * Initialize all available Perplexity API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeApiKeys(): void {
  if (initialized) return;
  initialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  let i = 1;
  while (true) {
    const key = process.env[`PERPLEXITY_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    primaryPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
    });
    i++;
  }

  // If no numbered keys found, fall back to single PERPLEXITY_API_KEY
  if (primaryPool.length === 0) {
    const singleKey = process.env.PERPLEXITY_API_KEY;
    if (singleKey) {
      primaryPool.push({
        key: singleKey,
        rateLimitedUntil: 0,
        pool: 'primary',
        index: 0,
      });
    }
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`PERPLEXITY_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    fallbackPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = primaryPool.length + fallbackPool.length;
  if (totalKeys > 0) {
    console.log(`[Perplexity] Initialized dual-pool system (dynamic detection):`);
    console.log(`[Perplexity]   Primary pool: ${primaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[Perplexity]   Fallback pool: ${fallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key from the primary pool (round-robin)
 * Returns null if all primary keys are rate limited
 */
function getPrimaryKey(): string | null {
  const now = Date.now();

  // Round-robin through primary pool
  for (let i = 0; i < primaryPool.length; i++) {
    const keyIndex = (primaryKeyIndex + i) % primaryPool.length;
    const keyState = primaryPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      // Advance round-robin for next request (load distribution)
      primaryKeyIndex = (keyIndex + 1) % primaryPool.length;
      return keyState.key;
    }
  }

  return null; // All primary keys are rate limited
}

/**
 * Get an available key from the fallback pool
 * Returns null if all fallback keys are rate limited
 */
function getFallbackKey(): string | null {
  if (fallbackPool.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < fallbackPool.length; i++) {
    const keyIndex = (fallbackKeyIndex + i) % fallbackPool.length;
    const keyState = fallbackPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      fallbackKeyIndex = (keyIndex + 1) % fallbackPool.length;
      console.log(`[Perplexity] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
      return keyState.key;
    }
  }

  return null; // All fallback keys are also rate limited
}

/**
 * Get the next available Perplexity API key
 * Priority: Primary pool (round-robin) → Fallback pool → Wait for soonest available
 */
function getApiKey(): string | null {
  initializeApiKeys();

  // No keys configured at all
  if (primaryPool.length === 0 && fallbackPool.length === 0) {
    return null;
  }

  // Try primary pool first (round-robin for load distribution)
  const primaryKey = getPrimaryKey();
  if (primaryKey) {
    return primaryKey;
  }

  // Primary pool exhausted - try fallback pool
  const fallbackKey = getFallbackKey();
  if (fallbackKey) {
    return fallbackKey;
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
  console.log(`[Perplexity] All ${allKeys.length} keys rate limited. Using ${soonestKey.pool} key ${soonestKey.index} (available in ${waitTime}s)`);

  return soonestKey.key;
}

/**
 * Mark a specific API key as rate limited
 */
function markKeyRateLimited(apiKey: string, retryAfterSeconds: number = 60): void {
  const allKeys = [...primaryPool, ...fallbackPool];
  const keyState = allKeys.find(k => k.key === apiKey);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[Perplexity] ${keyState.pool.toUpperCase()} key ${keyState.index} rate limited for ${retryAfterSeconds}s`);

    // Log pool status
    const now = Date.now();
    const availablePrimary = primaryPool.filter(k => k.rateLimitedUntil <= now).length;
    const availableFallback = fallbackPool.filter(k => k.rateLimitedUntil <= now).length;
    console.log(`[Perplexity] Pool status: ${availablePrimary}/${primaryPool.length} primary, ${availableFallback}/${fallbackPool.length} fallback available`);
  }
}

/**
 * Get total number of API keys configured
 */
function getTotalKeyCount(): number {
  initializeApiKeys();
  return primaryPool.length + fallbackPool.length;
}

/**
 * Check if Perplexity is configured (has at least one API key)
 */
export function isPerplexityConfigured(): boolean {
  initializeApiKeys();
  return primaryPool.length > 0 || fallbackPool.length > 0;
}

/**
 * Get stats about API key usage
 */
export function getPerplexityKeyStats(): {
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

export interface PerplexitySearchResult {
  answer: string;
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  model: string;
}

export interface PerplexityOptions {
  query: string;
  model?: string;
  systemPrompt?: string;
}

/**
 * Search using Perplexity API
 * Returns accurate real-time information with sources
 * Automatically retries with different API keys on rate limit
 */
export async function perplexitySearch(options: PerplexityOptions): Promise<PerplexitySearchResult> {
  initializeApiKeys();

  if (!isPerplexityConfigured()) {
    throw new Error('PERPLEXITY_API_KEY is not configured. Set PERPLEXITY_API_KEY or PERPLEXITY_API_KEY_1, _2, etc.');
  }

  const model = options.model || DEFAULT_MODEL;

  // System prompt optimized for accurate, concise answers
  // IMPORTANT: Avoid em dashes (—) and use simple formatting
  const systemPrompt = options.systemPrompt || `You are a precise search assistant providing accurate, real-time information.

FORMATTING RULES:
- Use simple punctuation: commas, periods, colons. NO em dashes (—) or en dashes (–).
- Use hyphens (-) only for compound words.
- Keep sentences short and direct.

CONTENT RULES:
1. TIME: Return EXACT current time with timezone (e.g., "2:45 PM CST").
2. WEATHER: Current temp, conditions, forecast. Include "as of [time]".
3. NEWS: Include publication date/time for EVERY news item (e.g., "Published: Dec 8, 2024 at 3:30 PM").
4. PRICES: Current price with timestamp and source.
5. FACTS: Include when information was last updated if available.

ALWAYS:
- Answer the question directly first
- Include timestamps for time-sensitive info
- Cite your sources with full URLs`;

  // Retry up to the number of available API keys
  const maxRetries = Math.max(1, getTotalKeyCount());
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getApiKey();

    if (!apiKey) {
      throw new Error('No Perplexity API keys available');
    }

    try {
      console.log(`[Perplexity] Searching for: ${options.query} (attempt ${attempt + 1}/${maxRetries})`);

      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: options.query,
            },
          ],
          // Note: Removed search_recency_filter - it was set to 'day' which excluded
          // valid results for queries about established facts (store locations, etc.)
          // The filter is too restrictive for general search queries
          return_citations: true,
          return_related_questions: false,
        }),
      });

      // Check for rate limit
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        console.log(`[Perplexity] Rate limited (429), marking key and retrying...`);
        markKeyRateLimited(apiKey, retryAfter);
        continue; // Try next key
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Perplexity] API error:', response.status, errorText);

        // For 5xx errors, try next key
        if (response.status >= 500) {
          lastError = new Error(`Perplexity API error: ${response.status}`);
          continue;
        }

        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract the answer
      const answer = data.choices?.[0]?.message?.content || 'No answer found';

      // Extract citations/sources from multiple possible locations
      const sources: Array<{ title: string; url: string; snippet?: string }> = [];

      // Method 1: Check data.citations (standard location)
      if (data.citations && Array.isArray(data.citations)) {
        console.log('[Perplexity] Found citations in data.citations:', data.citations.length);
        for (const citation of data.citations) {
          if (citation.url && citation.url.startsWith('http')) {
            sources.push({
              title: citation.title || extractDomainFromUrl(citation.url),
              url: citation.url,
              snippet: citation.snippet,
            });
          }
        }
      }

      // Method 2: Check choices[0].message.citations
      const messageCitations = data.choices?.[0]?.message?.citations;
      if (messageCitations && Array.isArray(messageCitations)) {
        console.log('[Perplexity] Found citations in message.citations:', messageCitations.length);
        for (const citation of messageCitations) {
          const url = typeof citation === 'string' ? citation : citation.url;
          if (url && url.startsWith('http') && !sources.some(s => s.url === url)) {
            sources.push({
              title: typeof citation === 'object' ? (citation.title || extractDomainFromUrl(url)) : extractDomainFromUrl(url),
              url: url,
            });
          }
        }
      }

      // Method 3: Extract URLs from the answer text if no citations found
      if (sources.length === 0) {
        console.log('[Perplexity] No citations array found, extracting URLs from answer text');
        const urlRegex = /https?:\/\/[^\s\])"'<>]+/g;
        const foundUrls: string[] = answer.match(urlRegex) || [];
        const uniqueUrls: string[] = [...new Set(foundUrls)];
        for (const url of uniqueUrls.slice(0, 10)) {
          if (url.startsWith('http')) {
            sources.push({
              title: extractDomainFromUrl(url),
              url: url.replace(/[.,;:!?)]+$/, ''), // Clean trailing punctuation
            });
          }
        }
      }

      console.log(`[Perplexity] Search complete. Found ${sources.length} sources:`, sources.map(s => s.url).join(', '));

      return {
        answer,
        sources,
        model,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this might be a rate limit error from the error message
      if (lastError.message.toLowerCase().includes('rate limit')) {
        markKeyRateLimited(apiKey, 60);
        if (attempt < maxRetries - 1) {
          console.log(`[Perplexity] Rate limited on attempt ${attempt + 1}, retrying with different key...`);
          continue;
        }
      }

      // For other errors on last attempt, throw
      if (attempt === maxRetries - 1) {
        console.error('[Perplexity] Search error (all retries exhausted):', lastError);
        throw lastError;
      }

      console.error(`[Perplexity] Search error on attempt ${attempt + 1}, retrying:`, lastError.message);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('All Perplexity API keys exhausted');
}

/**
 * Search for current time in a location
 */
export async function searchCurrentTime(location: string): Promise<PerplexitySearchResult> {
  return perplexitySearch({
    query: `What is the current time and date in ${location}? Include the timezone.`,
    systemPrompt: `Return the EXACT current time, date, and day of week for the requested location. Format: "The current time in [Location] is [Time] [Timezone] on [Day], [Date]." Include the source.`,
  });
}

/**
 * Search for current weather in a location
 */
export async function searchWeather(location: string): Promise<PerplexitySearchResult> {
  return perplexitySearch({
    query: `What is the current weather in ${location}? Include temperature, conditions, and forecast.`,
    systemPrompt: `Return the current weather conditions for the requested location. Include: temperature (Fahrenheit), conditions (sunny, cloudy, etc.), wind, and brief forecast. Format concisely. Include the source.`,
  });
}

/**
 * Search for latest news
 */
export async function searchNews(topic?: string): Promise<PerplexitySearchResult> {
  const query = topic
    ? `What are the latest news headlines about ${topic}?`
    : `What are the top breaking news headlines today?`;

  return perplexitySearch({
    query,
    systemPrompt: `Return the top 3-5 latest news headlines. Include the date and source for each. Be concise.`,
  });
}

/**
 * General web search
 */
export async function searchWeb(query: string): Promise<PerplexitySearchResult> {
  return perplexitySearch({ query });
}
