/**
 * DOCUMENT EXECUTOR FOR RESEARCH AGENT
 *
 * Searches user's uploaded documents for relevant information.
 * Enables the Research Agent to include personal document context in research.
 *
 * Key Features:
 * - Keyword-based document search
 * - Multi-document context aggregation
 * - Citation tracking for source attribution
 * - Integration with user's knowledge base
 */

import { GeneratedQuery, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';
import {
  searchUserDocuments,
  userHasDocuments,
  type DocumentSearchResult,
} from '@/lib/documents/userSearch';

const log = logger('DocumentExecutor');

// Document search input
export interface DocumentInput {
  query: GeneratedQuery;
  userId: string;
  matchCount?: number;
}

export class DocumentExecutor {
  /**
   * Check if document search is available for a user
   */
  async isAvailable(userId: string): Promise<boolean> {
    try {
      return await userHasDocuments(userId);
    } catch (error) {
      log.error('Failed to check document availability', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Determine if a query should search user documents
   */
  shouldSearchDocuments(query: GeneratedQuery): boolean {
    const lower = query.query.toLowerCase();

    // Patterns that suggest document search is useful
    const documentPatterns = [
      /my.*document/i,
      /my.*file/i,
      /uploaded.*file/i,
      /personal.*data/i,
      /my.*notes/i,
      /according.*to.*my/i,
      /from.*my/i,
      /based.*on.*my/i,
      /in.*my.*files/i,
      /check.*my/i,
      /refer.*to.*my/i,
      /look.*at.*my/i,
    ];

    // Check for explicit document reference
    if (documentPatterns.some((p) => p.test(lower))) {
      return true;
    }

    // Check if expectedInfo suggests document search
    const expectedLower = query.expectedInfo.map((e) => e.toLowerCase());
    if (
      expectedLower.some(
        (e) => e.includes('personal') || e.includes('uploaded') || e.includes('my ')
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Execute document search for a research query
   */
  async execute(input: DocumentInput): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      if (!(await this.isAvailable(input.userId))) {
        return this.createErrorResult(
          input.query,
          'No documents available. Please upload documents to search.'
        );
      }

      log.info('Searching user documents', {
        userId: input.userId,
        query: input.query.query.substring(0, 50),
      });

      // Search documents
      const searchResult = await searchUserDocuments(input.userId, input.query.query, {
        matchCount: input.matchCount || 10,
      });

      const executionTime = Date.now() - startTime;

      if (searchResult.results.length === 0) {
        return {
          id: `doc_empty_${Date.now()}`,
          query: input.query.query,
          source: 'brave',
          content: 'No relevant information found in your uploaded documents for this query.',
          timestamp: Date.now(),
          relevanceScore: 0.1,
          metadata: {
            executionTime,
            hasRichData: false,
          },
        };
      }

      // Format results for research output
      const formattedContent = this.formatDocumentResults(input.query, searchResult.results);

      return {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: input.query.query,
        source: 'brave',
        content: formattedContent,
        title: `User Documents: ${searchResult.results.length} matches`,
        timestamp: Date.now(),
        relevanceScore: this.calculateRelevance(searchResult.results, input.query),
        metadata: {
          webResultCount: searchResult.results.length,
          hasRichData: true,
          richDataType: 'user_documents',
          executionTime,
        },
      };
    } catch (error) {
      log.error('Document search failed', { error: (error as Error).message });
      return this.createErrorResult(
        input.query,
        `Document search error: ${(error as Error).message}`
      );
    }
  }

  /**
   * Execute document search for multiple queries
   */
  async executeMany(inputs: DocumentInput[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // Brief delay between searches
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const result = await this.execute(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Search documents with a text query (not GeneratedQuery)
   */
  async searchWithText(
    userId: string,
    queryText: string,
    options?: { matchCount?: number }
  ): Promise<SearchResult> {
    const query: GeneratedQuery = {
      id: `text_${Date.now()}`,
      query: queryText,
      purpose: 'Document search',
      expectedInfo: [],
      source: 'brave',
      priority: 5,
    };

    return this.execute({
      query,
      userId,
      matchCount: options?.matchCount,
    });
  }

  /**
   * Get all document names for a user
   */
  async getDocumentList(userId: string): Promise<string[]> {
    try {
      const searchResult = await searchUserDocuments(userId, '', { matchCount: 100 });

      // Extract unique document names
      const names = new Set<string>();
      for (const result of searchResult.results) {
        names.add(result.document_name);
      }

      return Array.from(names);
    } catch (error) {
      log.error('Failed to get document list', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Format document search results for research output
   */
  private formatDocumentResults(query: GeneratedQuery, results: DocumentSearchResult[]): string {
    const parts: string[] = [];

    parts.push(`## Personal Documents Search Results`);
    parts.push(`**Query:** ${query.query}`);
    parts.push(`**Documents Found:** ${results.length} relevant chunks\n`);

    // Group by document
    const byDocument = new Map<string, { name: string; chunks: DocumentSearchResult[] }>();

    for (const result of results) {
      if (!byDocument.has(result.document_id)) {
        byDocument.set(result.document_id, {
          name: result.document_name,
          chunks: [],
        });
      }
      byDocument.get(result.document_id)!.chunks.push(result);
    }

    // Format each document's results
    for (const [, doc] of byDocument) {
      parts.push(`### From "${doc.name}"`);

      for (const chunk of doc.chunks) {
        const similarity = (chunk.similarity * 100).toFixed(0);
        parts.push(`**Relevance:** ${similarity}%`);
        parts.push('```');
        parts.push(chunk.content.substring(0, 1000));
        if (chunk.content.length > 1000) {
          parts.push('... (truncated)');
        }
        parts.push('```\n');
      }
    }

    // Add citation note
    parts.push('---');
    parts.push("*Information sourced from user's uploaded documents.*");

    return parts.join('\n');
  }

  /**
   * Calculate relevance score based on search results
   */
  private calculateRelevance(results: DocumentSearchResult[], query: GeneratedQuery): number {
    if (results.length === 0) return 0;

    // Average similarity score
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    // Boost for multiple results
    const countBoost = Math.min(0.2, results.length * 0.02);

    // Check if expected info is found
    const expectedLower = query.expectedInfo.map((e) => e.toLowerCase());
    const allContent = results.map((r) => r.content.toLowerCase()).join(' ');
    const expectedMatches = expectedLower.filter((e) => allContent.includes(e)).length;
    const expectedBoost =
      query.expectedInfo.length > 0 ? (expectedMatches / query.expectedInfo.length) * 0.2 : 0;

    return Math.min(1, avgSimilarity + countBoost + expectedBoost);
  }

  /**
   * Create error result
   */
  private createErrorResult(query: GeneratedQuery, error: string): SearchResult {
    return {
      id: `doc_error_${Date.now()}`,
      query: query.query,
      source: 'brave',
      content: error,
      timestamp: Date.now(),
      relevanceScore: 0,
    };
  }
}

// Singleton instance
export const documentExecutor = new DocumentExecutor();
