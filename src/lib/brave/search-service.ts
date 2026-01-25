/**
 * BRAVE SEARCH SERVICE
 *
 * High-level search service that:
 * 1. Optimizes queries for better results
 * 2. Performs Brave Search with appropriate parameters
 * 3. Synthesizes results using Claude/xAI with fallback
 *
 * Replaces Perplexity with a more powerful, cost-effective solution.
 */

import {
  intelligentSearch,
  formatResultsForSynthesis,
  isBraveConfigured,
  type BraveSearchOptions,
  type BraveSearchResponse,
} from './client';
import { completeChat } from '@/lib/ai/chat-router';
import type { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';

const log = logger('BraveSearchService');

// ============================================================================
// TYPES
// ============================================================================

export interface SearchRequest {
  /** User's original query */
  query: string;
  /** Search mode */
  mode?: 'search' | 'factcheck' | 'news' | 'local' | 'realtime';
  /** Optional system prompt override */
  systemPrompt?: string;
  /** User's location for local searches */
  location?: {
    latitude: number;
    longitude: number;
  };
  /** Freshness preference */
  freshness?: 'pd' | 'pw' | 'pm' | 'py';
  /** Country code */
  country?: string;
  /** Skip AI synthesis, return raw results */
  rawResults?: boolean;
}

export interface SearchResult {
  /** Synthesized answer from AI */
  answer: string;
  /** Model used for synthesis */
  model: string;
  /** Provider used (claude or xai) */
  provider: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Source URLs */
  sources: Array<{
    title: string;
    url: string;
  }>;
  /** Rich data if available (weather, stocks, etc.) */
  richData?: {
    type: string;
    data: Record<string, unknown>;
  };
  /** Raw search response (if requested) */
  rawResponse?: BraveSearchResponse;
}

// ============================================================================
// QUERY INTENT DETECTION
// ============================================================================

interface QueryIntent {
  type: 'weather' | 'stock' | 'crypto' | 'sports' | 'news' | 'local' | 'factcheck' | 'general';
  freshness?: 'pd' | 'pw' | 'pm' | 'py';
  enableRichData: boolean;
  needsLocation: boolean;
}

/**
 * Detect the intent of a search query to optimize parameters
 */
function detectQueryIntent(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase();

  // Weather queries
  if (
    /weather|forecast|temperature|rain|snow|sunny|cloudy/i.test(lowerQuery) &&
    /in |at |for |today|tomorrow|this week/i.test(lowerQuery)
  ) {
    return { type: 'weather', enableRichData: true, needsLocation: false };
  }

  // Stock queries
  if (
    /stock|share price|market cap|\$[A-Z]{1,5}\b|nasdaq|nyse|s&p/i.test(lowerQuery) ||
    /\b(AAPL|GOOGL|MSFT|AMZN|TSLA|META|NVDA)\b/i.test(query)
  ) {
    return { type: 'stock', enableRichData: true, needsLocation: false };
  }

  // Crypto queries
  if (
    /bitcoin|ethereum|crypto|btc|eth|cryptocurrency|dogecoin|solana/i.test(lowerQuery) &&
    /price|value|worth|cost/i.test(lowerQuery)
  ) {
    return { type: 'crypto', enableRichData: true, needsLocation: false };
  }

  // Sports queries
  if (
    /score|game|match|nfl|nba|mlb|nhl|soccer|football|basketball|baseball/i.test(lowerQuery) &&
    /today|yesterday|last night|this week|schedule/i.test(lowerQuery)
  ) {
    return { type: 'sports', freshness: 'pd', enableRichData: true, needsLocation: false };
  }

  // News queries
  if (
    /news|latest|recent|breaking|update|announced|happened/i.test(lowerQuery) ||
    /today|yesterday|this week/i.test(lowerQuery)
  ) {
    return { type: 'news', freshness: 'pw', enableRichData: false, needsLocation: false };
  }

  // Local queries
  if (
    /near me|nearby|closest|local|in my area|around here/i.test(lowerQuery) ||
    /restaurant|cafe|store|shop|gym|hotel|bar|club/i.test(lowerQuery)
  ) {
    return { type: 'local', enableRichData: false, needsLocation: true };
  }

  // Fact check queries
  if (/is it true|fact check|verify|accurate|real or fake|debunk/i.test(lowerQuery)) {
    return { type: 'factcheck', enableRichData: false, needsLocation: false };
  }

  // General query
  return { type: 'general', enableRichData: true, needsLocation: false };
}

// ============================================================================
// SYNTHESIS PROMPTS
// ============================================================================

function getSynthesisPrompt(mode: string, query: string): string {
  switch (mode) {
    case 'factcheck':
      return `You are a fact-checker. Based on the search results below, verify the following claim or question.

CLAIM/QUESTION: "${query}"

Provide your assessment as:
1. **VERDICT**: TRUE, FALSE, PARTIALLY TRUE, MISLEADING, or UNVERIFIABLE
2. **EXPLANATION**: Brief explanation of your verdict
3. **KEY EVIDENCE**: Cite specific sources that support your verdict

Be objective and cite sources.`;

    case 'news':
      return `You are a news analyst. Based on the search results below, provide a comprehensive summary of recent news about:

TOPIC: "${query}"

Structure your response as:
1. **Key Headlines**: The most important recent developments
2. **Summary**: A concise overview of the current situation
3. **Context**: Any relevant background information
4. **Sources**: List the main sources

Be factual and objective. Cite sources.`;

    case 'local':
      return `You are a local guide. Based on the search results and business information below, help the user find:

LOOKING FOR: "${query}"

Provide:
1. **Top Recommendations**: Best options with key details (rating, price, distance)
2. **Why These?**: Brief explanation of why you recommend each
3. **Practical Info**: Hours, contact info, any tips

Be helpful and specific.`;

    case 'weather':
      return `Based on the weather data below, provide a helpful weather summary for:

QUERY: "${query}"

Include:
- Current conditions
- What to expect (temperature, precipitation)
- Any recommendations (what to wear, umbrella needed, etc.)

Be concise and practical.`;

    case 'stock':
    case 'crypto':
      return `Based on the market data below, provide a clear summary for:

QUERY: "${query}"

Include:
- Current price and recent change
- Brief context (up/down trend, notable movements)
- Any relevant market context

Be factual. This is not financial advice.`;

    default:
      return `Based on the search results below, provide a comprehensive and accurate answer to:

QUESTION: "${query}"

Guidelines:
- Be accurate and cite sources
- Organize information clearly
- Include relevant details
- Mention if information is uncertain or conflicting

Provide a helpful, well-structured response.`;
  }
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

/**
 * Perform an intelligent search with AI synthesis
 */
export async function search(request: SearchRequest): Promise<SearchResult> {
  const {
    query,
    mode = 'search',
    systemPrompt,
    location,
    freshness,
    country = 'us',
    rawResults = false,
  } = request;

  if (!isBraveConfigured()) {
    throw new Error('Brave Search is not configured. Set BRAVE_SEARCH_API_KEY.');
  }

  log.info('Starting search', { query, mode });

  // Detect query intent
  const intent = detectQueryIntent(query);
  log.debug('Query intent detected', { intent });

  // Build search options
  const searchOptions: BraveSearchOptions = {
    query,
    count: intent.type === 'weather' || intent.type === 'stock' ? 5 : 10,
    freshness: freshness || intent.freshness,
    country,
    enableRichData: intent.enableRichData,
    extraSnippets: true,
  };

  // Add location if available and needed
  if (location && intent.needsLocation) {
    searchOptions.latitude = location.latitude;
    searchOptions.longitude = location.longitude;
  }

  // Perform the search
  const searchResponse = await intelligentSearch({
    ...searchOptions,
    enrichLocations: intent.type === 'local',
  });

  log.info('Search completed', {
    webResults: searchResponse.webResults.length,
    locationResults: searchResponse.locationResults.length,
    hasRichData: !!searchResponse.richData,
  });

  // If raw results requested, return without synthesis
  if (rawResults) {
    return {
      answer: formatResultsForSynthesis(searchResponse),
      model: 'none',
      provider: 'brave',
      usedFallback: false,
      sources: searchResponse.webResults.map((r) => ({
        title: r.title,
        url: r.url,
      })),
      richData: searchResponse.richData
        ? {
            type: searchResponse.richData.subtype,
            data: searchResponse.richData.data,
          }
        : undefined,
      rawResponse: searchResponse,
    };
  }

  // Format results for AI synthesis
  const formattedResults = formatResultsForSynthesis(searchResponse);

  // Determine synthesis prompt
  const synthesisMode = mode === 'factcheck' ? 'factcheck' : intent.type;
  const basePrompt = systemPrompt || getSynthesisPrompt(synthesisMode, query);

  // Synthesize with Claude/xAI (with fallback)
  const synthesisMessages: CoreMessage[] = [
    {
      role: 'user',
      content: `${basePrompt}\n\n---\n\nSEARCH RESULTS:\n\n${formattedResults}`,
    },
  ];

  log.info('Synthesizing results with AI');

  const synthesisResult = await completeChat(synthesisMessages, {
    model: 'claude-sonnet-4-5-20250929', // Use Sonnet for better synthesis
    maxTokens: 2048,
    temperature: 0.3, // Lower temperature for factual responses
  });

  log.info('Synthesis complete', {
    provider: synthesisResult.providerId,
    model: synthesisResult.model,
    usedFallback: synthesisResult.usedFallback,
  });

  return {
    answer: synthesisResult.text,
    model: synthesisResult.model,
    provider: synthesisResult.providerId,
    usedFallback: synthesisResult.usedFallback,
    sources: searchResponse.webResults.slice(0, 5).map((r) => ({
      title: r.title,
      url: r.url,
    })),
    richData: searchResponse.richData
      ? {
          type: searchResponse.richData.subtype,
          data: searchResponse.richData.data,
        }
      : undefined,
  };
}

/**
 * Quick fact check
 */
export async function factCheck(claim: string): Promise<SearchResult> {
  return search({
    query: `Fact check: ${claim}`,
    mode: 'factcheck',
  });
}

/**
 * Search recent news
 */
export async function searchNews(
  topic: string,
  freshness: 'pd' | 'pw' | 'pm' = 'pw'
): Promise<SearchResult> {
  return search({
    query: topic,
    mode: 'news',
    freshness,
  });
}

/**
 * Search local businesses
 */
export async function searchLocalBusinesses(
  query: string,
  latitude: number,
  longitude: number
): Promise<SearchResult> {
  return search({
    query,
    mode: 'local',
    location: { latitude, longitude },
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isBraveConfigured, detectQueryIntent, getSynthesisPrompt };

const braveSearchService = {
  search,
  factCheck,
  searchNews,
  searchLocalBusinesses,
  isBraveConfigured,
};

export default braveSearchService;
