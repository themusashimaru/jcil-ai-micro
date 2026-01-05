/**
 * PERPLEXITY SEARCH EXECUTOR
 *
 * Executes searches using Perplexity's sonar-pro model.
 * Best for: deep analysis, comparisons, synthesized insights, complex topics.
 */

import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { GeneratedQuery, SearchResult } from '../../core/types';

export class PerplexityExecutor {
  /**
   * Check if Perplexity is available
   */
  isAvailable(): boolean {
    return isPerplexityConfigured();
  }

  /**
   * Execute a search query using Perplexity
   */
  async execute(query: GeneratedQuery): Promise<SearchResult> {
    try {
      if (!this.isAvailable()) {
        return {
          id: `perplexity_unavailable_${Date.now()}`,
          query: query.query,
          source: 'perplexity',
          content: 'Perplexity is not configured. Skipping this search.',
          timestamp: Date.now(),
          relevanceScore: 0,
        };
      }

      // Use sonar-pro for deep research
      const result = await perplexitySearch({
        query: this.enhanceQuery(query),
        model: 'sonar-pro',
        systemPrompt: `You are an expert research analyst conducting deep research.

RESEARCH CONTEXT:
Purpose: ${query.purpose}
Expected Information: ${query.expectedInfo.join(', ') || 'Comprehensive information'}

INSTRUCTIONS:
1. Provide comprehensive, detailed information
2. Include specific data points, statistics, and figures
3. Cite sources when possible
4. Organize information clearly
5. Highlight key insights and findings
6. Note any conflicting information found
7. Include recent developments (2024-2025)

Be thorough. This is for business intelligence purposes.`,
      });

      // Format content with sources
      let content = result.answer;

      if (result.sources.length > 0) {
        content += '\n\n**Sources:**\n';
        result.sources.forEach((source, i) => {
          content += `${i + 1}. [${source.title}](${source.url})\n`;
        });
      }

      return {
        id: `perplexity_${query.id}_${Date.now()}`,
        query: query.query,
        source: 'perplexity',
        content,
        url: result.sources[0]?.url,
        title: `Perplexity Research: ${query.query.substring(0, 50)}...`,
        timestamp: Date.now(),
        relevanceScore: this.calculateRelevance(result.answer, query),
      };
    } catch (error) {
      console.error('[PerplexityExecutor] Search error:', error);

      return {
        id: `perplexity_error_${Date.now()}`,
        query: query.query,
        source: 'perplexity',
        content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        relevanceScore: 0,
      };
    }
  }

  /**
   * Execute multiple queries with rate limit handling
   */
  async executeMany(queries: GeneratedQuery[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Execute sequentially to respect rate limits
    for (const query of queries) {
      const result = await this.execute(query);
      results.push(result);

      // Brief delay between requests
      await this.sleep(500);
    }

    return results;
  }

  /**
   * Enhance query for better results
   */
  private enhanceQuery(query: GeneratedQuery): string {
    // Add context to the query for better results
    let enhanced = query.query;

    // Add year context if not present
    if (!enhanced.includes('2024') && !enhanced.includes('2025')) {
      enhanced += ' 2024 2025';
    }

    return enhanced;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(content: string, query: GeneratedQuery): number {
    const lowerContent = content.toLowerCase();
    const queryWords = query.query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // Count matched words
    const matchedWords = queryWords.filter(word => lowerContent.includes(word));
    const wordScore = matchedWords.length / queryWords.length;

    // Check for expected info
    const expectedMatches = query.expectedInfo.filter(info =>
      lowerContent.includes(info.toLowerCase())
    ).length;
    const expectedScore = query.expectedInfo.length > 0
      ? expectedMatches / query.expectedInfo.length
      : 0.5;

    // Perplexity usually gives comprehensive answers
    const lengthScore = Math.min(1, content.length / 3000);

    return (wordScore * 0.4) + (expectedScore * 0.4) + (lengthScore * 0.2);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const perplexityExecutor = new PerplexityExecutor();
