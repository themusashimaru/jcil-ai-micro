/**
 * BRAVE SEARCH TOOL
 *
 * Wrapper around the existing Brave Search API for the scout tool system.
 */

import { braveWebSearch, type BraveSearchResponse, type BraveWebResult } from '@/lib/brave';
import type { BraveSearchInput, BraveSearchOutput } from './types';
import { logger } from '@/lib/logger';

const log = logger('BraveSearchTool');

/**
 * Execute a Brave web search
 */
export async function searchBrave(input: BraveSearchInput): Promise<BraveSearchOutput> {
  const { query, count = 10 } = input;

  try {
    log.info('Executing Brave search', { query: query.slice(0, 50) });

    const searchResult: BraveSearchResponse = await braveWebSearch({
      query,
      count,
      extraSnippets: true,
    });

    if (!searchResult.webResults?.length) {
      return {
        success: true,
        results: [],
      };
    }

    const results = searchResult.webResults.slice(0, count).map((r: BraveWebResult) => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
      snippet: r.extraSnippets?.join(' ') || '',
    }));

    log.info('Brave search complete', {
      query: query.slice(0, 30),
      resultCount: results.length,
    });

    return {
      success: true,
      results,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Brave search failed', { query, error: errMsg });

    return {
      success: false,
      results: [],
      error: errMsg,
    };
  }
}

/**
 * Format search results for LLM consumption
 */
export function formatSearchResults(output: BraveSearchOutput): string {
  if (!output.success || output.results.length === 0) {
    return output.error || 'No results found';
  }

  return output.results
    .map((r, i) =>
      `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}\n${r.snippet || ''}`.trim()
    )
    .join('\n\n');
}
