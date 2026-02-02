/**
 * NER TOOL
 * Complete Named Entity Recognition
 *
 * This implementation provides:
 * - Rule-based entity recognition
 * - Pattern matching for common entity types
 * - Gazetteer-based recognition
 * - Entity type classification
 * - Context-aware entity extraction
 *
 * Supported entity types:
 * - PERSON: Names of people
 * - ORG: Organizations, companies
 * - LOC: Locations, places
 * - GPE: Geo-political entities (countries, cities)
 * - DATE: Dates and times
 * - MONEY: Monetary values
 * - PERCENT: Percentages
 * - EMAIL: Email addresses
 * - URL: Web URLs
 * - PHONE: Phone numbers
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// ENTITY TYPES
// ============================================================================

const ENTITY_TYPES: Record<string, string> = {
  PERSON: 'Person name',
  ORG: 'Organization',
  LOC: 'Location',
  GPE: 'Geo-political entity (country, city, state)',
  DATE: 'Date or time expression',
  TIME: 'Time expression',
  MONEY: 'Monetary value',
  PERCENT: 'Percentage',
  QUANTITY: 'Quantity or measurement',
  ORDINAL: 'Ordinal number (first, second)',
  CARDINAL: 'Cardinal number',
  EMAIL: 'Email address',
  URL: 'Web URL',
  PHONE: 'Phone number',
  PRODUCT: 'Product name',
  EVENT: 'Event name',
  WORK_OF_ART: 'Title of work',
  LAW: 'Law or legal document',
  LANGUAGE: 'Language name',
  NORP: 'Nationalities, religious/political groups'
};

// ============================================================================
// GAZETTEERS (Known entity lists)
// ============================================================================

const PERSON_TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor', 'sir', 'lord', 'lady',
  'president', 'senator', 'governor', 'mayor', 'judge', 'justice', 'general',
  'captain', 'colonel', 'lieutenant', 'sergeant', 'officer', 'detective',
  'rev', 'reverend', 'father', 'sister', 'brother', 'rabbi', 'imam'
]);

const COMMON_FIRST_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
  'thomas', 'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan',
  'jessica', 'sarah', 'karen', 'nancy', 'lisa', 'betty', 'margaret', 'sandra',
  'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle', 'carol', 'amanda',
  'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
  'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob'
]);

const COUNTRIES = new Set([
  'afghanistan', 'albania', 'algeria', 'andorra', 'angola', 'argentina', 'armenia',
  'australia', 'austria', 'azerbaijan', 'bahamas', 'bahrain', 'bangladesh', 'belarus',
  'belgium', 'belize', 'benin', 'bhutan', 'bolivia', 'bosnia', 'botswana', 'brazil',
  'brunei', 'bulgaria', 'burkina', 'burundi', 'cambodia', 'cameroon', 'canada', 'chad',
  'chile', 'china', 'colombia', 'congo', 'costa rica', 'croatia', 'cuba', 'cyprus',
  'czech', 'denmark', 'djibouti', 'dominica', 'ecuador', 'egypt', 'el salvador',
  'england', 'eritrea', 'estonia', 'ethiopia', 'fiji', 'finland', 'france', 'gabon',
  'gambia', 'georgia', 'germany', 'ghana', 'greece', 'guatemala', 'guinea', 'guyana',
  'haiti', 'honduras', 'hungary', 'iceland', 'india', 'indonesia', 'iran', 'iraq',
  'ireland', 'israel', 'italy', 'jamaica', 'japan', 'jordan', 'kazakhstan', 'kenya',
  'korea', 'kuwait', 'laos', 'latvia', 'lebanon', 'liberia', 'libya', 'lithuania',
  'luxembourg', 'macedonia', 'madagascar', 'malawi', 'malaysia', 'maldives', 'mali',
  'malta', 'mauritania', 'mauritius', 'mexico', 'moldova', 'monaco', 'mongolia',
  'montenegro', 'morocco', 'mozambique', 'myanmar', 'namibia', 'nepal', 'netherlands',
  'new zealand', 'nicaragua', 'niger', 'nigeria', 'norway', 'oman', 'pakistan',
  'palestine', 'panama', 'papua', 'paraguay', 'peru', 'philippines', 'poland',
  'portugal', 'qatar', 'romania', 'russia', 'rwanda', 'saudi arabia', 'scotland',
  'senegal', 'serbia', 'singapore', 'slovakia', 'slovenia', 'somalia', 'south africa',
  'spain', 'sri lanka', 'sudan', 'sweden', 'switzerland', 'syria', 'taiwan',
  'tajikistan', 'tanzania', 'thailand', 'togo', 'trinidad', 'tunisia', 'turkey',
  'turkmenistan', 'uganda', 'ukraine', 'united arab emirates', 'united kingdom',
  'united states', 'uruguay', 'uzbekistan', 'venezuela', 'vietnam', 'wales', 'yemen',
  'zambia', 'zimbabwe', 'usa', 'uk', 'uae'
]);

const US_STATES = new Set([
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
  'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia',
  'wisconsin', 'wyoming'
]);

const MAJOR_CITIES = new Set([
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
  'san francisco', 'seattle', 'denver', 'boston', 'washington', 'miami',
  'london', 'paris', 'tokyo', 'beijing', 'shanghai', 'moscow', 'mumbai',
  'delhi', 'istanbul', 'karachi', 'dhaka', 'cairo', 'lagos', 'kinshasa',
  'lima', 'tianjin', 'chengdu', 'bangkok', 'guangzhou', 'lahore', 'kolkata',
  'toronto', 'sydney', 'melbourne', 'singapore', 'hong kong', 'seoul',
  'berlin', 'madrid', 'rome', 'amsterdam', 'barcelona', 'munich', 'vienna',
  'dublin', 'lisbon', 'brussels', 'stockholm', 'oslo', 'helsinki', 'copenhagen'
]);

const ORG_SUFFIXES = new Set([
  'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
  'co', 'company', 'group', 'holdings', 'partners', 'associates', 'enterprises',
  'foundation', 'institute', 'association', 'society', 'university', 'college',
  'bank', 'trust', 'fund', 'capital', 'investments', 'consulting', 'services',
  'solutions', 'technologies', 'systems', 'network', 'media', 'studios',
  'entertainment', 'productions', 'publishing', 'press', 'labs', 'research'
]);

const LANGUAGES = new Set([
  'english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian',
  'chinese', 'japanese', 'korean', 'arabic', 'hindi', 'bengali', 'punjabi',
  'turkish', 'vietnamese', 'polish', 'ukrainian', 'dutch', 'greek', 'czech',
  'swedish', 'hungarian', 'finnish', 'danish', 'norwegian', 'hebrew', 'thai',
  'indonesian', 'malay', 'tagalog', 'swahili', 'persian', 'urdu', 'tamil'
]);

const NATIONALITIES = new Set([
  'american', 'british', 'canadian', 'australian', 'french', 'german', 'italian',
  'spanish', 'russian', 'chinese', 'japanese', 'korean', 'indian', 'brazilian',
  'mexican', 'african', 'european', 'asian', 'arab', 'jewish', 'muslim', 'christian',
  'buddhist', 'hindu', 'catholic', 'protestant', 'orthodox', 'democratic', 'republican'
]);

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

interface EntityPattern {
  type: string;
  pattern: RegExp;
  priority?: number;
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // Email
  { type: 'EMAIL', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi, priority: 10 },

  // URL
  { type: 'URL', pattern: /\bhttps?:\/\/[^\s<>"\)]+/gi, priority: 10 },
  { type: 'URL', pattern: /\bwww\.[^\s<>"\)]+/gi, priority: 10 },

  // Phone numbers
  { type: 'PHONE', pattern: /\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, priority: 10 },
  { type: 'PHONE', pattern: /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g, priority: 10 },

  // Money
  { type: 'MONEY', pattern: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:million|billion|trillion|m|b|k))?\b/gi, priority: 8 },
  { type: 'MONEY', pattern: /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|euros?|pounds?|yen|USD|EUR|GBP|JPY)\b/gi, priority: 8 },

  // Percentages
  { type: 'PERCENT', pattern: /\b\d+(?:\.\d+)?%/g, priority: 8 },
  { type: 'PERCENT', pattern: /\b\d+(?:\.\d+)?\s*percent\b/gi, priority: 8 },

  // Dates
  { type: 'DATE', pattern: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi, priority: 7 },
  { type: 'DATE', pattern: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi, priority: 7 },
  { type: 'DATE', pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, priority: 7 },
  { type: 'DATE', pattern: /\b\d{4}-\d{2}-\d{2}\b/g, priority: 7 },
  { type: 'DATE', pattern: /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, priority: 6 },
  { type: 'DATE', pattern: /\b(?:yesterday|today|tomorrow|last\s+(?:week|month|year)|next\s+(?:week|month|year))\b/gi, priority: 6 },

  // Time
  { type: 'TIME', pattern: /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\b/g, priority: 7 },

  // Ordinals
  { type: 'ORDINAL', pattern: /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\b/gi, priority: 5 },

  // Quantities
  { type: 'QUANTITY', pattern: /\b\d+(?:\.\d+)?\s*(?:kg|km|m|cm|mm|lb|lbs|oz|ft|mi|mph|kmh|mb|gb|tb)\b/gi, priority: 6 }
];

// ============================================================================
// NER ENGINE
// ============================================================================

interface Entity {
  text: string;
  type: string;
  start: number;
  end: number;
  confidence: number;
}

function tokenize(text: string): { token: string; start: number; end: number }[] {
  const tokens: { token: string; start: number; end: number }[] = [];
  const regex = /\S+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      token: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return tokens;
}

function extractPatternEntities(text: string): Entity[] {
  const entities: Entity[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const { type, pattern, priority: _priority = 5 } of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9
      });
    }
  }

  return entities;
}

function extractGazetteerEntities(text: string, _tokens: { token: string; start: number; end: number }[]): Entity[] {
  const entities: Entity[] = [];
  const lowerText = text.toLowerCase();

  // Check for countries
  for (const country of COUNTRIES) {
    const idx = lowerText.indexOf(country);
    if (idx !== -1) {
      // Check if it's a whole word
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + country.length >= text.length || /\W/.test(text[idx + country.length]);
      if (before && after) {
        entities.push({
          text: text.slice(idx, idx + country.length),
          type: 'GPE',
          start: idx,
          end: idx + country.length,
          confidence: 0.95
        });
      }
    }
  }

  // Check for US states
  for (const state of US_STATES) {
    const idx = lowerText.indexOf(state);
    if (idx !== -1) {
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + state.length >= text.length || /\W/.test(text[idx + state.length]);
      if (before && after) {
        entities.push({
          text: text.slice(idx, idx + state.length),
          type: 'GPE',
          start: idx,
          end: idx + state.length,
          confidence: 0.9
        });
      }
    }
  }

  // Check for major cities
  for (const city of MAJOR_CITIES) {
    const idx = lowerText.indexOf(city);
    if (idx !== -1) {
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + city.length >= text.length || /\W/.test(text[idx + city.length]);
      if (before && after) {
        entities.push({
          text: text.slice(idx, idx + city.length),
          type: 'GPE',
          start: idx,
          end: idx + city.length,
          confidence: 0.85
        });
      }
    }
  }

  // Check for languages
  for (const lang of LANGUAGES) {
    const idx = lowerText.indexOf(lang);
    if (idx !== -1) {
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + lang.length >= text.length || /\W/.test(text[idx + lang.length]);
      if (before && after) {
        entities.push({
          text: text.slice(idx, idx + lang.length),
          type: 'LANGUAGE',
          start: idx,
          end: idx + lang.length,
          confidence: 0.85
        });
      }
    }
  }

  // Check for nationalities/groups
  for (const norp of NATIONALITIES) {
    const idx = lowerText.indexOf(norp);
    if (idx !== -1) {
      const before = idx === 0 || /\W/.test(text[idx - 1]);
      const after = idx + norp.length >= text.length || /\W/.test(text[idx + norp.length]);
      if (before && after) {
        entities.push({
          text: text.slice(idx, idx + norp.length),
          type: 'NORP',
          start: idx,
          end: idx + norp.length,
          confidence: 0.8
        });
      }
    }
  }

  return entities;
}

function extractRuleBasedEntities(text: string, tokens: { token: string; start: number; end: number }[]): Entity[] {
  const entities: Entity[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].token;
    const cleanToken = token.replace(/[.,;:!?'"()[\]{}]/g, '');
    const lowerToken = cleanToken.toLowerCase();

    // Check for person names with titles
    if (PERSON_TITLES.has(lowerToken) && i + 1 < tokens.length) {
      const nextTokens: string[] = [cleanToken];
      let j = i + 1;

      // Collect capitalized words
      while (j < tokens.length) {
        const nextClean = tokens[j].token.replace(/[.,;:!?'"()[\]{}]/g, '');
        if (/^[A-Z][a-z]+$/.test(nextClean)) {
          nextTokens.push(nextClean);
          j++;
        } else {
          break;
        }
      }

      if (nextTokens.length > 1) {
        const fullName = nextTokens.join(' ');
        entities.push({
          text: fullName,
          type: 'PERSON',
          start: tokens[i].start,
          end: tokens[j - 1].end,
          confidence: 0.9
        });
      }
    }

    // Check for capitalized sequences (potential names/organizations)
    if (/^[A-Z][a-z]+$/.test(cleanToken) && !PERSON_TITLES.has(lowerToken)) {
      const capitalizedTokens: string[] = [cleanToken];
      let j = i + 1;

      while (j < tokens.length) {
        const nextClean = tokens[j].token.replace(/[.,;:!?'"()[\]{}]/g, '');
        if (/^[A-Z][a-z]+$/.test(nextClean)) {
          capitalizedTokens.push(nextClean);
          j++;
        } else if (ORG_SUFFIXES.has(nextClean.toLowerCase())) {
          capitalizedTokens.push(nextClean);
          j++;
          break;
        } else {
          break;
        }
      }

      if (capitalizedTokens.length >= 1) {
        const fullText = capitalizedTokens.join(' ');
        const lastWord = capitalizedTokens[capitalizedTokens.length - 1].toLowerCase();

        let type = 'ORG';
        let confidence = 0.6;

        // Determine if it's a person or organization
        if (capitalizedTokens.length === 2 &&
            COMMON_FIRST_NAMES.has(capitalizedTokens[0].toLowerCase())) {
          type = 'PERSON';
          confidence = 0.8;
        } else if (ORG_SUFFIXES.has(lastWord)) {
          type = 'ORG';
          confidence = 0.85;
        } else if (capitalizedTokens.length === 1 &&
                   COMMON_FIRST_NAMES.has(lowerToken)) {
          type = 'PERSON';
          confidence = 0.5;
        }

        // Don't add single-word entities that might be sentence starters
        if (capitalizedTokens.length > 1 || i > 0) {
          entities.push({
            text: fullText,
            type,
            start: tokens[i].start,
            end: tokens[j - 1].end,
            confidence
          });
        }
      }
    }

    // Check for all-caps acronyms (potential organizations)
    if (/^[A-Z]{2,}$/.test(cleanToken) && cleanToken.length <= 6) {
      entities.push({
        text: cleanToken,
        type: 'ORG',
        start: tokens[i].start,
        end: tokens[i].end,
        confidence: 0.6
      });
    }
  }

  return entities;
}

function deduplicateEntities(entities: Entity[]): Entity[] {
  // Sort by start position, then by confidence (descending)
  entities.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.confidence - a.confidence;
  });

  const result: Entity[] = [];
  let lastEnd = -1;

  for (const entity of entities) {
    // Skip overlapping entities
    if (entity.start >= lastEnd) {
      result.push(entity);
      lastEnd = entity.end;
    } else if (entity.confidence > 0.85 && entity.start < lastEnd) {
      // Allow high-confidence entities to overlap
      const overlap = result.find(e => e.start <= entity.start && e.end >= entity.end);
      if (!overlap) {
        result.push(entity);
      }
    }
  }

  return result;
}

function extractEntities(text: string, entityTypes?: string[]): Entity[] {
  const tokens = tokenize(text);

  // Extract entities from different sources
  const patternEntities = extractPatternEntities(text);
  const gazetteerEntities = extractGazetteerEntities(text, tokens);
  const ruleEntities = extractRuleBasedEntities(text, tokens);

  // Combine all entities
  let allEntities = [...patternEntities, ...gazetteerEntities, ...ruleEntities];

  // Filter by entity types if specified
  if (entityTypes && entityTypes.length > 0) {
    const typeSet = new Set(entityTypes.map(t => t.toUpperCase()));
    allEntities = allEntities.filter(e => typeSet.has(e.type));
  }

  // Deduplicate
  return deduplicateEntities(allEntities);
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const nerTool: UnifiedTool = {
  name: 'ner',
  description: 'Named Entity Recognition - extract people, organizations, locations, etc.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['extract', 'classify', 'types', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Text to analyze'
      },
      entity_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific entity types to extract (default: all)'
      },
      min_confidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0-1, default: 0.5)'
      }
    },
    required: ['operation']
  }
};

export async function executener(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, entity_types, min_confidence = 0.5 } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Named Entity Recognition Tool',
        description: 'Extract and classify named entities from text',
        operations: {
          extract: 'Extract named entities from text',
          classify: 'Classify a single entity',
          types: 'List available entity types'
        },
        supportedTypes: Object.keys(ENTITY_TYPES),
        features: [
          'Pattern-based recognition (emails, URLs, phones, dates)',
          'Gazetteer-based recognition (countries, cities, names)',
          'Rule-based recognition (capitalization patterns)',
          'Confidence scoring',
          'Entity type filtering'
        ],
        algorithm: 'Hybrid rule-based and pattern matching'
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Types operation
    if (operation === 'types') {
      return { toolCallId: id, content: JSON.stringify({
        operation: 'types',
        entityTypes: Object.entries(ENTITY_TYPES).map(([type, description]) => ({
          type,
          description
        })),
        count: Object.keys(ENTITY_TYPES).length
      }, null, 2) };
    }

    // Extract operation
    if (operation === 'extract') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for extraction', isError: true };
      }

      let entities = extractEntities(text, entity_types);

      // Filter by confidence
      entities = entities.filter(e => e.confidence >= min_confidence);

      // Group by type
      const byType: Record<string, Entity[]> = {};
      for (const entity of entities) {
        if (!byType[entity.type]) byType[entity.type] = [];
        byType[entity.type].push(entity);
      }

      // Count by type
      const typeCounts: Record<string, number> = {};
      for (const [type, ents] of Object.entries(byType)) {
        typeCounts[type] = ents.length;
      }

      return { toolCallId: id, content: JSON.stringify({
        operation: 'extract',
        input: {
          text: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
          length: text.length
        },
        output: {
          entities: entities.slice(0, 50).map(e => ({
            text: e.text,
            type: e.type,
            confidence: Math.round(e.confidence * 100) / 100,
            position: { start: e.start, end: e.end }
          })),
          entityCount: entities.length,
          ...(entities.length > 50 ? { truncated: true } : {})
        },
        summary: {
          byType: typeCounts,
          uniqueTypes: Object.keys(typeCounts).length,
          highConfidence: entities.filter(e => e.confidence >= 0.8).length
        },
        ...(entity_types ? { filteredBy: entity_types } : {}),
        minConfidence: min_confidence
      }, null, 2) };
    }

    // Classify operation - determine type of a single entity
    if (operation === 'classify') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for classification', isError: true };
      }

      const entities = extractEntities(text);
      const exactMatch = entities.find(e =>
        e.text.toLowerCase() === text.toLowerCase()
      );

      if (exactMatch) {
        return { toolCallId: id, content: JSON.stringify({
          operation: 'classify',
          input: text,
          classification: {
            type: exactMatch.type,
            typeDescription: ENTITY_TYPES[exactMatch.type] || 'Unknown',
            confidence: Math.round(exactMatch.confidence * 100) / 100
          }
        }, null, 2) };
      }

      // Try pattern matching
      const lowerText = text.toLowerCase();

      let possibleType = 'UNKNOWN';
      let confidence = 0.3;

      if (COUNTRIES.has(lowerText) || US_STATES.has(lowerText) || MAJOR_CITIES.has(lowerText)) {
        possibleType = 'GPE';
        confidence = 0.8;
      } else if (LANGUAGES.has(lowerText)) {
        possibleType = 'LANGUAGE';
        confidence = 0.85;
      } else if (NATIONALITIES.has(lowerText)) {
        possibleType = 'NORP';
        confidence = 0.8;
      } else if (COMMON_FIRST_NAMES.has(lowerText)) {
        possibleType = 'PERSON';
        confidence = 0.5;
      } else if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(text)) {
        possibleType = 'PERSON';
        confidence = 0.6;
      } else if (/^[A-Z]{2,}$/.test(text)) {
        possibleType = 'ORG';
        confidence = 0.5;
      }

      return { toolCallId: id, content: JSON.stringify({
        operation: 'classify',
        input: text,
        classification: {
          type: possibleType,
          typeDescription: ENTITY_TYPES[possibleType] || 'Unknown or ambiguous',
          confidence: Math.round(confidence * 100) / 100
        },
        note: possibleType === 'UNKNOWN'
          ? 'Could not determine entity type with confidence'
          : undefined
      }, null, 2) };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isnerAvailable(): boolean {
  return true;
}
