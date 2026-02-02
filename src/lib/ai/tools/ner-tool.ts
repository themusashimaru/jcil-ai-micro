/**
 * NER TOOL
 * Named Entity Recognition with rule-based and pattern-based extraction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nerTool: UnifiedTool = {
  name: 'ner',
  description: 'Named Entity Recognition (person, org, location, etc.)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['extract', 'classify', 'annotate', 'info'], description: 'Operation' },
      text: { type: 'string', description: 'Text to process' },
      entity_types: { type: 'array', items: { type: 'string' }, description: 'Entity types to extract' }
    },
    required: ['operation']
  }
};

// Entity type definitions
const ENTITY_TYPES: { [key: string]: { description: string; examples: string[] } } = {
  'PERSON': {
    description: 'People, including fictional characters',
    examples: ['Albert Einstein', 'Marie Curie', 'Sherlock Holmes']
  },
  'ORG': {
    description: 'Companies, agencies, institutions',
    examples: ['Google', 'United Nations', 'MIT']
  },
  'GPE': {
    description: 'Geopolitical entities (countries, cities, states)',
    examples: ['France', 'New York', 'California']
  },
  'LOC': {
    description: 'Non-GPE locations (mountains, rivers, regions)',
    examples: ['Mount Everest', 'Pacific Ocean', 'Silicon Valley']
  },
  'DATE': {
    description: 'Dates and periods',
    examples: ['January 2024', 'the 1990s', 'last week']
  },
  'TIME': {
    description: 'Times of day',
    examples: ['3:00 PM', 'noon', 'midnight']
  },
  'MONEY': {
    description: 'Monetary values',
    examples: ['$50', '€100 million', '500 dollars']
  },
  'PERCENT': {
    description: 'Percentages',
    examples: ['50%', 'twenty percent', '0.5%']
  },
  'QUANTITY': {
    description: 'Measurements and quantities',
    examples: ['100 kilometers', '5 kilograms', 'three miles']
  },
  'PRODUCT': {
    description: 'Products, vehicles, works of art',
    examples: ['iPhone', 'Boeing 747', 'Mona Lisa']
  },
  'EVENT': {
    description: 'Named events',
    examples: ['World War II', 'Olympics', 'Super Bowl']
  },
  'LANGUAGE': {
    description: 'Named languages',
    examples: ['English', 'Spanish', 'Mandarin']
  },
  'EMAIL': {
    description: 'Email addresses',
    examples: ['user@example.com']
  },
  'URL': {
    description: 'Web addresses',
    examples: ['https://example.com']
  },
  'PHONE': {
    description: 'Phone numbers',
    examples: ['+1-555-123-4567', '(555) 123-4567']
  }
};

// Common entity gazetteers
const COMMON_PERSONS = new Set([
  'albert einstein', 'isaac newton', 'marie curie', 'stephen hawking',
  'barack obama', 'donald trump', 'joe biden', 'bill gates', 'elon musk',
  'jeff bezos', 'mark zuckerberg', 'warren buffett', 'steve jobs'
]);

const COMMON_ORGS = new Set([
  'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta', 'twitter',
  'netflix', 'tesla', 'spacex', 'nasa', 'fbi', 'cia', 'nsa',
  'united nations', 'world health organization', 'red cross',
  'harvard', 'stanford', 'mit', 'oxford', 'cambridge',
  'nfl', 'nba', 'mlb', 'fifa', 'olympics'
]);

const COMMON_LOCATIONS = new Set([
  'united states', 'usa', 'united kingdom', 'uk', 'china', 'japan', 'india',
  'germany', 'france', 'italy', 'spain', 'russia', 'brazil', 'canada', 'australia',
  'new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'beijing',
  'california', 'texas', 'florida', 'new jersey', 'washington'
]);

const TITLES = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'professor',
  'president', 'ceo', 'cto', 'cfo', 'sir', 'lord', 'lady',
  'king', 'queen', 'prince', 'princess', 'senator', 'governor'
]);

const MONTHS = new Set([
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
]);

const DAYS = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
]);

// Entity extraction patterns
interface Entity {
  text: string;
  type: string;
  start: number;
  end: number;
  confidence: number;
}

// Extract entities using patterns and rules
function extractEntities(text: string, requestedTypes?: string[]): Entity[] {
  const entities: Entity[] = [];
  const types = requestedTypes || Object.keys(ENTITY_TYPES);

  // Email pattern
  if (types.includes('EMAIL')) {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'EMAIL',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.99
      });
    }
  }

  // URL pattern
  if (types.includes('URL')) {
    const urlPattern = /https?:\/\/[^\s<>\"{}|\\^`\[\]]+/gi;
    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'URL',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.99
      });
    }
  }

  // Phone pattern
  if (types.includes('PHONE')) {
    const phonePattern = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    let match;
    while ((match = phonePattern.exec(text)) !== null) {
      if (match[0].replace(/\D/g, '').length >= 10) {
        entities.push({
          text: match[0],
          type: 'PHONE',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.9
        });
      }
    }
  }

  // Money pattern
  if (types.includes('MONEY')) {
    const moneyPattern = /[$€£¥]\s*[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|thousand|k|m|b))?|\d+(?:\.\d{2})?\s*(?:dollars?|euros?|pounds?|yen)/gi;
    let match;
    while ((match = moneyPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'MONEY',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95
      });
    }
  }

  // Percent pattern
  if (types.includes('PERCENT')) {
    const percentPattern = /\d+(?:\.\d+)?\s*%|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+percent/gi;
    let match;
    while ((match = percentPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'PERCENT',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95
      });
    }
  }

  // Date patterns
  if (types.includes('DATE')) {
    // Full dates
    const datePattern1 = /(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.\s]+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/gi;
    let match;
    while ((match = datePattern1.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'DATE',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9
      });
    }

    // Relative dates
    const relativeDates = /(?:last|next|this)\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:yesterday|today|tomorrow)/gi;
    while ((match = relativeDates.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'DATE',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.85
      });
    }
  }

  // Time pattern
  if (types.includes('TIME')) {
    const timePattern = /\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\b(?:noon|midnight|morning|afternoon|evening)\b/gi;
    let match;
    while ((match = timePattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'TIME',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9
      });
    }
  }

  // Quantity pattern
  if (types.includes('QUANTITY')) {
    const quantityPattern = /\d+(?:\.\d+)?\s*(?:kg|kilogram|lb|pound|km|kilometer|mile|meter|foot|feet|inch|gallon|liter|celsius|fahrenheit|degrees?)s?/gi;
    let match;
    while ((match = quantityPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'QUANTITY',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9
      });
    }
  }

  // Named entity extraction using capitalization and context
  const words = text.split(/\s+/);
  let currentEntity = '';
  let entityStart = 0;
  let charIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.replace(/[.,!?;:'"()\[\]{}]/g, '');
    const lowerCleanWord = cleanWord.toLowerCase();

    // Check if word starts capitalized (potential named entity)
    if (/^[A-Z]/.test(cleanWord) && cleanWord.length > 1) {
      if (currentEntity === '') {
        entityStart = text.indexOf(word, charIndex);
      }

      // Check for title (indicates person)
      if (TITLES.has(lowerCleanWord)) {
        currentEntity = cleanWord;
      } else if (currentEntity) {
        currentEntity += ' ' + cleanWord;
      } else {
        currentEntity = cleanWord;
      }
    } else {
      // End of potential entity
      if (currentEntity && currentEntity.split(' ').length >= 1) {
        const lowerEntity = currentEntity.toLowerCase();

        let type: string | null = null;
        let confidence = 0.7;

        // Check gazetteers
        if (COMMON_PERSONS.has(lowerEntity) || TITLES.has(currentEntity.split(' ')[0].toLowerCase())) {
          type = 'PERSON';
          confidence = 0.9;
        } else if (COMMON_ORGS.has(lowerEntity)) {
          type = 'ORG';
          confidence = 0.9;
        } else if (COMMON_LOCATIONS.has(lowerEntity)) {
          type = 'GPE';
          confidence = 0.9;
        } else if (currentEntity.split(' ').length >= 2) {
          // Multi-word capitalized - likely PERSON or ORG
          if (/Inc\.?|Corp\.?|LLC|Ltd\.?|Company|University|Institute|Foundation/.test(currentEntity)) {
            type = 'ORG';
            confidence = 0.85;
          } else {
            type = 'PERSON';
            confidence = 0.6;
          }
        } else if (/^[A-Z]{2,}$/.test(currentEntity)) {
          // All caps acronym - likely ORG
          type = 'ORG';
          confidence = 0.6;
        }

        if (type && types.includes(type)) {
          const entityEnd = entityStart + currentEntity.length;
          // Check for overlap
          const overlaps = entities.some(e =>
            (entityStart >= e.start && entityStart < e.end) ||
            (entityEnd > e.start && entityEnd <= e.end)
          );

          if (!overlaps) {
            entities.push({
              text: currentEntity,
              type,
              start: entityStart,
              end: entityEnd,
              confidence
            });
          }
        }
      }
      currentEntity = '';
    }

    charIndex = text.indexOf(word, charIndex) + word.length;
  }

  // Handle trailing entity
  if (currentEntity) {
    const lowerEntity = currentEntity.toLowerCase();
    let type: string | null = null;
    let confidence = 0.6;

    if (COMMON_PERSONS.has(lowerEntity)) { type = 'PERSON'; confidence = 0.9; }
    else if (COMMON_ORGS.has(lowerEntity)) { type = 'ORG'; confidence = 0.9; }
    else if (COMMON_LOCATIONS.has(lowerEntity)) { type = 'GPE'; confidence = 0.9; }
    else if (currentEntity.split(' ').length >= 2) { type = 'PERSON'; }

    if (type && types.includes(type)) {
      entities.push({
        text: currentEntity,
        type,
        start: entityStart,
        end: entityStart + currentEntity.length,
        confidence
      });
    }
  }

  // Sort by position
  entities.sort((a, b) => a.start - b.start);

  return entities;
}

// Annotate text with entity markers
function annotateText(text: string, entities: Entity[]): string {
  // Sort entities by start position (descending to avoid index shifts)
  const sorted = [...entities].sort((a, b) => b.start - a.start);

  let annotated = text;
  for (const entity of sorted) {
    const before = annotated.substring(0, entity.start);
    const after = annotated.substring(entity.end);
    annotated = `${before}[${entity.text}](${entity.type})${after}`;
  }

  return annotated;
}

export async function executener(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'ner',
        name: 'Named Entity Recognition',
        description: 'Identifies and classifies named entities in text',

        entityTypes: ENTITY_TYPES,

        approaches: {
          rulebased: {
            description: 'Pattern matching and gazetteers',
            pros: ['Fast', 'Interpretable', 'No training needed'],
            cons: ['Limited coverage', 'Maintenance burden']
          },
          statistical: {
            description: 'CRF, HMM models',
            pros: ['Handles unseen entities', 'Context-aware'],
            cons: ['Needs labeled data']
          },
          neural: {
            description: 'BiLSTM-CRF, BERT-based models',
            pros: ['State-of-the-art accuracy', 'Transfer learning'],
            cons: ['Computationally expensive']
          }
        },

        evaluationMetrics: {
          precision: 'Correct entities / Predicted entities',
          recall: 'Correct entities / True entities',
          f1: 'Harmonic mean of precision and recall',
          note: 'Exact match vs partial match evaluation'
        },

        applications: [
          'Information extraction',
          'Question answering',
          'Knowledge graph construction',
          'Content categorization',
          'PII detection'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    const text = args.text || 'Albert Einstein was born in Ulm, Germany on March 14, 1879. He later worked at Princeton University and won the Nobel Prize in 1921. His email was einstein@princeton.edu and he earned $15,000 annually.';
    const entityTypes = args.entity_types;

    if (operation === 'extract') {
      const entities = extractEntities(text, entityTypes);

      // Group by type
      const byType: { [type: string]: Entity[] } = {};
      for (const entity of entities) {
        if (!byType[entity.type]) byType[entity.type] = [];
        byType[entity.type].push(entity);
      }

      // Create summary
      const summary = Object.entries(byType).map(([type, ents]) => ({
        type,
        description: ENTITY_TYPES[type]?.description || 'Unknown',
        count: ents.length,
        entities: ents.map(e => e.text)
      }));

      const output = {
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        totalEntities: entities.length,

        entities: entities.map(e => ({
          text: e.text,
          type: e.type,
          position: `${e.start}-${e.end}`,
          confidence: Number(e.confidence.toFixed(2))
        })),

        byType: summary,

        annotatedText: annotateText(text, entities)
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'classify') {
      const entities = extractEntities(text, entityTypes);

      // Detailed classification
      const classified = entities.map(e => ({
        text: e.text,
        type: e.type,
        typeDescription: ENTITY_TYPES[e.type]?.description || 'Unknown',
        confidence: Number(e.confidence.toFixed(2)),
        context: text.substring(Math.max(0, e.start - 30), Math.min(text.length, e.end + 30))
          .replace(e.text, `**${e.text}**`)
      }));

      const output = {
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),

        classifications: classified,

        statistics: {
          totalEntities: entities.length,
          averageConfidence: entities.length > 0
            ? Number((entities.reduce((s, e) => s + e.confidence, 0) / entities.length).toFixed(2))
            : 0,
          typeDistribution: Object.entries(
            entities.reduce((acc, e) => {
              acc[e.type] = (acc[e.type] || 0) + 1;
              return acc;
            }, {} as { [key: string]: number })
          ).map(([type, count]) => ({ type, count }))
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'annotate') {
      const entities = extractEntities(text, entityTypes);
      const annotated = annotateText(text, entities);

      // Create IOB2 format annotation
      const iobAnnotation: { token: string; tag: string }[] = [];
      const tokens = text.split(/\s+/);
      let charPos = 0;

      for (const token of tokens) {
        const tokenStart = text.indexOf(token, charPos);
        const tokenEnd = tokenStart + token.length;

        // Find entity for this token
        const entity = entities.find(e =>
          (tokenStart >= e.start && tokenStart < e.end) ||
          (tokenEnd > e.start && tokenEnd <= e.end)
        );

        if (entity) {
          const isBeginning = tokenStart === entity.start || tokenStart <= entity.start + 1;
          iobAnnotation.push({
            token,
            tag: isBeginning ? `B-${entity.type}` : `I-${entity.type}`
          });
        } else {
          iobAnnotation.push({ token, tag: 'O' });
        }

        charPos = tokenEnd;
      }

      const output = {
        originalText: text,
        annotatedText: annotated,

        iobFormat: iobAnnotation.map(t => `${t.token}\t${t.tag}`).join('\n'),

        legend: {
          format: '[entity text](ENTITY_TYPE)',
          iobTags: {
            'B-TYPE': 'Beginning of entity',
            'I-TYPE': 'Inside entity (continuation)',
            'O': 'Outside any entity'
          }
        },

        entitiesFound: entities.length
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isnerAvailable(): boolean { return true; }
