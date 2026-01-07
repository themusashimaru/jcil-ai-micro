/**
 * USER DOCUMENT SEARCH
 *
 * Searches user's uploaded documents using keyword matching.
 * Used by chat to include relevant document context in responses.
 *
 * NOTE: Simplified to use keyword matching instead of vector search
 * to avoid dependency on Google/OpenAI embedding APIs.
 */

import { createClient } from '@supabase/supabase-js';

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
  const { matchCount = 5 } = options;

  console.log(`[UserSearch] Starting search for user ${userId}, query: "${query.substring(0, 50)}..."`);

  try {
    const supabase = createServiceClient();

    // Check if user has any documents first
    const { count, error: countError } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'ready');

    if (countError) {
      console.error('[UserSearch] Error checking document count:', countError);
      return { results: [], contextString: '' };
    }

    console.log(`[UserSearch] User has ${count || 0} ready documents`);

    if (!count || count === 0) {
      return { results: [], contextString: '' };
    }

    // Use keyword-based search
    const results = await keywordSearch(supabase, userId, query, matchCount);

    if (results.length === 0) {
      console.log('[UserSearch] No matching chunks found');
      return { results: [], contextString: '' };
    }

    const contextString = formatSearchResultsForChat(results);
    console.log(`[UserSearch] SUCCESS: Found ${results.length} relevant chunks`);

    return { results, contextString };
  } catch (error) {
    console.error('[UserSearch] Unexpected error:', error);
    return { results: [], contextString: '' };
  }
}

/**
 * Simple keyword-based document search
 * Searches for query terms in document chunks
 */
async function keywordSearch(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  query: string,
  limit: number
): Promise<DocumentSearchResult[]> {
  try {
    // Extract keywords from query (simple tokenization)
    const keywords = query
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2);

    if (keywords.length === 0) {
      // Fall back to getting recent chunks
      return await getRecentChunks(supabase, userId, limit);
    }

    // Search for chunks containing any keywords using Postgres full-text search
    // Note: This is a simple ILIKE search, not full-text search
    const searchPattern = keywords.slice(0, 5).map(k => `%${k}%`);

    const { data: chunks, error } = await supabase
      .from('user_document_chunks')
      .select(`
        id,
        document_id,
        content,
        user_documents!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .or(searchPattern.map(p => `content.ilike.${p}`).join(','))
      .limit(limit);

    if (error || !chunks || chunks.length === 0) {
      console.log('[UserSearch] No keyword matches, falling back to recent chunks');
      return await getRecentChunks(supabase, userId, limit);
    }

    // Score results by keyword matches
    return chunks.map((chunk: {
      id: string;
      document_id: string;
      content: string;
      user_documents: { name: string } | { name: string }[];
    }) => {
      const contentLower = chunk.content.toLowerCase();
      const matchCount = keywords.filter(k => contentLower.includes(k)).length;
      const similarity = matchCount / keywords.length;

      return {
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        document_name: Array.isArray(chunk.user_documents)
          ? chunk.user_documents[0]?.name || 'Unknown'
          : chunk.user_documents?.name || 'Unknown',
        content: chunk.content,
        similarity,
      };
    }).sort((a, b) => b.similarity - a.similarity);
  } catch (error) {
    console.error('[UserSearch] Keyword search error:', error);
    return [];
  }
}

/**
 * Get most recent document chunks as fallback
 */
async function getRecentChunks(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  limit: number
): Promise<DocumentSearchResult[]> {
  try {
    const { data: chunks, error } = await supabase
      .from('user_document_chunks')
      .select(`
        id,
        document_id,
        content,
        user_documents!inner (
          name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !chunks) return [];

    return chunks.map((chunk: {
      id: string;
      document_id: string;
      content: string;
      user_documents: { name: string } | { name: string }[];
    }) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      document_name: Array.isArray(chunk.user_documents)
        ? chunk.user_documents[0]?.name || 'Unknown'
        : chunk.user_documents?.name || 'Unknown',
      content: chunk.content,
      similarity: 0.5,
    }));
  } catch (error) {
    console.error('[UserSearch] Recent chunks error:', error);
    return [];
  }
}

/**
 * Format search results into a context string for the chat system prompt
 */
function formatSearchResultsForChat(results: DocumentSearchResult[]): string {
  if (results.length === 0) return '';

  let context = '## USER\'S PERSONAL DOCUMENTS\n\n';
  context += 'The following information comes from documents the user has uploaded:\n\n';

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
