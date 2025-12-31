/**
 * DOCUMENT SEARCH API
 *
 * Semantic search across user's documents
 * Uses vector similarity to find relevant chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini for embeddings (same provider as chat!)
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, matchCount = 5, matchThreshold = 0.7 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the query using Gemini
    const embeddingResponse = await gemini.models.embedContent({
      model: 'text-embedding-004',
      contents: query.trim(),
    });

    if (!embeddingResponse.embeddings?.[0]?.values) {
      console.error('[Search] No embedding returned from Gemini');
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    const queryEmbedding = embeddingResponse.embeddings[0].values;

    // Search using the database function
    const { data: results, error: searchError } = await supabase.rpc(
      'search_user_documents',
      {
        p_user_id: user.id,
        p_query_embedding: JSON.stringify(queryEmbedding),
        p_match_count: matchCount,
        p_match_threshold: matchThreshold,
      }
    );

    if (searchError) {
      console.error('[Search] Search error:', searchError);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({
      results: results || [],
      query,
      matchCount: results?.length || 0,
    });
  } catch (error) {
    console.error('[Search] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count ready documents with chunks
    const { count } = await supabase
      .from('user_documents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ready');

    return NextResponse.json({
      hasDocuments: (count || 0) > 0,
      documentCount: count || 0,
    });
  } catch (error) {
    console.error('[Search] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
