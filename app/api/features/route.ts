/**
 * PUBLIC FEATURES API
 * Returns which features are available
 * This is a public endpoint (no auth required)
 */

import { successResponse } from '@/lib/api/utils';

export async function GET() {
  return successResponse({
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
