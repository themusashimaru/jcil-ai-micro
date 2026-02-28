/**
 * DOCUMENT SEARCH API
 *
 * Keyword-based search across user's documents
 * Uses simple keyword matching (embeddings removed to eliminate Google dependency)
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger('DocumentsSearch');

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    const body = await request.json();
    const { query, matchCount = 5 } = body;

    if (!query || query.trim().length === 0) {
      return errors.badRequest('Query is required');
    }

    // Extract keywords
    const keywords = query
      .toLowerCase()
      .split(/\W+/)
      .filter((w: string) => w.length > 2);

    if (keywords.length === 0) {
      return successResponse({ results: [], query, matchCount: 0 });
    }

    // Build ILIKE search pattern
    const searchPatterns = keywords.slice(0, 5).map((k: string) => `%${k}%`);

    // Search chunks using keyword matching
    const { data: results, error: searchError } = await supabase
      .from('user_document_chunks')
      .select(
        `
        id,
        document_id,
        content,
        user_documents!inner (
          name
        )
      `
      )
      .eq('user_id', user.id)
      .or(searchPatterns.map((p: string) => `content.ilike.${p}`).join(','))
      .limit(matchCount);

    if (searchError) {
      log.error('Search error', { error: searchError ?? 'Unknown error' });
      return errors.serverError('Search failed');
    }

    // Format results
    const formattedResults = (results || []).map(
      (r: {
        id: string;
        document_id: string;
        content: string;
        user_documents: { name: string } | { name: string }[];
      }) => ({
        chunk_id: r.id,
        document_id: r.document_id,
        document_name: Array.isArray(r.user_documents)
          ? r.user_documents[0]?.name || 'Unknown'
          : r.user_documents?.name || 'Unknown',
        content: r.content,
        similarity: 0.8, // Placeholder for keyword match
      })
    );

    return successResponse({
      results: formattedResults,
      query,
      matchCount: formattedResults.length,
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}

/**
 * GET endpoint to check if user has searchable documents
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ready');

    return successResponse({
      hasDocuments: (count || 0) > 0,
      documentCount: count || 0,
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}
