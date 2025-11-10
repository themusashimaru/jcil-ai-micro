/**
 * SEARCH API - Semantic search over user chat history
 * TODO: Implement vector search with embeddings
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ results: [] });
}
