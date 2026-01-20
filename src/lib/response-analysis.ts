/**
 * RESPONSE ANALYSIS UTILITY
 *
 * Analyzes AI responses to detect triggers for automatic tool suggestions:
 * - Knowledge cutoff mentions → Suggest web search
 * - Uncertainty on factual claims → Suggest fact check
 * - Explicit outdated information → Suggest web search
 *
 * This enables a conversational flow where the AI asks:
 * "Would you like me to search for current information?"
 * instead of requiring manual button clicks.
 */

import { logger } from '@/lib/logger';

const log = logger('ResponseAnalysis');

/**
 * Types of triggers detected in AI responses
 */
export type ResponseTriggerType = 'knowledge_cutoff' | 'uncertainty' | 'outdated_info' | 'none';

/**
 * Suggested action based on trigger
 */
export type SuggestedAction = 'search' | 'factcheck' | 'none';

/**
 * Result of analyzing an AI response
 */
export interface ResponseAnalysisResult {
  triggerType: ResponseTriggerType;
  suggestedAction: SuggestedAction;
  confidence: 'high' | 'medium' | 'low';
  matchedPhrase?: string;
  suggestedPrompt?: string;
}

// ========================================
// PATTERN DEFINITIONS
// ========================================

/**
 * Patterns that indicate the AI is mentioning its knowledge cutoff
 * These are strong signals that current information would be helpful
 */
const KNOWLEDGE_CUTOFF_PATTERNS: RegExp[] = [
  /my (?:knowledge|training)(?: data)? (?:cutoff|cut-off|cut off|ends?|stopped)/i,
  /(?:knowledge|training) (?:was )?(?:cut off|cutoff) (?:in|at|around)/i,
  /(?:trained|updated) (?:on data )?(?:up to|through|until)/i,
  /as of my (?:last )?(?:training|knowledge|update)/i,
  /don't have (?:any )?(?:information|data|knowledge) (?:about|on|for) (?:events? )?after/i,
  /my (?:information|data|knowledge) (?:only )?(?:goes|extends|reaches) (?:up )?to/i,
  /(?:knowledge|training) (?:base|data) (?:is|was) (?:from|last updated)/i,
  /I (?:can't|cannot|don't) (?:access|have|know) (?:information about )?(?:current|recent|latest|real-time)/i,
  /(?:not|don't) have access to (?:current|recent|live|real-time) (?:information|data|news)/i,
  /(?:information|data) (?:may be|might be|could be) (?:out of date|outdated|stale)/i,
  /last (?:trained|updated) in \d{4}/i,
  /training data (?:only )?(?:goes|extends|includes|covers) (?:up )?to/i,
];

/**
 * Patterns that indicate uncertainty about factual claims
 * These suggest fact-checking might be helpful
 */
const UNCERTAINTY_PATTERNS: RegExp[] = [
  /I(?:'m| am) not (?:entirely |completely |100% )?(?:sure|certain)/i,
  /I (?:believe|think) (?:this is|that|it)/i,
  /(?:to the best of )?my (?:knowledge|understanding)/i,
  /I (?:can't|cannot) (?:verify|confirm) (?:this|that|if)/i,
  /(?:this|that|it) (?:may|might|could) (?:not be|be in)?accurate/i,
  /you (?:should|may want to|might want to) (?:verify|confirm|check|double-check)/i,
  /I (?:would |)recommend (?:verifying|checking|confirming)/i,
  /take this (?:with a grain of salt|information with caution)/i,
  /(?:not|don't) have (?:concrete|definitive|reliable) (?:information|data|sources)/i,
];

/**
 * Patterns that indicate the AI knows information is outdated
 */
const OUTDATED_INFO_PATTERNS: RegExp[] = [
  /(?:this|that|the) (?:information|data) (?:is|was|may be) (?:from|dated)/i,
  /(?:things|situation|circumstances) (?:may|might|could) have changed/i,
  /for (?:the )?(?:most |)(?:current|up-to-date|recent|latest) (?:information|data)/i,
  /(?:check|consult|refer to) (?:official|authoritative|primary) sources/i,
  /(?:recommend|suggest) (?:checking|looking up|verifying) (?:the )?(?:latest|current)/i,
];

// ========================================
// CONFIRMATION DETECTION
// ========================================

/**
 * Patterns that indicate user confirmation to proceed with search/fact-check
 */
const CONFIRMATION_PATTERNS: RegExp[] = [
  /^yes\b/i,
  /^yeah\b/i,
  /^yep\b/i,
  /^sure\b/i,
  /^please\b/i,
  /^ok(?:ay)?\b/i,
  /^do it\b/i,
  /^go ahead\b/i,
  /^sounds good\b/i,
  /^let's do it\b/i,
  /^that would be (?:great|helpful|nice)\b/i,
  /^search for/i,
  /^yes,? (?:please|search|look|find)/i,
  /^please (?:search|look|find|verify|check)/i,
];

/**
 * Patterns that indicate user declining the suggestion
 */
const DECLINE_PATTERNS: RegExp[] = [
  /^no\b/i,
  /^nope\b/i,
  /^nah\b/i,
  /^not (?:now|yet|necessary)/i,
  /^(?:that's|it's) (?:ok|okay|fine|alright)/i,
  /^don't (?:worry|bother)/i,
  /^never ?mind/i,
  /^skip/i,
  /^I'm good/i,
  /^no thanks/i,
  /^no,? (?:that's|it's) (?:ok|okay|fine)/i,
];

// ========================================
// ANALYSIS FUNCTIONS
// ========================================

/**
 * Analyze an AI response to detect if it triggers a tool suggestion
 *
 * @param content - The AI response content
 * @returns Analysis result with trigger type and suggested action
 */
export function analyzeResponse(content: string): ResponseAnalysisResult {
  if (!content || typeof content !== 'string') {
    return { triggerType: 'none', suggestedAction: 'none', confidence: 'low' };
  }

  // Sanitize and limit content for pattern matching
  const sanitized = content.trim().slice(0, 5000);

  if (sanitized.length < 20) {
    return { triggerType: 'none', suggestedAction: 'none', confidence: 'low' };
  }

  // Check for knowledge cutoff mentions (highest priority)
  for (const pattern of KNOWLEDGE_CUTOFF_PATTERNS) {
    const match = sanitized.match(pattern);
    if (match) {
      log.debug('Knowledge cutoff pattern detected', { pattern: pattern.source.slice(0, 50) });
      return {
        triggerType: 'knowledge_cutoff',
        suggestedAction: 'search',
        confidence: 'high',
        matchedPhrase: match[0],
        suggestedPrompt:
          '\n\nWould you like me to search the web for current information on this topic?',
      };
    }
  }

  // Check for outdated info mentions
  for (const pattern of OUTDATED_INFO_PATTERNS) {
    const match = sanitized.match(pattern);
    if (match) {
      log.debug('Outdated info pattern detected', { pattern: pattern.source.slice(0, 50) });
      return {
        triggerType: 'outdated_info',
        suggestedAction: 'search',
        confidence: 'medium',
        matchedPhrase: match[0],
        suggestedPrompt: '\n\nWould you like me to search for the latest information on this?',
      };
    }
  }

  // Check for uncertainty patterns (lower priority - may not need search)
  for (const pattern of UNCERTAINTY_PATTERNS) {
    const match = sanitized.match(pattern);
    if (match) {
      log.debug('Uncertainty pattern detected', { pattern: pattern.source.slice(0, 50) });
      return {
        triggerType: 'uncertainty',
        suggestedAction: 'factcheck',
        confidence: 'medium',
        matchedPhrase: match[0],
        suggestedPrompt: '\n\nWould you like me to verify this information for you?',
      };
    }
  }

  return { triggerType: 'none', suggestedAction: 'none', confidence: 'low' };
}

/**
 * Check if a user message is confirming a previous tool suggestion
 *
 * @param content - The user's response
 * @returns true if this is a confirmation
 */
export function isConfirmation(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  const sanitized = content.trim().slice(0, 200);
  if (sanitized.length < 1) return false;

  // Check for explicit confirmations
  for (const pattern of CONFIRMATION_PATTERNS) {
    if (pattern.test(sanitized)) {
      log.debug('Confirmation detected', { pattern: pattern.source.slice(0, 30) });
      return true;
    }
  }

  return false;
}

/**
 * Check if a user message is declining a previous tool suggestion
 *
 * @param content - The user's response
 * @returns true if this is a decline
 */
export function isDecline(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  const sanitized = content.trim().slice(0, 200);
  if (sanitized.length < 1) return false;

  for (const pattern of DECLINE_PATTERNS) {
    if (pattern.test(sanitized)) {
      log.debug('Decline detected', { pattern: pattern.source.slice(0, 30) });
      return true;
    }
  }

  return false;
}

/**
 * Extract the original question from conversation context
 * Used to formulate a better search query
 *
 * @param messages - Array of conversation messages
 * @returns The most recent user question that led to the AI response
 */
export function extractOriginalQuestion(
  messages: Array<{ role: string; content: string }>
): string | null {
  // Find the last user message before the AI's response
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user' && msg.content.trim().length > 5) {
      // Skip very short messages like "yes" or "ok"
      if (msg.content.trim().length > 15) {
        return msg.content.trim();
      }
    }
  }
  return null;
}

/**
 * Generate a search-friendly query from the original question
 * Removes conversational elements and focuses on the key topic
 *
 * @param question - The original user question
 * @returns A cleaned-up search query
 */
export function generateSearchQuery(question: string): string {
  if (!question) return '';

  // Remove common conversational prefixes
  let query = question
    .replace(/^(can you|could you|please|hey|hi|hello|um|uh|so|well|actually)\s+/gi, '')
    .replace(/^(tell me|explain|describe|what is|what are|who is|who are)\s+/gi, '')
    .replace(/\?+$/, '')
    .trim();

  // Limit length for search
  if (query.length > 200) {
    query = query.slice(0, 200);
  }

  return query;
}
