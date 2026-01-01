/**
 * USER DOCUMENT SEARCH - RAG Integration
 *
 * Searches user's uploaded documents using vector similarity.
 * Used by chat to include relevant document context in responses.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini for embeddings
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

// Service role client for database operations (bypasses RLS)
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface DocumentSearchResult {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  similarity: number;
}

/**
 * Search user documents for relevant content
 * Returns formatted context string for inclusion in chat
 */
export async function searchUserDocuments(
  userId: string,
  query: string,
  options: {
    matchCount?: number;
    matchThreshold?: number;
  } = {}
): Promise<{
  results: DocumentSearchResult[];
  contextString: string;
}> {
  const { matchCount = 3, matchThreshold = 0.65 } = options;

  try {
    // Check if user has any documents first (quick check)
    const supabase = createServiceClient();

    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ready');

    if (!count || count === 0) {
      // User has no documents - skip search
      return { results: [], contextString: '' };
    }

    // Generate embedding for the query using Gemini
    const embeddingResponse = await gemini.models.embedContent({
      model: 'text-embedding-004',
      contents: query.trim(),
    });

    if (!embeddingResponse.embeddings?.[0]?.values) {
      console.error('[UserSearch] No embedding returned from Gemini');
      return { results: [], contextString: '' };
    }

    const queryEmbedding = embeddingResponse.embeddings[0].values;

    // Search using the database function
    const { data: results, error: searchError } = await supabase.rpc(
      'search_user_documents',
      {
        p_user_id: userId,
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_match_count: matchCount,
        p_match_threshold: matchThreshold,
      }
    );

    if (searchError) {
      console.error('[UserSearch] Search error:', searchError);
      return { results: [], contextString: '' };
    }

    if (!results || results.length === 0) {
      return { results: [], contextString: '' };
    }

    // Format results into context string
    const contextString = formatSearchResultsForChat(results);

    console.log(`[UserSearch] Found ${results.length} relevant chunks for user ${userId}`);

    return {
      results,
      contextString,
    };
  } catch (error) {
    console.error('[UserSearch] Unexpected error:', error);
    return { results: [], contextString: '' };
  }
}

/**
 * Format search results into a context string for the chat system prompt
 */
function formatSearchResultsForChat(results: DocumentSearchResult[]): string {
  if (results.length === 0) return '';

  let context = '## USER\'S PERSONAL DOCUMENTS\n\n';
  context += 'The following information comes from documents the user has uploaded. Use this to answer their questions:\n\n';

  // Group by document for cleaner presentation
  const byDocument = new Map<string, { name: string; chunks: string[] }>();

  for (const result of results) {
    if (!byDocument.has(result.document_id)) {
      byDocument.set(result.document_id, {
        name: result.document_name,
        chunks: [],
      });
    }
    byDocument.get(result.document_id)!.chunks.push(result.content);
  }

  for (const [, doc] of byDocument) {
    context += `### From "${doc.name}":\n`;
    for (const chunk of doc.chunks) {
      context += `${chunk}\n\n`;
    }
  }

  context += '---\n\n';
  context += 'IMPORTANT: When answering based on the user\'s documents above, cite which document the information comes from.\n';

  return context;
}

/**
 * Check if user has any searchable documents
 * Quick check before doing full search
 */
export async function userHasDocuments(userId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ready');

    return (count || 0) > 0;
  } catch (error) {
    console.error('[UserSearch] Error checking documents:', error);
    return false;
  }
}
