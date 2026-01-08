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

import { logger } from '@/lib/logger';

const log = logger('BraveSearch');

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

  if (!apiKey) {
    log.warn('API key not configured');
    return {
      results: [],
      query,
    };
  }

  const count = options?.count || 10;
  const safesearch = options?.safesearch || 'moderate';

  // Build query parameters
  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    safesearch,
  });

  // Add freshness filter if specified
  if (options?.freshness) {
    params.append('freshness', options.freshness);
  }

  try {
    log.debug('Searching', { query: query.substring(0, 100) });

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
      log.error('API error', { status: response.status, error: errorText.substring(0, 200) });
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

    log.info('Search complete', { resultCount: results.length });

    return {
      results,
      query: data.query.altered || data.query.original,
      totalResults: data.web?.total,
    };
  } catch (error) {
    log.error('Search error', error as Error);
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
    log.warn('API key not configured');
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
    log.debug('News search', { query: query.substring(0, 100) });

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
      log.error('News API error', { status: response.status });
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

    log.info('News search complete', { resultCount: results.length });

    return {
      results,
      query: data.query.altered || data.query.original,
    };
  } catch (error) {
    log.error('News search error', error as Error);
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
