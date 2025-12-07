/**
 * PUBLIC FEATURES API
 * Returns which features are available based on current provider settings
 * This is a public endpoint (no auth required)
 */

import { NextResponse } from 'next/server';
import { getProviderSettings } from '@/lib/provider/settings';

export async function GET() {
  try {
    const settings = await getProviderSettings();

    // Image generation is only available with OpenAI
    const imageGenerationAvailable = settings.activeProvider === 'openai';

    return NextResponse.json({
      imageGeneration: imageGenerationAvailable,
      activeProvider: settings.activeProvider,
    });
  } catch (error) {
    console.error('[Features API] Error:', error);
    // Default to OpenAI behavior on error
    return NextResponse.json({
      imageGeneration: true,
      activeProvider: 'openai',
    });
  }
}

export const runtime = 'nodejs';
