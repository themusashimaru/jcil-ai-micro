/**
 * PERSISTENT MEMORY AGENT - Memory Extractor
 *
 * Uses Claude Haiku to analyze conversations and extract:
 * - Personal facts about the user
 * - Preferences and communication style
 * - Topics discussed
 * - Goals and interests
 *
 * Designed for async background processing to not impact chat latency.
 *
 * @module memory/memory-extractor
 * @version 1.0.0
 */

import { createAnthropicCompletion, CLAUDE_HAIKU } from '@/lib/anthropic/client';
import { logger } from '@/lib/logger';
import type { MemoryExtraction, ExtractedFact } from './types';

const log = logger('MemoryExtractor');

// Extraction prompt template
const EXTRACTION_PROMPT = `You are a memory extraction assistant. Analyze the following conversation and extract information about the USER (not the assistant).

Extract ONLY facts that the user explicitly stated or strongly implied about themselves. Do NOT make assumptions or inferences beyond what is clearly stated.

Categories to extract:
1. **personal** - Name, age, location, occupation
2. **family** - Family members mentioned (spouse, children, parents, etc.)
3. **interest** - Hobbies, interests, topics they care about
4. **preference** - Communication preferences, how they like to interact
5. **goal** - Goals, aspirations, things they're working toward
6. **work** - Job, career, professional context
7. **other** - Any other notable personal facts

For each fact, provide:
- category: one of the categories above
- fact: the actual information (brief)
- key: a structured key for storing (e.g., "name", "occupation", "family_member")
- value: the value to store
- confidence: 0.0-1.0 how confident you are this is accurate

Also provide:
- topics: array of 2-5 main topics discussed
- summary: 1-2 sentence summary of what was discussed

CONVERSATION:
{conversation}

Respond with valid JSON only, no markdown:
{
  "facts": [
    {"category": "personal", "fact": "User's name is John", "key": "name", "value": "John", "confidence": 0.95}
  ],
  "topics": ["topic1", "topic2"],
  "summary": "Brief summary of conversation"
}

If no personal facts were shared, return empty facts array but still provide topics and summary.`;

/**
 * Extract memory from a conversation
 *
 * @param messages - Array of conversation messages
 * @returns Extracted memory information
 */
export async function extractMemoryFromConversation(
  messages: Array<{ role: string; content: string }>
): Promise<MemoryExtraction> {
  // Default empty extraction
  const defaultExtraction: MemoryExtraction = {
    facts: [],
    topics: [],
    summary: '',
    confidence: 0,
  };

  // Need at least 2 messages (user + assistant)
  if (!messages || messages.length < 2) {
    return defaultExtraction;
  }

  try {
    // Format conversation for analysis
    const conversationText = formatConversationForAnalysis(messages);

    // Skip if conversation is too short
    if (conversationText.length < 100) {
      log.debug('Conversation too short for extraction');
      return defaultExtraction;
    }

    // Truncate if too long (keep under token limits)
    const truncatedConversation = conversationText.slice(0, 8000);

    // Call Claude Haiku for extraction
    const prompt = EXTRACTION_PROMPT.replace('{conversation}', truncatedConversation);

    const result = await createAnthropicCompletion({
      messages: [{ role: 'user', content: prompt }],
      model: CLAUDE_HAIKU,
      maxTokens: 1000,
      temperature: 0.1, // Low temperature for consistent extraction
    });

    if (!result.text) {
      log.warn('Empty response from extraction');
      return defaultExtraction;
    }

    // Parse JSON response
    const extraction = parseExtractionResponse(result.text);

    log.info('Extracted memory from conversation', {
      factsCount: extraction.facts.length,
      topicsCount: extraction.topics.length,
    });

    return extraction;
  } catch (error) {
    log.error('Failed to extract memory', error as Error);
    return defaultExtraction;
  }
}

/**
 * Format conversation messages for analysis
 */
function formatConversationForAnalysis(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const role = m.role === 'user' ? 'USER' : 'ASSISTANT';
      const content = typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content);
      return `${role}: ${content}`;
    })
    .join('\n\n');
}

/**
 * Parse the JSON response from Claude
 */
function parseExtractionResponse(text: string): MemoryExtraction {
  const defaultExtraction: MemoryExtraction = {
    facts: [],
    topics: [],
    summary: '',
    confidence: 0,
  };

  try {
    // Clean up the response (remove markdown if present)
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.slice(7);
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.slice(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.slice(0, -3);
    }
    cleanText = cleanText.trim();

    const parsed = JSON.parse(cleanText);

    // Validate and sanitize facts
    const facts: ExtractedFact[] = [];
    if (Array.isArray(parsed.facts)) {
      for (const fact of parsed.facts) {
        if (isValidFact(fact)) {
          facts.push({
            category: sanitizeCategory(fact.category),
            fact: String(fact.fact).slice(0, 500),
            key: fact.key ? String(fact.key).slice(0, 50) : undefined,
            value: sanitizeValue(fact.value),
            confidence: Math.min(1, Math.max(0, Number(fact.confidence) || 0.5)),
          });
        }
      }
    }

    // Validate topics
    const topics: string[] = [];
    if (Array.isArray(parsed.topics)) {
      for (const topic of parsed.topics.slice(0, 10)) {
        if (typeof topic === 'string' && topic.trim().length > 0) {
          topics.push(topic.trim().slice(0, 100));
        }
      }
    }

    // Validate summary
    const summary = typeof parsed.summary === 'string'
      ? parsed.summary.slice(0, 500)
      : '';

    // Calculate overall confidence
    const confidence = facts.length > 0
      ? facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length
      : 0;

    return { facts, topics, summary, confidence };
  } catch (error) {
    log.warn('Failed to parse extraction response', { error: (error as Error).message });
    return defaultExtraction;
  }
}

/**
 * Validate a fact object
 */
function isValidFact(fact: unknown): fact is ExtractedFact {
  if (!fact || typeof fact !== 'object') return false;
  const f = fact as Record<string, unknown>;
  return (
    typeof f.category === 'string' &&
    typeof f.fact === 'string' &&
    f.fact.length > 0
  );
}

/**
 * Sanitize category to allowed values
 */
function sanitizeCategory(category: string): ExtractedFact['category'] {
  const allowed = ['personal', 'preference', 'family', 'work', 'interest', 'goal', 'other'];
  const normalized = String(category).toLowerCase().trim();
  return allowed.includes(normalized)
    ? normalized as ExtractedFact['category']
    : 'other';
}

/**
 * Sanitize fact value
 */
function sanitizeValue(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') {
    return value.slice(0, 200);
  }
  if (Array.isArray(value)) {
    return value
      .filter(v => typeof v === 'string')
      .map(v => String(v).slice(0, 100))
      .slice(0, 10);
  }
  return undefined;
}

/**
 * Quick check if conversation likely contains extractable information
 * Used to skip extraction for trivial conversations
 */
export function shouldExtractMemory(
  messages: Array<{ role: string; content: string }>
): boolean {
  if (!messages || messages.length < 2) return false;

  // Get user messages only
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join(' ');

  // Skip if user messages are very short
  if (userMessages.length < 50) return false;

  // Check for personal information indicators
  const personalIndicators = [
    /\bmy name\b/i,
    /\bi am\b/i,
    /\bi'm\b/i,
    /\bi work\b/i,
    /\bi live\b/i,
    /\bmy (wife|husband|spouse|partner|son|daughter|mother|father|family)\b/i,
    /\bi (want|need|hope|plan)\b/i,
    /\bmy (job|career|business|company)\b/i,
    /\bi (like|love|enjoy|prefer)\b/i,
    /\bmy (goal|dream|aspiration)\b/i,
    /\bi (study|studied|learning)\b/i,
    /\bcall me\b/i,
  ];

  return personalIndicators.some(pattern => pattern.test(userMessages));
}

/**
 * Extract topics only (lightweight, no AI call)
 * Used for quick topic tagging
 */
export function extractTopicsLocally(
  messages: Array<{ role: string; content: string }>
): string[] {
  const topics = new Set<string>();

  // Common topic patterns
  const topicPatterns: Array<{ pattern: RegExp; topic: string }> = [
    { pattern: /\b(bible|scripture|verse|psalm|gospel)\b/i, topic: 'scripture' },
    { pattern: /\b(pray|prayer|praying)\b/i, topic: 'prayer' },
    { pattern: /\b(faith|believe|god|jesus|christ|holy spirit)\b/i, topic: 'faith' },
    { pattern: /\b(code|programming|software|developer)\b/i, topic: 'programming' },
    { pattern: /\b(business|company|startup|entrepreneur)\b/i, topic: 'business' },
    { pattern: /\b(health|fitness|diet|exercise)\b/i, topic: 'health' },
    { pattern: /\b(family|parenting|marriage|children)\b/i, topic: 'family' },
    { pattern: /\b(study|learning|education|school|university)\b/i, topic: 'education' },
    { pattern: /\b(career|job|work|profession)\b/i, topic: 'career' },
    { pattern: /\b(finance|money|budget|invest)\b/i, topic: 'finance' },
    { pattern: /\b(travel|vacation|trip)\b/i, topic: 'travel' },
    { pattern: /\b(recipe|cooking|food)\b/i, topic: 'cooking' },
    { pattern: /\b(write|writing|book|story)\b/i, topic: 'writing' },
    { pattern: /\b(music|song|artist|band)\b/i, topic: 'music' },
  ];

  const allContent = messages
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join(' ');

  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(allContent)) {
      topics.add(topic);
    }
  }

  return Array.from(topics).slice(0, 5);
}
