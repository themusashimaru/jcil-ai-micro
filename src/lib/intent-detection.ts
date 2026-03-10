/**
 * INTENT DETECTION UTILITY
 *
 * Automatically detects user intent from message content to route to appropriate tools:
 * - Search: Web searches for current information
 * - Fact Check: Verify claims and statements
 * - Research: Deep research on complex topics
 *
 * Security considerations:
 * - Input validation and sanitization
 * - Rate limiting integration (handled by caller)
 * - No user data stored or logged
 */

import { logger } from '@/lib/logger';

const log = logger('IntentDetection');

/**
 * Detected intent types matching SearchMode
 */
export type DetectedIntent = 'none' | 'search' | 'factcheck' | 'research';

/**
 * Result of intent detection
 */
export interface IntentDetectionResult {
  intent: DetectedIntent;
  confidence: 'high' | 'medium' | 'low';
  matchedPattern?: string;
  suggestion?: string;
}

// ========================================
// PATTERN DEFINITIONS
// ========================================

/**
 * High-confidence search patterns
 * Direct requests for current/web information
 */
const SEARCH_PATTERNS_HIGH: RegExp[] = [
  /\b(search|google|look\s*up)\s+(for|about|on|the\s+web)?\s*(.+)/i,
  /\bfind\s+(information|out|results?|details?)\s+(about|on|for)\b/i,
  /\bwhat('?s|s)?\s+(the\s+)?(current|latest|recent|today'?s?)\s+\w+/i,
  /\bwhat\s+are\s+the\s+(latest|recent|current)\b/i,
  /\b(news|headlines|updates)\s+(about|on|for)\b/i,
  /\bnews\s+about\b/i,
  /\bwhat\s+time\s+is\s+it\b/i,
  /\bwhat('?s|s)?\s+(the\s+)?date\s+today\b/i,
  /\b(weather|forecast)\s+(in|for|today|tomorrow)\b/i,
  /\bweather\s+forecast\b/i,
  /\bstock\s+price\s+(of|for)\b/i,
  /\bstock\s+price\b/i,
  /\b(how\s+much|what('?s|s)?)\s+(is|are).+?(worth|cost|price)/i,
];

/**
 * Medium-confidence search patterns
 * Likely wants current information but less explicit
 */
const SEARCH_PATTERNS_MEDIUM: RegExp[] = [
  /\bwho\s+(is|are|was|were)\s+.+?\s+(currently|now|today)/i,
  /\bwhen\s+(is|are|was|were)\s+.+?\s+(happening|scheduled|planned)/i,
  /\bwhere\s+can\s+i\s+find\b/i,
  /\b(show|tell)\s+me\s+(about\s+)?(the\s+)?(latest|recent|current)\b/i,
  /\bhow\s+do\s+i\s+(get\s+to|find|reach)\b/i,
  /\bfind\s+(a|an|the|me)\b/i,
];

/**
 * High-confidence fact check patterns
 * Explicit verification requests
 */
const FACTCHECK_PATTERNS_HIGH: RegExp[] = [
  /\bfact\s*check\b/i,
  /\bverify\s+(if|this|that|the)\b/i,
  /\bis\s+(it|this|that)\s+(true|false|real|fake|accurate)\b/i,
  /\bis\s+(it|this|that)\s+\w+\s+(true|false|real|fake|accurate)\b/i, // "is this statement accurate"
  /\b(true\s+or\s+false|real\s+or\s+fake)\b/i,
  /\bcan\s+you\s+(verify|confirm|check\s+if)\b/i,
  /\bis\s+(it|this|that)\s+(actually|really)\s+(true|correct|accurate)\b/i,
  /\b(debunk|myth|hoax|misinformation)\b/i,
];

/**
 * Medium-confidence fact check patterns
 */
const FACTCHECK_PATTERNS_MEDIUM: RegExp[] = [
  /\bdid\s+.+?\s+(really|actually)\s+(happen|say|do)\b/i,
  /\bis\s+it\s+(correct|accurate)\s+that\b/i,
  /\baccording\s+to\s+.+?,?\s+.+?\s+(true|false)\?/i,
  /\bsomeone\s+(said|told\s+me|claims)\s+that\b/i,
];

/**
 * High-confidence research patterns
 * Complex topics requiring deep analysis
 * Note: Use word boundary + imperative form to avoid matching past tense narrative
 */
const RESEARCH_PATTERNS_HIGH: RegExp[] = [
  /^(research|investigate|analyze|study|explore)\s+/i, // Must start with verb (imperative)
  /\b(please\s+)?(research|investigate|analyze|study|explore)\s+(about|on|the\s+topic\s+of|the|this|that|how|why|what)\b/i,
  /\bin[- ]?depth\s+(analysis|look|review|study|examination)\b/i,
  /\bcomprehensive\s+(overview|analysis|study|report|look|review)\b/i,
  /\b(compare|contrast)\s+.+?\s+(vs\.?|versus|and|to|with)\b/i,
  /\bpros\s+and\s+cons\s+of\b/i,
  /\badvantages\s+and\s+disadvantages\s+of\b/i,
  /\bwhat\s+(are|is)\s+the\s+(history|background|origin|evolution)\s+of\b/i,
  /\bexplain\s+(the\s+)?(background|history|origin)\s+of\b/i,
  /\bexplain\s+(in\s+detail|thoroughly|comprehensively)\b/i,
];

/**
 * Medium-confidence research patterns
 */
const RESEARCH_PATTERNS_MEDIUM: RegExp[] = [
  /\bhow\s+(does|do|did)\s+\w+\s+work\b/i,
  /\bwhy\s+(does|do|did|is|are)\s+.+\b/i,
  /\bwhat\s+(causes|caused|leads?\s+to)\b/i,
  /\b(impact|effect|consequence|implication)s?\s+of\b/i,
  /\b(explain|describe|elaborate)\s+(on|about)?\s+.{20,}/i, // Long explanation requests
];

/**
 * Time-related patterns (search for current time/date)
 */
const TIME_DATE_PATTERNS: RegExp[] = [
  /\bwhat\s+(time|day|date)\s+(is\s+it)?\b/i,
  /\b(current|today'?s?)\s+(time|date|day)\b/i,
  /\btime\s+(in|at)\s+\w+/i, // "time in New York"
];

// ========================================
// INTENT DETECTION FUNCTIONS
// ========================================

/**
 * Detect intent from user message content
 *
 * @param content - User message content (will be sanitized)
 * @returns Detection result with intent and confidence
 */
export function detectIntent(content: string): IntentDetectionResult {
  // Input validation
  if (!content || typeof content !== 'string') {
    return { intent: 'none', confidence: 'low' };
  }

  // Sanitize input - remove excessive whitespace, limit length for pattern matching
  const sanitized = content.trim().slice(0, 2000).replace(/\s+/g, ' ');

  if (sanitized.length < 3) {
    return { intent: 'none', confidence: 'low' };
  }

  // Check time/date patterns first (always search)
  for (const pattern of TIME_DATE_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'search',
        confidence: 'high',
        matchedPattern: 'time_date',
        suggestion: 'Searching for current time/date information',
      };
    }
  }

  // Check high-confidence patterns first
  for (const pattern of SEARCH_PATTERNS_HIGH) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'search',
        confidence: 'high',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  for (const pattern of FACTCHECK_PATTERNS_HIGH) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'factcheck',
        confidence: 'high',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  for (const pattern of RESEARCH_PATTERNS_HIGH) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'research',
        confidence: 'high',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  // Check medium-confidence patterns
  for (const pattern of SEARCH_PATTERNS_MEDIUM) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'search',
        confidence: 'medium',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  for (const pattern of FACTCHECK_PATTERNS_MEDIUM) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'factcheck',
        confidence: 'medium',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  for (const pattern of RESEARCH_PATTERNS_MEDIUM) {
    if (pattern.test(sanitized)) {
      return {
        intent: 'research',
        confidence: 'medium',
        matchedPattern: pattern.source.slice(0, 50),
      };
    }
  }

  // No strong intent detected
  return { intent: 'none', confidence: 'low' };
}

/**
 * Determine if auto-routing should be applied
 *
 * Only auto-route on high confidence matches to avoid
 * surprising users with unexpected behavior.
 *
 * @param result - Intent detection result
 * @param allowMediumConfidence - Whether to allow medium confidence auto-routing
 */
export function shouldAutoRoute(
  result: IntentDetectionResult,
  allowMediumConfidence: boolean = false
): boolean {
  if (result.intent === 'none') return false;
  if (result.confidence === 'high') return true;
  if (result.confidence === 'medium' && allowMediumConfidence) return true;
  return false;
}

/**
 * Get user-friendly description of detected intent
 */
export function getIntentDescription(intent: DetectedIntent): string {
  switch (intent) {
    case 'search':
      return 'Searching the web for current information';
    case 'factcheck':
      return 'Fact-checking this claim';
    case 'research':
      return 'Conducting deep research on this topic';
    default:
      return '';
  }
}

/**
 * Check if a specific tool is explicitly requested
 * (More strict than general intent detection)
 */
export function isExplicitToolRequest(content: string): DetectedIntent {
  const sanitized = content.trim().toLowerCase();

  // Very explicit requests only
  if (/^(search|google|look\s*up)\s/i.test(sanitized)) {
    return 'search';
  }
  if (/^(fact\s*check|verify)\s/i.test(sanitized)) {
    return 'factcheck';
  }
  if (/^(research|investigate)\s/i.test(sanitized)) {
    return 'research';
  }

  return 'none';
}

/**
 * Log intent detection for debugging (no user content logged)
 */
export function logIntentDetection(result: IntentDetectionResult, messageLength: number): void {
  log.debug('Intent detected', {
    intent: result.intent,
    confidence: result.confidence,
    messageLength,
    // Don't log actual content or patterns for privacy
  });
}
