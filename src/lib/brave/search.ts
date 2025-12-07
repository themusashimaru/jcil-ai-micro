/**
 * BRAVE SEARCH API CLIENT
 *
 * PURPOSE:
 * - Provide web search functionality via Brave Search API
 * - Used as the search backend when Anthropic is the active provider
 * - Supports text search with result snippets
 *
 * USAGE:
 * - Requires BRAVE_SEARCH_API_KEY environment variable
 * - Returns structured search results with titles, URLs, and descriptions
 */

export interface BraveSearchResult {
  results: Array<{
    title: string;
    url: string;
    description: string;
    content?: string;
    publishedDate?: string;
  }>;
  query: string;
  totalResults?: number;
}

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  extra_snippets?: string[];
  published_date?: string;
  language?: string;
}

interface BraveSearchResponse {
  query: {
    original: string;
    altered?: string;
  };
  web?: {
    results: BraveWebResult[];
    total?: number;
  };
  news?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  };
}

/**
 * Perform a web search using Brave Search API
 */
export async function braveSearch(query: string, options?: {
  count?: number;
  freshness?: 'day' | 'week' | 'month' | 'year';
  safesearch?: 'off' | 'moderate' | 'strict';
}): Promise<BraveSearchResult> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  console.log('[Brave Search] Called with query:', query, 'API key present:', !!apiKey);

  if (!apiKey) {
    console.error('[Brave Search] BRAVE_SEARCH_API_KEY not configured - returning empty results');
    return {
      results: [],
      query,
    };
  }

  const count = options?.count || 10;
  const safesearch = options?.safesearch || 'moderate';
  // Default to 'week' freshness for news-like queries to get recent results
  const freshness = options?.freshness || 'week';

  // Build query parameters - always include freshness to prioritize recent results
  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    safesearch,
    freshness,
  });

  try {
    console.log('[Brave Search] Searching for:', query);

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Brave Search] API error:', response.status, errorText);
      return {
        results: [],
        query,
      };
    }

    const data: BraveSearchResponse = await response.json();

    // Extract web results
    const webResults = data.web?.results || [];

    const results = webResults.map((result): {
      title: string;
      url: string;
      description: string;
      content?: string;
      publishedDate?: string;
    } => ({
      title: result.title,
      url: result.url,
      description: result.description,
      // Combine extra snippets into content if available
      content: result.extra_snippets?.join(' '),
      publishedDate: result.published_date,
    }));

    console.log('[Brave Search] Found', results.length, 'results');

    return {
      results,
      query: data.query.altered || data.query.original,
      totalResults: data.web?.total,
    };
  } catch (error) {
    console.error('[Brave Search] Error:', error);
    return {
      results: [],
      query,
    };
  }
}

/**
 * Perform a news-focused search using Brave Search API
 */
export async function braveNewsSearch(query: string, options?: {
  count?: number;
  freshness?: 'day' | 'week' | 'month';
}): Promise<BraveSearchResult> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    console.warn('[Brave Search] API key not configured');
    return {
      results: [],
      query,
    };
  }

  const count = options?.count || 10;

  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    safesearch: 'moderate',
    // Request news results
    result_filter: 'news',
  });

  if (options?.freshness) {
    params.append('freshness', options.freshness);
  }

  try {
    console.log('[Brave Search] News search for:', query);

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      }
    );

    if (!response.ok) {
      console.error('[Brave Search] News API error:', response.status);
      return {
        results: [],
        query,
      };
    }

    const data: BraveSearchResponse = await response.json();

    // Use news results if available, otherwise fall back to web results
    const newsResults = data.news?.results || [];
    const webResults = data.web?.results || [];

    const results = (newsResults.length > 0 ? newsResults : webResults).map((result) => ({
      title: result.title,
      url: result.url,
      description: result.description,
    }));

    console.log('[Brave Search] News found', results.length, 'results');

    return {
      results,
      query: data.query.altered || data.query.original,
    };
  } catch (error) {
    console.error('[Brave Search] News error:', error);
    return {
      results: [],
      query,
    };
  }
}

/**
 * Check if Brave Search is available (API key configured)
 */
export function isBraveSearchAvailable(): boolean {
  return !!process.env.BRAVE_SEARCH_API_KEY;
}
