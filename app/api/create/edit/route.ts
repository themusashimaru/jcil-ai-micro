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

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
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
  enhanceEditPromptWithVision,
  FLUX_MODELS,
  type FluxModel,
  BFLError,
} from '@/lib/connectors/bfl';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { untypedFrom } from '@/lib/supabase/workspace-client';

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
    return errors.serviceUnavailable(
      'Image editing not available - BLACK_FOREST_LABS_API_KEY is not configured'
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
      return errors.unauthorized();
    }

    // Parse request
    const parseResult = await safeParseJSON<EditRequest>(request);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error);
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
      return errors.badRequest('Prompt is required');
    }

    if (prompt.length > 2000) {
      return errors.badRequest('Prompt must be less than 2000 characters');
    }

    // Validate images
    if (!images || images.length === 0) {
      return errors.badRequest('At least one reference image is required');
    }

    const modelConfig = FLUX_MODELS[model];
    if (!modelConfig.capabilities.imageEditing) {
      return errors.badRequest(`Model ${modelConfig.name} does not support image editing`);
    }

    if (images.length > modelConfig.capabilities.maxReferenceImages) {
      return errors.badRequest(
        `Maximum ${modelConfig.capabilities.maxReferenceImages} reference images allowed for ${modelConfig.name}`
      );
    }

    // Validate and extract base64 from images
    const processedImages: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];

      // Check size (rough estimate from base64)
      const estimatedSize = (imageData.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE) {
        return errors.badRequest(`Image ${i + 1} exceeds maximum size of 10MB`);
      }

      // Extract base64 if data URL
      processedImages.push(extractBase64(imageData));
    }

    // Validate dimensions
    const dimValidation = validateDimensions(model, width, height);
    if (!dimValidation.valid) {
      return errors.badRequest(dimValidation.error);
    }

    // Validate strength
    if (strength < 0 || strength > 1) {
      return errors.badRequest('Strength must be between 0 and 1');
    }

    // Vision-aware prompt enhancement
    // Claude analyzes the source image to write a smarter edit prompt
    let enhancedPrompt: string;
    try {
      // Use the first image for vision analysis (primary reference)
      enhancedPrompt = await enhanceEditPromptWithVision(prompt.trim(), processedImages[0]);
      log.debug('Vision-aware edit prompt created', {
        original: prompt.trim().substring(0, 50),
        enhanced: enhancedPrompt.substring(0, 50),
      });
    } catch (enhanceError) {
      // If enhancement fails, use original prompt
      log.warn('Vision enhancement failed, using original', { error: enhanceError });
      enhancedPrompt = prompt.trim();
    }

    // Create generation record in database
    // Note: Using 'as any' because generations table was added after type generation
    // Run `npx supabase gen types` to regenerate types if needed
    const generationId = randomUUID();
    const serviceClient = createServiceRoleClient();

    const { error: insertError } = await untypedFrom(serviceClient, 'generations').insert({
      id: generationId,
      user_id: user.id,
      conversation_id: conversationId || null,
      type: 'edit',
      model,
      provider: 'bfl',
      prompt: enhancedPrompt,
      input_data: {
        imageCount: images.length,
        strength,
        originalPrompt: prompt.trim(),
      },
      dimensions: { width, height },
      status: 'processing',
    });

    if (insertError) {
      log.error('Failed to create generation record', { error: insertError });
      return errors.serverError('Failed to start edit');
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
      result = await editImage(enhancedPrompt, processedImages, {
        model,
        width,
        height,
        strength,
      });
    } catch (editError) {
      const errorMessage = editError instanceof Error ? editError.message : 'Edit failed';
      const errorCode = editError instanceof BFLError ? editError.code : 'EDIT_ERROR';

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

      log.error('Image edit failed', {
        generationId,
        error: errorMessage,
        code: errorCode,
      });

      return errors.serverError('Image edit failed');
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
      await untypedFrom(serviceClient, 'generations')
        .update({
          status: 'failed',
          error_code: 'STORAGE_FAILED',
          error_message: 'Failed to store edited image',
        })
        .eq('id', generationId);

      return errors.serverError('Failed to store image');
    }

    // Update generation record with success
    await untypedFrom(serviceClient, 'generations')
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
    });
  } catch (error) {
    log.error('Edit API error', error as Error);
    return errors.serverError('Edit generation failed');
  }
}
