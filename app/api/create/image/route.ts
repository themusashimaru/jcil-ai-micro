/**
 * IMAGE GENERATION API
 *
 * Creates AI-generated images using Black Forest Labs FLUX.2 models.
 *
 * Endpoints:
 * - POST /api/create/image - Submit a generation request
 *
 * Features:
 * - Text-to-image generation with FLUX.2 Pro
 * - Async processing with polling
 * - Automatic storage to Supabase
 * - Cost tracking
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/auth/user-guard';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import {
  isBFLConfigured,
  generateImage,
  downloadAndStore,
  validateDimensions,
  enhanceImagePrompt,
  verifyGenerationResult,
  ASPECT_RATIOS,
  type FluxModel,
  type AspectRatio,
  BFLError,
} from '@/lib/connectors/bfl';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { untypedFrom } from '@/lib/supabase/workspace-client';

const log = logger('CreateImageAPI');

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max for generation

// =============================================================================
// TYPES
// =============================================================================

interface GenerationRequest {
  prompt: string;
  model?: FluxModel;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  promptUpsampling?: boolean;
  conversationId?: string;
}

// =============================================================================
// POST - Submit generation request
// =============================================================================

export async function POST(request: NextRequest) {
  // Check if BFL is configured
  if (!isBFLConfigured()) {
    return errors.serviceUnavailable(
      'Image generation not available - BLACK_FOREST_LABS_API_KEY is not configured'
    );
  }

  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;

  try {
    // Parse request
    const parseResult = await safeParseJSON<GenerationRequest>(request);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error);
    }

    const {
      prompt,
      model = 'flux-2-pro',
      aspectRatio,
      width: customWidth,
      height: customHeight,
      promptUpsampling = true,
      conversationId,
    } = parseResult.data;

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      return errors.badRequest('Prompt is required');
    }

    if (prompt.length > 2000) {
      return errors.badRequest('Prompt must be less than 2000 characters');
    }

    // Determine dimensions
    let width: number;
    let height: number;

    if (aspectRatio && ASPECT_RATIOS[aspectRatio]) {
      width = ASPECT_RATIOS[aspectRatio].width;
      height = ASPECT_RATIOS[aspectRatio].height;
    } else if (customWidth && customHeight) {
      width = customWidth;
      height = customHeight;
    } else {
      // Default to square
      width = 1024;
      height = 1024;
    }

    // Validate dimensions
    const dimValidation = validateDimensions(model, width, height);
    if (!dimValidation.valid) {
      return errors.badRequest(dimValidation.error);
    }

    // Auto-enhance the prompt for better results
    let enhancedPrompt: string;
    try {
      enhancedPrompt = await enhanceImagePrompt(prompt.trim(), {
        type: 'create',
        aspectRatio,
      });
      log.debug('Prompt enhanced', {
        original: prompt.trim().substring(0, 50),
        enhanced: enhancedPrompt.substring(0, 50),
      });
    } catch (enhanceError) {
      // If enhancement fails, use original prompt
      log.warn('Prompt enhancement failed, using original', { error: enhanceError });
      enhancedPrompt = prompt.trim();
    }

    // Create generation record in database
    // Note: Using 'as any' because generations table was added after type generation
    // Run `npx supabase gen types` to regenerate types if needed
    const generationId = randomUUID();
    const serviceClient = createServiceRoleClient();

    const { error: insertError } = await untypedFrom(serviceClient, 'generations').insert({
      id: generationId,
      user_id: auth.user.id,
      conversation_id: conversationId || null,
      type: 'image',
      model,
      provider: 'bfl',
      prompt: enhancedPrompt,
      input_data: {
        aspectRatio,
        promptUpsampling,
        originalPrompt: prompt.trim(),
      },
      dimensions: { width, height },
      status: 'processing',
    });

    if (insertError) {
      log.error('Failed to create generation record', { error: insertError });
      return errors.serverError('Failed to start generation');
    }

    log.info('Starting image generation', {
      generationId,
      userId: auth.user.id,
      model,
      width,
      height,
    });

    // Generate image (this handles polling internally)
    let result;
    try {
      result = await generateImage(enhancedPrompt, {
        model,
        width,
        height,
        promptUpsampling,
      });
    } catch (genError) {
      const errorMessage = genError instanceof Error ? genError.message : 'Generation failed';
      const errorCode = genError instanceof BFLError ? genError.code : 'GENERATION_ERROR';

      // Update record with error
      await untypedFrom(serviceClient, 'generations')
        .update({
          status:
            errorCode === 'CONTENT_MODERATED' || errorCode === 'REQUEST_MODERATED'
              ? 'moderated'
              : 'failed',
          error_code: errorCode,
          error_message: errorMessage,
        })
        .eq('id', generationId);

      log.error('Image generation failed', {
        generationId,
        error: errorMessage,
        code: errorCode,
      });

      return errors.serverError('Image generation failed');
    }

    // Download and store the image (BFL URLs expire in 10 minutes)
    let storedUrl: string;
    try {
      storedUrl = await downloadAndStore(result.imageUrl, auth.user.id, generationId, 'png');
    } catch (storageError) {
      log.error('Failed to store image', {
        generationId,
        error: storageError,
      });

      // Update record with error
      await untypedFrom(serviceClient, 'generations')
        .update({
          status: 'failed',
          error_code: 'STORAGE_FAILED',
          error_message: 'Failed to store generated image',
        })
        .eq('id', generationId);

      return errors.serverError('Failed to store image');
    }

    // Verify the generated image matches user intent (vision check)
    // This is non-blocking - we still return the result even if verification fails
    let verification: { matches: boolean; feedback: string } | null = null;
    try {
      // Fetch the image from BFL URL (still valid) for verification
      const imageResponse = await fetch(result.imageUrl);
      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');
        verification = await verifyGenerationResult(prompt.trim(), imageBase64);
        log.debug('Generation verified', {
          generationId,
          matches: verification.matches,
          feedback: verification.feedback.substring(0, 100),
        });
      }
    } catch (verifyError) {
      // Verification is optional - don't fail the request
      log.warn('Generation verification skipped', { error: verifyError });
    }

    // Update generation record with success
    await untypedFrom(serviceClient, 'generations')
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

    log.info('Image generation complete', {
      generationId,
      storedUrl,
      cost: result.cost,
      verified: verification?.matches,
    });

    return successResponse({
      id: generationId,
      status: 'completed',
      imageUrl: storedUrl,
      model,
      prompt: prompt.trim(),
      enhancedPrompt: enhancedPrompt,
      dimensions: { width, height },
      seed: result.seed,
      cost: result.cost,
      verification: verification || undefined,
    });
  } catch (error) {
    log.error('Image API error', error as Error);
    return errors.serverError('Image generation failed');
  }
}

// =============================================================================
// GET - Get user's generations
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;

  try {
    // Parse query params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
    const type = request.nextUrl.searchParams.get('type') || 'image';

    // Query generations
    const { data: generations, error } = await auth.supabase
      .from('generations')
      .select(
        'id, type, model, prompt, status, result_url, dimensions, cost_credits, created_at, completed_at'
      )
      .eq('user_id', auth.user.id)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return successResponse({
      generations: generations || [],
      pagination: {
        limit,
        offset,
        hasMore: (generations?.length || 0) === limit,
      },
    });
  } catch (error) {
    log.error('Failed to get generations', error as Error);
    return errors.serverError('Failed to get generations');
  }
}
