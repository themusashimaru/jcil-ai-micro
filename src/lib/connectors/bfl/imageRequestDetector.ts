/**
 * IMAGE REQUEST DETECTOR
 *
 * Detects image generation/editing requests in natural language chat messages.
 * Uses pattern matching for common phrases, with Claude fallback for ambiguous cases.
 *
 * CREATION Examples:
 * - "generate an image of a sunset"
 * - "create a picture of a cat"
 * - "draw me a landscape"
 * - "make me a pic of..."
 * - "sketch a portrait"
 * - "gimme an image of..."
 * - "I need a visual showing..."
 * - "can you paint a..."
 *
 * EDITING Examples (when image is attached):
 * - "make this brighter"
 * - "remove the background"
 * - "fix this photo"
 * - "change the colors"
 * - "make it look more professional"
 *
 * SLIDE Examples (generates 16:9 images):
 * - "create a slide about..."
 * - "PowerPoint slide for..."
 * - "presentation visual showing..."
 * - "pitch deck slide..."
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

// =============================================================================
// STRONG CREATE PATTERNS - High confidence image generation
// =============================================================================
const STRONG_CREATE_PATTERNS = [
  // Standard patterns: "create/generate/make an image of..."
  /^(?:please\s+)?(?:generate|create|make|produce|render|draw|paint|design|illustrate|visualize)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|artwork|art|graphic|visual|painting|drawing|render|portrait|landscape|scene)\s+(?:of|showing|depicting|with|that|featuring)/i,
  /^(?:please\s+)?(?:can you|could you|would you)\s+(?:generate|create|make|produce|render|draw|paint|design|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration)/i,
  /^i\s+(?:want|need|would like|'d like)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork)\s+(?:of|showing|depicting|with|that)/i,
  /^(?:show me|give me|get me|gimme)\s+(?:an?\s+)?(?:image|picture|photo|illustration|pic)\s+(?:of|showing)/i,

  // Casual patterns: "draw me a...", "sketch a...", "paint me..."
  /^(?:please\s+)?(?:draw|sketch|paint|illustrate)\s+(?:me\s+)?(?:a|an|some)\s+/i,
  /^(?:can you|could you)\s+(?:draw|sketch|paint)\s+(?:me\s+)?/i,

  // Short casual: "pic of...", "image of...", "photo of..."
  /^(?:a\s+)?(?:pic|picture|image|photo)\s+of\s+.{5,}/i,

  // "Make me a..." patterns
  /^(?:make|create|give)\s+me\s+(?:a|an|some)\s+(?:pic|picture|image|photo|artwork|art|visual|graphic)\s+/i,
  /^(?:make|create|give)\s+me\s+something\s+(?:showing|depicting|with|that\s+looks\s+like)/i,

  // "I need a visual..." patterns
  /^i\s+need\s+(?:a|an|some)\s+(?:visual|graphic|image|picture|artwork)\s+(?:for|of|showing|that)/i,

  // Art-specific patterns
  /^(?:please\s+)?(?:create|make|generate|design)\s+(?:me\s+)?(?:some\s+)?(?:digital\s+)?art\s+(?:of|showing|depicting|for)/i,
  /^(?:concept|digital|pixel)\s+art\s+(?:of|showing|for)\s+/i,

  // Slide creation patterns - generates 16:9 images
  /^(?:please\s+)?(?:create|make|generate|design)\s+(?:me\s+)?(?:a|an)\s+(?:presentation\s+)?slide\s+(?:about|for|on|showing|with|of)/i,
  /^(?:please\s+)?(?:can you|could you)\s+(?:create|make|generate)\s+(?:me\s+)?(?:a|an)\s+slide\s+/i,
  /^(?:make|create|design)\s+(?:me\s+)?(?:a|an)\s+(?:powerpoint|keynote|pitch\s*deck|presentation)\s+slide\s+/i,
  /^(?:i\s+need\s+)?(?:a|an)\s+(?:slide|presentation\s+visual|deck\s+image)\s+(?:for|about|showing|on)\s+/i,
  /^slide\s+(?:for|about|showing|on)\s+.{5,}/i,
];

// =============================================================================
// MEDIUM CREATE PATTERNS - Need more context but likely image generation
// =============================================================================
const MEDIUM_CREATE_PATTERNS = [
  // Partial matches that need context
  /(?:generate|create|make)\s+(?:an?\s+)?(?:image|picture|photo|pic)/i,
  /(?:image|picture|photo|illustration)\s+(?:of|showing|depicting)\s+.{10,}/i,
  /^visualize\s+/i,
  /turn\s+(?:this|that|it)\s+into\s+(?:an?\s+)?(?:image|picture|illustration)/i,

  // "Something showing..." patterns
  /^(?:something|anything)\s+(?:showing|depicting|with|that\s+looks\s+like)\s+/i,

  // Casual requests
  /^(?:gimme|give\s+me)\s+(?:a|an|some)\s+.{5,}\s+(?:pic|picture|image)/i,

  // Art patterns without explicit "create"
  /(?:artwork|illustration|graphic|visual)\s+(?:of|showing|depicting|for)\s+.{10,}/i,

  // Slide patterns (medium confidence)
  /(?:slide|presentation\s+image|deck\s+visual)\s+(?:about|for|on|showing)\s+/i,
];

// =============================================================================
// EDIT PATTERNS - Image editing/modification requests
// =============================================================================
const EDIT_PATTERNS = [
  // Explicit edit requests: "edit/modify/fix this image"
  /(?:edit|modify|change|alter|transform|adjust|fix|improve|enhance|update)\s+(?:this|that|the|my)\s+(?:image|picture|photo|pic)/i,
  /(?:make|turn)\s+(?:this|that|the|my)\s+(?:image|picture|photo|pic)\s+.{3,}/i,
  /(?:in|on)\s+(?:this|that|the)\s+(?:image|picture|photo|pic).{0,20}(?:change|replace|remove|add)/i,

  // Action-based edits (when image is clearly attached)
  /^(?:please\s+)?(?:remove|delete|erase|get\s+rid\s+of)\s+(?:the\s+)?(?:background|person|object|text|watermark)/i,
  /^(?:please\s+)?(?:add|put|place|insert)\s+(?:a|an|some)\s+.{3,}\s+(?:to|in|on)\s+(?:this|the|it)/i,
  /^(?:please\s+)?(?:change|replace|swap)\s+(?:the\s+)?.{3,}\s+(?:to|with|for)/i,

  // Quality/style edits
  /^(?:make|turn)\s+(?:this|it)\s+(?:brighter|darker|warmer|cooler|sharper|blurry|black\s*(?:and|&)?\s*white|sepia|vintage|retro|professional|hd|higher\s+quality)/i,
  /^(?:make|turn)\s+(?:this|it)\s+(?:look\s+)?(?:better|nicer|cleaner|more\s+\w+)/i,
  /^(?:improve|enhance|fix|clean\s*up|touch\s*up|retouch)\s+(?:this|it|the\s+(?:image|photo|picture|pic))/i,

  // Color edits
  /^(?:change|adjust|fix|correct)\s+(?:the\s+)?(?:color|colors|colour|colours|hue|saturation|brightness|contrast)/i,
  /^(?:make|turn)\s+(?:this|it|the\s+colors?)\s+(?:more\s+)?(?:vibrant|muted|saturated|desaturated|colorful|warm|cool)/i,

  // Crop/resize (might not be FLUX but we can detect intent)
  /^(?:crop|resize|zoom\s+in|zoom\s+out|focus\s+on)\s+/i,

  // Background edits
  /^(?:blur|remove|change|replace)\s+(?:the\s+)?background/i,
  /^(?:make|turn)\s+(?:the\s+)?background\s+/i,

  // General "make this..." patterns when image is implied
  /^make\s+(?:this|it)\s+(?:look\s+)?(?:like|into|more|less)\s+/i,
  /^(?:can\s+you\s+)?(?:fix|improve|enhance|clean)\s+this/i,
];

// =============================================================================
// NEGATIVE PATTERNS - These override detection (NOT image generation requests)
// =============================================================================
const NEGATIVE_PATTERNS = [
  // Questions about images (analysis, not generation)
  /^(?:how|what|why|when|where|who|which)\s+/i,
  /(?:explain|describe|tell me about|what is|what are|what does)\s+/i,
  /(?:analyze|examine|look at|review|check|inspect|identify)\s+(?:this|that|the|my)\s+(?:image|picture|photo)/i,
  /(?:what's|what is)\s+(?:in|on|this|that)\s+/i,

  // File operations (not generation)
  /(?:upload|attach|send|share|post)\s+(?:an?\s+)?(?:image|picture|photo)/i,
  /(?:save|download|export|copy)\s+(?:this|that|the)\s+(?:image|picture|photo)/i,

  // Search/find operations
  /(?:find|search|look\s+for|get)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of|from|on)/i,

  // Help/how-to questions
  /^how\s+(?:do|can|to)\s+/i,
  /^can\s+you\s+(?:help|explain|tell|show\s+me\s+how)/i,

  // Reading/extracting text from images
  /(?:read|extract|ocr|transcribe|get\s+the\s+text)\s+(?:from|in)\s+/i,
];

// =============================================================================
// ASPECT RATIO HINTS - Detect intended image dimensions
// =============================================================================
const ASPECT_RATIO_PATTERNS = {
  landscape: /(?:landscape|horizontal|wide|panorama|banner|header|desktop\s+wallpaper)/i,
  portrait: /(?:portrait|vertical|tall|phone|mobile|story|stories|pinterest|poster)/i,
  square: /(?:square|instagram|profile|avatar|icon|thumbnail|1.?1)/i,
  wide: /(?:cinematic|movie|film|widescreen|16.?9|ultrawide|slide|presentation|deck|powerpoint|keynote|pitch)/i,
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
 * Handles various conversational patterns and extracts the core subject
 */
function extractPromptFromMessage(message: string, type: 'create' | 'edit'): string {
  let prompt = message;

  if (type === 'create') {
    // Remove common creation prefixes in order of specificity
    const prefixPatterns = [
      // Politeness + can you patterns
      /^(?:please\s+)?(?:can you|could you|would you)\s+(?:please\s+)?/i,
      // Direct creation verbs
      /^(?:please\s+)?(?:generate|create|make|produce|render|draw|paint|design|illustrate|visualize|sketch)\s+(?:me\s+)?/i,
      // "I want/need" patterns
      /^i\s+(?:want|need|would like|'d like)\s+(?:you\s+to\s+)?(?:create|make|draw|generate)?\s*/i,
      // "Show/give me" patterns
      /^(?:show me|give me|get me|gimme)\s+/i,
      // Remove image type words
      /^(?:an?\s+)?(?:image|picture|photo|illustration|artwork|art|graphic|visual|painting|drawing|render|pic)\s+(?:of|showing|depicting|with|that|featuring)\s+/i,
      // Slide-specific
      /^(?:an?\s+)?(?:slide|presentation\s+(?:slide|visual|image)|deck\s+(?:slide|image))\s+(?:about|for|on|showing|of)\s+/i,
      /^(?:an?\s+)?(?:powerpoint|keynote|pitch\s*deck)\s+slide\s+(?:about|for|on|showing|of)\s+/i,
      // Art-specific
      /^(?:some\s+)?(?:digital\s+|concept\s+|pixel\s+)?art\s+(?:of|showing|depicting|for)\s+/i,
      // "Something showing..."
      /^something\s+(?:showing|depicting|with|that\s+looks\s+like)\s+/i,
    ];

    for (const pattern of prefixPatterns) {
      prompt = prompt.replace(pattern, '');
    }
  } else {
    // Edit mode - extract the edit instruction
    const editPrefixes = [/^(?:please\s+)?(?:can you|could you)\s+/i, /^(?:please\s+)?/i];

    for (const pattern of editPrefixes) {
      prompt = prompt.replace(pattern, '');
    }
  }

  // Clean up
  prompt = prompt.trim();

  // Remove trailing punctuation
  prompt = prompt.replace(/[.!?]+$/, '').trim();

  // If the prompt is too short after extraction, use a cleaned version of original
  if (prompt.length < 5) {
    // Try to extract just the subject from the original
    prompt = message
      .replace(/^(?:please\s+)?(?:can you|could you|would you)\s+/i, '')
      .replace(/^(?:draw|create|make|generate|paint|sketch)\s+(?:me\s+)?/i, '')
      .trim();
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

/**
 * Detect if a message is an image edit request when an image is attached
 * This is more lenient than regular detection since we KNOW an image is present
 *
 * @param message - The user's chat message
 * @param hasImageAttachment - Whether the message includes an image attachment
 * @returns Detection result optimized for edit scenarios
 */
export function detectEditWithAttachment(
  message: string,
  hasImageAttachment: boolean
): ImageRequestDetection | null {
  if (!hasImageAttachment) {
    return null;
  }

  const trimmed = message.trim().toLowerCase();

  // When image is attached, these patterns strongly indicate edit intent
  const attachmentEditPatterns = [
    // Direct edit commands
    /^(?:edit|modify|change|fix|improve|enhance|update|adjust)/i,
    /^(?:make|turn)\s+(?:this|it)\s+/i,

    // Removal commands
    /^(?:remove|delete|erase|get\s+rid\s+of)/i,

    // Addition commands
    /^(?:add|put|place|insert)/i,

    // Style/quality commands
    /^(?:make|turn)\s+(?:this|it)\s+(?:brighter|darker|better|nicer|more|less)/i,

    // Background commands
    /^(?:blur|remove|change|replace)\s+(?:the\s+)?background/i,

    // Color commands
    /^(?:change|adjust|fix)\s+(?:the\s+)?(?:color|colours?)/i,
    /^(?:make|turn)\s+(?:this|it)\s+(?:black\s*(?:and|&)?\s*white|sepia|vintage)/i,

    // Crop/focus commands
    /^(?:crop|zoom|focus)/i,

    // General improvement
    /^(?:clean|touch)\s*up/i,
    /^(?:fix|improve|enhance)\s+(?:this|it)/i,

    // Short casual commands (when image attached, these likely mean edit)
    /^(?:brighter|darker|sharper|blurry|warmer|cooler)/i,
  ];

  for (const pattern of attachmentEditPatterns) {
    if (pattern.test(trimmed)) {
      return {
        isImageRequest: true,
        confidence: 'high',
        extractedPrompt: extractPromptFromMessage(message, 'edit'),
        requestType: 'edit',
        aspectRatioHint: null,
      };
    }
  }

  // Check standard edit patterns too
  for (const pattern of EDIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isImageRequest: true,
        confidence: 'high',
        extractedPrompt: extractPromptFromMessage(message, 'edit'),
        requestType: 'edit',
        aspectRatioHint: null,
      };
    }
  }

  return null;
}
