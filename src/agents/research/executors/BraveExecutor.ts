/**
 * BRAVE SEARCH EXECUTOR
 *
 * Executes searches using Brave Search API with intelligent query optimization.
 * Replaces PerplexityExecutor with more powerful, cost-effective solution.
 *
 * Key Features:
 * - Up to 20 parallel searches (vs Perplexity's practical limit)
 * - Rich data integration (weather, stocks, sports, crypto)
 * - Extra snippets for comprehensive context
 * - Freshness filtering for time-sensitive queries
 * - AI synthesis with Claude/xAI fallback
 * - ~$5/1000 queries vs Perplexity's higher cost
 */

import {
  braveWebSearch,
  isBraveConfigured,
  formatResultsForSynthesis,
  type BraveSearchResponse,
} from '@/lib/brave/client';
import { completeChat } from '@/lib/ai/chat-router';
import { GeneratedQuery, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';
import type { CoreMessage } from 'ai';

const log = logger('BraveExecutor');

// Query intent detection for optimization
interface QueryIntent {
  type: 'weather' | 'stock' | 'crypto' | 'sports' | 'news' | 'local' | 'general';
  freshness?: 'pd' | 'pw' | 'pm' | 'py';
  enableRichData: boolean;
}

export class BraveExecutor {
  /**
   * Check if Brave Search is available
   */
  isAvailable(): boolean {
    return isBraveConfigured();
  }

  /**
   * Detect query intent for optimal search parameters
   */
  private detectIntent(query: string): QueryIntent {
    const lower = query.toLowerCase();

    // Weather queries
    if (/weather|forecast|temperature|rain|snow|sunny|cloudy/i.test(lower)) {
      return { type: 'weather', enableRichData: true };
    }

    // Stock queries
    if (/stock|share price|market cap|\$[A-Z]{1,5}\b|nasdaq|nyse|s&p/i.test(lower)) {
      return { type: 'stock', enableRichData: true };
    }

    // Crypto queries
    if (/bitcoin|ethereum|crypto|btc|eth|cryptocurrency|dogecoin|solana/i.test(lower)) {
      return { type: 'crypto', enableRichData: true };
    }

    // Sports queries
    if (/score|game|match|nfl|nba|mlb|nhl|soccer|football|basketball/i.test(lower)) {
      return { type: 'sports', freshness: 'pd', enableRichData: true };
    }

    // News queries
    if (/news|latest|recent|breaking|update|announced|today|yesterday/i.test(lower)) {
      return { type: 'news', freshness: 'pw', enableRichData: false };
    }

    // Local queries
    if (/near me|nearby|closest|local|restaurant|store|shop/i.test(lower)) {
      return { type: 'local', enableRichData: false };
    }

    // General - enable rich data to catch anything useful
    return { type: 'general', enableRichData: true };
  }

  /**
   * Execute a single search query using Brave Search with AI synthesis
   */
  async execute(query: GeneratedQuery): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      if (!this.isAvailable()) {
        return {
          id: `brave_unavailable_${Date.now()}`,
          query: query.query,
          source: 'brave',
          content: 'Brave Search is not configured. Set BRAVE_SEARCH_API_KEY.',
          timestamp: Date.now(),
          relevanceScore: 0,
        };
      }

      log.debug('Executing Brave search', { query: query.query, purpose: query.purpose });

      // Detect intent for optimal parameters
      const intent = this.detectIntent(query.query);

      // Enhance query for better results
      const enhancedQuery = this.enhanceQuery(query.query);

      // Execute Brave search with optimized parameters
      const searchResponse = await braveWebSearch({
        query: enhancedQuery,
        count: 10, // Get 10 results per query
        freshness: intent.freshness,
        extraSnippets: true, // Get up to 5 extra snippets per result
        enableRichData: intent.enableRichData,
        country: 'us',
        safeSearch: 'moderate',
      });

      log.debug('Brave search complete', {
        webResults: searchResponse.webResults.length,
        hasRichData: !!searchResponse.richData,
        hasFaq: !!searchResponse.faq?.length,
      });

      // Format results for AI synthesis
      const formattedResults = formatResultsForSynthesis(searchResponse);

      // Synthesize with AI for concise, relevant answer
      const synthesizedContent = await this.synthesizeResult(
        query,
        formattedResults,
        searchResponse
      );

      const executionTime = Date.now() - startTime;
      log.debug('Search synthesis complete', { executionTime, queryId: query.id });

      return {
        id: `brave_${query.id}_${Date.now()}`,
        query: query.query,
        source: 'brave',
        content: synthesizedContent,
        url: searchResponse.webResults[0]?.url,
        title: `Brave Research: ${query.query.substring(0, 50)}...`,
        timestamp: Date.now(),
        relevanceScore: this.calculateRelevance(synthesizedContent, query, searchResponse),
        // Store raw response for rich data access
        metadata: {
          webResultCount: searchResponse.webResults.length,
          hasRichData: !!searchResponse.richData,
          richDataType: searchResponse.richData?.subtype,
          executionTime,
        },
      };
    } catch (error) {
      log.error('Brave search error', { error, query: query.query });

      return {
        id: `brave_error_${Date.now()}`,
        query: query.query,
        source: 'brave',
        content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        relevanceScore: 0,
      };
    }
  }

  /**
   * Synthesize search results into a concise, relevant answer
   * Uses Claude with xAI fallback
   */
  private async synthesizeResult(
    query: GeneratedQuery,
    formattedResults: string,
    searchResponse: BraveSearchResponse
  ): Promise<string> {
    // Build synthesis prompt optimized for research
    const synthesisPrompt = `You are a research analyst. Extract the most relevant information to answer this research query.

RESEARCH QUERY: "${query.query}"
PURPOSE: ${query.purpose}
EXPECTED INFO: ${query.expectedInfo.join(', ')}

SEARCH RESULTS:
${formattedResults}

${searchResponse.richData ? `\nRICH DATA (${searchResponse.richData.subtype}): ${JSON.stringify(searchResponse.richData.data)}` : ''}

INSTRUCTIONS:
1. Extract the KEY FACTS that directly answer the query
2. Include specific numbers, dates, and data points when available
3. Be concise - aim for 2-4 sentences
4. If the results don't fully answer the query, note what's missing
5. Prioritize the most recent and authoritative sources

Provide a concise, factual answer:`;

    const messages: CoreMessage[] = [{ role: 'user', content: synthesisPrompt }];

    const result = await completeChat(messages, {
      model: 'claude-sonnet-4-5-20250929', // Sonnet for quality synthesis
      maxTokens: 500,
      temperature: 0.3, // Low temperature for factual responses
      systemPrompt: 'You are a research analyst. Be concise, factual, and cite specific data.',
    });

    // Append top sources
    let content = result.text;
    const topSources = searchResponse.webResults.slice(0, 3);
    if (topSources.length > 0) {
      content += '\n\n**Sources:**\n';
      topSources.forEach((source, i) => {
        content += `${i + 1}. [${source.title}](${source.url})\n`;
      });
    }

    return content;
  }

  /**
   * Execute multiple queries in parallel with intelligent batching
   * Can handle up to 20 queries efficiently
   */
  async executeMany(queries: GeneratedQuery[]): Promise<SearchResult[]> {
    if (queries.length === 0) return [];

    log.info('Executing batch search', { queryCount: queries.length });

    // Execute all queries in parallel (Brave handles rate limiting gracefully)
    const BATCH_SIZE = 10; // Process in batches of 10 to avoid overwhelming
    const results: SearchResult[] = [];

    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(batch.map((query) => this.execute(query)));

      results.push(...batchResults);

      // Brief delay between batches if more to come
      if (i + BATCH_SIZE < queries.length) {
        await this.sleep(200);
      }
    }

    log.info('Batch search complete', {
      totalQueries: queries.length,
      successfulResults: results.filter((r) => (r.relevanceScore ?? 0) > 0).length,
    });

    return results;
  }

  /**
   * Enhance query for better search results
   */
  private enhanceQuery(query: string): string {
    let enhanced = query;

    // Add year context for current info if not present
    if (!/\b202[4-6]\b/.test(enhanced)) {
      enhanced += ' 2025';
    }

    return enhanced;
  }

  /**
   * Calculate relevance score based on multiple factors
   */
  private calculateRelevance(
    content: string,
    query: GeneratedQuery,
    response: BraveSearchResponse
  ): number {
    const lowerContent = content.toLowerCase();
    const queryWords = query.query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Word match score
    const matchedWords = queryWords.filter((word) => lowerContent.includes(word));
    const wordScore = queryWords.length > 0 ? matchedWords.length / queryWords.length : 0.5;

    // Expected info match score
    const expectedMatches = query.expectedInfo.filter((info) =>
      lowerContent.includes(info.toLowerCase())
    ).length;
    const expectedScore =
      query.expectedInfo.length > 0 ? expectedMatches / query.expectedInfo.length : 0.5;

    // Result quality score (based on what we found)
    const hasResults = response.webResults.length > 0;
    const hasRichData = !!response.richData;
    const hasFaq = (response.faq?.length || 0) > 0;
    const qualityScore = (hasResults ? 0.5 : 0) + (hasRichData ? 0.3 : 0) + (hasFaq ? 0.2 : 0);

    // Content length score (longer usually means more comprehensive)
    const lengthScore = Math.min(1, content.length / 2000);

    // Weighted combination
    return wordScore * 0.3 + expectedScore * 0.3 + qualityScore * 0.25 + lengthScore * 0.15;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const braveExecutor = new BraveExecutor();
