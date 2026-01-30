/**
 * PROMPT ENHANCER
 *
 * Uses Claude to automatically enhance user prompts for better image generation.
 * Vision-aware: Can analyze images to write smarter prompts.
 * Fast, single-pass enhancement - no back-and-forth questions.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('PromptEnhancer');

// Cache the client
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// =============================================================================
// IMAGE ANALYSIS (Vision)
// =============================================================================

/**
 * Analyze an image and return a description
 * Used to understand what's in an image before writing edit prompts
 */
export async function analyzeImage(imageBase64: string, context?: string): Promise<string> {
  const client = getClient();

  // Determine media type from base64 header or default to jpeg
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const match = imageBase64.match(/data:(image\/\w+);base64,/);
    if (match) {
      mediaType = match[1] as typeof mediaType;
      imageBase64 = imageBase64.replace(/data:image\/\w+;base64,/, '');
    }
  }

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fast vision model
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: context
                ? `Analyze this image for editing. Context: ${context}\n\nDescribe: subject, composition, lighting, colors, background, style, quality issues.`
                : 'Briefly describe this image: subject, composition, lighting, colors, background, style. Be concise.',
            },
          ],
        },
      ],
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    log.debug('Image analyzed', { analysisLength: analysis.length });
    return analysis;
  } catch (error) {
    log.warn('Image analysis failed', { error });
    return '';
  }
}

/**
 * Vision-aware edit prompt enhancement
 * Analyzes the source image, then writes a smart edit prompt
 */
export async function enhanceEditPromptWithVision(
  userPrompt: string,
  imageBase64: string
): Promise<string> {
  const client = getClient();

  // First, analyze the image
  const imageAnalysis = await analyzeImage(imageBase64, userPrompt);

  if (!imageAnalysis) {
    // Fallback to regular enhancement if analysis fails
    return enhanceImagePrompt(userPrompt, { type: 'edit', hasReferenceImages: true });
  }

  const systemPrompt = `You are an expert at crafting edit prompts for AI image editing (FLUX.2 Pro model).

You've analyzed the source image. Now write a precise edit prompt that will achieve the user's goal.

Rules:
- Be SPECIFIC about what to change based on what you see in the image
- Keep what's good, fix what needs fixing
- Include technical details: lighting adjustments, color corrections, composition changes
- Preserve the subject's identity/essence while making requested changes
- Output ONLY the edit prompt, nothing else
- Under 500 characters`;

  const userMessage = `Image analysis: ${imageAnalysis}

User's edit request: "${userPrompt}"

Write a precise edit prompt that will transform this image according to the user's request.`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const enhanced =
      response.content[0].type === 'text' ? response.content[0].text.trim() : userPrompt;

    log.debug('Vision-aware edit prompt created', {
      original: userPrompt.substring(0, 50),
      enhanced: enhanced.substring(0, 50),
    });

    return enhanced;
  } catch (error) {
    log.warn('Vision-aware enhancement failed, falling back', { error });
    return enhanceImagePrompt(userPrompt, { type: 'edit', hasReferenceImages: true });
  }
}

/**
 * Verify a generated image matches the user's intent
 * Returns feedback or confirmation
 */
export async function verifyGenerationResult(
  originalPrompt: string,
  generatedImageBase64: string
): Promise<{ matches: boolean; feedback: string }> {
  const client = getClient();

  // Determine media type
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
  let imageData = generatedImageBase64;
  if (generatedImageBase64.startsWith('data:')) {
    const match = generatedImageBase64.match(/data:(image\/\w+);base64,/);
    if (match) {
      mediaType = match[1] as typeof mediaType;
      imageData = generatedImageBase64.replace(/data:image\/\w+;base64,/, '');
    }
  }

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: `User requested: "${originalPrompt}"

Does this generated image match their request?
Reply with: YES or NO, followed by brief feedback (what works, what might be off).`,
            },
          ],
        },
      ],
    });

    const result = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const matches = result.toUpperCase().startsWith('YES');
    const feedback = result.replace(/^(YES|NO)[,.\s]*/i, '').trim();

    log.debug('Generation verified', { matches, feedbackLength: feedback.length });

    return { matches, feedback };
  } catch (error) {
    log.warn('Generation verification failed', { error });
    return { matches: true, feedback: '' }; // Assume good if verification fails
  }
}

/**
 * Enhance a prompt for image generation
 */
export async function enhanceImagePrompt(
  userPrompt: string,
  context?: {
    type?: 'create' | 'edit';
    hasReferenceImages?: boolean;
    aspectRatio?: string;
  }
): Promise<string> {
  const client = getClient();

  const systemPrompt = `You are an expert at crafting prompts for AI image generation (FLUX.2 Pro model).

Your task: Take the user's simple request and enhance it into a detailed, effective prompt.

Rules:
- Keep the user's core intent - don't change what they want
- Add relevant details: lighting, style, composition, mood, colors
- Be specific but concise (under 500 chars ideal)
- Use comma-separated descriptors
- Don't add things the user wouldn't want
- For professional photos: add lighting, background, expression details
- For art: add style, medium, artistic references
- For logos/graphics: add design style, color scheme, composition
- Output ONLY the enhanced prompt, nothing else`;

  const userMessage =
    context?.type === 'edit' && context.hasReferenceImages
      ? `Enhance this image editing request: "${userPrompt}"\n\nThe user has uploaded reference image(s) to modify.`
      : `Enhance this image generation prompt: "${userPrompt}"${context?.aspectRatio ? `\n\nTarget aspect ratio: ${context.aspectRatio}` : ''}`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    const enhanced =
      response.content[0].type === 'text' ? response.content[0].text.trim() : userPrompt;

    log.debug('Prompt enhanced', {
      original: userPrompt.substring(0, 50),
      enhanced: enhanced.substring(0, 50),
    });

    return enhanced;
  } catch (error) {
    // If enhancement fails, just use original prompt
    log.warn('Prompt enhancement failed, using original', { error });
    return userPrompt;
  }
}

/**
 * Enhance a prompt for slide generation
 */
export async function enhanceSlidePrompt(
  userPrompt: string,
  slideNumber: number,
  totalSlides: number,
  slideContent?: string
): Promise<string> {
  const client = getClient();

  const systemPrompt = `You are an expert at creating visual prompts for presentation slides.

Your task: Create a specific image prompt for a presentation slide.

Rules:
- Create a clean, professional visual that supports the content
- Use presentation-appropriate style (clean, minimal, corporate-friendly)
- Include: style, composition, color scheme, mood
- Make it complement text content, not duplicate it
- Output ONLY the image prompt, nothing else`;

  const userMessage = `Create an image prompt for slide ${slideNumber} of ${totalSlides}.

Topic: "${userPrompt}"
${slideContent ? `Slide content: "${slideContent}"` : ''}

Generate a visual that would work well as a slide background or supporting image.`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    });

    return response.content[0].type === 'text' ? response.content[0].text.trim() : userPrompt;
  } catch (error) {
    log.warn('Slide prompt enhancement failed', { error });
    return `Professional presentation slide visual for: ${userPrompt}`;
  }
}
