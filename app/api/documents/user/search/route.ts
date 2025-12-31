/**
 * DOCUMENT SEARCH API
 *
 * Semantic search across user's documents
 * Uses vector similarity to find relevant chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, matchCount = 5, matchThreshold = 0.7 } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.trim(),
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

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
    const supabase = await createClient();

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
