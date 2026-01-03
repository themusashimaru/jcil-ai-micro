/**
 * Route Decision Helper
 *
 * Determines the appropriate model/target based on user message content.
 * Logs routing decisions for telemetry.
 *
 * Routes (GPT-5 Edition):
 * - video: Sora for video generation requests (admin only)
 * - image: DALL-E 3 for image generation requests
 * - mini: gpt-5-mini for complex tasks (search, code, files, reasoning)
 * - nano: gpt-5-nano for basic chat (default, cost-optimized)
 */

export type RouteTarget = 'video' | 'image' | 'website' | 'github' | 'mini' | 'nano';

export type RouteReason =
  | 'video-intent'
  | 'video-button'
  | 'image-intent'
  | 'image-button'
  | 'image-analysis'
  | 'file-analysis'
  | 'website-intent'
  | 'website-button'
  | 'github-intent'
  | 'github-button'
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
 * Website/landing page intent detection patterns
 * Matches requests like "create a landing page", "build a website"
 */
const WEBSITE_INTENT_PATTERNS = [
  // Direct website/landing page requests
  /\b(create|make|build|generate|design)\b.*\b(landing\s*page|website|webpage|web\s*page|web\s*app|site)\b/i,

  // Reverse order
  /\b(landing\s*page|website|webpage|web\s*app)\b.*\b(for|about|with)\b/i,

  // Give me / I want patterns
  /\b(give\s+me|i\s+want|i\s+need)\b.*\b(landing\s*page|website|webpage)\b/i,

  // Code/HTML specific
  /\b(html|frontend|ui)\s+(code|page)?\s+(for|about)\b/i,
  /\b(spin\s*up|scaffold|bootstrap)\b.*\b(landing\s*page|website|site|app)\b/i,

  // Business landing pages (common requests)
  /\b(auto\s*detailing|car\s*wash|cleaning|plumbing|restaurant|salon|gym|fitness|dental|law\s*firm|agency|barbershop|landscaping|hvac|roofing|photography|wedding|bakery|florist|spa)\b.*\b(landing\s*page|website|page|site)\b/i,
  /\b(landing\s*page|website|page|site)\b.*\b(auto\s*detailing|car\s*wash|cleaning|plumbing|restaurant|salon|gym|fitness|dental|law\s*firm|agency|barbershop|landscaping|hvac|roofing|photography|wedding|bakery|florist|spa)\b/i,
];

/**
 * GitHub/code review intent detection patterns
 * Matches requests like "review my repo", "analyze github.com/..."
 */
const GITHUB_INTENT_PATTERNS = [
  // Explicit GitHub URL references
  /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/i,
  /github\.com\/[^/\s]+\/[^/\s]+/i,

  // Review/analyze repository patterns
  /\b(review|analyze|check|look at|examine|audit)\b.*\b(my\s+)?(repo|repository|code|codebase|project)\b/i,
  /\b(my\s+)?(repo|repository|code|codebase|project)\b.*\b(review|analyze|check|look at|examine|audit)\b/i,

  // GitHub-specific requests
  /\b(github|git)\s+(repo|repository)\b/i,
  /\bclone\b.*\b(repo|repository)\b/i,

  // Code review requests
  /\b(code\s+review|review\s+code|pull\s+request|pr)\b/i,

  // Help with repo patterns
  /\b(help|assist)\b.*\b(my\s+)?(repo|repository|codebase)\b/i,

  // What's in my repo patterns
  /\bwhat('s| is)\s+(in|wrong with)\s+(my\s+)?(repo|repository|code)\b/i,

  // Improve/refactor repo patterns
  /\b(improve|refactor|optimize|fix)\s+(my\s+)?(repo|repository|codebase)\b/i,

  // Short form "owner/repo" with action keywords
  /\b(review|analyze|check)\b.*\b[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\b/i,
];

/**
 * Video intent detection patterns
 * Matches requests like "generate/create/make a video/clip/animation..."
 */
const VIDEO_INTENT_PATTERNS = [
  // Direct video generation requests
  /\b(generate|create|make|render|produce)\b.*\b(video|clip|footage|animation|movie|film)\b/i,

  // Reverse order: "video of...", "clip of..."
  /\b(video|clip|footage|animation)\b.*\b(of|showing|depicting|about)\b/i,

  // "Can you create/make a video..."
  /\bcan you\b.*\b(create|generate|make|render)\b.*\b(video|clip|animation)\b/i,

  // "I want/need a video of..."
  /\b(i want|i need|i'd like|give me|show me)\b.*\b(video|clip|animation|footage)\b/i,

  // Sora-specific requests
  /\bsora\b.*\b(video|clip|generate|create)\b/i,
  /\b(use|with)\s+sora\b/i,

  // Cinematic/film requests
  /\b(cinematic|film|movie)\s+(shot|scene|clip|sequence)\b/i,

  // Animate specific content
  /\b(animate|animating)\b.*\b(scene|shot|image|picture|this)\b/i,

  // Emoji prefix pattern (from button)
  /^🎬\s*Generate video:/i,
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
 * Check if a message indicates video generation intent
 */
export function hasVideoIntent(text: string): { isVideo: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check if this is a document request - these should NOT be videos
  if (isDocumentRequest(normalizedText)) {
    return { isVideo: false };
  }

  // Check for video generation patterns
  for (const pattern of VIDEO_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isVideo: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isVideo: false };
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

  // Check for video first - video requests shouldn't route to image
  if (hasVideoIntent(normalizedText).isVideo) {
    return {
      isImage: false,
      excludedReason: 'video-request'
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
 * Check if a message indicates website/landing page generation intent
 */
export function hasWebsiteIntent(text: string): { isWebsite: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check if this is a document request - documents should not be websites
  if (isDocumentRequest(normalizedText)) {
    return { isWebsite: false };
  }

  // Check for website generation patterns
  for (const pattern of WEBSITE_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isWebsite: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isWebsite: false };
}

/**
 * Check if a message indicates GitHub/code review intent
 */
export function hasGitHubIntent(text: string): { isGitHub: boolean; matchedPattern?: string } {
  const normalizedText = text.trim();

  // Check for GitHub patterns
  for (const pattern of GITHUB_INTENT_PATTERNS) {
    if (pattern.test(normalizedText)) {
      return {
        isGitHub: true,
        matchedPattern: pattern.source
      };
    }
  }

  return { isGitHub: false };
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
  // If tool is explicitly set to video (button press), route to video
  if (toolOverride === 'video') {
    return {
      target: 'video',
      reason: 'video-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-video',
    };
  }

  // If tool is explicitly set to image (button press), route to image
  if (toolOverride === 'image') {
    return {
      target: 'image',
      reason: 'image-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-image',
    };
  }

  // If tool is explicitly set to website (button press), route to website
  if (toolOverride === 'website') {
    return {
      target: 'website',
      reason: 'website-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-website',
    };
  }

  // If tool is explicitly set to github (button press), route to github
  if (toolOverride === 'github') {
    return {
      target: 'github',
      reason: 'github-button',
      confidence: 1.0,
      matchedPattern: 'tool-override-github',
    };
  }

  // Check for website intent FIRST (landing pages before other routes)
  const websiteCheck = hasWebsiteIntent(lastUserText);
  if (websiteCheck.isWebsite) {
    return {
      target: 'website',
      reason: 'website-intent',
      confidence: 0.95,
      matchedPattern: websiteCheck.matchedPattern,
    };
  }

  // Check for GitHub/code review intent (before video/image)
  const githubCheck = hasGitHubIntent(lastUserText);
  if (githubCheck.isGitHub) {
    return {
      target: 'github',
      reason: 'github-intent',
      confidence: 0.95,
      matchedPattern: githubCheck.matchedPattern,
    };
  }

  // Check for video intent in the message
  const videoCheck = hasVideoIntent(lastUserText);
  if (videoCheck.isVideo) {
    return {
      target: 'video',
      reason: 'video-intent',
      confidence: 0.9,
      matchedPattern: videoCheck.matchedPattern,
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
