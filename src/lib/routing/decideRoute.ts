/**
 * Route Decision Helper
 *
 * Determines the appropriate model/target based on user message content.
 * Logs routing decisions for telemetry.
 *
 * Routes (GPT-5 Edition):
 * - image: DALL-E 3 for image generation requests
 * - mini: gpt-5-mini for complex tasks (search, code, files, reasoning)
 * - nano: gpt-5-nano for basic chat (default, cost-optimized)
 */

export type RouteTarget = 'image' | 'mini' | 'nano';

export type RouteReason =
  | 'image-intent'
  | 'image-button'
  | 'image-analysis'
  | 'file-analysis'
  | 'code-task'
  | 'research-task'
  | 'file-operation'
  | 'complex-reasoning'
  | 'light-chat'
  | 'document-request';

export interface RouteDecision {
  target: RouteTarget;
  reason: RouteReason;
  confidence: number; // 0-1 confidence score
  matchedPattern?: string; // The pattern that matched, for debugging
}

/**
 * Document/text output patterns - these should NEVER route to DALL-E
 * DALL-E creates artwork/visual images, NOT readable text documents
 *
 * Rule: If the primary output should be READABLE TEXT, don't use DALL-E
 */
const DOCUMENT_PATTERNS = [
  // Explicit document formats
  /\b(pdf|document|doc|docx|word|text file|txt)\b/i,

  // Business documents
  /\b(memo|memorandum|letter|report|summary|brief|briefing)\b/i,
  /\b(contract|agreement|proposal|quote|quotation|estimate)\b/i,
  /\b(invoice|receipt|bill|statement|order)\b/i,
  /\b(certificate|diploma|license|permit|authorization)\b/i,
  /\b(policy|procedure|guideline|manual|handbook)\b/i,

  // Professional documents
  /\b(resume|résumé|cv|curriculum vitae|cover letter|bio|biography)\b/i,
  /\b(business card|letterhead|form|application)\b/i,

  // Meeting/notes
  /\b(meeting notes|minutes|agenda|schedule|itinerary|plan)\b/i,
  /\b(notes|outline|checklist|todo|to-do|task list)\b/i,

  // Academic/educational
  /\b(essay|paper|thesis|dissertation|assignment|homework)\b/i,
  /\b(syllabus|lesson plan|course|curriculum)\b/i,

  // Communications
  /\b(email|e-mail|newsletter|announcement|notice|memo)\b/i,
  /\b(press release|article|blog post|content)\b/i,

  // Data/structured content
  /\b(spreadsheet|excel|csv|table|chart|graph)\b/i,
  /\b(database|record|entry|log|inventory)\b/i,

  // QR/barcodes (need functional generation, not pictures of them)
  /\bqr\s*code\b/i,
  /\bbarcode\b/i,

  // Legal
  /\b(nda|non-disclosure|terms|conditions|disclaimer|waiver)\b/i,

  // Financial
  /\b(budget|forecast|projection|analysis|financial)\b/i,

  // Scripts/presentations
  /\b(script|screenplay|presentation|slides|powerpoint|deck)\b/i,

  // "Write me" / "Draft" patterns (text output intent)
  /\b(write|draft|compose|type|prepare)\s+(me\s+)?(a|an|the)\b/i,

  // "Create a [document type] for/about/to"
  /\bcreate\s+(a|an)\s+\w+\s+(for|about|to|regarding)\b/i,
];

/**
 * Check if request is for a document/text output (not an image)
 * Returns true if this should NOT go to DALL-E
 */
function isDocumentRequest(text: string): boolean {
  return DOCUMENT_PATTERNS.some(pattern => pattern.test(text));
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

  // Poster/banner specific (visual design)
  /\b(design|create|make)\b.*\b(poster|banner|flyer|cover|thumbnail)\b/i,

  // Logo specific (visual design)
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
 * IMPORTANT: Document requests are EXCLUDED even if they match image patterns
 */
export function hasImageIntent(text: string): { isImage: boolean; matchedPattern?: string; excludedReason?: string } {
  const normalizedText = text.trim();

  // FIRST: Check if this is a document request - these should NEVER go to DALL-E
  if (isDocumentRequest(normalizedText)) {
    return {
      isImage: false,
      excludedReason: 'document-request'
    };
  }

  // Then check for image generation patterns
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

  // Check for complex tasks requiring gpt-5-mini
  const complexCheck = requiresComplexTask(lastUserText);
  if (complexCheck.isComplex && complexCheck.reason) {
    return {
      target: 'mini',
      reason: complexCheck.reason,
      confidence: 0.85,
    };
  }

  // Default to nano for light chat (cost-optimized)
  return {
    target: 'nano',
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
