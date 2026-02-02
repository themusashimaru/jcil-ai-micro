/**
 * POS-TAGGER TOOL
 * Complete Part-of-Speech Tagging
 *
 * This implementation provides:
 * - Hidden Markov Model (HMM) based tagging
 * - Rule-based tagging fallback
 * - Penn Treebank and Universal tagsets
 * - Viterbi algorithm for sequence labeling
 * - Pre-trained model with common English patterns
 *
 * Applications:
 * - Text analysis
 * - Information extraction
 * - Grammar checking
 * - Machine translation preprocessing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TAG DEFINITIONS
// ============================================================================

// Penn Treebank tags
const PENN_TAGS: Record<string, string> = {
  CC: 'Coordinating conjunction',
  CD: 'Cardinal number',
  DT: 'Determiner',
  EX: 'Existential there',
  FW: 'Foreign word',
  IN: 'Preposition or subordinating conjunction',
  JJ: 'Adjective',
  JJR: 'Adjective, comparative',
  JJS: 'Adjective, superlative',
  LS: 'List item marker',
  MD: 'Modal',
  NN: 'Noun, singular or mass',
  NNS: 'Noun, plural',
  NNP: 'Proper noun, singular',
  NNPS: 'Proper noun, plural',
  PDT: 'Predeterminer',
  POS: 'Possessive ending',
  PRP: 'Personal pronoun',
  'PRP$': 'Possessive pronoun',
  RB: 'Adverb',
  RBR: 'Adverb, comparative',
  RBS: 'Adverb, superlative',
  RP: 'Particle',
  SYM: 'Symbol',
  TO: 'to',
  UH: 'Interjection',
  VB: 'Verb, base form',
  VBD: 'Verb, past tense',
  VBG: 'Verb, gerund or present participle',
  VBN: 'Verb, past participle',
  VBP: 'Verb, non-3rd person singular present',
  VBZ: 'Verb, 3rd person singular present',
  WDT: 'Wh-determiner',
  WP: 'Wh-pronoun',
  'WP$': 'Possessive wh-pronoun',
  WRB: 'Wh-adverb',
  '.': 'Punctuation (sentence-ending)',
  ',': 'Punctuation (comma)',
  ':': 'Punctuation (colon/semicolon)',
  '(': 'Left bracket',
  ')': 'Right bracket',
  '"': 'Quote',
  '$': 'Dollar sign'
};

// Universal POS tags (mapping from Penn)
const UNIVERSAL_TAGS: Record<string, string> = {
  ADJ: 'Adjective',
  ADP: 'Adposition',
  ADV: 'Adverb',
  AUX: 'Auxiliary',
  CCONJ: 'Coordinating conjunction',
  DET: 'Determiner',
  INTJ: 'Interjection',
  NOUN: 'Noun',
  NUM: 'Numeral',
  PART: 'Particle',
  PRON: 'Pronoun',
  PROPN: 'Proper noun',
  PUNCT: 'Punctuation',
  SCONJ: 'Subordinating conjunction',
  SYM: 'Symbol',
  VERB: 'Verb',
  X: 'Other'
};

const PENN_TO_UNIVERSAL: Record<string, string> = {
  CC: 'CCONJ', CD: 'NUM', DT: 'DET', EX: 'PRON', FW: 'X',
  IN: 'ADP', JJ: 'ADJ', JJR: 'ADJ', JJS: 'ADJ',
  MD: 'AUX', NN: 'NOUN', NNS: 'NOUN', NNP: 'PROPN', NNPS: 'PROPN',
  PDT: 'DET', POS: 'PART', PRP: 'PRON', 'PRP$': 'PRON',
  RB: 'ADV', RBR: 'ADV', RBS: 'ADV', RP: 'PART',
  SYM: 'SYM', TO: 'PART', UH: 'INTJ',
  VB: 'VERB', VBD: 'VERB', VBG: 'VERB', VBN: 'VERB', VBP: 'VERB', VBZ: 'VERB',
  WDT: 'DET', WP: 'PRON', 'WP$': 'PRON', WRB: 'ADV',
  '.': 'PUNCT', ',': 'PUNCT', ':': 'PUNCT', '(': 'PUNCT', ')': 'PUNCT', '"': 'PUNCT', '$': 'SYM'
};

// ============================================================================
// LEXICON AND RULES
// ============================================================================

// Word -> likely tags (simplified lexicon)
const LEXICON: Record<string, string[]> = {
  // Determiners
  'the': ['DT'], 'a': ['DT'], 'an': ['DT'], 'this': ['DT'], 'that': ['DT', 'IN'],
  'these': ['DT'], 'those': ['DT'], 'some': ['DT'], 'any': ['DT'],
  'all': ['DT', 'PDT'], 'both': ['DT', 'PDT'], 'each': ['DT'],

  // Pronouns
  'i': ['PRP'], 'me': ['PRP'], 'my': ['PRP$'], 'mine': ['PRP$'],
  'you': ['PRP'], 'your': ['PRP$'], 'yours': ['PRP$'],
  'he': ['PRP'], 'him': ['PRP'], 'his': ['PRP$'],
  'she': ['PRP'], 'her': ['PRP', 'PRP$'], 'hers': ['PRP$'],
  'it': ['PRP'], 'its': ['PRP$'],
  'we': ['PRP'], 'us': ['PRP'], 'our': ['PRP$'], 'ours': ['PRP$'],
  'they': ['PRP'], 'them': ['PRP'], 'their': ['PRP$'], 'theirs': ['PRP$'],
  'who': ['WP'], 'whom': ['WP'], 'whose': ['WP$'], 'which': ['WDT', 'WP'],
  'what': ['WP', 'WDT'], 'whoever': ['WP'], 'whatever': ['WDT'],

  // Common verbs
  'be': ['VB'], 'is': ['VBZ'], 'am': ['VBP'], 'are': ['VBP'], 'was': ['VBD'], 'were': ['VBD'],
  'been': ['VBN'], 'being': ['VBG'],
  'have': ['VB', 'VBP'], 'has': ['VBZ'], 'had': ['VBD', 'VBN'], 'having': ['VBG'],
  'do': ['VB', 'VBP'], 'does': ['VBZ'], 'did': ['VBD'], 'done': ['VBN'], 'doing': ['VBG'],
  'will': ['MD'], 'would': ['MD'], 'could': ['MD'], 'should': ['MD'],
  'can': ['MD'], 'may': ['MD'], 'might': ['MD'], 'must': ['MD'],
  'shall': ['MD'], 'need': ['VB', 'MD'],

  // Prepositions/Conjunctions
  'to': ['TO', 'IN'], 'of': ['IN'], 'in': ['IN'], 'for': ['IN'], 'on': ['IN'],
  'with': ['IN'], 'at': ['IN'], 'by': ['IN'], 'from': ['IN'], 'about': ['IN'],
  'into': ['IN'], 'through': ['IN'], 'during': ['IN'], 'before': ['IN'],
  'after': ['IN'], 'above': ['IN'], 'below': ['IN'], 'between': ['IN'],
  'under': ['IN'], 'over': ['IN'], 'out': ['IN', 'RP'],
  'and': ['CC'], 'or': ['CC'], 'but': ['CC'], 'nor': ['CC'], 'so': ['CC', 'RB'],
  'yet': ['CC', 'RB'], 'for': ['CC', 'IN'],
  'if': ['IN'], 'because': ['IN'], 'although': ['IN'], 'while': ['IN'],
  'since': ['IN'], 'unless': ['IN'], 'until': ['IN'], 'though': ['IN'],

  // Common adverbs
  'not': ['RB'], 'very': ['RB'], 'also': ['RB'], 'just': ['RB'],
  'only': ['RB'], 'even': ['RB'], 'still': ['RB'], 'already': ['RB'],
  'always': ['RB'], 'never': ['RB'], 'often': ['RB'], 'sometimes': ['RB'],
  'here': ['RB'], 'there': ['RB', 'EX'], 'now': ['RB'], 'then': ['RB'],
  'how': ['WRB'], 'when': ['WRB'], 'where': ['WRB'], 'why': ['WRB'],
  'more': ['RBR', 'JJR'], 'most': ['RBS', 'JJS'], 'less': ['RBR', 'JJR'],

  // Common adjectives
  'good': ['JJ'], 'new': ['JJ'], 'first': ['JJ'], 'last': ['JJ'],
  'long': ['JJ'], 'great': ['JJ'], 'little': ['JJ'], 'own': ['JJ'],
  'other': ['JJ'], 'old': ['JJ'], 'right': ['JJ'], 'big': ['JJ'],
  'high': ['JJ'], 'different': ['JJ'], 'small': ['JJ'], 'large': ['JJ'],
  'next': ['JJ'], 'early': ['JJ'], 'young': ['JJ'], 'important': ['JJ'],
  'few': ['JJ'], 'public': ['JJ'], 'bad': ['JJ'], 'same': ['JJ'],
  'able': ['JJ'], 'better': ['JJR'], 'best': ['JJS'],
  'worse': ['JJR'], 'worst': ['JJS'],

  // Common nouns
  'time': ['NN'], 'year': ['NN'], 'people': ['NNS'], 'way': ['NN'],
  'day': ['NN'], 'man': ['NN'], 'thing': ['NN'], 'woman': ['NN'],
  'life': ['NN'], 'child': ['NN'], 'world': ['NN'], 'school': ['NN'],
  'state': ['NN', 'VB'], 'family': ['NN'], 'student': ['NN'],
  'group': ['NN'], 'country': ['NN'], 'problem': ['NN'], 'hand': ['NN'],
  'part': ['NN'], 'place': ['NN'], 'case': ['NN'], 'week': ['NN'],
  'company': ['NN'], 'system': ['NN'], 'program': ['NN'], 'question': ['NN'],
  'work': ['NN', 'VB'], 'government': ['NN'], 'number': ['NN'],
  'night': ['NN'], 'point': ['NN', 'VB'], 'home': ['NN', 'RB'],
  'water': ['NN'], 'room': ['NN'], 'mother': ['NN'], 'area': ['NN'],

  // Interjections
  'oh': ['UH'], 'ah': ['UH'], 'wow': ['UH'], 'hey': ['UH'],
  'yes': ['UH'], 'no': ['UH', 'DT'], 'hello': ['UH'], 'please': ['UH', 'VB']
};

// Suffix rules for unknown words
const SUFFIX_RULES: Array<{ suffix: string; tag: string; minLen?: number }> = [
  { suffix: 'ing', tag: 'VBG', minLen: 5 },
  { suffix: 'ed', tag: 'VBD', minLen: 4 },
  { suffix: 'ly', tag: 'RB', minLen: 4 },
  { suffix: 'ness', tag: 'NN', minLen: 5 },
  { suffix: 'ment', tag: 'NN', minLen: 5 },
  { suffix: 'tion', tag: 'NN', minLen: 5 },
  { suffix: 'sion', tag: 'NN', minLen: 5 },
  { suffix: 'able', tag: 'JJ', minLen: 5 },
  { suffix: 'ible', tag: 'JJ', minLen: 5 },
  { suffix: 'ful', tag: 'JJ', minLen: 4 },
  { suffix: 'less', tag: 'JJ', minLen: 5 },
  { suffix: 'ous', tag: 'JJ', minLen: 4 },
  { suffix: 'ive', tag: 'JJ', minLen: 4 },
  { suffix: 'er', tag: 'NN', minLen: 4 },
  { suffix: 'or', tag: 'NN', minLen: 4 },
  { suffix: 'ist', tag: 'NN', minLen: 4 },
  { suffix: 's', tag: 'NNS', minLen: 3 },
  { suffix: "'s", tag: 'POS', minLen: 3 }
];

// ============================================================================
// TRANSITION PROBABILITIES (Simplified HMM)
// ============================================================================

// P(tag_i | tag_{i-1}) - simplified bigram probabilities
const TRANSITIONS: Record<string, Record<string, number>> = {
  START: { DT: 0.3, PRP: 0.15, NN: 0.15, NNP: 0.1, VB: 0.1, RB: 0.05, JJ: 0.05, IN: 0.05, CC: 0.025, MD: 0.025 },
  DT: { NN: 0.5, JJ: 0.3, NNS: 0.1, NNP: 0.05, RB: 0.03, VBG: 0.02 },
  JJ: { NN: 0.5, NNS: 0.2, JJ: 0.15, NNP: 0.1, ',': 0.03, CC: 0.02 },
  NN: { VBZ: 0.15, VBD: 0.1, IN: 0.2, '.': 0.15, ',': 0.1, CC: 0.1, NN: 0.05, MD: 0.05, TO: 0.05, POS: 0.05 },
  NNS: { VBP: 0.15, VBD: 0.1, IN: 0.2, '.': 0.15, ',': 0.1, CC: 0.1, MD: 0.05, TO: 0.05 },
  NNP: { NNP: 0.3, VBZ: 0.15, VBD: 0.1, IN: 0.15, '.': 0.1, ',': 0.1, CC: 0.05, POS: 0.05 },
  PRP: { VBZ: 0.2, VBP: 0.2, VBD: 0.15, MD: 0.15, VB: 0.1, RB: 0.1, '.': 0.05, ',': 0.05 },
  VB: { DT: 0.2, NN: 0.15, PRP: 0.1, TO: 0.1, RB: 0.1, JJ: 0.1, IN: 0.1, '.': 0.1, NNP: 0.05 },
  VBZ: { DT: 0.2, JJ: 0.15, RB: 0.15, VBG: 0.1, VBN: 0.1, NN: 0.1, IN: 0.1, '.': 0.05, TO: 0.05 },
  VBD: { DT: 0.2, JJ: 0.1, RB: 0.15, NN: 0.1, PRP: 0.1, IN: 0.1, TO: 0.1, '.': 0.1, NNP: 0.05 },
  VBG: { NN: 0.2, DT: 0.15, IN: 0.15, '.': 0.1, ',': 0.1, JJ: 0.1, TO: 0.1, RB: 0.1 },
  VBN: { IN: 0.2, '.': 0.15, ',': 0.1, RB: 0.1, TO: 0.1, DT: 0.1, NN: 0.1, CC: 0.1, BY: 0.05 },
  VBP: { DT: 0.2, JJ: 0.15, RB: 0.15, VBG: 0.1, VBN: 0.1, NN: 0.1, IN: 0.1, '.': 0.05, TO: 0.05 },
  IN: { DT: 0.3, NN: 0.2, NNP: 0.15, PRP: 0.1, JJ: 0.1, VBG: 0.05, WDT: 0.05, NNS: 0.05 },
  TO: { VB: 0.6, NN: 0.15, DT: 0.1, JJ: 0.05, NNP: 0.05, RB: 0.05 },
  MD: { VB: 0.6, RB: 0.2, PRP: 0.1, NN: 0.05, DT: 0.05 },
  RB: { VB: 0.2, VBD: 0.1, VBZ: 0.1, JJ: 0.15, RB: 0.1, VBN: 0.1, IN: 0.1, '.': 0.1, ',': 0.05 },
  CC: { DT: 0.2, NN: 0.15, JJ: 0.15, PRP: 0.1, VB: 0.1, NNP: 0.1, RB: 0.1, NNS: 0.05, VBG: 0.05 },
  '.': { END: 1.0 },
  ',': { DT: 0.2, CC: 0.15, NN: 0.15, RB: 0.1, JJ: 0.1, IN: 0.1, VBG: 0.1, NNP: 0.05, PRP: 0.05 }
};

// ============================================================================
// TAGGER IMPLEMENTATION
// ============================================================================

interface TaggedWord {
  word: string;
  tag: string;
  universal?: string;
  confidence: number;
}

function tokenize(text: string): string[] {
  // Simple tokenization
  return text
    .replace(/([.!?,;:'"()\[\]{}])/g, ' $1 ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function getLexiconTags(word: string): string[] {
  const lower = word.toLowerCase();

  // Check lexicon
  if (LEXICON[lower]) {
    return LEXICON[lower];
  }

  // Check for numbers
  if (/^\d+(\.\d+)?$/.test(word)) {
    return ['CD'];
  }

  // Check for punctuation
  if (/^[.!?]$/.test(word)) return ['.'];
  if (/^[,]$/.test(word)) return [','];
  if (/^[;:]$/.test(word)) return [':'];
  if (/^[({\[]$/.test(word)) return ['('];
  if (/^[)}\]]$/.test(word)) return [')'];
  if (/^["'`]$/.test(word)) return ['"'];
  if (/^\$$/.test(word)) return ['$'];

  // Check for capitalized words (likely proper nouns)
  if (/^[A-Z][a-z]+$/.test(word)) {
    return ['NNP'];
  }

  // Apply suffix rules
  for (const rule of SUFFIX_RULES) {
    if (word.length >= (rule.minLen || 3) && lower.endsWith(rule.suffix)) {
      return [rule.tag];
    }
  }

  // Default to noun
  return ['NN'];
}

function getTransitionProb(prevTag: string, tag: string): number {
  const probs = TRANSITIONS[prevTag];
  if (!probs) return 0.01;
  return probs[tag] || 0.01;
}

function viterbiTag(words: string[]): TaggedWord[] {
  if (words.length === 0) return [];

  const n = words.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _allTags = Object.keys(PENN_TAGS);

  // Viterbi tables
  const viterbi: Map<string, number>[] = [];
  const backpointer: Map<string, string>[] = [];

  // Initialize
  const firstWord = words[0];
  const firstTags = getLexiconTags(firstWord);
  const firstProbs = new Map<string, number>();

  for (const tag of firstTags) {
    const transProb = getTransitionProb('START', tag);
    firstProbs.set(tag, Math.log(transProb + 0.001));
  }

  viterbi.push(firstProbs);
  backpointer.push(new Map());

  // Forward pass
  for (let i = 1; i < n; i++) {
    const word = words[i];
    const possibleTags = getLexiconTags(word);
    const probs = new Map<string, number>();
    const bp = new Map<string, string>();

    for (const tag of possibleTags) {
      let maxProb = -Infinity;
      let maxPrevTag = '';

      for (const [prevTag, prevProb] of viterbi[i - 1]) {
        const transProb = getTransitionProb(prevTag, tag);
        const prob = prevProb + Math.log(transProb + 0.001);

        if (prob > maxProb) {
          maxProb = prob;
          maxPrevTag = prevTag;
        }
      }

      probs.set(tag, maxProb);
      bp.set(tag, maxPrevTag);
    }

    viterbi.push(probs);
    backpointer.push(bp);
  }

  // Backtrack
  const tags: string[] = new Array(n);
  let maxProb = -Infinity;
  let lastTag = '';

  for (const [tag, prob] of viterbi[n - 1]) {
    if (prob > maxProb) {
      maxProb = prob;
      lastTag = tag;
    }
  }

  tags[n - 1] = lastTag;

  for (let i = n - 2; i >= 0; i--) {
    tags[i] = backpointer[i + 1].get(tags[i + 1]) || 'NN';
  }

  // Build result
  return words.map((word, i) => {
    const tag = tags[i];
    const confidence = Math.exp(viterbi[i].get(tag) || -10);

    return {
      word,
      tag,
      universal: PENN_TO_UNIVERSAL[tag] || 'X',
      confidence: Math.min(1, Math.max(0, confidence))
    };
  });
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeTagDistribution(tagged: TaggedWord[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const { tag } of tagged) {
    dist[tag] = (dist[tag] || 0) + 1;
  }
  return dist;
}

function extractPhrases(tagged: TaggedWord[]): { nounPhrases: string[]; verbPhrases: string[] } {
  const nounPhrases: string[] = [];
  const verbPhrases: string[] = [];

  let currentNP: string[] = [];
  let currentVP: string[] = [];

  for (const { word, tag } of tagged) {
    // Noun phrase: DT? JJ* NN+
    if (['DT', 'JJ', 'JJR', 'JJS'].includes(tag)) {
      currentNP.push(word);
    } else if (['NN', 'NNS', 'NNP', 'NNPS'].includes(tag)) {
      currentNP.push(word);
    } else {
      if (currentNP.length > 0 && currentNP.some(w => {
        const t = tagged.find(x => x.word === w);
        return t && ['NN', 'NNS', 'NNP', 'NNPS'].includes(t.tag);
      })) {
        nounPhrases.push(currentNP.join(' '));
      }
      currentNP = [];
    }

    // Verb phrase: MD? RB* VB*
    if (['MD', 'RB', 'RBR', 'RBS'].includes(tag)) {
      currentVP.push(word);
    } else if (['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'].includes(tag)) {
      currentVP.push(word);
    } else {
      if (currentVP.length > 0 && currentVP.some(w => {
        const t = tagged.find(x => x.word === w);
        return t && ['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'].includes(t.tag);
      })) {
        verbPhrases.push(currentVP.join(' '));
      }
      currentVP = [];
    }
  }

  // Don't forget trailing phrases
  if (currentNP.length > 0) nounPhrases.push(currentNP.join(' '));
  if (currentVP.length > 0) verbPhrases.push(currentVP.join(' '));

  return { nounPhrases, verbPhrases };
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const postaggerTool: UnifiedTool = {
  name: 'pos_tagger',
  description: 'Part-of-speech tagging for natural language text',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['tag', 'analyze', 'tagset', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Text to tag'
      },
      tagset: {
        type: 'string',
        enum: ['penn', 'universal'],
        description: 'Tag set to use (default: penn)'
      }
    },
    required: ['operation']
  }
};

export async function executepostagger(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, tagset = 'penn' } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Part-of-Speech Tagger',
        description: 'Tag words with their grammatical parts of speech',
        operations: {
          tag: 'Tag text with POS labels',
          analyze: 'Tag and analyze text structure',
          tagset: 'List available tags and their meanings'
        },
        tagsets: {
          penn: 'Penn Treebank tagset (36 tags)',
          universal: 'Universal Dependencies tagset (17 tags)'
        },
        algorithm: 'Hidden Markov Model with Viterbi decoding',
        features: [
          'Lexicon-based word tagging',
          'Suffix rules for unknown words',
          'Bigram transition probabilities',
          'Noun and verb phrase extraction'
        ]
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Tagset operation
    if (operation === 'tagset') {
      const tags = tagset === 'universal' ? UNIVERSAL_TAGS : PENN_TAGS;
      return { toolCallId: id, content: JSON.stringify({
        operation: 'tagset',
        tagset: tagset === 'universal' ? 'universal' : 'penn',
        tagCount: Object.keys(tags).length,
        tags: Object.entries(tags).map(([tag, desc]) => ({ tag, description: desc }))
      }, null, 2) };
    }

    // Tag operation
    if (operation === 'tag') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for tagging', isError: true };
      }

      const words = tokenize(text);
      const tagged = viterbiTag(words);

      const result = tagset === 'universal'
        ? tagged.map(t => ({ word: t.word, tag: t.universal, confidence: Math.round(t.confidence * 100) / 100 }))
        : tagged.map(t => ({ word: t.word, tag: t.tag, confidence: Math.round(t.confidence * 100) / 100 }));

      return { toolCallId: id, content: JSON.stringify({
        operation: 'tag',
        tagset: tagset === 'universal' ? 'universal' : 'penn',
        input: {
          text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          wordCount: words.length
        },
        output: {
          tagged: result.slice(0, 50),
          ...(result.length > 50 ? { truncated: true } : {})
        },
        formatted: result.slice(0, 30).map(t => `${t.word}/${t.tag}`).join(' ')
      }, null, 2) };
    }

    // Analyze operation
    if (operation === 'analyze') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for analysis', isError: true };
      }

      const words = tokenize(text);
      const tagged = viterbiTag(words);
      const distribution = analyzeTagDistribution(tagged);
      const { nounPhrases, verbPhrases } = extractPhrases(tagged);

      const universalDist: Record<string, number> = {};
      for (const { tag } of tagged) {
        const uTag = PENN_TO_UNIVERSAL[tag] || 'X';
        universalDist[uTag] = (universalDist[uTag] || 0) + 1;
      }

      return { toolCallId: id, content: JSON.stringify({
        operation: 'analyze',
        input: {
          text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          wordCount: words.length,
          sentenceEstimate: (text.match(/[.!?]+/g) || []).length || 1
        },
        tagDistribution: {
          penn: distribution,
          universal: universalDist
        },
        phrases: {
          nounPhrases: nounPhrases.slice(0, 10),
          verbPhrases: verbPhrases.slice(0, 10),
          nounPhraseCount: nounPhrases.length,
          verbPhraseCount: verbPhrases.length
        },
        statistics: {
          contentWords: (distribution['NN'] || 0) + (distribution['NNS'] || 0) +
                        (distribution['VB'] || 0) + (distribution['VBD'] || 0) +
                        (distribution['VBG'] || 0) + (distribution['VBN'] || 0) +
                        (distribution['VBP'] || 0) + (distribution['VBZ'] || 0) +
                        (distribution['JJ'] || 0) + (distribution['RB'] || 0),
          functionWords: (distribution['DT'] || 0) + (distribution['IN'] || 0) +
                         (distribution['CC'] || 0) + (distribution['TO'] || 0) +
                         (distribution['PRP'] || 0) + (distribution['MD'] || 0),
          nounRatio: ((distribution['NN'] || 0) + (distribution['NNS'] || 0) +
                      (distribution['NNP'] || 0)) / words.length,
          verbRatio: ((distribution['VB'] || 0) + (distribution['VBD'] || 0) +
                      (distribution['VBG'] || 0) + (distribution['VBN'] || 0) +
                      (distribution['VBP'] || 0) + (distribution['VBZ'] || 0)) / words.length
        }
      }, null, 2) };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function ispostaggerAvailable(): boolean {
  return true;
}
