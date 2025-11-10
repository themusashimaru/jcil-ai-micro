/**
 * LIVE SEARCH API
 * PURPOSE: Real-time web search using xAI with citations
 * ROUTES: POST /api/live-search
 * SECURITY: Rate limited by user tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { liveSearch } from '@/lib/providers/xai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, enableWebSearch, enableXSearch, enableNewsSearch } = body;

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Perform live search
    const result = await liveSearch({
      query: query.trim(),
      enableWebSearch: enableWebSearch !== false,
      enableXSearch: enableXSearch !== false,
      enableNewsSearch: enableNewsSearch !== false,
    });

    return NextResponse.json({
      success: true,
      content: result.content,
      citations: result.citations,
      usage: result.usage,
    });
  } catch (error) {
    console.error('Live search error:', error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          {
            error: 'API configuration error',
            details: 'XAI_API_KEY is not configured',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Live search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
