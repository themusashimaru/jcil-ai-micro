/**
 * CODE MEMORY SERVICE (Enhancement #7)
 *
 * Persistent memory for code artifacts across conversations.
 * Enables "that React component from yesterday" type queries.
 *
 * Features:
 * - Store code snippets with embeddings
 * - Semantic search for code
 * - Auto-categorization by language/purpose
 * - Link code to conversations
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('CodeMemory');

// ============================================================================
// TYPES
// ============================================================================

export interface CodeArtifact {
  id: string;
  userId: string;
  conversationId?: string;
  code: string;
  language: string;
  description?: string;
  tags?: string[];
  filename?: string;
  createdAt: Date;
  embedding?: number[];
}

export interface CodeSearchResult {
  artifact: CodeArtifact;
  similarity: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface CodeMemoryOptions {
  maxResults?: number;
  minSimilarity?: number;
  language?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// CODE MEMORY SERVICE
// ============================================================================

class CodeMemoryService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log.warn('Supabase not configured for code memory');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Store a code artifact in memory
   */
  async storeCode(
    userId: string,
    code: string,
    options: {
      language?: string;
      description?: string;
      tags?: string[];
      filename?: string;
      conversationId?: string;
    } = {}
  ): Promise<CodeArtifact | null> {
    if (!this.supabase) {
      log.warn('Supabase not available for code storage');
      return null;
    }

    try {
      const language = options.language || this.detectLanguage(code);
      const description = options.description || this.generateDescription(code, language);

      // Generate embedding for semantic search
      const embedding = await this.generateEmbedding(code, description);

      const artifact: Partial<CodeArtifact> = {
        userId,
        conversationId: options.conversationId,
        code: code.slice(0, 50000), // Limit size
        language,
        description,
        tags: options.tags || this.extractTags(code, language),
        filename: options.filename,
        createdAt: new Date(),
        embedding,
      };

      const { data, error } = await this.supabase
        .from('chat_code_artifacts')
        .insert([artifact])
        .select()
        .single();

      if (error) {
        log.error('Failed to store code artifact', { error: error.message });
        return null;
      }

      log.info('Code artifact stored', { id: data.id, language, tags: artifact.tags });
      return data;
    } catch (error) {
      log.error('Error storing code', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Search for code artifacts semantically
   */
  async searchCode(
    userId: string,
    query: string,
    options: CodeMemoryOptions = {}
  ): Promise<CodeSearchResult[]> {
    if (!this.supabase) {
      return [];
    }

    const { maxResults = 10, minSimilarity = 0.5, language, dateRange } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);

      // Build query
      let dbQuery = this.supabase
        .from('chat_code_artifacts')
        .select('*')
        .eq('user_id', userId);

      if (language) {
        dbQuery = dbQuery.eq('language', language);
      }

      if (dateRange) {
        dbQuery = dbQuery
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      // For now, do simple text search if no embedding
      // In production, use pgvector similarity search
      if (!queryEmbedding) {
        dbQuery = dbQuery.or(
          `description.ilike.%${query}%,code.ilike.%${query}%,tags.cs.{${query}}`
        );
      }

      const { data, error } = await dbQuery.limit(maxResults * 2);

      if (error) {
        log.error('Failed to search code', { error: error.message });
        return [];
      }

      // Calculate similarity and rank results
      const results: CodeSearchResult[] = [];

      for (const artifact of data || []) {
        const similarity = queryEmbedding && artifact.embedding
          ? this.cosineSimilarity(queryEmbedding, artifact.embedding)
          : this.textSimilarity(query, artifact);

        if (similarity >= minSimilarity) {
          results.push({
            artifact,
            similarity,
            relevance: similarity > 0.8 ? 'high' : similarity > 0.6 ? 'medium' : 'low',
          });
        }
      }

      // Sort by similarity and return top results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);
    } catch (error) {
      log.error('Error searching code', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get recent code artifacts for a user
   */
  async getRecentCode(
    userId: string,
    limit: number = 10
  ): Promise<CodeArtifact[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('chat_code_artifacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        log.error('Failed to get recent code', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error getting recent code', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get code artifacts for a specific conversation
   */
  async getConversationCode(conversationId: string): Promise<CodeArtifact[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('chat_code_artifacts')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        log.error('Failed to get conversation code', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error getting conversation code', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Format code memory for system prompt injection
   */
  async formatForPrompt(userId: string, maxTokens: number = 1000): Promise<string> {
    const recentCode = await this.getRecentCode(userId, 5);

    if (recentCode.length === 0) {
      return '';
    }

    let prompt = '\n\n## Recent Code Memory\n';
    let currentTokens = 0;
    const tokensPerChar = 0.25; // Rough estimate

    for (const artifact of recentCode) {
      const entry = `
### ${artifact.filename || artifact.language} (${new Date(artifact.createdAt).toLocaleDateString()})
${artifact.description || 'No description'}
\`\`\`${artifact.language}
${artifact.code.slice(0, 200)}${artifact.code.length > 200 ? '...' : ''}
\`\`\`
`;
      const entryTokens = entry.length * tokensPerChar;

      if (currentTokens + entryTokens > maxTokens) break;

      prompt += entry;
      currentTokens += entryTokens;
    }

    return prompt;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private detectLanguage(code: string): string {
    // Simple language detection based on patterns
    if (code.includes('import React') || code.includes('useState')) return 'tsx';
    if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
    if (code.includes('function ') && code.includes('{')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('func ') && code.includes('package ')) return 'go';
    if (code.includes('fn ') && code.includes('let ') && code.includes('mut ')) return 'rust';
    if (code.includes('public class ')) return 'java';
    if (code.includes('<html') || code.includes('<!DOCTYPE')) return 'html';
    if (code.includes('SELECT ') || code.includes('INSERT ')) return 'sql';
    return 'text';
  }

  private generateDescription(code: string, language: string): string {
    // Extract first comment or function name as description
    const commentMatch = code.match(/^(?:\/\/|#|\/\*|\"\"\"|''')\s*(.+?)(?:\n|\*\/|\"\"\"|}''')/);
    if (commentMatch) return commentMatch[1].slice(0, 100);

    const functionMatch = code.match(/(?:function|def|fn|func)\s+(\w+)/);
    if (functionMatch) return `${language} function: ${functionMatch[1]}`;

    const classMatch = code.match(/(?:class|interface|struct)\s+(\w+)/);
    if (classMatch) return `${language} ${classMatch[0]}`;

    return `${language} code snippet`;
  }

  private extractTags(code: string, language: string): string[] {
    const tags = [language];

    // Add framework tags
    if (code.includes('React')) tags.push('react');
    if (code.includes('useState') || code.includes('useEffect')) tags.push('hooks');
    if (code.includes('express')) tags.push('express');
    if (code.includes('nextjs') || code.includes('Next')) tags.push('nextjs');
    if (code.includes('async') || code.includes('await')) tags.push('async');
    if (code.includes('test') || code.includes('expect')) tags.push('test');
    if (code.includes('api') || code.includes('fetch')) tags.push('api');

    return tags.slice(0, 10);
  }

  private async generateEmbedding(_text: string, _description?: string): Promise<number[] | undefined> {
    // In production, this would call an embedding API
    // For now, return undefined to use text-based similarity
    return undefined;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }

  private textSimilarity(query: string, artifact: CodeArtifact): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Check description
    if (artifact.description?.toLowerCase().includes(queryLower)) {
      score += 0.4;
    }

    // Check tags
    for (const tag of artifact.tags || []) {
      if (queryLower.includes(tag.toLowerCase())) {
        score += 0.2;
      }
    }

    // Check code content
    if (artifact.code.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }

    // Check language
    if (artifact.language.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let codeMemoryInstance: CodeMemoryService | null = null;

export function getCodeMemory(): CodeMemoryService {
  if (!codeMemoryInstance) {
    codeMemoryInstance = new CodeMemoryService();
  }
  return codeMemoryInstance;
}

// Export convenience functions
export const storeCode = (userId: string, code: string, options?: Parameters<CodeMemoryService['storeCode']>[2]) =>
  getCodeMemory().storeCode(userId, code, options);

export const searchCode = (userId: string, query: string, options?: CodeMemoryOptions) =>
  getCodeMemory().searchCode(userId, query, options);

export const getRecentCode = (userId: string, limit?: number) =>
  getCodeMemory().getRecentCode(userId, limit);

export const getConversationCode = (conversationId: string) =>
  getCodeMemory().getConversationCode(conversationId);

export const formatCodeMemoryForPrompt = (userId: string, maxTokens?: number) =>
  getCodeMemory().formatForPrompt(userId, maxTokens);
