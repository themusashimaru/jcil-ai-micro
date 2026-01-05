/**
 * GOOGLE SEARCH EXECUTOR
 *
 * Executes searches using Google's Grounded Search via Gemini.
 * Best for: current facts, news, recent data, local information.
 */

import { GoogleGenAI } from '@google/genai';
import { GeneratedQuery, SearchResult } from '../../core/types';

const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export class GoogleExecutor {
  private model = 'gemini-2.5-pro-preview-05-06';

  /**
   * Execute a search query using Google Grounded Search
   */
  async execute(query: GeneratedQuery): Promise<SearchResult> {
    try {
      // Use Gemini with grounded search tool
      const response = await gemini.models.generateContent({
        model: this.model,
        contents: `Research the following topic and provide comprehensive, factual information with specific data points, statistics, and recent information:

"${query.query}"

Purpose of this search: ${query.purpose}

Provide detailed findings including:
- Specific facts and figures
- Recent developments (2024-2025)
- Key players or entities involved
- Relevant statistics
- Source information when available

Be thorough and specific. Include numbers, dates, and concrete details.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const content = response.text || '';

      // Extract grounding metadata if available
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = groundingMetadata?.groundingChunks?.map((chunk: { web?: { uri?: string; title?: string } }) =>
        chunk.web?.uri
      ).filter(Boolean) || [];

      return {
        id: `google_${query.id}_${Date.now()}`,
        query: query.query,
        source: 'google',
        content,
        url: sources[0] || undefined,
        title: `Google Search: ${query.query.substring(0, 50)}...`,
        timestamp: Date.now(),
        relevanceScore: this.calculateRelevance(content, query),
      };
    } catch (error) {
      console.error('[GoogleExecutor] Search error:', error);

      // Return error result
      return {
        id: `google_error_${Date.now()}`,
        query: query.query,
        source: 'google',
        content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        relevanceScore: 0,
      };
    }
  }

  /**
   * Execute multiple queries in parallel
   */
  async executeMany(queries: GeneratedQuery[]): Promise<SearchResult[]> {
    // Execute in parallel with rate limiting
    const results = await Promise.all(
      queries.map(async (query, index) => {
        // Stagger requests slightly to avoid rate limits
        if (index > 0) {
          await this.sleep(200 * index);
        }
        return this.execute(query);
      })
    );

    return results;
  }

  /**
   * Calculate relevance score based on content matching query intent
   */
  private calculateRelevance(content: string, query: GeneratedQuery): number {
    const lowerContent = content.toLowerCase();
    const queryWords = query.query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // Count how many query words appear in content
    const matchedWords = queryWords.filter(word => lowerContent.includes(word));
    const wordScore = matchedWords.length / queryWords.length;

    // Check for expected info
    const expectedMatches = query.expectedInfo.filter(info =>
      lowerContent.includes(info.toLowerCase())
    ).length;
    const expectedScore = query.expectedInfo.length > 0
      ? expectedMatches / query.expectedInfo.length
      : 0.5;

    // Check content length (longer = more comprehensive)
    const lengthScore = Math.min(1, content.length / 2000);

    return (wordScore * 0.4) + (expectedScore * 0.4) + (lengthScore * 0.2);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const googleExecutor = new GoogleExecutor();
