/**
 * FULL-TEXT SEARCH INDEX TOOL
 *
 * Build and query search indexes using Lunr.js.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Create search indexes from documents
 * - Full-text search with ranking
 * - Field boosting
 * - Fuzzy matching
 * - Wildcard queries
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded lunr
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lunr: any = null;

// In-memory index storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const indexCache: Map<string, { index: any; documents: Record<string, unknown>[] }> = new Map();

async function initLunr(): Promise<boolean> {
  if (lunr) return true;
  try {
    const mod = await import('lunr');
    lunr = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const searchIndexTool: UnifiedTool = {
  name: 'search_index',
  description: `Build and query full-text search indexes.

Operations:
- create: Create a search index from documents
- search: Search an existing index
- delete: Delete an index
- list: List all indexes

Features:
- Full-text search with TF-IDF ranking
- Field boosting (weight certain fields higher)
- Fuzzy matching (find similar words)
- Wildcard queries (prefix matching)
- Multiple indexes for different document sets

Use cases:
- Search through document collections
- Build searchable knowledge bases
- Find relevant content quickly
- Implement semantic search

Indexes persist during the session.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'search', 'delete', 'list'],
        description: 'Search index operation to perform',
      },
      index_name: {
        type: 'string',
        description: 'Name/ID for the search index',
      },
      documents: {
        type: 'array',
        items: { type: 'object' },
        description: 'For create: array of documents to index (must have id field)',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'For create: field names to index (default: all string fields)',
      },
      boost: {
        type: 'object',
        description: 'For create: field boost weights (e.g., {"title": 10, "body": 1})',
      },
      query: {
        type: 'string',
        description: 'For search: search query string',
      },
      fuzzy: {
        type: 'boolean',
        description: 'For search: enable fuzzy matching (default: false)',
      },
      limit: {
        type: 'number',
        description: 'For search: max results to return (default: 10)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSearchIndexAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSearchIndex(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    index_name?: string;
    documents?: Record<string, unknown>[];
    fields?: string[];
    boost?: Record<string, number>;
    query?: string;
    fuzzy?: boolean;
    limit?: number;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initLunr();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize lunr' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create': {
        if (!args.index_name || !args.documents || args.documents.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Index name and documents required for create' }),
            isError: true,
          };
        }

        // Validate documents have id field
        for (let i = 0; i < args.documents.length; i++) {
          if (!args.documents[i].id) {
            return {
              toolCallId: toolCall.id,
              content: JSON.stringify({
                error: `Document at index ${i} missing required 'id' field`,
              }),
              isError: true,
            };
          }
        }

        // Determine fields to index
        const fieldsToIndex = args.fields || inferFields(args.documents[0]);
        const boostConfig = args.boost || {};

        // Build the index
        const documents = args.documents;
        const index = lunr(function (this: {
          ref: (field: string) => void;
          field: (field: string, config?: { boost: number }) => void;
          add: (doc: Record<string, unknown>) => void;
        }) {
          this.ref('id');

          for (const field of fieldsToIndex) {
            if (field !== 'id') {
              const boost = boostConfig[field] || 1;
              this.field(field, { boost });
            }
          }

          for (const doc of documents) {
            this.add(doc);
          }
        });

        // Store index and documents
        indexCache.set(args.index_name, { index, documents });

        result = {
          operation: 'create',
          index_name: args.index_name,
          documents_indexed: args.documents.length,
          fields_indexed: fieldsToIndex,
          boost_config: boostConfig,
        };
        break;
      }

      case 'search': {
        if (!args.index_name || !args.query) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Index name and query required for search' }),
            isError: true,
          };
        }

        const cached = indexCache.get(args.index_name);
        if (!cached) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Index "${args.index_name}" not found` }),
            isError: true,
          };
        }

        // Build query
        let searchQuery = args.query;
        if (args.fuzzy) {
          // Add fuzzy modifier to each term
          searchQuery = args.query
            .split(/\s+/)
            .map((term) => `${term}~1`)
            .join(' ');
        }

        // Execute search
        const searchResults = cached.index.search(searchQuery);
        const limit = args.limit || 10;

        // Map results to documents
        const results = searchResults.slice(0, limit).map((r: { ref: string; score: number }) => {
          const doc = cached.documents.find((d) => d.id === r.ref);
          return {
            id: r.ref,
            score: r.score,
            document: doc,
          };
        });

        result = {
          operation: 'search',
          index_name: args.index_name,
          query: args.query,
          fuzzy: args.fuzzy || false,
          total_results: searchResults.length,
          returned: results.length,
          results,
        };
        break;
      }

      case 'delete': {
        if (!args.index_name) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Index name required for delete' }),
            isError: true,
          };
        }

        const existed = indexCache.has(args.index_name);
        indexCache.delete(args.index_name);

        result = {
          operation: 'delete',
          index_name: args.index_name,
          deleted: existed,
        };
        break;
      }

      case 'list': {
        const indexes = Array.from(indexCache.entries()).map(([name, data]) => ({
          name,
          document_count: data.documents.length,
        }));

        result = {
          operation: 'list',
          indexes,
          total: indexes.length,
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Search index operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Infer indexable fields from document
function inferFields(doc: Record<string, unknown>): string[] {
  return Object.entries(doc)
    .filter(([, value]) => typeof value === 'string')
    .map(([key]) => key);
}
