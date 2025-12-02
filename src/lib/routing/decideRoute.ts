/**
 * Route Decision Helper
 *
 * Determines the appropriate model/target based on user message content.
 * Logs routing decisions for telemetry.
 *
 * Routes:
 * - image: DALL-E 3 for image generation requests
 * - 4o: GPT-4o for complex tasks (code, research, file operations)
 * - mini: GPT-4o-mini for light chat (default)
 */

export type RouteTarget = 'image' | '4o' | 'mini';

export type RouteReason =
  | 'image-intent'
  | 'image-button'
  | 'code-task'
  | 'research-task'
  | 'file-operation'
  | 'complex-reasoning'
  | 'light-chat';

export interface RouteDecision {
  target: RouteTarget;
  reason: RouteReason;
  confidence: number; // 0-1 confidence score
  matchedPattern?: string; // The pattern that matched, for debugging
}

/**
 * Image intent detection patterns
 * Matches requests like "generate/create/draw/make an image/picture/logo..."
 */
const IMAGE_INTENT_PATTERNS = [
  // Direct image generation requests (including "pic" shorthand)
  /\b(generate|create|make|draw|render|design|paint|sketch|illustrate)\b.*\b(image|picture|pic|logo|poster|icon|thumbnail|art|artwork|illustration|photo|graphic|banner|avatar|portrait|scene|landscape)\b/i,

  // Reverse order: "image of...", "picture of...", "pic of..."
  /\b(image|picture|pic|logo|poster|icon|thumbnail|art|artwork|illustration|photo|graphic|banner|avatar|portrait)\b.*\b(of|showing|depicting|with)\b/i,

  // "Can you draw/create..." style
  /\bcan you\b.*\b(draw|create|generate|make|design|render)\b.*\b(image|picture|pic|logo|art|illustration)\b/i,

  // "I want/need an image of..."
  /\b(i want|i need|i'd like|give me|show me)\b.*\b(image|picture|pic|logo|illustration|art)\b/i,

  // Emoji prefix pattern (from button)
  /^🎨\s*Generate image:/i,

  // "create/make/draw for me" patterns
  /\b(draw|create|make|generate)\s+(for\s+me|me)\s+(a|an)\b/i,

  // Simple patterns: "draw me a...", "make a logo"
  /\b(draw me|make me|create me)\b.*\b(a|an|the)\b/i,

  // Poster/banner specific
  /\b(design|create|make)\b.*\b(poster|banner|flyer|cover|thumbnail)\b/i,

  // Logo specific
  /\b(logo|brand|branding)\b.*\b(for|design|create|with)\b/i,
  /\b(create|design|make)\b.*\blogo\b/i,

  // Direct "pic of" or "picture of" at start
  /^(a\s+)?(pic|picture|image)\s+(of|showing)\s+/i,
];

/**
 * Complex task patterns that require GPT-4o
 */
const COMPLEX_TASK_PATTERNS = {
  code: [
    /\b(write|create|fix|debug|refactor|implement|update|modify)\b.*\b(code|function|class|component|file|script)\b/i,
    /\b(github|git|commit|push|pull|merge|pr|pull request)\b/i,
    /\b(typescript|javascript|python|java|rust|go|ruby|php|c\+\+|swift)\b/i,
    /\b(api|endpoint|route|handler|middleware|controller)\b/i,
    /\b(database|sql|query|migration|schema)\b/i,
    /\b(deploy|vercel|supabase|aws|docker|kubernetes)\b/i,
  ],
  research: [
    /\b(research|investigate|analyze|compare|evaluate)\b.*\b(in detail|thoroughly|comprehensive)\b/i,
    /\bsearch\b.*\b(for|about|regarding)\b/i,
    /\b(find|lookup|look up)\b.*\b(information|data|sources|articles)\b/i,
  ],
  fileOperation: [
    /\b(open|read|edit|modify|update|create)\b.*\b(file|document|spreadsheet)\b/i,
    /\b(analyze|process|parse)\b.*\b(csv|xlsx|excel|pdf|json|xml)\b/i,
  ],
  complexReasoning: [
    /\b(explain|analyze|compare|evaluate)\b.*\b(in detail|step by step|thoroughly)\b/i,
    /\bwhat (are|is) the (difference|comparison|pros and cons)\b/i,
    /\b(comprehensive|detailed|thorough)\b.*\b(analysis|explanation|review)\b/i,
  ],
};

/**
 * Parse size from user text
 * Supports formats like "256x256", "512", "1024x1024"
 */
export function parseSizeFromText(text: string): '1024x1024' | '512x512' | '256x256' {
  // Check for explicit size mentions
  if (/\b256\s*x?\s*256\b/i.test(text) || /\b256\b/.test(text)) {
    return '256x256';
  }
  if (/\b512\s*x?\s*512\b/i.test(text) || /\b512\b/.test(text)) {
    return '512x512';
  }
  // Default to 1024x1024 (highest quality)
  return '1024x1024';
}

/**
 * Check if a message indicates image generation intent
 */
export function hasImageIntent(text: string): { isImage: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  for (const pattern of IMAGE_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isImage: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isImage: false };
}

/**
 * Check if a message requires complex task handling (GPT-4o)
 */
function requiresComplexTask(text: string): { isComplex: boolean; reason?: RouteReason } {
  const normalizedText = text.toLowerCase();

  // Check code patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.code) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'code-task' };
    }
  }

  // Check research patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.research) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'research-task' };
    }
  }

  // Check file operation patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.fileOperation) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'file-operation' };
    }
  }

  // Check complex reasoning patterns
  for (const pattern of COMPLEX_TASK_PATTERNS.complexReasoning) {
    if (pattern.test(normalizedText)) {
      return { isComplex: true, reason: 'complex-reasoning' };
    }
  }

  return { isComplex: false };
}

/**
 * Main routing decision function
 *
 * @param lastUserText - The last user message text
 * @param toolOverride - Optional tool override from button selection (e.g., 'image')
 * @returns RouteDecision with target, reason, and confidence
 */
export function decideRoute(
  lastUserText: string,
  toolOverride?: string
): RouteDecision {
  // If tool is explicitly set to image (button press), route to image
  if (toolOverride === 'image' || toolOverride === 'video') {
    return {
      target: 'image',
      reason: 'image-button',
      confidence: 1.0,
      matchedPattern: 'tool-override',
    };
  }

  // Check for image intent in the message
  const imageCheck = hasImageIntent(lastUserText);
  if (imageCheck.isImage) {
    return {
      target: 'image',
      reason: 'image-intent',
      confidence: 0.9,
      matchedPattern: imageCheck.matchedPattern,
    };
  }

  // Check for complex tasks requiring GPT-4o
  const complexCheck = requiresComplexTask(lastUserText);
  if (complexCheck.isComplex && complexCheck.reason) {
    return {
      target: '4o',
      reason: complexCheck.reason,
      confidence: 0.85,
    };
  }

  // Default to mini for light chat
  return {
    target: 'mini',
    reason: 'light-chat',
    confidence: 0.7,
  };
}

/**
 * Log route decision for telemetry
 */
export function logRouteDecision(
  userId: string,
  decision: RouteDecision,
  promptPreview?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    target: decision.target,
    reason: decision.reason,
    confidence: decision.confidence,
    matchedPattern: decision.matchedPattern,
    promptPreview: promptPreview?.slice(0, 50),
  };

  console.log('[Route Decision]', JSON.stringify(logEntry));
}
