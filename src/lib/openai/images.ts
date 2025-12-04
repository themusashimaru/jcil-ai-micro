/**
 * Image Generation with Graceful Fallback
 *
 * Implements:
 * - DALL-E 3 image generation
 * - Text description fallback on failure
 * - Retry hints for user refinement
 * - Structured logging for billing
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { httpWithTimeout } from '../http';
import { logImageGeneration } from '../log';

const RETRY_DELAYS = [250, 1000, 3000];
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
const CONNECT_TIMEOUT_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return apiKey;
}

export type ImageSize = '1024x1024' | '512x512' | '256x256';

export interface ImageSuccessResult {
  ok: true;
  image: string;
  model: 'dall-e-3';
  size: ImageSize;
}

export interface ImageFallbackResult {
  ok: false;
  error: string;
  fallbackText: string;
  retryHint: string;
  suggestedPrompts: string[];
}

export type ImageResult = ImageSuccessResult | ImageFallbackResult;

// Image costs for logging
const IMAGE_COSTS: Record<ImageSize, number> = {
  '1024x1024': 0.04,
  '512x512': 0.018,
  '256x256': 0.016,
};

/**
 * Generate an image with automatic fallback to text description
 */
export async function generateImageWithFallback(
  prompt: string,
  size: ImageSize = '1024x1024',
  userId?: string
): Promise<ImageResult> {
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const startTime = Date.now();

  // Try DALL-E 3 with retries
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await httpWithTimeout(`${baseURL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size,
        }),
        timeoutMs: 60_000,
        connectTimeoutMs: CONNECT_TIMEOUT_MS,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const statusCode = response.status;

        if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
          console.log(`[DALL-E 3] Retrying in ${RETRY_DELAYS[attempt]}ms... (status: ${statusCode})`);
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }

        throw new Error(`DALL-E 3 error (${statusCode}): ${errorText}`);
      }

      const data = await response.json();
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      // Log successful generation
      logImageGeneration(
        userId || 'anonymous',
        'dall-e-3',
        size,
        IMAGE_COSTS[size],
        true,
        Date.now() - startTime
      );

      return {
        ok: true,
        image: imageUrl,
        model: 'dall-e-3',
        size,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[DALL-E 3] Error:', lastError.message);

      if (attempt < RETRY_DELAYS.length) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
    }
  }

  // Log failed generation
  logImageGeneration(
    userId || 'anonymous',
    'dall-e-3',
    size,
    0,
    false,
    Date.now() - startTime
  );

  // Generate text fallback
  console.log('[DALL-E 3] Generation failed, creating text fallback');
  return generateTextFallback(prompt, lastError?.message || 'Unknown error');
}

/**
 * Generate a text description fallback when image generation fails
 */
async function generateTextFallback(
  originalPrompt: string,
  errorMessage: string
): Promise<ImageFallbackResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createBasicFallback(originalPrompt, errorMessage);
    }

    const openai = createOpenAI({ apiKey });

    const fallbackPrompt = `The image generation failed for the following prompt.
Provide a vivid textual description of what the image would look like,
plus 3 alternative prompts that might work better.

Original prompt: "${originalPrompt}"
Error: ${errorMessage}

Return in this exact format:
TITLE: [A short title for the image]

DESCRIPTION: [A detailed, vivid description of what the image would show - colors, composition, style, mood, etc. Make it helpful for the user to visualize.]

SUGGESTED PROMPTS:
1. [A more specific version of the prompt]
2. [A variation with different style/lighting]
3. [A simpler version that's more likely to succeed]`;

    const result = await generateText({
      model: openai('gpt-5-mini'),
      prompt: fallbackPrompt,
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    const text = result.text || '';

    // Parse the response (use [\s\S] instead of /s flag for ES5 compatibility)
    const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|DESCRIPTION)/);
    const descMatch = text.match(/DESCRIPTION:\s*([\s\S]+?)(?:\n\s*SUGGESTED|$)/);
    const promptsMatch = text.match(/SUGGESTED PROMPTS:\s*([\s\S]+?)$/);

    const title = titleMatch?.[1]?.trim() || 'Image Description';
    const description = descMatch?.[1]?.trim() || text;
    const promptsText = promptsMatch?.[1] || '';

    // Extract numbered prompts
    const suggestedPrompts = promptsText
      .split(/\n/)
      .filter(line => /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    return {
      ok: false,
      error: 'image-generation-failed',
      fallbackText: `**${title}**\n\n${description}`,
      retryHint: 'You can retry in a minute or adjust the prompt with more concrete style, lighting, or color details.',
      suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : [
        `${originalPrompt}, digital art style`,
        `${originalPrompt}, photorealistic`,
        `Simple illustration of ${originalPrompt}`,
      ],
    };
  } catch (error) {
    console.error('[Image Fallback] Text generation error:', error);
    return createBasicFallback(originalPrompt, errorMessage);
  }
}

/**
 * Create a basic fallback when even text generation fails
 */
function createBasicFallback(prompt: string, _errorMessage: string): ImageFallbackResult {
  return {
    ok: false,
    error: 'image-generation-failed',
    fallbackText: `Image generation was unsuccessful for: "${prompt}"

The system encountered an error while creating your image. This can happen due to:
- High demand on the image generation service
- Content that requires adjustment for safety guidelines
- Temporary service issues

Your prompt describes: ${prompt}`,
    retryHint: 'Try again in a minute, or rephrase your prompt to be more specific about the style and composition you want.',
    suggestedPrompts: [
      `${prompt}, digital illustration style`,
      `${prompt}, minimalist design`,
      `${prompt}, professional quality`,
    ],
  };
}

/**
 * Check if a prompt might trigger content filters
 */
export function mightTriggerFilters(prompt: string): boolean {
  const sensitivePatterns = [
    /\b(violent|gore|blood|weapon|gun)\b/i,
    /\b(nude|naked|sexual|explicit)\b/i,
    /\b(hate|racist|discriminat)\b/i,
    /\b(celebrity|famous person|politician)\b/i,
    /\b(child|children|kid|minor)\b/i,
  ];

  return sensitivePatterns.some(pattern => pattern.test(prompt));
}

/**
 * Suggest prompt improvements
 */
export function suggestPromptImprovements(prompt: string): string[] {
  const suggestions: string[] = [];

  // Check for vague prompts
  if (prompt.length < 20) {
    suggestions.push('Add more detail about style, colors, or composition');
  }

  // Check for missing style
  if (!/style|art|photo|illustration|painting|digital/i.test(prompt)) {
    suggestions.push('Specify an art style (e.g., "digital art", "oil painting", "photorealistic")');
  }

  // Check for missing lighting
  if (!/light|bright|dark|shadow|sun|glow/i.test(prompt)) {
    suggestions.push('Describe the lighting (e.g., "soft lighting", "dramatic shadows")');
  }

  // Check for missing color
  if (!/color|colour|blue|red|green|yellow|orange|purple|black|white/i.test(prompt)) {
    suggestions.push('Mention specific colors you want in the image');
  }

  return suggestions;
}
