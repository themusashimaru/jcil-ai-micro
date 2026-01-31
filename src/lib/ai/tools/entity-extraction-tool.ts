/**
 * ENTITY EXTRACTION TOOL
 *
 * Extract named entities and structured information from text.
 * Uses Compromise.js - a lightweight, fast NLP library.
 *
 * Extracted entities:
 * - People (names)
 * - Places (locations, cities, countries)
 * - Organizations (companies, institutions)
 * - Dates and times
 * - Money/currency
 * - Phone numbers
 * - Emails
 * - URLs
 * - Hashtags and mentions
 * - Nouns, verbs, adjectives
 *
 * Zero external API dependencies - runs entirely locally.
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded Compromise library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nlp: any = null;

async function initCompromise(): Promise<boolean> {
  if (nlp) return true;
  try {
    const compromiseModule = await import('compromise');
    nlp = compromiseModule.default || compromiseModule;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const entityExtractionTool: UnifiedTool = {
  name: 'extract_entities',
  description: `Extract named entities and structured information from text.

Entities extracted:
- people: Person names
- places: Locations, cities, countries
- organizations: Companies, institutions
- dates: Dates and times mentioned
- money: Currency amounts
- values: Numbers and quantities
- emails: Email addresses
- urls: Web URLs
- hashtags: Social media hashtags
- mentions: @mentions
- topics: Key topics/noun phrases
- sentences: Parsed sentence structures
- questions: Questions in the text
- statements: Declarative statements

Additional analysis:
- Part of speech tagging
- Sentence type detection
- Key phrase extraction
- Topic summarization

Use cases:
- Extract contacts from documents
- Parse event details from text
- Extract data for CRM/database entry
- Analyze document structure
- Social media content analysis`,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to extract entities from',
      },
      entity_types: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Specific entity types to extract. Default: all. Options: people, places, organizations, dates, money, values, emails, urls, hashtags, mentions, nouns, verbs, adjectives',
      },
      include_context: {
        type: 'boolean',
        description: 'Include surrounding context for each entity. Default: false',
      },
      normalize: {
        type: 'boolean',
        description: 'Normalize entities (lowercase, trim). Default: true',
      },
      deduplicate: {
        type: 'boolean',
        description: 'Remove duplicate entities. Default: true',
      },
    },
    required: ['text'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isEntityExtractionAvailable(): Promise<boolean> {
  return await initCompromise();
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPeople(doc: any): string[] {
  return doc.people().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPlaces(doc: any): string[] {
  return doc.places().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOrganizations(doc: any): string[] {
  return doc.organizations().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDates(doc: any): string[] {
  return doc.dates().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMoney(doc: any): string[] {
  return doc.money().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractValues(doc: any): string[] {
  return doc.values().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEmails(doc: any): string[] {
  return doc.emails().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUrls(doc: any): string[] {
  return doc.urls().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractHashtags(doc: any): string[] {
  return doc.hashTags().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractMentions(doc: any): string[] {
  return doc.atMentions().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNouns(doc: any): string[] {
  return doc.nouns().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVerbs(doc: any): string[] {
  return doc.verbs().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAdjectives(doc: any): string[] {
  return doc.adjectives().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPhoneNumbers(text: string): string[] {
  // Simple phone number regex
  const phoneRegex =
    /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}(?:\s*(?:ext|x|extension)\s*[0-9]+)?/gi;
  const matches = text.match(phoneRegex);
  return matches ? [...new Set(matches)] : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractQuestions(doc: any): string[] {
  return doc.questions().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractStatements(doc: any): string[] {
  return doc.statements().out('array');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTopics(doc: any): string[] {
  // Get noun phrases as topics
  const nouns = doc.nouns().out('array');
  const topics = doc.topics ? doc.topics().out('array') : [];
  return [...new Set([...topics, ...nouns.slice(0, 10)])];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSentences(doc: any): { text: string; type: string }[] {
  const sentences: { text: string; type: string }[] = [];
  doc.sentences().forEach((s: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentence = s as any;
    const text = sentence.text();
    let type = 'statement';
    if (sentence.has('#QuestionMark')) {
      type = 'question';
    } else if (sentence.has('#ExclamationMark')) {
      type = 'exclamation';
    }
    sentences.push({ text, type });
  });
  return sentences;
}

function deduplicateArray(arr: string[], normalize: boolean): string[] {
  if (normalize) {
    const seen = new Set<string>();
    return arr.filter((item) => {
      const normalized = item.toLowerCase().trim();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }
  return [...new Set(arr)];
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeEntityExtraction(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    text: string;
    entity_types?: string[];
    include_context?: boolean;
    normalize?: boolean;
    deduplicate?: boolean;
  };

  // Validate required parameters
  if (!args.text) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: text parameter is required',
      isError: true,
    };
  }

  // Initialize Compromise library
  const loaded = await initCompromise();
  if (!loaded || !nlp) {
    return {
      toolCallId: toolCall.id,
      content:
        'Error: Compromise NLP library not available. Please install the compromise package.',
      isError: true,
    };
  }

  try {
    const doc = nlp(args.text);
    const normalize = args.normalize !== false;
    const deduplicate = args.deduplicate !== false;

    // All available entity types
    const allEntityTypes = [
      'people',
      'places',
      'organizations',
      'dates',
      'money',
      'values',
      'emails',
      'urls',
      'hashtags',
      'mentions',
      'phones',
      'nouns',
      'verbs',
      'adjectives',
      'questions',
      'statements',
      'topics',
    ];

    // Determine which entities to extract
    const requestedTypes = args.entity_types || allEntityTypes;

    // Extract entities based on requested types
    const entities: Record<string, string[] | { text: string; type: string }[]> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractors: Record<string, (doc: any) => string[]> = {
      people: extractPeople,
      places: extractPlaces,
      organizations: extractOrganizations,
      dates: extractDates,
      money: extractMoney,
      values: extractValues,
      emails: extractEmails,
      urls: extractUrls,
      hashtags: extractHashtags,
      mentions: extractMentions,
      phones: () => extractPhoneNumbers(args.text),
      nouns: extractNouns,
      verbs: extractVerbs,
      adjectives: extractAdjectives,
      questions: extractQuestions,
      statements: extractStatements,
      topics: extractTopics,
    };

    let totalEntities = 0;

    for (const entityType of requestedTypes) {
      const extractor = extractors[entityType.toLowerCase()];
      if (extractor) {
        let extracted = extractor(doc);
        if (deduplicate && Array.isArray(extracted) && typeof extracted[0] === 'string') {
          extracted = deduplicateArray(extracted as string[], normalize);
        }
        entities[entityType] = extracted;
        totalEntities += extracted.length;
      }
    }

    // Get sentence-level analysis
    const sentences = extractSentences(doc);

    // Summary statistics
    const wordCount = doc.wordCount();
    const sentenceCount = sentences.length;

    // Build entity summary
    const entitySummary = Object.entries(entities)
      .filter(([, arr]) => arr.length > 0)
      .map(([type, arr]) => `${type}: ${arr.length}`)
      .join(', ');

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Extracted ${totalEntities} entities from text`,
        textStats: {
          characterCount: args.text.length,
          wordCount,
          sentenceCount,
        },
        entitySummary: entitySummary || 'No entities found',
        entities,
        sentences,
        options: {
          normalize,
          deduplicate,
          entityTypesRequested: requestedTypes,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error extracting entities: ${(error as Error).message}`,
      isError: true,
    };
  }
}
