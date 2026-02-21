/**
 * SLIDE GENERATOR MODULE
 *
 * Shared slide generation logic for presentation slides.
 * Eliminates code duplication between natural language and button-based generation.
 *
 * Features:
 * - FLUX.2 background image generation
 * - Canvas-based text overlay
 * - Unified progress callbacks
 * - Quality control integration ready
 */

import { generateImage, downloadAndStore, enhanceImagePrompt } from '@/lib/connectors/bfl';
import { ASPECT_RATIOS } from '@/lib/connectors/bfl/models';
import { logger } from '@/lib/logger';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger('SlideGenerator');

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum slides per generation request */
export const MAX_SLIDES_PER_REQUEST = 10;

/** Slide dimensions (16:9 widescreen) */
export const SLIDE_WIDTH = ASPECT_RATIOS['16:9'].width;
export const SLIDE_HEIGHT = ASPECT_RATIOS['16:9'].height;

// =============================================================================
// TYPES
// =============================================================================

/** Input for a single slide to generate */
export interface SlideInput {
  slideNumber: number;
  title: string;
  bullets?: string[];
  prompt: string;
}

/** Result from generating a single slide */
export interface SlideResult {
  slideNumber: number;
  title: string;
  bullets?: string[];
  imageUrl: string;
  generationId: string;
  originalPrompt?: string;
  seed?: number;
  enhancedPrompt?: string;
}

/** Progress callback for streaming updates */
export type ProgressCallback = (message: string) => void;

/** Options for slide generation */
export interface SlideGenerationOptions {
  /** User ID for storage and tracking */
  userId: string;
  /** Optional conversation ID to link slides */
  conversationId?: string | null;
  /** Supabase service client for database operations */
  serviceClient: SupabaseClient;
  /** Progress callback for streaming updates */
  onProgress?: ProgressCallback;
  /** Whether this is a regeneration (for QC auto-fix) */
  isRegeneration?: boolean;
  /** Source of the generation request */
  source?: 'chat' | 'button';
}

// =============================================================================
// SYSTEM PROMPTS
// =============================================================================

/**
 * Get the system prompt for slide design
 * Instructs Claude to create visual-only backgrounds with separate text content
 */
export function getSlideDesignSystemPrompt(
  maxSlides: number = MAX_SLIDES_PER_REQUEST,
  researchContext: string = ''
): string {
  return `You are a presentation designer. The user wants visual presentation slides.

CRITICAL: AI image generators CANNOT render text reliably. Text in generated images comes out garbled and unreadable.

Your task: Create visual slide BACKGROUNDS and GRAPHICS only. The actual text will be overlaid separately.

${researchContext ? `Research context for accurate content:\n${researchContext}\n` : ''}

Rules for IMAGE PROMPTS:
1. DO NOT include any text, words, letters, or numbers in the image prompt
2. Focus on: backgrounds, gradients, icons, graphics, illustrations, patterns, imagery
3. Describe visual elements that support the slide's topic
4. Use 16:9 landscape aspect ratio
5. Professional, clean presentation aesthetic
6. Each slide should have a distinct but cohesive visual theme

Rules for CONTENT:
1. Title: Short, clear slide title (will be rendered as actual text)
2. Bullets: 2-4 key points per slide (will be rendered as actual text)
3. Use accurate, factual information based on research context if provided
4. Structure slides logically: title slide, content slides, conclusion
5. If user specifies slide count, create EXACTLY that many (max ${maxSlides})
6. Default to 4-6 slides if not specified

Output ONLY valid JSON array:
[
  {
    "slideNumber": 1,
    "title": "The actual title text for this slide",
    "bullets": ["Key point 1", "Key point 2", "Key point 3"],
    "prompt": "Visual-only image prompt - NO TEXT. Describe background, colors, graphics, icons, imagery only."
  }
]

Example:
{
  "slideNumber": 1,
  "title": "German Shepherd Nutrition",
  "bullets": ["High protein requirements (22-26%)", "Joint support supplements recommended", "Avoid common allergens like wheat"],
  "prompt": "Professional presentation slide background with dark blue gradient. Centered illustration of a healthy German Shepherd dog in profile view. Subtle paw print pattern in corners. Clean corporate design with soft lighting. Abstract geometric shapes. NO TEXT."
}

IMPORTANT:
- NEVER include text/words/letters in the "prompt" field
- Each prompt should describe ONLY visuals`;
}

// =============================================================================
// PROGRESS HELPERS
// =============================================================================

/**
 * Standard progress messages for slide generation
 * These are internal-only and not shown to users
 * The user just sees "Creating presentation slides..." and then the final result
 */
export const ProgressMessages = {
  // All progress is now silent (internal logging only)
  // Return empty strings so they don't appear in the chat
  researchStart: '',
  researchComplete: '',
  designStart: '',
  designComplete: (_count: number) => '',
  slideStart: (_num: number, _title: string) => '',
  slideBackgroundStart: '',
  slideBackgroundComplete: '',
  slideTextStart: '',
  slideTextComplete: '',
  slideComplete: (_num: number, _title: string) => '',
  slideFailed: (_num: number, _title: string) => '',
  qcStart: '',
  qcRecheck: '',
  qcPassed: (_score: number) => '',
  qcFixing: (_score: number, _count: number) => '',
  qcMaxRetries: (_score: number) => '',
  regenerateStart: (_num: number) => '',
  regenerateComplete: (_num: number) => '',
  regenerateFailed: (_num: number) => '',
  autoImproved: (_count: number) => '',
};

// =============================================================================
// CORE GENERATION FUNCTION
// =============================================================================

/**
 * Generate a single slide with background and text overlay
 *
 * This is the core function used by both natural language and button-based paths.
 * It handles:
 * 1. Prompt enhancement
 * 2. Database record creation
 * 3. FLUX.2 background generation
 * 4. Canvas text overlay
 * 5. Storage to Supabase
 * 6. Database record update
 */
export async function generateSingleSlide(
  slide: SlideInput,
  options: SlideGenerationOptions
): Promise<SlideResult | null> {
  const { userId, conversationId, serviceClient, isRegeneration, source } = options;
  // Note: onProgress is no longer used since text overlay was removed

  try {
    // Generate unique ID for this slide
    const { randomUUID } = await import('crypto');
    const genId = randomUUID();

    // Enhance the visual prompt
    const enhancedPrompt = await enhanceImagePrompt(slide.prompt, {
      type: 'create',
      aspectRatio: '16:9',
    });

    // Create generation record in database
    await untypedFrom(serviceClient, 'generations').insert({
      id: genId,
      user_id: userId,
      conversation_id: conversationId || null,
      type: 'slide',
      model: 'flux-2-pro',
      provider: 'bfl',
      prompt: enhancedPrompt,
      input_data: {
        originalPrompt: slide.prompt,
        slideNumber: slide.slideNumber,
        slideTitle: slide.title,
        bullets: slide.bullets || [],
        detectedFromChat: source === 'chat',
        fromButton: source === 'button',
        isRegeneration: isRegeneration || false,
      },
      dimensions: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      status: 'processing',
    });

    // Step 1: Generate the background image via FLUX
    const result = await generateImage(enhancedPrompt, {
      model: 'flux-2-pro',
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      promptUpsampling: true,
    });

    // Step 2: Store the generated image directly
    // Text content is displayed separately in markdown (more reliable than SVG text on serverless)
    const storedUrl = await downloadAndStore(result.imageUrl, userId, genId);

    // Step 3: Update generation record with results
    await untypedFrom(serviceClient, 'generations')
      .update({
        status: 'completed',
        result_url: storedUrl,
        result_data: {
          seed: result.seed,
          enhancedPrompt: result.enhancedPrompt,
        },
        cost_credits: result.cost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', genId);

    log.info('Slide generated successfully', {
      slideNumber: slide.slideNumber,
      generationId: genId,
      isRegeneration,
    });

    return {
      slideNumber: slide.slideNumber,
      title: slide.title,
      bullets: slide.bullets,
      imageUrl: storedUrl,
      generationId: genId,
      originalPrompt: slide.prompt,
      seed: result.seed,
      enhancedPrompt: result.enhancedPrompt,
    };
  } catch (error) {
    log.error('Failed to generate slide', {
      slideNumber: slide.slideNumber,
      isRegeneration,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Generate multiple slides with progress tracking
 *
 * @param slides - Array of slide inputs to generate
 * @param options - Generation options including callbacks
 * @returns Array of successfully generated slides
 */
export async function generateSlides(
  slides: SlideInput[],
  options: SlideGenerationOptions
): Promise<SlideResult[]> {
  const { onProgress } = options;
  const results: SlideResult[] = [];

  for (const slide of slides) {
    onProgress?.(ProgressMessages.slideStart(slide.slideNumber, slide.title));

    const result = await generateSingleSlide(slide, options);

    if (result) {
      results.push(result);
      onProgress?.(ProgressMessages.slideComplete(slide.slideNumber, slide.title));
    } else {
      onProgress?.(ProgressMessages.slideFailed(slide.slideNumber, slide.title));
    }
  }

  return results;
}

/**
 * Parse slide prompts from Claude's JSON response
 */
export function parseSlidePrompts(
  jsonText: string
): Array<{ slideNumber: number; title: string; bullets?: string[]; prompt: string }> {
  // Clean up the JSON if wrapped in code blocks
  let cleaned = jsonText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned) as Array<{
    slideNumber: number;
    title: string;
    bullets?: string[];
    prompt: string;
  }>;

  // Enforce max slides limit
  if (parsed.length > MAX_SLIDES_PER_REQUEST) {
    return parsed.slice(0, MAX_SLIDES_PER_REQUEST);
  }

  return parsed;
}

/**
 * Format final slide output for streaming to the user
 */
export function formatSlideOutput(slides: SlideResult[]): string {
  let output = `\n---\n\n## Your ${slides.length} Presentation Slide${slides.length > 1 ? 's' : ''}\n\n`;

  for (const slide of slides) {
    output += `### Slide ${slide.slideNumber}: ${slide.title}\n\n`;

    if (slide.bullets && slide.bullets.length > 0) {
      for (const bullet of slide.bullets) {
        output += `- ${bullet}\n`;
      }
      output += '\n';
    }

    output += `[![Slide ${slide.slideNumber}](${slide.imageUrl})](${slide.imageUrl})\n\n`;
  }

  return output;
}

/**
 * Generate the JSON metadata for slide generation completion
 * Wrapped in HTML comment to hide from user view while allowing frontend parsing
 */
export function generateSlideCompletionMetadata(
  _slides: SlideResult[],
  _qcResult?: {
    passed: boolean;
    overallScore: number;
    feedback: string;
    issues: string[];
  } | null,
  _regeneratedCount?: number
): string {
  // Return empty string - metadata now stored in database, no need to display
  // The slide images and content are already shown to the user above
  // Frontend can fetch slide details from the generations table if needed
  return '';
}
