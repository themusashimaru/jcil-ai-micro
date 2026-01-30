/**
 * IMAGE REQUEST DETECTOR
 *
 * Detects image generation/editing requests in natural language chat messages.
 * Uses pattern matching for common phrases, with Claude fallback for ambiguous cases.
 *
 * Examples that should trigger:
 * - "generate an image of a sunset"
 * - "create a picture of a cat"
 * - "make me an illustration of..."
 * - "I want an image that shows..."
 * - "can you draw a landscape?"
 * - "visualize this concept as an image"
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('ImageRequestDetector');

// =============================================================================
// TYPES
// =============================================================================

export interface ImageRequestDetection {
  isImageRequest: boolean;
  confidence: 'high' | 'medium' | 'low';
  extractedPrompt: string | null;
  requestType: 'create' | 'edit' | null;
  aspectRatioHint?: 'landscape' | 'portrait' | 'square' | 'wide' | null;
}

// =============================================================================
// PATTERN-BASED DETECTION (Fast, no API calls)
// =============================================================================

// Strong indicators - high confidence
const STRONG_CREATE_PATTERNS = [
  /^(?:please\s+)?(?:generate|create|make|produce|render|draw|paint|design|illustrate|visualize)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|artwork|art|graphic|visual|painting|drawing|render|portrait|landscape|scene)\s+(?:of|showing|depicting|with|that|featuring)/i,
  /^(?:please\s+)?(?:can you|could you|would you)\s+(?:generate|create|make|produce|render|draw|paint|design|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration)/i,
  /^i\s+(?:want|need|would like|'d like)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork)\s+(?:of|showing|depicting|with|that)/i,
  /^(?:show me|give me|get me)\s+(?:an?\s+)?(?:image|picture|photo|illustration)\s+(?:of|showing)/i,
];

// Medium indicators - need more context
const MEDIUM_CREATE_PATTERNS = [
  /(?:generate|create|make)\s+(?:an?\s+)?(?:image|picture|photo)/i,
  /(?:image|picture|photo|illustration)\s+(?:of|showing|depicting)\s+.{10,}/i,
  /^visualize\s+/i,
  /turn\s+(?:this|that|it)\s+into\s+(?:an?\s+)?(?:image|picture|illustration)/i,
];

// Edit indicators
const EDIT_PATTERNS = [
  /(?:edit|modify|change|alter|transform|adjust|fix|improve|enhance)\s+(?:this|that|the|my)\s+(?:image|picture|photo)/i,
  /(?:make|turn)\s+(?:this|that|the|my)\s+(?:image|picture|photo)\s+.{5,}/i,
  /(?:in|on)\s+(?:this|that|the)\s+(?:image|picture|photo).{0,20}(?:change|replace|remove|add)/i,
];

// Negative patterns - these override detection
const NEGATIVE_PATTERNS = [
  /(?:how|what|why|when|where|who|which|explain|describe|tell me about|what is|what are|what does)/i,
  /(?:analyze|examine|look at|review|check)\s+(?:this|that|the|my)\s+(?:image|picture|photo)/i,
  /(?:what's|what is)\s+in\s+(?:this|that|the)\s+(?:image|picture|photo)/i,
  /(?:upload|attach|send|share)\s+(?:an?\s+)?(?:image|picture|photo)/i,
  /(?:save|download|export)\s+(?:this|that|the)\s+(?:image|picture|photo)/i,
];

// Aspect ratio hints
const ASPECT_RATIO_PATTERNS = {
  landscape: /(?:landscape|horizontal|wide|panorama|banner|header)/i,
  portrait: /(?:portrait|vertical|tall|phone|mobile)/i,
  square: /(?:square|instagram|profile|avatar|icon)/i,
  wide: /(?:cinematic|movie|film|widescreen|16.?9|ultrawide)/i,
};

/**
 * Fast pattern-based detection (no API calls)
 */
function patternBasedDetection(message: string): ImageRequestDetection | null {
  const trimmed = message.trim();

  // Check negative patterns first
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return null; // Not an image request
    }
  }

  // Check strong create patterns
  for (const pattern of STRONG_CREATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      const prompt = extractPromptFromMessage(trimmed, 'create');
      const aspectHint = detectAspectRatioHint(trimmed);
      return {
        isImageRequest: true,
        confidence: 'high',
        extractedPrompt: prompt,
        requestType: 'create',
        aspectRatioHint: aspectHint,
      };
    }
  }

  // Check edit patterns
  for (const pattern of EDIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isImageRequest: true,
        confidence: 'medium',
        extractedPrompt: extractPromptFromMessage(trimmed, 'edit'),
        requestType: 'edit',
        aspectRatioHint: null,
      };
    }
  }

  // Check medium create patterns
  for (const pattern of MEDIUM_CREATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      const prompt = extractPromptFromMessage(trimmed, 'create');
      const aspectHint = detectAspectRatioHint(trimmed);
      return {
        isImageRequest: true,
        confidence: 'medium',
        extractedPrompt: prompt,
        requestType: 'create',
        aspectRatioHint: aspectHint,
      };
    }
  }

  return null;
}

/**
 * Extract the image description from the message
 */
function extractPromptFromMessage(message: string, _type: 'create' | 'edit'): string {
  let prompt = message;

  // Remove common prefixes
  const prefixPatterns = [
    /^(?:please\s+)?(?:can you|could you|would you)\s+/i,
    /^(?:please\s+)?(?:generate|create|make|produce|render|draw|paint|design|illustrate|visualize)\s+(?:me\s+)?/i,
    /^i\s+(?:want|need|would like|'d like)\s+/i,
    /^(?:show me|give me|get me)\s+/i,
    /^(?:an?\s+)?(?:image|picture|photo|illustration|artwork|art|graphic|visual|painting|drawing|render)\s+(?:of|showing|depicting|with|that|featuring)\s+/i,
  ];

  for (const pattern of prefixPatterns) {
    prompt = prompt.replace(pattern, '');
  }

  // Clean up
  prompt = prompt.trim();

  // Remove trailing punctuation
  prompt = prompt.replace(/[.!?]+$/, '').trim();

  // If the prompt is too short, use the original message
  if (prompt.length < 10) {
    prompt = message;
  }

  return prompt;
}

/**
 * Detect aspect ratio hints in the message
 */
function detectAspectRatioHint(
  message: string
): 'landscape' | 'portrait' | 'square' | 'wide' | null {
  for (const [ratio, pattern] of Object.entries(ASPECT_RATIO_PATTERNS)) {
    if (pattern.test(message)) {
      return ratio as 'landscape' | 'portrait' | 'square' | 'wide';
    }
  }
  return null;
}

// =============================================================================
// CLAUDE-BASED DETECTION (For ambiguous cases)
// =============================================================================

/**
 * Use Claude to detect if a message is an image generation request
 * Only called for ambiguous cases where pattern matching is uncertain
 */
async function claudeBasedDetection(message: string): Promise<ImageRequestDetection | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.warn('Anthropic API key not configured for Claude-based detection');
    return null;
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Analyze this user message and determine if they want an AI to GENERATE a new image (not just discuss images).

User message: "${message}"

Respond ONLY with valid JSON (no markdown):
{
  "isImageRequest": true/false,
  "confidence": "high"/"medium"/"low",
  "extractedPrompt": "the cleaned prompt for image generation" or null,
  "requestType": "create"/"edit" or null,
  "aspectRatioHint": "landscape"/"portrait"/"square"/"wide" or null
}

Rules:
- "isImageRequest" is true ONLY if they clearly want to CREATE or GENERATE a new image
- Questions about images, requests to analyze images, or upload requests are NOT image generation requests
- Extract the core subject matter for "extractedPrompt", removing conversational parts
- "requestType" is "edit" if they want to modify an existing image, "create" for new images`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    const result = JSON.parse(content.text) as ImageRequestDetection;
    return result;
  } catch (error) {
    log.error('Claude-based detection failed', { error });
    return null;
  }
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

export interface DetectionOptions {
  useClaude?: boolean; // Whether to use Claude for ambiguous cases (default: false)
  minConfidence?: 'high' | 'medium' | 'low'; // Minimum confidence to return (default: 'medium')
}

/**
 * Detect if a chat message is an image generation request
 *
 * @param message - The user's chat message
 * @param options - Detection options
 * @returns Detection result or null if not an image request
 */
export async function detectImageRequest(
  message: string,
  options: DetectionOptions = {}
): Promise<ImageRequestDetection | null> {
  const { useClaude = false, minConfidence = 'medium' } = options;

  // Skip very short messages
  if (message.trim().length < 10) {
    return null;
  }

  // Skip messages that look like code or technical content
  if (message.includes('```') || message.includes('function ') || message.includes('const ')) {
    return null;
  }

  // Try pattern-based detection first (fast)
  const patternResult = patternBasedDetection(message);

  if (patternResult) {
    // Check if confidence meets threshold
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    if (confidenceOrder[patternResult.confidence] >= confidenceOrder[minConfidence]) {
      log.debug('Image request detected via pattern matching', {
        message: message.substring(0, 50),
        confidence: patternResult.confidence,
      });
      return patternResult;
    }
  }

  // If Claude is enabled and pattern detection found something but low confidence, use Claude
  if (useClaude && patternResult && patternResult.confidence === 'low') {
    log.debug('Using Claude for ambiguous detection', { message: message.substring(0, 50) });
    const claudeResult = await claudeBasedDetection(message);
    if (claudeResult) {
      return claudeResult;
    }
  }

  // If no pattern match but Claude is enabled, try Claude for edge cases
  if (useClaude && !patternResult) {
    // Only use Claude for messages that might contain image-related words
    const mightBeImageRelated =
      /(?:image|picture|photo|visual|art|draw|paint|illustration|graphic|render|generate|create|make)/i.test(
        message
      );
    if (mightBeImageRelated) {
      log.debug('Using Claude for potential image request', { message: message.substring(0, 50) });
      return await claudeBasedDetection(message);
    }
  }

  return patternResult;
}

/**
 * Quick synchronous check without Claude (for initial filtering)
 */
export function quickDetectImageRequest(message: string): boolean {
  const result = patternBasedDetection(message);
  return result !== null && result.isImageRequest;
}
