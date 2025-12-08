/**
 * PERPLEXITY API CLIENT
 *
 * PURPOSE:
 * - Provide accurate real-time web search
 * - Used for time, weather, news, prices, and current events
 * - More reliable than Anthropic's native web search for real-time data
 *
 * FEATURES:
 * - Real-time web search with citations
 * - Accurate time/date/weather data
 * - Returns structured results with sources
 */

// Perplexity API endpoint
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Models available
// sonar-small: Fast, cheaper, good for simple queries
// sonar-medium: Balanced speed/quality
// sonar-pro: Most accurate, best for complex queries
const DEFAULT_MODEL = 'sonar';

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
 * Get Perplexity API key
 */
function getPerplexityApiKey(): string | null {
  return process.env.PERPLEXITY_API_KEY || null;
}

/**
 * Check if Perplexity is configured
 */
export function isPerplexityConfigured(): boolean {
  return !!getPerplexityApiKey();
}

/**
 * Search using Perplexity API
 * Returns accurate real-time information with sources
 */
export async function perplexitySearch(options: PerplexityOptions): Promise<PerplexitySearchResult> {
  const apiKey = getPerplexityApiKey();

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY is not configured');
  }

  const model = options.model || DEFAULT_MODEL;

  // System prompt optimized for accurate, concise answers
  const systemPrompt = options.systemPrompt || `You are a precise search assistant. Your job is to provide accurate, real-time information.

CRITICAL RULES:
1. For time queries: Return the EXACT current time from your search results. Include timezone.
2. For weather: Return current conditions with temperature, description, and forecast.
3. For news: Return the latest headlines with dates.
4. For prices: Return current prices with source.
5. ALWAYS include the source/citation for your information.
6. Be CONCISE - answer directly without unnecessary preamble.
7. If you cannot find current information, say so clearly.

FORMAT:
- Answer the question directly first
- Include relevant details (time, temp, etc.)
- List sources at the end`;

  try {
    console.log('[Perplexity] Searching for:', options.query);

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
        // Enable web search
        search_recency_filter: 'day', // Prefer recent results
        return_citations: true,
        return_related_questions: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Perplexity] API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract the answer
    const answer = data.choices?.[0]?.message?.content || 'No answer found';

    // Extract citations/sources
    const sources: Array<{ title: string; url: string; snippet?: string }> = [];

    if (data.citations && Array.isArray(data.citations)) {
      for (const citation of data.citations) {
        sources.push({
          title: citation.title || citation.url || 'Source',
          url: citation.url || '',
          snippet: citation.snippet,
        });
      }
    }

    console.log(`[Perplexity] Search complete. Found ${sources.length} sources.`);

    return {
      answer,
      sources,
      model,
    };
  } catch (error) {
    console.error('[Perplexity] Search error:', error);
    throw error;
  }
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
