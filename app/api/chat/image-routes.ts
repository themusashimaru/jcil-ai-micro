/**
 * Chat Image Generation & Editing Routes
 *
 * Handles natural language image generation and editing via BFL/FLUX:
 * - Route 0: New image creation from text prompts
 * - Route 0.5: Image editing with uploaded attachment
 * - Route 0.6: Conversational editing of previously generated images
 */

import { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import {
  isBFLConfigured,
  detectImageRequest,
  detectEditWithAttachment,
  detectConversationalEdit,
  generateImage,
  editImage,
  downloadAndStore,
  enhanceImagePrompt,
  enhanceEditPromptWithVision,
  verifyGenerationResult,
  ASPECT_RATIOS,
  BFLError,
} from '@/lib/connectors/bfl';
import { getImageAttachments, findPreviousGeneratedImage } from './helpers';

const log = logger('ChatImageRoutes');

export interface ImageRouteContext {
  messages: CoreMessage[];
  lastUserContent: string;
  userId: string;
  conversationId?: string;
  isAuthenticated: boolean;
}

/**
 * Try to handle image creation from natural language.
 * Returns a Response if handled, null if not an image request.
 */
export async function tryImageCreation(ctx: ImageRouteContext): Promise<Response | null> {
  if (!isBFLConfigured() || !ctx.isAuthenticated) return null;

  try {
    const imageDetection = await detectImageRequest(ctx.lastUserContent, {
      useClaude: false,
      minConfidence: 'high',
    });

    if (!imageDetection?.isImageRequest || imageDetection.requestType !== 'create') {
      return null;
    }

    log.info('Image generation request detected in natural language', {
      confidence: imageDetection.confidence,
      prompt: imageDetection.extractedPrompt?.substring(0, 50),
    });

    try {
      const prompt = imageDetection.extractedPrompt || ctx.lastUserContent;

      // Determine dimensions from aspect ratio hint
      let width = 1024;
      let height = 1024;
      if (imageDetection.aspectRatioHint === 'landscape') {
        width = ASPECT_RATIOS['16:9'].width;
        height = ASPECT_RATIOS['16:9'].height;
      } else if (imageDetection.aspectRatioHint === 'portrait') {
        width = ASPECT_RATIOS['9:16'].width;
        height = ASPECT_RATIOS['9:16'].height;
      } else if (imageDetection.aspectRatioHint === 'wide') {
        width = ASPECT_RATIOS['16:9'].width;
        height = ASPECT_RATIOS['16:9'].height;
      }

      // Enhance the prompt
      const enhancedPrompt = await enhanceImagePrompt(prompt, {
        type: 'create',
        aspectRatio:
          imageDetection.aspectRatioHint === 'square'
            ? '1:1'
            : imageDetection.aspectRatioHint === 'portrait'
              ? '9:16'
              : '16:9',
      });

      // Create generation record
      const { randomUUID } = await import('crypto');
      const generationId = randomUUID();
      const serviceClient = createServiceRoleClient();

      await untypedFrom(serviceClient, 'generations').insert({
        id: generationId,
        user_id: ctx.userId,
        conversation_id: ctx.conversationId || null,
        type: 'image',
        model: 'flux-2-pro',
        provider: 'bfl',
        prompt: enhancedPrompt,
        input_data: {
          originalPrompt: prompt,
          detectedFromChat: true,
        },
        dimensions: { width, height },
        status: 'processing',
      });

      // Generate the image
      const result = await generateImage(enhancedPrompt, {
        model: 'flux-2-pro',
        width,
        height,
        promptUpsampling: true,
      });

      // Store the image
      const storedUrl = await downloadAndStore(result.imageUrl, ctx.userId, generationId, 'png');

      // Verify the result
      let verification: { matches: boolean; feedback: string } | null = null;
      try {
        const imageResponse = await fetch(result.imageUrl);
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBase64 = Buffer.from(imageBuffer).toString('base64');
          verification = await verifyGenerationResult(prompt, imageBase64);
        }
      } catch {
        // Verification is optional
      }

      // Update generation record
      await untypedFrom(serviceClient, 'generations')
        .update({
          status: 'completed',
          result_url: storedUrl,
          result_data: {
            seed: result.seed,
            enhancedPrompt: result.enhancedPrompt,
            verification: verification || undefined,
          },
          cost_credits: result.cost,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);

      return new Response(
        JSON.stringify({
          type: 'image_generation',
          content:
            verification?.matches === false
              ? `I've generated this image based on your request. ${verification.feedback}\n\n[ref:${storedUrl}]`
              : `I've created this image for you based on: "${prompt}"\n\n[ref:${storedUrl}]`,
          generatedImage: {
            id: generationId,
            type: 'create',
            imageUrl: storedUrl,
            prompt: prompt,
            enhancedPrompt: enhancedPrompt,
            dimensions: { width, height },
            model: 'flux-2-pro',
            seed: result.seed,
            verification: verification || undefined,
          },
          model: 'flux-2-pro',
          provider: 'bfl',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (imgError) {
      const errorMessage = imgError instanceof Error ? imgError.message : 'Image generation failed';
      const errorCode = imgError instanceof BFLError ? imgError.code : 'GENERATION_ERROR';

      log.error('Natural language image generation failed', {
        error: errorMessage,
        code: errorCode,
      });

      // Return an error response so the user knows image gen failed
      // (instead of silently falling through to regular chat)
      return new Response(
        JSON.stringify({
          type: 'image_generation_error',
          content: `I tried to generate an image but it failed: ${errorMessage}. Please try again or rephrase your request.`,
          error: { message: errorMessage, code: errorCode },
        }),
        {
          status: 200, // 200 so the chat UI renders the message
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (detectionError) {
    log.debug('Image request detection failed', { error: detectionError });
    return null; // Detection failure is fine — just means it's not an image request
  }
}

/**
 * Try to handle image editing with an uploaded attachment.
 * Returns a Response if handled, null if not an edit request.
 */
export async function tryImageEditWithAttachment(ctx: ImageRouteContext): Promise<Response | null> {
  if (!isBFLConfigured() || !ctx.isAuthenticated) return null;

  const imageAttachments = getImageAttachments(ctx.messages);
  if (imageAttachments.length === 0) return null;

  try {
    const editDetection = detectEditWithAttachment(ctx.lastUserContent, true);

    if (!editDetection?.isImageRequest || editDetection.requestType !== 'edit') {
      return null;
    }

    log.info('Image edit request detected with attachment', {
      confidence: editDetection.confidence,
      prompt: editDetection.extractedPrompt?.substring(0, 50),
      imageCount: imageAttachments.length,
    });

    try {
      const editPrompt = editDetection.extractedPrompt || ctx.lastUserContent;

      // Enhance the edit prompt with vision analysis
      let enhancedPrompt: string;
      try {
        enhancedPrompt = await enhanceEditPromptWithVision(editPrompt, imageAttachments[0]);
      } catch {
        enhancedPrompt = editPrompt;
      }

      // Create generation record
      const { randomUUID } = await import('crypto');
      const generationId = randomUUID();
      const serviceClient = createServiceRoleClient();

      await untypedFrom(serviceClient, 'generations').insert({
        id: generationId,
        user_id: ctx.userId,
        conversation_id: ctx.conversationId || null,
        type: 'edit',
        model: 'flux-2-pro',
        provider: 'bfl',
        prompt: enhancedPrompt,
        input_data: {
          originalPrompt: editPrompt,
          detectedFromChat: true,
          hasAttachment: true,
        },
        dimensions: { width: 1024, height: 1024 },
        status: 'processing',
      });

      // Prepare image for FLUX edit API
      const imageBase64 = imageAttachments[0].startsWith('data:')
        ? imageAttachments[0]
        : `data:image/png;base64,${imageAttachments[0]}`;

      // Edit the image
      const result = await editImage(enhancedPrompt, [imageBase64], {
        model: 'flux-2-pro',
      });

      // Store the edited image
      const storedUrl = await downloadAndStore(result.imageUrl, ctx.userId, generationId, 'png');

      // Update generation record
      await untypedFrom(serviceClient, 'generations')
        .update({
          status: 'completed',
          result_url: storedUrl,
          result_data: {
            seed: result.seed,
            enhancedPrompt: enhancedPrompt,
          },
          cost_credits: result.cost,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);

      log.info('Image edit complete', { generationId, storedUrl });

      return new Response(
        JSON.stringify({
          type: 'image_generation',
          content: `I've edited your image based on: "${editPrompt}"\n\n[ref:${storedUrl}]`,
          generatedImage: {
            id: generationId,
            type: 'edit',
            imageUrl: storedUrl,
            prompt: editPrompt,
            enhancedPrompt: enhancedPrompt,
            dimensions: { width: 1024, height: 1024 },
            model: 'flux-2-pro',
            seed: result.seed,
          },
          model: 'flux-2-pro',
          provider: 'bfl',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (editError) {
      const errorMessage = editError instanceof Error ? editError.message : 'Image editing failed';
      const errorCode = editError instanceof BFLError ? editError.code : 'EDIT_ERROR';

      log.error('Natural language image editing failed', {
        error: errorMessage,
        code: errorCode,
      });

      return new Response(
        JSON.stringify({
          type: 'image_generation_error',
          content: `I tried to edit the image but it failed: ${errorMessage}. Please try again.`,
          error: { message: errorMessage, code: errorCode },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (editDetectionError) {
    log.debug('Image edit detection failed', { error: editDetectionError });
    return null; // Detection failure is fine — not an edit request
  }
}

/**
 * Try to handle conversational image editing (no attachment, references previous image).
 * Returns a Response if handled, null if not a conversational edit.
 */
export async function tryConversationalImageEdit(ctx: ImageRouteContext): Promise<Response | null> {
  if (!isBFLConfigured() || !ctx.isAuthenticated) return null;

  try {
    const conversationalEditDetection = detectConversationalEdit(ctx.lastUserContent);

    if (
      !conversationalEditDetection?.isImageRequest ||
      conversationalEditDetection.requestType !== 'edit'
    ) {
      return null;
    }

    // Find the most recent generated image URL in conversation history
    const previousImageUrl = findPreviousGeneratedImage(ctx.messages);
    if (!previousImageUrl) return null;

    log.info('Conversational edit request detected', {
      confidence: conversationalEditDetection.confidence,
      prompt: conversationalEditDetection.extractedPrompt?.substring(0, 50),
      previousImage: previousImageUrl.substring(0, 50),
    });

    try {
      const editPrompt = conversationalEditDetection.extractedPrompt || ctx.lastUserContent;

      // SSRF protection: only fetch from known image hosting domains
      const allowedImageDomains = [
        'supabase.co',
        'supabase.in',
        'api.bfl.ml',
        'bfl.ml',
        'replicate.delivery',
        'oaidalleapiprodscus.blob.core.windows.net',
      ];
      try {
        const imageUrl = new URL(previousImageUrl);
        const isDomainAllowed = allowedImageDomains.some(
          (d) => imageUrl.hostname === d || imageUrl.hostname.endsWith(`.${d}`)
        );
        if (!isDomainAllowed) {
          log.warn('Image URL domain not in allowlist', {
            hostname: imageUrl.hostname,
          });
          return null;
        }
      } catch {
        log.warn('Invalid image URL for editing', { url: previousImageUrl.substring(0, 50) });
        return null;
      }

      // Fetch the previous image and convert to base64
      const imageResponse = await fetch(previousImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch previous image: ${imageResponse.status}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;

      // Enhance the edit prompt with vision analysis
      let enhancedPrompt: string;
      try {
        enhancedPrompt = await enhanceEditPromptWithVision(editPrompt, base64Image);
      } catch {
        enhancedPrompt = editPrompt;
      }

      // Create generation record
      const { randomUUID } = await import('crypto');
      const generationId = randomUUID();
      const serviceClient = createServiceRoleClient();

      await untypedFrom(serviceClient, 'generations').insert({
        id: generationId,
        user_id: ctx.userId,
        conversation_id: ctx.conversationId || null,
        type: 'edit',
        model: 'flux-2-pro',
        provider: 'bfl',
        prompt: enhancedPrompt,
        input_data: {
          originalPrompt: editPrompt,
          detectedFromChat: true,
          conversationalEdit: true,
          sourceImageUrl: previousImageUrl,
        },
        dimensions: { width: 1024, height: 1024 },
        status: 'processing',
      });

      // Edit the image
      const result = await editImage(enhancedPrompt, [base64Image], {
        model: 'flux-2-pro',
      });

      // Store the edited image
      const storedUrl = await downloadAndStore(result.imageUrl, ctx.userId, generationId, 'png');

      // Update generation record
      await untypedFrom(serviceClient, 'generations')
        .update({
          status: 'completed',
          result_url: storedUrl,
          result_data: {
            seed: result.seed,
            enhancedPrompt: enhancedPrompt,
          },
          cost_credits: result.cost,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generationId);

      log.info('Conversational image edit complete', { generationId, storedUrl });

      return new Response(
        JSON.stringify({
          type: 'image_generation',
          content: `I've edited the image: "${editPrompt}"\n\n[ref:${storedUrl}]`,
          generatedImage: {
            id: generationId,
            type: 'edit',
            imageUrl: storedUrl,
            prompt: editPrompt,
            enhancedPrompt: enhancedPrompt,
            dimensions: { width: 1024, height: 1024 },
            model: 'flux-2-pro',
            seed: result.seed,
          },
          model: 'flux-2-pro',
          provider: 'bfl',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (editError) {
      const errorMessage = editError instanceof Error ? editError.message : 'Image editing failed';
      const errorCode = editError instanceof BFLError ? editError.code : 'EDIT_ERROR';

      log.error('Conversational image editing failed', {
        error: errorMessage,
        code: errorCode,
      });

      return new Response(
        JSON.stringify({
          type: 'image_generation_error',
          content: `I tried to edit the image but it failed: ${errorMessage}. Please try again.`,
          error: { message: errorMessage, code: errorCode },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (conversationalEditError) {
    log.debug('Conversational edit detection failed', { error: conversationalEditError });
    return null; // Detection failure is fine — not a conversational edit
  }
}
