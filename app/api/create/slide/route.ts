/**
 * SLIDE GENERATION API
 *
 * Creates AI-generated presentation slides using Black Forest Labs FLUX.2.
 * Uses 16:9 aspect ratio (1280x720) optimized for presentations.
 *
 * Endpoints:
 * - POST /api/create/slide - Generate a presentation slide
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import {
  isBFLConfigured,
  generateImage,
  downloadAndStore,
  enhanceSlidePrompt,
  verifyGenerationResult,
  ASPECT_RATIOS,
  BFLError,
} from '@/lib/connectors/bfl';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const log = logger('CreateSlideAPI');

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max for generation

// =============================================================================
// TYPES
// =============================================================================

interface SlideRequest {
  prompt: string;
  conversationId?: string;
}

// =============================================================================
// POST - Generate slide
// =============================================================================

export async function POST(request: NextRequest) {
  // Check if BFL is configured
  if (!isBFLConfigured()) {
    return NextResponse.json(
      {
        error: 'Slide generation not available',
        message: 'BLACK_FOREST_LABS_API_KEY is not configured',
      },
      { status: 503 }
    );
  }

  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createClient();

  try {
    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const parseResult = await safeParseJSON<SlideRequest>(request);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const { prompt, conversationId } = parseResult.data;

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: 'Prompt must be less than 2000 characters' },
        { status: 400 }
      );
    }

    // Fixed 16:9 dimensions for slides
    const width = ASPECT_RATIOS['16:9'].width;
    const height = ASPECT_RATIOS['16:9'].height;

    // Enhance the prompt for slide generation
    let enhancedPrompt: string;
    try {
      // For single slide generation, use slide 1 of 1
      enhancedPrompt = await enhanceSlidePrompt(prompt.trim(), 1, 1);
      log.debug('Slide prompt enhanced', {
        original: prompt.trim().substring(0, 50),
        enhanced: enhancedPrompt.substring(0, 50),
      });
    } catch (enhanceError) {
      // If enhancement fails, use original prompt with slide context
      log.warn('Slide prompt enhancement failed, using original', { error: enhanceError });
      enhancedPrompt = `Professional presentation slide: ${prompt.trim()}. 16:9 aspect ratio, clean layout, high quality.`;
    }

    // Create generation record in database
    const generationId = randomUUID();
    const serviceClient = createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (serviceClient as any).from('generations').insert({
      id: generationId,
      user_id: user.id,
      conversation_id: conversationId || null,
      type: 'slide',
      model: 'flux-2-pro',
      provider: 'bfl',
      prompt: enhancedPrompt,
      input_data: {
        originalPrompt: prompt.trim(),
        slideType: 'presentation',
      },
      dimensions: { width, height },
      status: 'processing',
    });

    if (insertError) {
      log.error('Failed to create generation record', { error: insertError });
      return NextResponse.json({ error: 'Failed to start generation' }, { status: 500 });
    }

    log.info('Starting slide generation', {
      generationId,
      userId: user.id,
      width,
      height,
    });

    // Generate slide image
    let result;
    try {
      result = await generateImage(enhancedPrompt, {
        model: 'flux-2-pro',
        width,
        height,
        promptUpsampling: true,
      });
    } catch (genError) {
      const errorMessage = genError instanceof Error ? genError.message : 'Generation failed';
      const errorCode = genError instanceof BFLError ? genError.code : 'GENERATION_ERROR';

      // Update record with error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient as any)
        .from('generations')
        .update({
          status:
            errorCode === 'CONTENT_MODERATED' || errorCode === 'REQUEST_MODERATED'
              ? 'moderated'
              : 'failed',
          error_code: errorCode,
          error_message: errorMessage,
        })
        .eq('id', generationId);

      log.error('Slide generation failed', {
        generationId,
        error: errorMessage,
        code: errorCode,
      });

      return NextResponse.json(
        {
          error: 'Slide generation failed',
          message: errorMessage,
          code: errorCode,
        },
        { status: 500 }
      );
    }

    // Download and store the slide (BFL URLs expire in 10 minutes)
    let storedUrl: string;
    try {
      storedUrl = await downloadAndStore(result.imageUrl, user.id, generationId, 'png');
    } catch (storageError) {
      log.error('Failed to store slide', {
        generationId,
        error: storageError,
      });

      // Update record with error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient as any)
        .from('generations')
        .update({
          status: 'failed',
          error_code: 'STORAGE_FAILED',
          error_message: 'Failed to store generated slide',
        })
        .eq('id', generationId);

      return NextResponse.json(
        {
          error: 'Failed to store slide',
          message: 'The slide was generated but could not be saved',
        },
        { status: 500 }
      );
    }

    // Verify the generated slide matches user intent (vision check)
    let verification: { matches: boolean; feedback: string } | null = null;
    try {
      const imageResponse = await fetch(result.imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        verification = await verifyGenerationResult(prompt.trim(), imageBase64);
        log.debug('Slide verified', {
          generationId,
          matches: verification.matches,
          feedback: verification.feedback.substring(0, 100),
        });
      }
    } catch (verifyError) {
      // Verification is optional - don't fail the request
      log.warn('Slide verification skipped', { error: verifyError });
    }

    // Update generation record with success
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (serviceClient as any)
      .from('generations')
      .update({
        status: 'completed',
        result_url: storedUrl,
        result_data: {
          seed: result.seed,
          enhancedPrompt: result.enhancedPrompt,
          originalUrl: result.imageUrl,
          verification: verification || undefined,
        },
        cost_credits: result.cost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    log.info('Slide generation complete', {
      generationId,
      storedUrl,
      cost: result.cost,
      verified: verification?.matches,
    });

    return NextResponse.json({
      id: generationId,
      status: 'completed',
      imageUrl: storedUrl,
      model: 'flux-2-pro',
      prompt: prompt.trim(),
      enhancedPrompt: enhancedPrompt,
      dimensions: { width, height },
      seed: result.seed,
      cost: result.cost,
      verification: verification || undefined,
    });
  } catch (error) {
    log.error('Slide API error', error as Error);
    return NextResponse.json(
      {
        error: 'Slide generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get user's slide generations
// =============================================================================

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);

    // Query slide generations
    const { data: generations, error } = await supabase
      .from('generations')
      .select(
        'id, type, model, prompt, status, result_url, dimensions, cost_credits, created_at, completed_at'
      )
      .eq('user_id', user.id)
      .eq('type', 'slide')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      generations: generations || [],
      pagination: {
        limit,
        offset,
        hasMore: (generations?.length || 0) === limit,
      },
    });
  } catch (error) {
    log.error('Failed to get slide generations', error as Error);
    return NextResponse.json({ error: 'Failed to get slides' }, { status: 500 });
  }
}
