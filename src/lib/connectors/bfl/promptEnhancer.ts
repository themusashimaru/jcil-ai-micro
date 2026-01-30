/**
 * PROMPT ENHANCER
 *
 * Uses Claude to automatically enhance user prompts for better image generation.
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
