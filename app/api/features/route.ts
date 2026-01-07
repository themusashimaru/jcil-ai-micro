/**
 * PUBLIC FEATURES API
 * Returns which features are available
 * This is a public endpoint (no auth required)
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    // Image generation is not available (Claude + Perplexity only)
    imageGeneration: false,
    // Video generation is not available
    videoGeneration: false,
    // Web search is available via Perplexity
    webSearch: true,
    // Active provider is always Claude
    activeProvider: 'anthropic',
  });
}
