/**
 * IMAGE EDIT API
 *
 * Edits images using Black Forest Labs FLUX.2 models with reference images.
 * Supports up to 8 reference images for style matching and editing.
 *
 * Endpoints:
 * - POST /api/create/edit - Submit an edit request
 *
 * Use cases:
 * - Professional headshots from selfies
 * - Style matching from screenshots
 * - Image modifications with natural language
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';
import {
  isBFLConfigured,
  editImage,
  downloadAndStore,
  validateDimensions,
  extractBase64,
  FLUX_MODELS,
  type FluxModel,
  BFLError,
} from '@/lib/connectors/bfl';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const log = logger('EditImageAPI');

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max for edit

// =============================================================================
// TYPES
// =============================================================================

interface EditRequest {
  prompt: string;
  images: string[]; // Base64-encoded images or data URLs
  model?: FluxModel;
  width?: number;
  height?: number;
  strength?: number; // 0.0-1.0, how much to change
  conversationId?: string;
}

// Maximum image size in bytes (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// POST - Submit edit request
// =============================================================================

export async function POST(request: NextRequest) {
  // Check if BFL is configured
  if (!isBFLConfigured()) {
    return NextResponse.json(
      {
        error: 'Image editing not available',
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
    const parseResult = await safeParseJSON<EditRequest>(request);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const {
      prompt,
      images,
      model = 'flux-2-pro',
      width = 1024,
      height = 1024,
      strength = 0.8,
      conversationId,
    } = parseResult.data;

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

    // Validate images
    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'At least one reference image is required' },
        { status: 400 }
      );
    }

    const modelConfig = FLUX_MODELS[model];
    if (!modelConfig.capabilities.imageEditing) {
      return NextResponse.json(
        { error: `Model ${modelConfig.name} does not support image editing` },
        { status: 400 }
      );
    }

    if (images.length > modelConfig.capabilities.maxReferenceImages) {
      return NextResponse.json(
        {
          error: `Maximum ${modelConfig.capabilities.maxReferenceImages} reference images allowed for ${modelConfig.name}`,
        },
        { status: 400 }
      );
    }

    // Validate and extract base64 from images
    const processedImages: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];

      // Check size (rough estimate from base64)
      const estimatedSize = (imageData.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE) {
        return NextResponse.json(
          { error: `Image ${i + 1} exceeds maximum size of 10MB` },
          { status: 400 }
        );
      }

      // Extract base64 if data URL
      processedImages.push(extractBase64(imageData));
    }

    // Validate dimensions
    const dimValidation = validateDimensions(model, width, height);
    if (!dimValidation.valid) {
      return NextResponse.json({ error: dimValidation.error }, { status: 400 });
    }

    // Validate strength
    if (strength < 0 || strength > 1) {
      return NextResponse.json({ error: 'Strength must be between 0 and 1' }, { status: 400 });
    }

    // Create generation record in database
    // Note: Using 'as any' because generations table was added after type generation
    // Run `npx supabase gen types` to regenerate types if needed
    const generationId = randomUUID();
    const serviceClient = createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (serviceClient as any).from('generations').insert({
      id: generationId,
      user_id: user.id,
      conversation_id: conversationId || null,
      type: 'edit',
      model,
      provider: 'bfl',
      prompt: prompt.trim(),
      input_data: {
        imageCount: images.length,
        strength,
      },
      dimensions: { width, height },
      status: 'processing',
    });

    if (insertError) {
      log.error('Failed to create generation record', { error: insertError });
      return NextResponse.json({ error: 'Failed to start edit' }, { status: 500 });
    }

    log.info('Starting image edit', {
      generationId,
      userId: user.id,
      model,
      imageCount: images.length,
      strength,
    });

    // Edit image (this handles polling internally)
    let result;
    try {
      result = await editImage(prompt.trim(), processedImages, {
        model,
        width,
        height,
        strength,
      });
    } catch (editError) {
      const errorMessage = editError instanceof Error ? editError.message : 'Edit failed';
      const errorCode = editError instanceof BFLError ? editError.code : 'EDIT_ERROR';

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

      log.error('Image edit failed', {
        generationId,
        error: errorMessage,
        code: errorCode,
      });

      return NextResponse.json(
        {
          error: 'Image edit failed',
          message: errorMessage,
          code: errorCode,
        },
        { status: 500 }
      );
    }

    // Download and store the image (BFL URLs expire in 10 minutes)
    let storedUrl: string;
    try {
      storedUrl = await downloadAndStore(result.imageUrl, user.id, generationId, 'png');
    } catch (storageError) {
      log.error('Failed to store edited image', {
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
          error_message: 'Failed to store edited image',
        })
        .eq('id', generationId);

      return NextResponse.json(
        {
          error: 'Failed to store image',
          message: 'The edit was completed but could not be saved',
        },
        { status: 500 }
      );
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
          originalUrl: result.imageUrl,
        },
        cost_credits: result.cost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', generationId);

    log.info('Image edit complete', {
      generationId,
      storedUrl,
      cost: result.cost,
    });

    return NextResponse.json({
      id: generationId,
      status: 'completed',
      imageUrl: storedUrl,
      model,
      prompt: prompt.trim(),
      dimensions: { width, height },
      seed: result.seed,
      cost: result.cost,
    });
  } catch (error) {
    log.error('Edit API error', error as Error);
    return NextResponse.json(
      {
        error: 'Image edit failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
